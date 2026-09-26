import type { ApiResult, TaskCommentsApi } from '../api';
import { describeFailure, localFailure, type TaskCommentErrorCode, type TaskCommentFailure } from '../errors';
import type { CommentSession } from '../store';
import type { CommentPage, TaskComment } from '../types';

const START = Date.parse('2026-09-26T10:00:00.000Z');

/** A comment as the server sends it; created a second apart, in the order of the ids. */
export function comment(id: number, overrides: Partial<TaskComment> = {}): TaskComment {
  const at = new Date(START + id * 1000).toISOString();
  return {
    id: String(id),
    task_id: 1,
    author: { id: 7, full_name: 'Иванов Иван' },
    text: `Комментарий ${id}`,
    mentions: [],
    created_at: at,
    updated_at: at,
    edited_at: null,
    deleted_at: null,
    version: 1,
    permissions: { can_edit: true, can_delete: true },
    ...overrides,
  };
}

export const tombstone = (source: TaskComment): TaskComment => ({
  ...source,
  text: null,
  mentions: [],
  deleted_at: new Date(START + 3_600_000).toISOString(),
  version: source.version + 1,
  permissions: { can_edit: false, can_delete: false },
});

export const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => comment(from + index));

export function page(
  items: TaskComment[],
  { cursor = null, canComment = true }: { cursor?: string | null; canComment?: boolean } = {}
): ApiResult<CommentPage> {
  return { ok: true, value: { items, next_cursor: cursor, has_more: cursor !== null, permissions: { can_comment: canComment } } };
}

/** A failure the way the API client reports an answer of the server. */
export function serverFailure(status: number, code: TaskCommentErrorCode, message = 'Ошибка'): TaskCommentFailure {
  return describeFailure({ ok: false, error: message, status, code });
}

export const offline = (): TaskCommentFailure => localFailure('offline');

/** Lets every callback queued by settled promises run. */
export const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

type Method = keyof TaskCommentsApi;

export interface FakeCall {
  method: Method;
  args: unknown[];
  signal: AbortSignal | undefined;
  answered: boolean;
  /** Answers the call and lets the code waiting for it run. */
  answer(result: ApiResult<unknown>): Promise<void>;
}

/**
 * An API whose calls wait until the test answers them, in any order. A cancelled call answers
 * itself as the real client does; with `honorAbort: false` it keeps waiting, like a response
 * already on its way that the network did not stop.
 */
export function fakeApi({ honorAbort = true }: { honorAbort?: boolean } = {}) {
  const calls: FakeCall[] = [];

  function record<T>(method: Method, args: unknown[], signal: AbortSignal | undefined): Promise<ApiResult<T>> {
    return new Promise((resolve) => {
      const call: FakeCall = {
        method,
        args,
        signal,
        answered: false,
        async answer(result) {
          if (call.answered) throw new Error(`${method} is already answered`);
          call.answered = true;
          resolve(result as ApiResult<T>);
          await flush();
        },
      };
      signal?.addEventListener('abort', () => {
        if (call.answered || !honorAbort) return;
        call.answered = true;
        resolve({ ok: false, failure: localFailure('cancelled') });
      });
      calls.push(call);
    });
  }

  const api: TaskCommentsApi = {
    listComments: (taskId, query, signal) => record('listComments', [taskId, query], signal),
    createComment: (taskId, draft, requestId, signal) => record('createComment', [taskId, draft, requestId], signal),
    editComment: (taskId, commentId, draft, version, signal) =>
      record('editComment', [taskId, commentId, draft, version], signal),
    deleteComment: (taskId, commentId, version, signal) => record('deleteComment', [taskId, commentId, version], signal),
    searchMentionCandidates: (taskId, query, signal) => record('searchMentionCandidates', [taskId, query], signal),
  };

  return {
    api,
    calls,
    /** Calls of the method still waiting for an answer, oldest first. */
    waiting: (method: Method) => calls.filter((call) => call.method === method && !call.answered),
    /** The only waiting call of the method; fails the test when there is none or several. */
    next(method: Method): FakeCall {
      const waiting = calls.filter((call) => call.method === method && !call.answered);
      if (waiting.length !== 1) throw new Error(`expected one waiting ${method}, found ${waiting.length}`);
      return waiting[0];
    },
    count: (method: Method) => calls.filter((call) => call.method === method).length,
  };
}

export function fakeSession(user: string | null = '7') {
  let current = user;
  const listeners = new Set<() => void>();
  const session: CommentSession = {
    current: () => current,
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
  return {
    session,
    signIn(next: string | null) {
      current = next;
      for (const listener of listeners) listener();
    },
  };
}
