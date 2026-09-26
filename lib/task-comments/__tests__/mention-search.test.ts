import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createMentionSearch, type Timers } from '../mention-search';
import { fakeApi, offline } from './fakes';

/** Timers that fire only when the test moves the clock. */
function manualTimers() {
  let now = 0;
  let lastId = 0;
  const queue = new Map<number, { run: () => void; at: number }>();
  const timers: Timers = {
    set(run, ms) {
      lastId += 1;
      queue.set(lastId, { run, at: now + ms });
      return lastId;
    },
    clear(handle) {
      queue.delete(handle as number);
    },
  };
  return {
    timers,
    advance(ms: number) {
      now += ms;
      for (const [id, timer] of [...queue]) {
        if (timer.at > now) continue;
        queue.delete(id);
        timer.run();
      }
    },
    scheduled: () => queue.size,
  };
}

const person = (id: number, fullName: string) => ({ id, full_name: fullName, position: null });
const candidates = (items: ReturnType<typeof person>[], cursor: string | null = null) =>
  ({ ok: true, value: { items, next_cursor: cursor, has_more: cursor !== null } }) as const;

function setup({ honorAbort = true } = {}) {
  const server = fakeApi({ honorAbort });
  const clock = manualTimers();
  const search = createMentionSearch({ api: server.api, taskId: 4, timers: clock.timers });
  return { server, clock, search };
}

describe('mention candidates search', () => {
  it('asks once typing pauses, for what was typed last', () => {
    const { server, clock, search } = setup();
    search.search('и');
    clock.advance(200);
    search.search('ив');
    clock.advance(200);
    search.search('иван ');
    assert.equal(server.calls.length, 0);
    assert.equal(search.getState().loading, true);

    clock.advance(300);
    const call = server.next('searchMentionCandidates');
    assert.deepEqual(call.args, [4, { q: 'иван', limit: 20, cursor: null }]);
  });

  it('shows the answer to the last query only, whatever order the answers arrive in', async () => {
    const { server, clock, search } = setup({ honorAbort: false });
    search.search('ив');
    clock.advance(300);
    const earlier = server.next('searchMentionCandidates');
    search.search('иван');
    assert.equal(earlier.signal?.aborted, true);
    clock.advance(300);
    const later = server.waiting('searchMentionCandidates')[1];

    await later.answer(candidates([person(2, 'Иванов Иван')]));
    await earlier.answer(candidates([person(3, 'Ивлев Пётр')]));

    assert.deepEqual(search.getState(), {
      query: 'иван',
      items: [person(2, 'Иванов Иван')],
      hasMore: false,
      loading: false,
      failure: null,
    });
  });

  it('loads the next page of the same query once, without repeating anyone', async () => {
    const { server, clock, search } = setup();
    search.search('');
    clock.advance(300);
    await server.next('searchMentionCandidates').answer(candidates([person(1, 'А'), person(2, 'Б')], 'next'));

    search.loadMore();
    search.loadMore();
    const call = server.next('searchMentionCandidates');
    assert.deepEqual(call.args, [4, { q: '', limit: 20, cursor: 'next' }]);
    await call.answer(candidates([person(2, 'Б'), person(3, 'В')]));

    assert.deepEqual(search.getState().items.map((item) => item.id), [1, 2, 3]);
    assert.equal(search.getState().hasMore, false);
    search.loadMore();
    assert.equal(server.waiting('searchMentionCandidates').length, 0);
  });

  it('does not ask again for the same query, but does after a failure', async () => {
    const { server, clock, search } = setup();
    search.search('петр');
    clock.advance(300);
    await server.next('searchMentionCandidates').answer({ ok: false, failure: offline() });
    assert.equal(search.getState().failure?.kind, 'offline');

    search.search(' петр ');
    clock.advance(300);
    await server.next('searchMentionCandidates').answer(candidates([person(5, 'Петров Пётр')]));
    search.search('петр');
    clock.advance(300);

    assert.equal(server.calls.length, 2);
    assert.equal(search.getState().failure, null);
  });

  it('does not ask about a query longer than any name the server searches', () => {
    const { server, clock, search } = setup();
    search.search('я'.repeat(101));
    clock.advance(300);
    assert.equal(server.calls.length, 0);
    assert.deepEqual(search.getState().items, []);
    assert.equal(search.getState().loading, false);
  });

  it('cancels the wait and the request when the picker closes', () => {
    const { server, clock, search } = setup();
    search.search('а');
    clock.advance(300);
    search.search('аб');
    search.dispose();
    assert.equal(server.calls[0].signal?.aborted, true);
    assert.equal(clock.scheduled(), 0);
    clock.advance(300);
    assert.equal(server.calls.length, 1);
  });
});
