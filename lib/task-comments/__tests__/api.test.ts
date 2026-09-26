import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { RequestFailure } from '@/lib/api-errors';

import { createTaskCommentsApi, type Transport } from '../api';
import { comment } from './fakes';

type Sent = { path: string; method?: string; params?: Record<string, string>; body?: unknown; signal: AbortSignal };
type Answer = { ok: true; data: unknown } | RequestFailure;

/** A transport that records requests and answers them from the list, or waits until cancelled. */
function fakeTransport(answers: (Answer | 'wait')[] = []) {
  const sent: Sent[] = [];
  const transport: Transport = <T>(path: string, init: Parameters<Transport>[1]) => {
    sent.push({ ...init, path, body: init.body === undefined ? undefined : JSON.parse(init.body) });
    const answer = answers.shift() ?? { ok: true, data: {} };
    if (answer !== 'wait') return Promise.resolve(answer as { ok: true; data: T } | RequestFailure);
    return new Promise((resolve) => {
      init.signal.addEventListener('abort', () => resolve({ ok: false, error: 'Запрос отменён', aborted: true }));
    });
  };
  return { transport, sent };
}

const pageBody = { items: [comment(1)], next_cursor: 'c1', has_more: true, permissions: { can_comment: true } };

describe('requests of the comment API', () => {
  it('asks for the pages, writes and candidates the contract describes', async () => {
    const { transport, sent } = fakeTransport([
      { ok: true, data: pageBody },
      { ok: true, data: pageBody },
      { ok: true, data: { comment: comment(2), replayed: false } },
      { ok: true, data: { comment: comment(2) } },
      { ok: true, data: { comment: comment(2) } },
      { ok: true, data: { items: [], next_cursor: null, has_more: false } },
      { ok: true, data: { items: [], next_cursor: null, has_more: false } },
    ]);
    const api = createTaskCommentsApi(transport);
    const mentions = [{ user_id: 9, start: 0, end: 7, label: 'Петров' }];

    await api.listComments(5, { limit: 30 });
    await api.listComments(5, { limit: 30, before: 'cursor' });
    await api.createComment(5, { text: '@Петров привет', mentions }, 'key');
    await api.editComment(5, '12', { text: '@Петров привет!', mentions }, 3);
    await api.deleteComment(5, '12', 4);
    await api.searchMentionCandidates(5, { q: 'иван', limit: 20, cursor: 'next' });
    await api.searchMentionCandidates(5, { q: '' });

    assert.deepEqual(
      sent.map(({ path, method, params, body }) => ({ path, method, params, body })),
      [
        { path: '/user-tasks/5/comments', method: undefined, params: { limit: '30' }, body: undefined },
        { path: '/user-tasks/5/comments', method: undefined, params: { limit: '30', before: 'cursor' }, body: undefined },
        {
          path: '/user-tasks/5/comments',
          method: 'POST',
          params: undefined,
          // Только поля контракта: подпись упоминания сервер отклонил бы как неизвестное поле.
          body: { text: '@Петров привет', mentions: [{ user_id: 9, start: 0, end: 7 }], client_request_id: 'key' },
        },
        {
          path: '/user-tasks/5/comments/12',
          method: 'PATCH',
          params: undefined,
          body: { text: '@Петров привет!', mentions: [{ user_id: 9, start: 0, end: 7 }], version: 3 },
        },
        { path: '/user-tasks/5/comments/12', method: 'DELETE', params: { version: '4' }, body: undefined },
        {
          path: '/user-tasks/5/mention-candidates',
          method: undefined,
          params: { q: 'иван', limit: '20', cursor: 'next' },
          body: undefined,
        },
        { path: '/user-tasks/5/mention-candidates', method: undefined, params: {}, body: undefined },
      ]
    );
  });

  it('returns only the fields of the contract and refuses an answer of another shape', async () => {
    const extra = { ...pageBody, secret: 'x', items: [{ ...comment(1), author: { id: 7, full_name: 'Иванов Иван', phone: '+7' } }] };
    const { transport } = fakeTransport([
      { ok: true, data: extra },
      { ok: true, data: { ...pageBody, items: [{ ...comment(1), id: 12 }] } },
      { ok: true, data: '<html>' },
      { ok: true, data: { comment: comment(1) } },
    ]);
    const api = createTaskCommentsApi(transport);

    const read = await api.listComments(1, { limit: 30 });
    assert.equal(read.ok, true);
    assert.deepEqual(read.ok && read.value, { ...pageBody, items: [comment(1)] });

    for (const answer of [await api.listComments(1, { limit: 30 }), await api.listComments(1, { limit: 30 })]) {
      assert.equal(!answer.ok && answer.failure.kind, 'server');
      assert.equal(!answer.ok && answer.failure.code, null);
    }
    const created = await api.createComment(1, { text: 'Текст', mentions: [] }, 'key');
    assert.equal(!created.ok && created.failure.kind, 'server', 'no `replayed`: not a creation answer');
  });

  it('passes on what the server said went wrong', async () => {
    const { transport } = fakeTransport([
      { ok: false, error: 'Комментарий уже изменён: обновите ленту', status: 409, code: 'COMMENT_VERSION_CONFLICT' },
    ]);
    const answer = await createTaskCommentsApi(transport).editComment(1, '1', { text: 'Текст', mentions: [] }, 1);
    assert.equal(answer.ok, false);
    assert.deepEqual(!answer.ok && [answer.failure.kind, answer.failure.code, answer.failure.message], [
      'stale',
      'COMMENT_VERSION_CONFLICT',
      'Комментарий уже изменён: обновите ленту',
    ]);
  });

  it('gives up on a request the server does not answer in time, as on a lost network', async () => {
    const { transport, sent } = fakeTransport(['wait']);
    const answer = await createTaskCommentsApi(transport, { timeoutMs: 5 }).createComment(1, { text: 'Текст', mentions: [] }, 'key');
    assert.equal(sent[0].signal.aborted, true);
    assert.deepEqual(!answer.ok && [answer.failure.kind, answer.failure.message], ['offline', 'Сервер не ответил вовремя. Повторите']);
  });

  it('cancels at the caller’s request and does not send what is already cancelled', async () => {
    const { transport, sent } = fakeTransport(['wait']);
    const api = createTaskCommentsApi(transport);
    const controller = new AbortController();
    const reading = api.listComments(1, { limit: 30 }, controller.signal);
    controller.abort();
    const answer = await reading;
    assert.equal(sent[0].signal.aborted, true);
    assert.equal(!answer.ok && answer.failure.kind, 'cancelled');

    const late = await api.listComments(1, { limit: 30 }, controller.signal);
    assert.equal(!late.ok && late.failure.kind, 'cancelled');
    assert.equal(sent.length, 1);
  });

  it('does not take a response cut short by cancellation for an answer', async () => {
    const controller = new AbortController();
    // `request` reads the body with `.catch(() => ({}))`: a cancelled read still looks like success.
    const transport: Transport = async () => {
      controller.abort();
      return { ok: true, data: {} } as never;
    };
    const answer = await createTaskCommentsApi(transport).createComment(1, { text: 'Текст', mentions: [] }, 'key', controller.signal);
    assert.equal(!answer.ok && answer.failure.kind, 'cancelled');
  });
});
