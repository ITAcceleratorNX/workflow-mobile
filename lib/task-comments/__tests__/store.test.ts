import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createTaskComments, EMPTY_FEED, feedStatus, type TaskCommentsOptions } from '../store';
import type { CommentDraft } from '../types';
import { comment, fakeApi, fakeSession, offline, page, range, serverFailure, tombstone } from './fakes';

const draft = (text: string): CommentDraft => ({ text, mentions: [] });
const ids = (items: { id: string }[]) => items.map((item) => item.id);

function setup({ honorAbort = true, limits }: { honorAbort?: boolean; limits?: TaskCommentsOptions['limits'] } = {}) {
  const server = fakeApi({ honorAbort });
  const auth = fakeSession('7');
  let keys = 0;
  const comments = createTaskComments({
    api: server.api,
    session: auth.session,
    newRequestId: () => `key-${++keys}`,
    limits,
  });
  const feed = (taskId = 1) => comments.store.getState().feeds[taskId] ?? EMPTY_FEED;
  /** Opens the task and answers its first read. */
  async function open(taskId = 1, items = range(1, 3), cursor: string | null = null) {
    const release = comments.retain(taskId);
    const loading = comments.refresh(taskId);
    await server.next('listComments').answer(page(items, { cursor }));
    await loading;
    return release;
  }
  return { server, auth, comments, feed, open };
}

describe('reading the feed', () => {
  it('loads the latest page, oldest first, with the right to write', async () => {
    const { server, comments, feed } = setup();
    comments.retain(1);
    const loading = comments.refresh(1);
    assert.equal(feedStatus(feed()), 'loading');
    const call = server.next('listComments');
    assert.deepEqual(call.args, [1, { limit: 30, before: null }]);

    await call.answer(page(range(71, 100), { cursor: 'c71' }));
    await loading;

    assert.equal(feedStatus(feed()), 'ready');
    assert.deepEqual(ids(feed().items), ids(range(71, 100)));
    assert.equal(feed().olderCursor, 'c71');
    assert.equal(feed().hasOlder, true);
    assert.equal(feed().canComment, true);
    assert.equal(feed().reading, null);
  });

  it('loads older pages above and re-reads everything loaded on refresh: new comments, edits and deletions', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, range(71, 100), 'c71');
    void comments.loadOlder(1);
    let call = server.next('listComments');
    assert.deepEqual(call.args, [1, { limit: 30, before: 'c71' }]);
    await call.answer(page(range(41, 70), { cursor: 'c41' }));
    assert.deepEqual(ids(feed().items), ids(range(41, 100)));

    // Meanwhile three comments were added, #45 edited and #50 deleted.
    void comments.refresh(1);
    call = server.next('listComments');
    assert.deepEqual(call.args, [1, { limit: 60, before: null }], 'as many as loaded, in one request');
    const edited = comment(45, { text: 'Исправлено', version: 2, edited_at: '2026-09-26T12:00:00.000Z' });
    const deleted = tombstone(comment(50));
    const latest = range(44, 103).map((item) => (item.id === '45' ? edited : item.id === '50' ? deleted : item));
    await call.answer(page(latest, { cursor: 'c44' }));
    call = server.next('listComments');
    assert.deepEqual(call.args, [1, { limit: 100, before: 'c44' }], 'down to the oldest loaded comment');
    await call.answer(page(range(1, 43)));

    assert.deepEqual(ids(feed().items), ids(range(1, 103)));
    assert.equal(feed().items[44].text, 'Исправлено');
    assert.equal(feed().items[49].text, null);
    assert.equal(feed().hasOlder, false);
    assert.equal(feed().olderCursor, null);
    assert.equal(server.count('listComments'), 4);
  });

  it('asks once for a refresh already on its way and lets a refresh replace a history page', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, range(71, 100), 'c71');

    void comments.refresh(1);
    void comments.refresh(1);
    assert.equal(server.count('listComments'), 2, 'the second refresh neither asks again nor restarts the first');
    await server.next('listComments').answer(page(range(71, 100), { cursor: 'c71' }));

    void comments.loadOlder(1);
    const older = server.next('listComments');
    void comments.refresh(1);
    assert.equal(older.signal?.aborted, true);
    await server.next('listComments').answer(page(range(71, 101), { cursor: 'c71' }));
    assert.deepEqual(ids(feed().items), ids(range(71, 101)));
    assert.equal(feed().olderCursor, 'c71');
    assert.equal(server.waiting('listComments').length, 0);
  });

  it('ignores an answer that arrives after its read was replaced, even when the network did not stop it', async () => {
    const { server, comments, feed, open } = setup({ honorAbort: false });
    await open(1, range(71, 100), 'c71');
    void comments.loadOlder(1);
    const [older] = server.waiting('listComments');
    void comments.refresh(1);
    const latest = server.waiting('listComments')[1];

    await older.answer(page(range(41, 70), { cursor: 'c41' }));
    assert.deepEqual(ids(feed().items), ids(range(71, 100)));
    assert.equal(feed().reading, 'latest');

    await latest.answer(page(range(71, 101), { cursor: 'c71' }));
    assert.deepEqual(ids(feed().items), ids(range(71, 101)));
    assert.equal(feed().olderCursor, 'c71');
    assert.equal(feed().reading, null);
  });

  it('keeps each task apart when answers arrive crosswise', async () => {
    const { server, comments, feed } = setup();
    comments.retain(1);
    comments.retain(2);
    void comments.refresh(1);
    void comments.refresh(2);
    const [first, second] = server.waiting('listComments');
    assert.deepEqual([first.args[0], second.args[0]], [1, 2]);

    await second.answer(page([comment(5, { task_id: 2 })], { canComment: false }));
    await first.answer(page([comment(3)]));

    assert.deepEqual(ids(feed(1).items), ['3']);
    assert.equal(feed(1).canComment, true);
    assert.deepEqual(ids(feed(2).items), ['5']);
    assert.equal(feed(2).canComment, false);
  });

  it('cancels the read of a closed card: its late answer lands nowhere', async () => {
    const { server, comments, feed } = setup({ honorAbort: false });
    const release = comments.retain(1);
    void comments.refresh(1);
    const call = server.next('listComments');
    release();
    assert.equal(call.signal?.aborted, true);
    assert.equal(feed().reading, null);

    await call.answer(page([comment(1)]));
    assert.deepEqual(feed().items, []);
    assert.equal(feed().loaded, false);
  });

  it('keeps what was loaded when the network fails, showing the failure', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    void comments.refresh(1);
    await server.next('listComments').answer({ ok: false, failure: offline() });

    assert.equal(feedStatus(feed()), 'ready');
    assert.deepEqual(ids(feed().items), ['1', '2', '3']);
    assert.equal(feed().readError?.kind, 'offline');

    void comments.refresh(1);
    await server.next('listComments').answer(page(range(1, 3)));
    assert.equal(feed().readError, null);
  });

  it('starts from the latest comments when the history cursor stopped fitting', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, range(71, 100), 'c71');
    void comments.loadOlder(1);
    await server.next('listComments').answer({ ok: false, failure: serverFailure(400, 'INVALID_CURSOR') });

    const call = server.next('listComments');
    assert.deepEqual(call.args, [1, { limit: 30, before: null }]);
    await call.answer(page(range(71, 100), { cursor: 'n71' }));
    assert.equal(feed().olderCursor, 'n71');
    assert.equal(feed().readError, null);
  });
});

describe('memory limits', () => {
  it('stops loading history at the limit and, on refresh, keeps the newest comments without a gap', async () => {
    const { server, comments, feed, open } = setup({ limits: { pageSize: 2, maxLoaded: 4 } });
    await open(1, range(9, 10), 'c9');
    void comments.loadOlder(1);
    await server.next('listComments').answer(page(range(7, 8), { cursor: 'c7' }));
    assert.equal(feed().historyLimited, true);
    assert.equal(feed().hasOlder, true);

    await comments.loadOlder(1);
    assert.equal(server.waiting('listComments').length, 0, 'no request past the limit');

    // Four new comments: the refresh reads the newest four and stops there.
    void comments.refresh(1);
    const call = server.next('listComments');
    assert.deepEqual(call.args, [1, { limit: 4, before: null }]);
    await call.answer(page(range(11, 14), { cursor: 'c11' }));
    assert.equal(server.waiting('listComments').length, 0);
    assert.deepEqual(ids(feed().items), ids(range(11, 14)));
    assert.equal(feed().olderCursor, 'c11');
  });

  it('forgets the least recently used closed tasks, never one with an unsent message', async () => {
    const { server, comments, feed, open } = setup({ limits: { maxCachedTasks: 2 } });
    for (const taskId of [1, 2, 3]) (await open(taskId, [comment(taskId, { task_id: taskId })]))();
    assert.deepEqual(Object.keys(comments.store.getState().feeds), ['2', '3']);

    const release = await open(4, []);
    void comments.send(4, draft('Не ушло'));
    await server.next('createComment').answer({ ok: false, failure: offline() });
    release();
    for (const taskId of [5, 6]) (await open(taskId, []))();

    assert.deepEqual(Object.keys(comments.store.getState().feeds).sort(), ['4', '6']);
    assert.equal(feed(4).pending[0].draft.text, 'Не ушло');
  });
});

describe('sending', () => {
  it('shows the message as sending, then puts the comment in the feed and re-reads it', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    const sending = comments.send(1, { text: '@Петров посмотрите', mentions: [{ user_id: 9, start: 0, end: 7 }] });
    assert.deepEqual(
      feed().pending.map(({ status, requestId }) => ({ status, requestId })),
      [{ status: 'sending', requestId: 'key-1' }]
    );
    const call = server.next('createComment');
    assert.deepEqual(call.args, [1, { text: '@Петров посмотрите', mentions: [{ user_id: 9, start: 0, end: 7 }] }, 'key-1']);

    const created = comment(4, { text: '@Петров посмотрите' });
    await call.answer({ ok: true, value: { comment: created, replayed: false } });

    assert.deepEqual(await sending, { ok: true, comment: created });
    assert.deepEqual(feed().pending, []);
    assert.deepEqual(ids(feed().items), ['1', '2', '3', '4']);
    assert.equal(server.waiting('listComments').length, 1, 'own action refreshes the feed');
  });

  it('keeps the message and its key after a network failure and retries with the same key', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    const first = comments.send(1, draft('Привет'));
    await server.next('createComment').answer({ ok: false, failure: offline() });

    const outcome = await first;
    assert.equal(outcome.ok, false);
    assert.equal(!outcome.ok && outcome.failure.kind, 'offline');
    const [unsent] = feed().pending;
    assert.equal(unsent.status, 'failed');
    assert.equal(unsent.draft.text, 'Привет');

    const retrying = comments.retry(1, unsent.localId);
    const call = server.next('createComment');
    assert.equal(call.args[2], 'key-1');
    await call.answer({ ok: true, value: { comment: comment(4, { text: 'Привет' }), replayed: true } });
    assert.equal((await retrying).ok, true);
    assert.deepEqual(feed().pending, []);
    assert.deepEqual(ids(feed().items), ['1', '2', '3', '4']);
  });

  it('sends one request for a double tap, and the same text sent after a failure is the same message', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    const first = comments.send(1, draft('Ок'));
    const second = comments.send(1, draft('Ок'));
    assert.equal(server.count('createComment'), 1);
    await server.next('createComment').answer({ ok: false, failure: offline() });
    assert.deepEqual(await first, await second);

    void comments.send(1, draft('Ок'));
    assert.equal(server.next('createComment').args[2], 'key-1');
    assert.equal(feed().pending.length, 1);
  });

  it('takes a new key only when the server says the old one holds other content', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    void comments.send(1, draft('Текст'));
    await server.next('createComment').answer({ ok: false, failure: serverFailure(409, 'IDEMPOTENCY_CONFLICT') });
    const [unsent] = feed().pending;
    assert.equal(unsent.requestId, 'key-2');

    void comments.retry(1, unsent.localId);
    assert.equal(server.next('createComment').args[2], 'key-2');
  });

  it('gives an unsent message back for editing and forgets it', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    const sending = comments.send(1, draft('Черновик'));
    const { localId } = feed().pending[0];
    assert.equal(comments.discard(1, localId), null, 'not while it is on its way');
    await server.next('createComment').answer({ ok: false, failure: serverFailure(409, 'MENTION_NOT_AVAILABLE') });
    await sending;

    assert.deepEqual(comments.discard(1, localId), draft('Черновик'));
    assert.deepEqual(feed().pending, []);
  });

  it('closes writing when the server answers that the task is read only, and re-reads the rights', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    void comments.send(1, draft('Привет'));
    await server
      .next('createComment')
      .answer({ ok: false, failure: serverFailure(403, 'COMMENT_WRITE_FORBIDDEN', 'Задача доступна только для чтения') });

    assert.equal(feed().canComment, false);
    assert.equal(feed().pending[0].failure?.kind, 'read_only');
    assert.equal(feed().pending[0].failure?.message, 'Задача доступна только для чтения');
    assert.equal(server.waiting('listComments').length, 1);
  });

  it('clears what was read when the task is no longer visible, keeping own unsent messages', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    void comments.send(1, draft('Черновик'));
    await server.next('createComment').answer({ ok: false, failure: offline() });
    void comments.refresh(1);
    await server.next('listComments').answer({ ok: false, failure: serverFailure(404, 'TASK_NOT_FOUND') });

    assert.equal(feedStatus(feed()), 'unavailable');
    assert.deepEqual(feed().items, []);
    assert.equal(feed().canComment, false);
    assert.equal(feed().pending[0].draft.text, 'Черновик');
  });

  it('lets a sent message finish after the card closes', async () => {
    const { server, comments, feed, open } = setup();
    const release = await open();
    const sending = comments.send(1, draft('Уже ушло'));
    release();
    const call = server.next('createComment');
    assert.equal(call.signal?.aborted, false);

    await call.answer({ ok: true, value: { comment: comment(4, { text: 'Уже ушло' }), replayed: false } });
    assert.equal((await sending).ok, true);
    assert.deepEqual(ids(feed().items), ['1', '2', '3', '4']);
    assert.equal(server.waiting('listComments').length, 0, 'no refresh for a closed card');
  });
});

describe('editing and deleting', () => {
  it('edits by the version on screen and keeps the newer version when an older answer arrives later', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, [comment(1)]);
    void comments.refresh(1);
    const editing = comments.edit(1, '1', draft('Новый текст'));
    assert.deepEqual(feed().changing, { 1: 'edit' });
    const call = server.next('editComment');
    assert.deepEqual(call.args, [1, '1', draft('Новый текст'), 1]);

    await call.answer({ ok: true, value: comment(1, { text: 'Новый текст', version: 2 }) });
    assert.equal((await editing).ok, true);
    // The refresh began before the edit and answers with the version it read then.
    await server.next('listComments').answer(page([comment(1)]));

    assert.equal(feed().items[0].text, 'Новый текст');
    assert.equal(feed().items[0].version, 2);
    assert.deepEqual(feed().changing, {});
  });

  it('re-reads the feed on a version conflict and reports it, the other device’s text on screen', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, [comment(1)]);
    const editing = comments.edit(1, '1', draft('Мой вариант'));
    await server
      .next('editComment')
      .answer({ ok: false, failure: serverFailure(409, 'COMMENT_VERSION_CONFLICT', 'Комментарий уже изменён: обновите ленту') });
    await server.next('listComments').answer(page([comment(1, { text: 'С другого устройства', version: 2 })]));

    const outcome = await editing;
    assert.equal(outcome.ok, false);
    assert.equal(!outcome.ok && outcome.failure.kind, 'stale');
    assert.equal(!outcome.ok && outcome.failure.code, 'COMMENT_VERSION_CONFLICT');
    assert.equal(feed().items[0].text, 'С другого устройства');
  });

  it('counts a conflict as success when the comment already holds the edit: the first answer was lost', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, [comment(1)]);
    const first = comments.edit(1, '1', draft('Новый текст'));
    await server.next('editComment').answer({ ok: false, failure: offline() });
    assert.equal((await first).ok, false);

    const second = comments.edit(1, '1', draft('Новый текст'));
    assert.equal(server.next('editComment').args[3], 1);
    await server.next('editComment').answer({ ok: false, failure: serverFailure(409, 'COMMENT_VERSION_CONFLICT') });
    await server.next('listComments').answer(page([comment(1, { text: 'Новый текст', version: 2 })]));

    const outcome = await second;
    assert.equal(outcome.ok, true);
    assert.equal(outcome.ok && outcome.comment.version, 2);
    assert.equal(feed().items[0].version, 2);
  });

  it('asks once for a double tap and queues another change of the comment after the running one', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, [comment(1)]);
    const editing = comments.edit(1, '1', draft('Раз'));
    const again = comments.edit(1, '1', draft('Раз'));
    const deleting = comments.remove(1, '1');
    assert.equal(server.count('editComment'), 1);
    assert.equal(server.count('deleteComment'), 0, 'the deletion waits for the edit');

    await server.next('editComment').answer({ ok: true, value: comment(1, { text: 'Раз', version: 2 }) });
    assert.deepEqual(await again, await editing);
    const call = server.next('deleteComment');
    assert.deepEqual(call.args, [1, '1', 2], 'with the version the edit left');
    await call.answer({ ok: true, value: tombstone(comment(1, { version: 2 })) });

    assert.equal((await deleting).ok, true);
    assert.notEqual(feed().items[0].deleted_at, null);
    assert.deepEqual(feed().changing, {});
  });

  it('puts the tombstone in place of a deleted comment', async () => {
    const { server, comments, feed, open } = setup();
    await open();
    const deleting = comments.remove(1, '2');
    assert.deepEqual(feed().changing, { 2: 'delete' });
    const call = server.next('deleteComment');
    assert.deepEqual(call.args, [1, '2', 1]);
    await call.answer({ ok: true, value: tombstone(comment(2)) });

    assert.equal((await deleting).ok, true);
    assert.deepEqual(ids(feed().items), ['1', '2', '3']);
    assert.equal(feed().items[1].text, null);
    assert.notEqual(feed().items[1].deleted_at, null);
  });

  it('re-reads the rights when the comment is not the user’s', async () => {
    const { server, comments, feed, open } = setup();
    await open(1, [comment(1)]);
    const editing = comments.edit(1, '1', draft('Чужое'));
    await server.next('editComment').answer({ ok: false, failure: serverFailure(403, 'COMMENT_NOT_OWNED') });
    await server.next('listComments').answer(page([comment(1, { permissions: { can_edit: false, can_delete: false } })]));

    const outcome = await editing;
    assert.equal(!outcome.ok && outcome.failure.kind, 'forbidden');
    assert.equal(feed().items[0].permissions.can_edit, false);
  });

  it('does not ask the server about a comment the feed does not have', async () => {
    const { server, comments, open } = setup();
    await open();
    const outcome = await comments.edit(1, '99', draft('Текст'));
    assert.equal(!outcome.ok && outcome.failure.kind, 'stale');
    assert.equal(server.count('editComment'), 0);
  });
});

describe('the session', () => {
  it('forgets everything and ignores answers of the previous user when the user changes', async () => {
    const { server, auth, comments, feed, open } = setup({ honorAbort: false });
    await open();
    void comments.refresh(1);
    const sending = comments.send(1, draft('Привет'));
    const read = server.next('listComments');
    const create = server.next('createComment');

    auth.signIn('8');
    assert.deepEqual(comments.store.getState().feeds, {});
    assert.equal(read.signal?.aborted, true);
    assert.equal(create.signal?.aborted, true);

    await read.answer(page([comment(200)]));
    await create.answer({ ok: true, value: { comment: comment(201), replayed: false } });
    assert.deepEqual(comments.store.getState().feeds, {});
    assert.equal((await sending).ok, false);

    void comments.refresh(1);
    await server.next('listComments').answer(page([comment(300)]));
    assert.deepEqual(ids(feed().items), ['300']);
  });

  it('asks nothing without a signed-in user', async () => {
    const { server, auth, comments } = setup();
    auth.signIn(null);
    comments.retain(1);
    await comments.refresh(1);
    const outcome = await comments.send(1, draft('Привет'));

    assert.equal(server.calls.length, 0);
    assert.equal(!outcome.ok && outcome.failure.kind, 'unauthenticated');
  });
});
