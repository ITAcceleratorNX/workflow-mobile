import { createStore, type StoreApi } from 'zustand/vanilla';

import type { ApiResult, TaskCommentsApi } from './api';
import { localFailure, type TaskCommentFailure } from './errors';
import { applyFresh, compareComments, holdsDraft, mergeComments, sameDraft } from './feed';
import { newRequestId as randomRequestId } from './request-id';
import type { CommentDraft, CommentPage, TaskComment } from './types';

/** Первая страница и догрузка истории — по умолчанию контракта. */
const PAGE_SIZE = 30;
/** Больше сервер не отдаёт за один запрос. */
const MAX_PAGE_SIZE = 100;
/**
 * Сколько комментариев одной задачи держать в памяти; дальше история не догружается.
 * Виртуализация списка экономит отрисовку, но не память, а обновление перечитывает всё загруженное.
 */
const MAX_LOADED = 500;
/** Сколько задач держать в кэше, не считая открытых и тех, где есть неотправленное. */
const MAX_CACHED_TASKS = 5;

/** Своё сообщение, которое сервер ещё не подтвердил. */
export interface PendingComment {
  /** Ключ для списка на экране; на сервер не уходит. */
  localId: string;
  /** `client_request_id` — один на все попытки этого сообщения, поэтому повтор не создаёт копию. */
  requestId: string;
  draft: CommentDraft;
  status: 'sending' | 'failed';
  failure: TaskCommentFailure | null;
}

/** Комментарии одной задачи. */
export interface TaskCommentsFeed {
  /** Загруженные комментарии, сначала старые, каждый один раз. */
  items: TaskComment[];
  /** Хотя бы одна страница пришла. */
  loaded: boolean;
  /** Курсор догрузки более старых. */
  olderCursor: string | null;
  hasOlder: boolean;
  /** Более старые есть, но не догружаются: в памяти уже предел. */
  historyLimited: boolean;
  canComment: boolean;
  /** Задачи нет или она больше не видна: прочитанное убрано, остались только свои неотправленные. */
  unavailable: boolean;
  /** Идущее чтение: самые новые (открытие и обновление) или более старые. */
  reading: 'latest' | 'older' | null;
  /** Последняя ошибка чтения; успешное чтение её убирает. */
  readError: TaskCommentFailure | null;
  pending: PendingComment[];
  /** Комментарии, которые сейчас изменяются или удаляются. */
  changing: Record<string, 'edit' | 'delete'>;
}

export const EMPTY_FEED: TaskCommentsFeed = Object.freeze({
  items: [],
  loaded: false,
  olderCursor: null,
  hasOlder: false,
  historyLimited: false,
  canComment: false,
  unavailable: false,
  reading: null,
  readError: null,
  pending: [],
  changing: {},
});

export type TaskCommentsStatus = 'idle' | 'loading' | 'ready' | 'failed' | 'unavailable';

/** Что показывать вместо ленты или вместе с ней. */
export function feedStatus(feed: TaskCommentsFeed): TaskCommentsStatus {
  if (feed.unavailable) return 'unavailable';
  if (feed.loaded) return 'ready';
  if (feed.reading) return 'loading';
  return feed.readError ? 'failed' : 'idle';
}

export type WriteOutcome = { ok: true; comment: TaskComment } | { ok: false; failure: TaskCommentFailure };

/** Чей кэш. */
export interface CommentSession {
  /** Вошедшая учётная запись; null — никто не вошёл или демо-режим. */
  current(): string | null;
  /** Вызывает `listener` после любого изменения сессии; возвращает отписку. */
  subscribe(listener: () => void): () => void;
}

export interface TaskCommentsState {
  feeds: Record<number, TaskCommentsFeed>;
}

export interface TaskComments {
  store: StoreApi<TaskCommentsState>;
  /** Экран показывает задачу: её лента хранится и может читаться, пока не вызвана возвращённая функция. */
  retain(taskId: number): () => void;
  /** Загрузить ленту или перечитать загруженное: правки и удаления видны и в старых страницах. */
  refresh(taskId: number): Promise<void>;
  loadOlder(taskId: number): Promise<void>;
  send(taskId: number, draft: CommentDraft): Promise<WriteOutcome>;
  /** Повторить неотправленное с тем же ключом. */
  retry(taskId: number, localId: string): Promise<WriteOutcome>;
  /** Убрать неотправленное; возвращает его текст, чтобы вернуть в поле ввода. */
  discard(taskId: number, localId: string): CommentDraft | null;
  edit(taskId: number, commentId: string, draft: CommentDraft): Promise<WriteOutcome>;
  remove(taskId: number, commentId: string): Promise<WriteOutcome>;
}

export interface TaskCommentsOptions {
  api: TaskCommentsApi;
  session: CommentSession;
  newRequestId?: () => string;
  limits?: { pageSize?: number; maxLoaded?: number; maxCachedTasks?: number };
}

type ReadOutcome =
  | { ok: true; apply: (feed: TaskCommentsFeed) => Partial<TaskCommentsFeed> }
  | { ok: false; failure: TaskCommentFailure };

interface RunningRead {
  kind: 'latest' | 'older';
  controller: AbortController;
  done: Promise<void>;
}

/** Изменение комментария: правка с новым содержимым или удаление. */
type CommentChange = { kind: 'edit'; draft: CommentDraft } | { kind: 'delete' };

const sameChange = (a: CommentChange, b: CommentChange) =>
  a.kind === 'delete' ? b.kind === 'delete' : b.kind === 'edit' && sameDraft(a.draft, b.draft);

const copyDraft = (draft: CommentDraft): CommentDraft => ({
  text: draft.text,
  mentions: draft.mentions.map(({ user_id: userId, start, end }) => ({ user_id: userId, start, end })),
});

const withoutKey = (record: Record<string, 'edit' | 'delete'>, key: string) => {
  const { [key]: _removed, ...rest } = record;
  return rest;
};

const failed = (failure: TaskCommentFailure): WriteOutcome => ({ ok: false, failure });
const signedOut = () => failed(localFailure('unauthenticated', 'Войдите, чтобы писать комментарии'));
const cancelled = () => failed(localFailure('cancelled'));

/**
 * Состояние комментариев всех открытых задач одного пользователя.
 *
 * - Лента каждой задачи хранится отдельно: ответ по одной задаче не попадает в другую.
 * - Чтение одной задачи идёт одно: повторное обновление ждёт идущего, обновление прерывает
 *   догрузку истории, ответ прерванного или заменённого чтения не применяется.
 * - Сообщение получает ключ повтора один раз: повторная отправка того же текста и повтор после
 *   сбоя сети идут с тем же ключом, и сервер не создаёт копию.
 * - Из двух версий комментария остаётся более новая: запоздалый ответ не откатит правку.
 * - Смена пользователя и выход отменяют все запросы и очищают всё: ответы прежней сессии не применяются.
 * - Закрытие экрана отменяет чтение, но не запись: отправленное не теряется.
 */
export function createTaskComments({
  api,
  session,
  newRequestId = randomRequestId,
  limits = {},
}: TaskCommentsOptions): TaskComments {
  const { pageSize = PAGE_SIZE, maxLoaded = MAX_LOADED, maxCachedTasks = MAX_CACHED_TASKS } = limits;
  const store = createStore<TaskCommentsState>(() => ({ feeds: {} }));

  let owner = session.current();
  /** Растёт при смене сессии: записи прежней сессии не применяют свои ответы. */
  let epoch = 0;
  let lastLocalId = 0;
  const reads = new Map<number, RunningRead>();
  const writes = new Set<AbortController>();
  /** Идущие отправки по localId. */
  const sends = new Map<string, Promise<WriteOutcome>>();
  /** Идущие изменения комментариев: что меняется и запрос. */
  const changes = new Map<string, { target: CommentChange; promise: Promise<WriteOutcome> }>();
  /** Сколько экранов показывают задачу. */
  const holders = new Map<number, number>();
  /** Задачи от давно не использованных к недавним. */
  const recency: number[] = [];

  const feedOf = (taskId: number) => store.getState().feeds[taskId] ?? EMPTY_FEED;

  function update(taskId: number, change: (feed: TaskCommentsFeed) => Partial<TaskCommentsFeed>): void {
    store.setState((state) => {
      const feed = state.feeds[taskId] ?? EMPTY_FEED;
      return { feeds: { ...state.feeds, [taskId]: { ...feed, ...change(feed) } } };
    });
  }

  // ---------- Кэш по задачам ----------

  /** Лишние задачи — давно не использованные, без чтения, записи и неотправленного — забываются. */
  function evict(): void {
    let extra = recency.length - maxCachedTasks;
    if (extra <= 0) return;
    const { feeds } = store.getState();
    const forgotten = new Set<number>();
    for (const taskId of recency) {
      if (extra === 0) break;
      const feed = feeds[taskId];
      const busy = feed !== undefined && (feed.pending.length > 0 || Object.keys(feed.changing).length > 0);
      if (holders.has(taskId) || reads.has(taskId) || busy) continue;
      forgotten.add(taskId);
      extra -= 1;
    }
    if (!forgotten.size) return;
    const kept = recency.filter((taskId) => !forgotten.has(taskId));
    recency.splice(0, recency.length, ...kept);
    store.setState((state) => ({
      feeds: Object.fromEntries(Object.entries(state.feeds).filter(([taskId]) => !forgotten.has(Number(taskId)))),
    }));
  }

  function touch(taskId: number): void {
    const index = recency.indexOf(taskId);
    if (index !== -1) recency.splice(index, 1);
    recency.push(taskId);
    evict();
  }

  // ---------- Чтение ----------

  function cancelRead(taskId: number): void {
    const read = reads.get(taskId);
    if (!read) return;
    reads.delete(taskId);
    read.controller.abort();
  }

  /** Доступ к задаче потерян: убрать прочитанное из неё. Свои неотправленные сообщения остаются. */
  function loseTask(taskId: number, failure: TaskCommentFailure): void {
    cancelRead(taskId);
    update(taskId, (feed) => ({ ...EMPTY_FEED, unavailable: true, readError: failure, pending: feed.pending, changing: feed.changing }));
  }

  function startRead(taskId: number, kind: RunningRead['kind'], work: (signal: AbortSignal) => Promise<ReadOutcome>): Promise<void> {
    const controller = new AbortController();
    const read: RunningRead = {
      kind,
      controller,
      done: work(controller.signal).then((outcome) => {
        // Чтение прервано, заменено другим или сессия сменилась — ответ уже ничей.
        if (reads.get(taskId) !== read) return;
        reads.delete(taskId);
        if (outcome.ok) {
          update(taskId, (feed) => ({ ...outcome.apply(feed), reading: null, readError: null }));
          return;
        }
        const { failure } = outcome;
        if (failure.kind === 'unavailable') {
          loseTask(taskId, failure);
          return;
        }
        update(taskId, () => ({ reading: null, readError: failure.kind === 'cancelled' ? null : failure }));
        // Курсор перестал подходить, например после обновления сервера: начать с самых новых.
        if (failure.code === 'INVALID_CURSOR' && kind === 'older') void reread(taskId);
      }),
    };
    reads.set(taskId, read);
    update(taskId, () => ({ reading: kind }));
    return read.done;
  }

  /**
   * Самые новые комментарии вниз до самого старого загруженного: так видны и новые сообщения,
   * и правки с удалениями в уже загруженных страницах.
   */
  async function readLatest(taskId: number, signal: AbortSignal): Promise<ReadOutcome> {
    const shown = feedOf(taskId);
    const oldestLoaded = shown.loaded ? shown.items[0] : undefined;
    const fresh: TaskComment[] = [];
    let before: string | null = null;
    let limit = oldestLoaded ? Math.min(MAX_PAGE_SIZE, Math.max(pageSize, shown.items.length)) : pageSize;
    for (;;) {
      const result: ApiResult<CommentPage> = await api.listComments(taskId, { limit, before }, signal);
      if (!result.ok) return result;
      const page = result.value;
      fresh.unshift(...page.items);
      const reachedLoaded = !oldestLoaded || (page.items.length > 0 && compareComments(page.items[0], oldestLoaded) <= 0);
      if (!page.has_more || page.next_cursor === null || reachedLoaded || fresh.length >= maxLoaded) {
        return {
          ok: true,
          apply: (feed) => {
            const items = applyFresh(feed.items, fresh);
            return {
              items,
              loaded: true,
              olderCursor: page.has_more ? page.next_cursor : null,
              hasOlder: page.has_more,
              historyLimited: page.has_more && items.length >= maxLoaded,
              canComment: page.permissions.can_comment,
              unavailable: false,
            };
          },
        };
      }
      before = page.next_cursor;
      limit = MAX_PAGE_SIZE;
    }
  }

  async function readOlder(taskId: number, signal: AbortSignal): Promise<ReadOutcome> {
    const result = await api.listComments(taskId, { limit: pageSize, before: feedOf(taskId).olderCursor }, signal);
    if (!result.ok) return result;
    const page = result.value;
    return {
      ok: true,
      apply: (feed) => {
        const items = mergeComments(feed.items, page.items);
        return {
          items,
          olderCursor: page.has_more ? page.next_cursor : null,
          hasOlder: page.has_more,
          historyLimited: page.has_more && items.length >= maxLoaded,
          canComment: page.permissions.can_comment,
        };
      },
    };
  }

  /** Новое чтение самых новых; идущее прерывается — его ответ мог устареть. */
  function reread(taskId: number): Promise<void> {
    cancelRead(taskId);
    return startRead(taskId, 'latest', (signal) => readLatest(taskId, signal));
  }

  function refresh(taskId: number): Promise<void> {
    if (owner === null) return Promise.resolve();
    touch(taskId);
    const running = reads.get(taskId);
    return running?.kind === 'latest' ? running.done : reread(taskId);
  }

  function loadOlder(taskId: number): Promise<void> {
    const running = reads.get(taskId);
    if (running) return running.done;
    const feed = feedOf(taskId);
    if (owner === null || !feed.loaded || !feed.hasOlder || feed.historyLimited || feed.olderCursor === null) {
      return Promise.resolve();
    }
    touch(taskId);
    return startRead(taskId, 'older', (signal) => readOlder(taskId, signal));
  }

  const refreshIfShown = (taskId: number) => {
    if (holders.has(taskId)) void refresh(taskId);
  };

  // ---------- Запись ----------

  /** Запись отменяет только смена сессии: уход с экрана не должен терять отправленное. */
  function runWrite(work: (signal: AbortSignal, isCurrent: () => boolean) => Promise<WriteOutcome>): Promise<WriteOutcome> {
    const controller = new AbortController();
    const started = epoch;
    writes.add(controller);
    return work(controller.signal, () => started === epoch).finally(() => writes.delete(controller));
  }

  /** Ошибка записи говорит и о правах на задачу. */
  function noteAccess(taskId: number, failure: TaskCommentFailure): void {
    if (failure.kind === 'unavailable') {
      loseTask(taskId, failure);
    } else if (failure.kind === 'read_only') {
      update(taskId, () => ({ canComment: false }));
      refreshIfShown(taskId);
    }
  }

  function deliver(taskId: number, entry: PendingComment): Promise<WriteOutcome> {
    const { localId } = entry;
    const promise = runWrite(async (signal, isCurrent) => {
      const result = await api.createComment(taskId, entry.draft, entry.requestId, signal);
      if (!isCurrent()) return cancelled();
      if (result.ok) {
        const { comment } = result.value;
        update(taskId, (feed) => ({
          pending: feed.pending.filter((item) => item.localId !== localId),
          items: mergeComments(feed.items, [comment]),
        }));
        refreshIfShown(taskId);
        return { ok: true, comment };
      }
      const { failure } = result;
      update(taskId, (feed) => ({
        pending: feed.pending.map((item) =>
          item.localId !== localId
            ? item
            : {
                ...item,
                status: 'failed' as const,
                failure,
                // Ключ уже занят другим содержимым: следующая попытка — другое сообщение.
                requestId: failure.code === 'IDEMPOTENCY_CONFLICT' ? newRequestId() : item.requestId,
              }
        ),
      }));
      noteAccess(taskId, failure);
      return failed(failure);
    });
    sends.set(localId, promise);
    void promise.finally(() => {
      if (sends.get(localId) === promise) sends.delete(localId);
    });
    return promise;
  }

  function retry(taskId: number, localId: string): Promise<WriteOutcome> {
    const running = sends.get(localId);
    if (running) return running;
    if (owner === null) return Promise.resolve(signedOut());
    const entry = feedOf(taskId).pending.find((item) => item.localId === localId);
    if (!entry) return Promise.resolve(failed(localFailure('stale', 'Сообщение уже отправлено или удалено')));
    const sending: PendingComment = { ...entry, status: 'sending', failure: null };
    update(taskId, (feed) => ({ pending: feed.pending.map((item) => (item.localId === localId ? sending : item)) }));
    touch(taskId);
    return deliver(taskId, sending);
  }

  function send(taskId: number, draft: CommentDraft): Promise<WriteOutcome> {
    if (owner === null) return Promise.resolve(signedOut());
    // То же содержимое — та же отправка и тот же ключ: второе нажатие не создаёт второе сообщение.
    const same = feedOf(taskId).pending.find((entry) => sameDraft(entry.draft, draft));
    if (same) return retry(taskId, same.localId);
    lastLocalId += 1;
    const entry: PendingComment = {
      localId: `pending-${lastLocalId}`,
      requestId: newRequestId(),
      draft: copyDraft(draft),
      status: 'sending',
      failure: null,
    };
    update(taskId, (feed) => ({ pending: [...feed.pending, entry] }));
    touch(taskId);
    return deliver(taskId, entry);
  }

  function discard(taskId: number, localId: string): CommentDraft | null {
    const entry = feedOf(taskId).pending.find((item) => item.localId === localId);
    if (!entry || entry.status !== 'failed') return null;
    update(taskId, (feed) => ({ pending: feed.pending.filter((item) => item.localId !== localId) }));
    return entry.draft;
  }

  /** Удалось ли уже то, чего хотело изменение. */
  const achieved = (target: CommentChange, comment: TaskComment) =>
    target.kind === 'delete' ? comment.deleted_at !== null : holdsDraft(comment, target.draft);

  /**
   * Изменение своего комментария по версии, которую видит экран. Если экран видел устаревшее
   * состояние, лента перечитывается. Если нужное уже сделано — например, первая попытка дошла до
   * сервера, а ответ потерялся, — это успех.
   *
   * Изменения одного комментария идут по очереди: повторное такое же нажатие ждёт идущего
   * запроса, другое изменение начинается после него — с версией, которую тот оставил.
   */
  function change(taskId: number, commentId: string, target: CommentChange): Promise<WriteOutcome> {
    const key = `${taskId}:${commentId}`;
    const current = changes.get(key);
    if (current) {
      return sameChange(current.target, target)
        ? current.promise
        : current.promise.then(() => change(taskId, commentId, target));
    }
    if (owner === null) return Promise.resolve(signedOut());
    const comment = feedOf(taskId).items.find((item) => item.id === commentId);
    if (!comment) return Promise.resolve(failed(localFailure('stale', 'Комментарий не найден: обновите ленту')));
    update(taskId, (feed) => ({ changing: { ...feed.changing, [commentId]: target.kind } }));
    touch(taskId);
    const { version } = comment;
    const promise = runWrite(async (signal, isCurrent) => {
      try {
        const result =
          target.kind === 'edit'
            ? await api.editComment(taskId, commentId, target.draft, version, signal)
            : await api.deleteComment(taskId, commentId, version, signal);
        if (!isCurrent()) return cancelled();
        if (result.ok) {
          update(taskId, (feed) => ({ items: mergeComments(feed.items, [result.value]) }));
          refreshIfShown(taskId);
          return { ok: true, comment: result.value };
        }
        const { failure } = result;
        noteAccess(taskId, failure);
        if (failure.kind !== 'stale' && failure.kind !== 'forbidden') return failed(failure);
        await reread(taskId);
        if (!isCurrent()) return cancelled();
        const now = feedOf(taskId).items.find((item) => item.id === commentId);
        return failure.kind === 'stale' && now && achieved(target, now) ? { ok: true, comment: now } : failed(failure);
      } finally {
        if (isCurrent()) update(taskId, (feed) => ({ changing: withoutKey(feed.changing, commentId) }));
      }
    });
    const entry = { target, promise };
    changes.set(key, entry);
    // Снимается раньше, чем очередь продолжится: следующее изменение увидит, что этого больше нет.
    void promise.finally(() => {
      if (changes.get(key) === entry) changes.delete(key);
    });
    return promise;
  }

  const edit = (taskId: number, commentId: string, draft: CommentDraft) =>
    change(taskId, commentId, { kind: 'edit', draft: copyDraft(draft) });

  const remove = (taskId: number, commentId: string) => change(taskId, commentId, { kind: 'delete' });

  // ---------- Сессия и экраны ----------

  /** Другая учётная запись или никто: отменить всё и забыть всё прочитанное и написанное. */
  function reset(): void {
    epoch += 1;
    owner = session.current();
    for (const read of reads.values()) read.controller.abort();
    reads.clear();
    for (const controller of writes) controller.abort();
    writes.clear();
    sends.clear();
    changes.clear();
    recency.length = 0;
    store.setState({ feeds: {} });
  }

  session.subscribe(() => {
    if (session.current() !== owner) reset();
  });

  function retain(taskId: number): () => void {
    holders.set(taskId, (holders.get(taskId) ?? 0) + 1);
    touch(taskId);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      const left = (holders.get(taskId) ?? 1) - 1;
      if (left > 0) {
        holders.set(taskId, left);
        return;
      }
      holders.delete(taskId);
      // Экран закрыт: чтение больше не нужно. Запись продолжается — отправленное не теряется.
      if (reads.has(taskId)) {
        cancelRead(taskId);
        update(taskId, () => ({ reading: null }));
      }
      evict();
    };
  }

  return { store, retain, refresh, loadOlder, send, retry, discard, edit, remove };
}
