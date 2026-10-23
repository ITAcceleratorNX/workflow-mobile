import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../hooks/use-todo-list.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

const compiledScopedState = ts.transpileModule(readFileSync(new URL('../hooks/use-scoped-state.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

// Controlled lifecycle and deferred requests: no sleeps or network timing assumptions.
function harness(initialQuery) {
  const slots = [], requests = [];
  let cursor = 0, dirty = false, effects = [], query = initialQuery, result;
  const auth = { token: 'test-only', isGuest: false };
  const invalidation = { version: 0, bump: () => { invalidation.version++; dirty = true; } };
  const same = (a, b) => a && b && a.length === b.length && a.every((value, i) => Object.is(value, b[i]));
  const react = {
    useState(initial) {
      const i = cursor++;
      slots[i] ??= { value: typeof initial === 'function' ? initial() : initial };
      return [slots[i].value, (next) => {
        const value = typeof next === 'function' ? next(slots[i].value) : next;
        if (!Object.is(value, slots[i].value)) { slots[i].value = value; dirty = true; }
      }];
    },
    useRef(initial) { const i = cursor++; slots[i] ??= { current: initial }; return slots[i]; },
    useMemo(factory, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) slots[i] = { deps, value: factory() };
      return slots[i].value;
    },
    useCallback(callback, deps) { return react.useMemo(() => callback, deps); },
    useEffect(effect, deps) {
      const i = cursor++;
      if (!same(slots[i]?.deps, deps)) {
        slots[i] = { deps, cleanup: slots[i]?.cleanup };
        effects.push({ i, effect });
      }
    },
  };
  const toast = () => {};
  const dependencies = {
    react,
    '@/lib/user-tasks-api': { getUserTasks: (params) => new Promise((resolve) => requests.push({ params, resolve })) },
    '@/lib/task-recurrence': {}, '@/lib/group-task-completion': {}, '@/lib/recurring-completion': {}, '@/lib/task-recipients-api': {},
    '@/stores/auth-store': { useAuthStore: (select) => select(auth) },
    '@/stores/user-tasks-invalidate-store': { useUserTasksInvalidateStore: (select) => select(invalidation) },
    '@/context/toast-context': { useToast: () => ({ show: toast }) },
  };
  const scopedState = { exports: {} };
  vm.runInNewContext(compiledScopedState, { module: scopedState, exports: scopedState.exports, require: (id) => dependencies[id] });
  dependencies['@/hooks/use-scoped-state'] = scopedState.exports;
  const loaded = { exports: {} };
  vm.runInNewContext(compiled, { module: loaded, exports: loaded.exports, require: (id) => dependencies[id] });
  function render() {
    for (let attempts = 0; attempts < 50; attempts++) {
      dirty = false; cursor = 0;
      result = loaded.exports.useTodoList({ ...query });
      const pending = effects; effects = [];
      for (const { i } of pending) slots[i].cleanup?.();
      for (const { i, effect } of pending) slots[i].cleanup = effect();
      if (!dirty) return;
    }
    assert.fail('Hook did not stabilize');
  }
  render();
  return {
    requests,
    get hook() { return result; },
    query(next) { query = next; render(); },
    invalidate() { invalidation.bump(); render(); },
    logout() { auth.token = null; render(); },
    async respond(index, response) {
      requests[index].resolve(response);
      for (let i = 0; i < 6; i++) await Promise.resolve();
      render();
    },
  };
}
const page = (ids, number = 1, totalPages = 1) => ({ ok: true, data: { tasks: ids.map((id) => ({ id })), total: totalPages * 2, page: number, pageSize: 2, totalPages } });
const ids = (scenario) => Array.from(scenario.hook.tasks, (task) => task.id);

test('query/sort changes discard old results and restart from page one', async () => {
  const s = harness({ view: 'inbox', pageSize: 2 });
  s.query({ view: 'list_today', today: '2026-10-23', sortBy: 'priority', sortDirection: 'asc', pageSize: 2 });
  assert.equal(s.requests.length, 2, 'inline query identity does not refetch in a loop');
  assert.equal(s.requests[1].params.page, 1);
  assert.equal(s.requests[1].params.sort_by, 'priority');
  assert.equal(s.requests[1].params.sort_direction, 'asc');
  await s.respond(1, page([3, 2]));
  await s.respond(0, page([99]));
  assert.deepEqual(ids(s), [3, 2]);
  assert.equal(s.hook.loading, false);
});

test('stale errors cannot replace a successful sorted result', async () => {
  const s = harness({ view: 'inbox' });
  s.query({ view: 'inbox', sortBy: 'deadline', sortDirection: 'desc' });
  await s.respond(1, page([2]));
  await s.respond(0, { ok: false, error: 'old failure' });
  assert.deepEqual(ids(s), [2]);
  assert.equal(s.hook.error, null);
});

test('rapid load-more calls issue one request and preserve order without duplicates', async () => {
  const s = harness({ view: 'inbox', sortBy: 'created_at', sortDirection: 'desc', pageSize: 2 });
  await s.respond(0, page([5, 4], 1, 2));
  void s.hook.loadMore(); void s.hook.loadMore();
  assert.equal(s.requests.length, 2);
  assert.equal(s.requests[1].params.page, 2);
  await s.respond(1, page([4, 3], 2, 2));
  assert.deepEqual(ids(s), [5, 4, 3]);
  assert.equal(s.hook.hasMore, false);
});

test('mutation invalidation supersedes pending pagination', async () => {
  const s = harness({ view: 'inbox', pageSize: 2 });
  await s.respond(0, page([1, 2], 1, 2));
  void s.hook.loadMore(); s.invalidate();
  assert.equal(s.requests.length, 3);
  await s.respond(2, page([8]));
  await s.respond(1, page([3, 4], 2, 2));
  assert.deepEqual(ids(s), [8]);
  assert.equal(s.hook.loadingMore, false);
});

test('day rollover requests the new date and discards yesterday’s response', async () => {
  const s = harness({ view: 'list_today', today: '2026-10-23' });
  s.query({ view: 'list_today', today: '2026-10-24' });
  assert.equal(s.requests[1].params.today, '2026-10-24');
  await s.respond(0, page([1])); assert.deepEqual(ids(s), []);
  await s.respond(1, page([2])); assert.deepEqual(ids(s), [2]);
});

test('logout and disabled calendar view reject responses from the previous list', async () => {
  for (const action of ['logout', 'calendar']) {
    const s = harness({ view: 'inbox' });
    if (action === 'logout') s.logout(); else s.query({ view: 'inbox', enabled: false });
    await s.respond(0, page([1]));
    assert.deepEqual(ids(s), []);
    assert.equal(s.hook.loading, false);
    assert.equal(s.requests.length, 1);
  }
});
