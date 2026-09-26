import type { RequestFailure } from '@/lib/api-errors';

import {
  describeFailure,
  localFailure,
  timedOutFailure,
  unexpectedAnswerFailure,
  type TaskCommentFailure,
} from './errors';
import type {
  CommentDraft,
  CommentPage,
  MentionCandidate,
  MentionCandidatePage,
  TaskComment,
  TaskCommentMention,
} from './types';

/** Общий HTTP-клиент (`request` из `lib/api`) в той мере, в какой он нужен API комментариев. */
export type Transport = <T>(
  path: string,
  init: {
    method?: 'POST' | 'PATCH' | 'DELETE';
    params?: Record<string, string>;
    body?: string;
    signal: AbortSignal;
  }
) => Promise<{ ok: true; data: T } | RequestFailure>;

export type ApiResult<T> = { ok: true; value: T } | { ok: false; failure: TaskCommentFailure };

export interface CreatedComment {
  comment: TaskComment;
  /** true — это повтор уже выполненного запроса: сервер вернул текущее состояние комментария. */
  replayed: boolean;
}

export interface TaskCommentsApi {
  listComments(
    taskId: number,
    query: { limit: number; before?: string | null },
    signal?: AbortSignal
  ): Promise<ApiResult<CommentPage>>;
  createComment(
    taskId: number,
    draft: CommentDraft,
    clientRequestId: string,
    signal?: AbortSignal
  ): Promise<ApiResult<CreatedComment>>;
  editComment(
    taskId: number,
    commentId: string,
    draft: CommentDraft,
    version: number,
    signal?: AbortSignal
  ): Promise<ApiResult<TaskComment>>;
  deleteComment(taskId: number, commentId: string, version: number, signal?: AbortSignal): Promise<ApiResult<TaskComment>>;
  searchMentionCandidates(
    taskId: number,
    query: { q: string; limit?: number; cursor?: string | null },
    signal?: AbortSignal
  ): Promise<ApiResult<MentionCandidatePage>>;
}

/** Сколько ждать ответа: мобильная сеть может молча «повесить» запрос без ошибки. */
export const REQUEST_TIMEOUT_MS = 20_000;

// ---------- Проверка ответов: экран получает только данные ожидаемой формы ----------

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isInteger = (value: unknown): value is number => Number.isSafeInteger(value);
const isIntegerOrNull = (value: unknown): value is number | null => value === null || isInteger(value);
const isStringOrNull = (value: unknown): value is string | null => value === null || typeof value === 'string';

const COMMENT_ID = /^[1-9]\d*$/;

/** Все элементы, если каждый разобрался, иначе null. */
function parseAll<T>(values: unknown, parse: (value: unknown) => T | null): T[] | null {
  if (!Array.isArray(values)) return null;
  const parsed: T[] = [];
  for (const value of values) {
    const item = parse(value);
    if (item === null) return null;
    parsed.push(item);
  }
  return parsed;
}

function parseMention(value: unknown): TaskCommentMention | null {
  if (!isRecord(value)) return null;
  const { user_id: userId, start, end, label } = value;
  if (!isIntegerOrNull(userId) || !isInteger(start) || !isInteger(end) || typeof label !== 'string') return null;
  return { user_id: userId, start, end, label };
}

function parseComment(value: unknown): TaskComment | null {
  if (!isRecord(value)) return null;
  const { id, task_id: taskId, author, text, created_at: createdAt, updated_at: updatedAt } = value;
  const { edited_at: editedAt, deleted_at: deletedAt, version, permissions } = value;
  if (typeof id !== 'string' || !COMMENT_ID.test(id) || !isInteger(taskId) || !isInteger(version)) return null;
  if (!isRecord(author) || !isIntegerOrNull(author.id) || typeof author.full_name !== 'string') return null;
  if (!isRecord(permissions) || typeof permissions.can_edit !== 'boolean' || typeof permissions.can_delete !== 'boolean') {
    return null;
  }
  if (!isStringOrNull(text) || typeof createdAt !== 'string' || typeof updatedAt !== 'string') return null;
  if (!isStringOrNull(editedAt) || !isStringOrNull(deletedAt)) return null;
  const mentions = parseAll(value.mentions, parseMention);
  if (mentions === null) return null;
  return {
    id,
    task_id: taskId,
    author: { id: author.id, full_name: author.full_name },
    text,
    mentions,
    created_at: createdAt,
    updated_at: updatedAt,
    edited_at: editedAt,
    deleted_at: deletedAt,
    version,
    permissions: { can_edit: permissions.can_edit, can_delete: permissions.can_delete },
  };
}

function parsePage(value: unknown): CommentPage | null {
  if (!isRecord(value) || !isStringOrNull(value.next_cursor) || typeof value.has_more !== 'boolean') return null;
  if (!isRecord(value.permissions) || typeof value.permissions.can_comment !== 'boolean') return null;
  const items = parseAll(value.items, parseComment);
  if (items === null) return null;
  return {
    items,
    next_cursor: value.next_cursor,
    has_more: value.has_more,
    permissions: { can_comment: value.permissions.can_comment },
  };
}

function parseCreated(value: unknown): CreatedComment | null {
  if (!isRecord(value) || typeof value.replayed !== 'boolean') return null;
  const comment = parseComment(value.comment);
  return comment && { comment, replayed: value.replayed };
}

const parseCommentResult = (value: unknown): TaskComment | null => (isRecord(value) ? parseComment(value.comment) : null);

function parseCandidate(value: unknown): MentionCandidate | null {
  if (!isRecord(value) || !isInteger(value.id) || typeof value.full_name !== 'string' || !isStringOrNull(value.position)) {
    return null;
  }
  return { id: value.id, full_name: value.full_name, position: value.position };
}

function parseCandidates(value: unknown): MentionCandidatePage | null {
  if (!isRecord(value) || !isStringOrNull(value.next_cursor) || typeof value.has_more !== 'boolean') return null;
  const items = parseAll(value.items, parseCandidate);
  return items && { items, next_cursor: value.next_cursor, has_more: value.has_more };
}

/** Тело команды: только поля контракта — неизвестные поля сервер отклоняет. */
const draftBody = (draft: CommentDraft) => ({
  text: draft.text,
  mentions: draft.mentions.map(({ user_id: userId, start, end }) => ({ user_id: userId, start, end })),
});

// ---------- Клиент ----------

export function createTaskCommentsApi(
  transport: Transport,
  { timeoutMs = REQUEST_TIMEOUT_MS }: { timeoutMs?: number } = {}
): TaskCommentsApi {
  /**
   * Запрос с таймаутом и отменой. Отменённый или просроченный запрос — ошибка, даже если тело
   * ответа успело прийти частично: для записи исход тогда неизвестен.
   */
  async function call<T>(
    path: string,
    init: { method?: 'POST' | 'PATCH' | 'DELETE'; params?: Record<string, string>; body?: unknown },
    parse: (data: unknown) => T | null,
    signal?: AbortSignal
  ): Promise<ApiResult<T>> {
    if (signal?.aborted) return { ok: false, failure: localFailure('cancelled') };
    const controller = new AbortController();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, timeoutMs);
    const cancel = () => controller.abort();
    signal?.addEventListener('abort', cancel);
    try {
      const result = await transport<unknown>(path, {
        method: init.method,
        params: init.params,
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        signal: controller.signal,
      });
      if (controller.signal.aborted) {
        return { ok: false, failure: timedOut ? timedOutFailure() : localFailure('cancelled') };
      }
      if (!result.ok) return { ok: false, failure: describeFailure(result) };
      const value = parse(result.data);
      return value === null ? { ok: false, failure: unexpectedAnswerFailure() } : { ok: true, value };
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', cancel);
    }
  }

  const commentsPath = (taskId: number) => `/user-tasks/${taskId}/comments`;
  const commentPath = (taskId: number, commentId: string) =>
    `${commentsPath(taskId)}/${encodeURIComponent(commentId)}`;

  return {
    listComments(taskId, { limit, before }, signal) {
      const params: Record<string, string> = { limit: String(limit) };
      if (before) params.before = before;
      return call(commentsPath(taskId), { params }, parsePage, signal);
    },

    createComment(taskId, draft, clientRequestId, signal) {
      const body = { ...draftBody(draft), client_request_id: clientRequestId };
      return call(commentsPath(taskId), { method: 'POST', body }, parseCreated, signal);
    },

    editComment(taskId, commentId, draft, version, signal) {
      const body = { ...draftBody(draft), version };
      return call(commentPath(taskId, commentId), { method: 'PATCH', body }, parseCommentResult, signal);
    },

    deleteComment(taskId, commentId, version, signal) {
      const params = { version: String(version) };
      return call(commentPath(taskId, commentId), { method: 'DELETE', params }, parseCommentResult, signal);
    },

    searchMentionCandidates(taskId, { q, limit, cursor }, signal) {
      const params: Record<string, string> = {};
      if (q) params.q = q;
      if (limit !== undefined) params.limit = String(limit);
      if (cursor) params.cursor = cursor;
      return call(`/user-tasks/${taskId}/mention-candidates`, { params }, parseCandidates, signal);
    },
  };
}
