import assert from 'node:assert/strict';
import test from 'node:test';
import { createAsyncResource } from '../async-resource';

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('a query starts on subscription, publishes its data and keeps snapshots stable between updates', async () => {
  const request = deferred<number[]>();
  let loads = 0;
  const resource = createAsyncResource(() => { loads++; return request.promise; }, [] as number[]);
  const initial = resource.getSnapshot();
  assert.equal(loads, 0);
  assert.equal(resource.getSnapshot(), initial);
  let notifications = 0;
  const unsubscribe = resource.subscribe(() => notifications++);
  assert.equal(loads, 1);
  assert.equal(resource.getSnapshot().loading, true);
  request.resolve([7]); await flush();
  assert.deepEqual(resource.getSnapshot(), { data: [7], loading: false, error: null });
  assert.ok(notifications > 0);
  unsubscribe();
});

test('refresh supersedes both an old success and an old error', async () => {
  for (const fails of [false, true]) {
    const old = deferred<number>(), latest = deferred<number>();
    const pending = [old, latest];
    const resource = createAsyncResource(() => pending.shift()!.promise, 0);
    const unsubscribe = resource.subscribe(() => {});
    const refresh = resource.refresh();
    latest.resolve(2); await refresh;
    if (fails) old.reject(new Error('outdated failure')); else old.resolve(1);
    await flush();
    assert.deepEqual(resource.getSnapshot(), { data: 2, loading: false, error: null });
    unsubscribe();
  }
});

test('unsubscribe prevents a late response from publishing; resubscribe restarts the request', async () => {
  const old = deferred<string>(), current = deferred<string>();
  const pending = [old, current];
  const resource = createAsyncResource(() => pending.shift()!.promise, '');
  const unsubscribe = resource.subscribe(() => {});
  unsubscribe();
  const before = resource.getSnapshot();
  old.resolve('stale'); await flush();
  assert.equal(resource.getSnapshot(), before);
  const stop = resource.subscribe(() => {});
  current.resolve('current'); await flush();
  assert.equal(resource.getSnapshot().data, 'current');
  stop();
});

test('multiple consumers share a request until the last subscription closes', async () => {
  const request = deferred<number>(); let calls = 0;
  const resource = createAsyncResource(() => { calls++; return request.promise; }, 0);
  const first = resource.subscribe(() => {}), second = resource.subscribe(() => {});
  assert.equal(calls, 1); first();
  request.resolve(5); await flush();
  assert.equal(resource.getSnapshot().data, 5);
  second();
});

test('disabled resources neither fetch nor stay loading on refresh', async () => {
  let calls = 0;
  const resource = createAsyncResource(async () => { calls++; return 1; }, 0, false);
  const stop = resource.subscribe(() => {});
  await resource.refresh();
  assert.equal(calls, 0);
  assert.deepEqual(resource.getSnapshot(), { data: 0, loading: false, error: null });
  stop();
});

test('errors stop loading, preserve existing data and can be retried', async () => {
  let fails = true;
  const resource = createAsyncResource(async () => { if (fails) throw new Error('offline'); return ['saved']; }, ['cached']);
  const stop = resource.subscribe(() => {}); await flush();
  assert.deepEqual(resource.getSnapshot(), { data: ['cached'], loading: false, error: 'offline' });
  fails = false; await resource.refresh();
  assert.deepEqual(resource.getSnapshot(), { data: ['saved'], loading: false, error: null });
  stop();
});

test('optimistic updates stay local to their query instance', () => {
  const first = createAsyncResource(async () => ['A'], ['A'], false);
  const second = createAsyncResource(async () => ['B'], ['B'], false);
  first.setData((previous) => [...previous, 'updated']);
  assert.deepEqual(first.getSnapshot().data, ['A', 'updated']);
  assert.deepEqual(second.getSnapshot().data, ['B']);
});
