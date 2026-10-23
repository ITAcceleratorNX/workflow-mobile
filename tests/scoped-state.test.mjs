import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import ts from 'typescript';

const compiled = ts.transpileModule(readFileSync(new URL('../hooks/use-scoped-state.ts', import.meta.url), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

// Exercise the actual hook with deterministic useState/useCallback semantics.
function mount(key, initial) {
  const slots = [];
  let cursor = 0, dirty = false, value;
  const react = {
    useState(init) {
      const index = cursor++;
      if (!slots[index]) {
        slots[index] = { value: typeof init === 'function' ? init() : init };
        slots[index].set = (action) => {
          const next = typeof action === 'function' ? action(slots[index].value) : action;
          if (!Object.is(next, slots[index].value)) { slots[index].value = next; dirty = true; }
        };
      }
      return [slots[index].value, slots[index].set];
    },
    useCallback(fn, dependencies) {
      const index = cursor++;
      if (!slots[index] || !dependencies.every((item, i) => Object.is(item, slots[index].dependencies[i]))) {
        slots[index] = { dependencies, fn };
      }
      return slots[index].fn;
    },
  };
  const module = { exports: {} };
  vm.runInNewContext(compiled, { module, exports: module.exports, require: () => react });
  const render = () => {
    for (let i = 0; i < 10; i++) {
      cursor = 0; dirty = false;
      value = module.exports.useScopedState(key, initial);
      if (!dirty) return;
    }
    assert.fail('State reset must stabilize');
  };
  render();
  return {
    get value() { return value[0]; },
    get setter() { return value[1]; },
    change(nextKey, nextInitial) { key = nextKey; initial = nextInitial; render(); },
    update(action) { value[1](action); render(); },
    render,
  };
}

test('form drafts survive unrelated rerenders but reset for another record and on reopening', () => {
  const form = mount('open:record-1', 'server title');
  const setter = form.setter;
  form.update('unsaved draft');
  form.change('open:record-1', 'server title');
  assert.equal(form.value, 'unsaved draft');
  assert.equal(form.setter, setter);
  form.change('open:record-2', 'second title');
  assert.equal(form.value, 'second title');
  form.change('closed:record-2', 'second title');
  form.change('open:record-2', 'second title');
  assert.equal(form.value, 'second title');
});

test('late updates from a previous form are rejected even after returning to the same record', () => {
  const form = mount('A', 0);
  const oldSetter = form.setter;
  form.change('B', 10);
  oldSetter(99); form.render();
  assert.equal(form.value, 10);
  form.change('A', 1);
  oldSetter(99); form.render();
  assert.equal(form.value, 1);
  form.update((previous) => previous + 1);
  assert.equal(form.value, 2);
});

test('initializers run only on mount or a scope change, not while typing', () => {
  let initializations = 0;
  const initialize = () => { initializations++; return ''; };
  const form = mount('A', initialize);
  form.update('draft'); form.render(); form.change('A', initialize);
  assert.equal(initializations, 1);
  form.change('B', initialize);
  assert.equal(initializations, 2);
});
