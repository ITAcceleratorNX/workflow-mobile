import type { RequestFailure } from '@/lib/api-errors';

/** Машинные коды API комментариев. */
export const TASK_COMMENT_ERROR_CODES = [
  'VALIDATION_ERROR',
  'INVALID_CURSOR',
  'UNAUTHENTICATED',
  'COMMENT_WRITE_FORBIDDEN',
  'COMMENT_NOT_OWNED',
  'MODULE_FORBIDDEN',
  'TASK_NOT_FOUND',
  'COMMENT_NOT_FOUND',
  'COMMENT_VERSION_CONFLICT',
  'COMMENT_DELETED',
  'MENTION_NOT_AVAILABLE',
  'IDEMPOTENCY_CONFLICT',
  'PAYLOAD_TOO_LARGE',
  'RATE_LIMITED',
  'INTERNAL_ERROR',
] as const;

export type TaskCommentErrorCode = (typeof TASK_COMMENT_ERROR_CODES)[number];

/**
 * Что делать экрану с ошибкой:
 * - `offline` — ответа нет: нет сети или сервер не ответил вовремя. Запись могла и выполниться,
 *   и нет — повторять тем же запросом, ключ повтора защищает от второй копии;
 * - `cancelled` — запрос отменило само приложение: карточку закрыли, сменился пользователь;
 * - `unauthenticated` — сессия закончилась, `request` уже вывел на вход;
 * - `unavailable` — задачи нет или она больше не видна пользователю;
 * - `unsupported` — сервер не знает этого API (404 без кода, например старая версия);
 * - `read_only` — задача доступна только для чтения: писать больше нельзя;
 * - `forbidden` — чужой комментарий или модуль закрыт роли;
 * - `stale` — на экране устаревшее состояние: комментарий изменён или удалён. Перечитать ленту, черновик сохранить;
 * - `rejected` — сервер отклонил содержимое: исправить черновик, поля — в `details`;
 * - `rate_limited` — слишком часто, повторить через `retryAfterSeconds`;
 * - `server` — сбой сервера или неожиданный ответ; повтор позже может помочь.
 */
export type TaskCommentFailureKind =
  | 'offline'
  | 'cancelled'
  | 'unauthenticated'
  | 'unavailable'
  | 'unsupported'
  | 'read_only'
  | 'forbidden'
  | 'stale'
  | 'rejected'
  | 'rate_limited'
  | 'server';

export interface TaskCommentFailure {
  kind: TaskCommentFailureKind;
  /** Код API; null, если его нет: не было ответа, старый сервер или ошибка самого приложения. */
  code: TaskCommentErrorCode | null;
  status: number | null;
  /** Текст для пользователя, без содержимого комментариев. */
  message: string;
  /** Ошибки полей, например `mentions.2` — номер упоминания в запросе. */
  details: { field: string; message: string }[];
  retryAfterSeconds: number | null;
}

const KIND_OF_CODE: Record<TaskCommentErrorCode, TaskCommentFailureKind> = {
  VALIDATION_ERROR: 'rejected',
  INVALID_CURSOR: 'stale',
  UNAUTHENTICATED: 'unauthenticated',
  COMMENT_WRITE_FORBIDDEN: 'read_only',
  COMMENT_NOT_OWNED: 'forbidden',
  MODULE_FORBIDDEN: 'forbidden',
  TASK_NOT_FOUND: 'unavailable',
  COMMENT_NOT_FOUND: 'stale',
  COMMENT_VERSION_CONFLICT: 'stale',
  COMMENT_DELETED: 'stale',
  MENTION_NOT_AVAILABLE: 'rejected',
  IDEMPOTENCY_CONFLICT: 'rejected',
  PAYLOAD_TOO_LARGE: 'rejected',
  RATE_LIMITED: 'rate_limited',
  INTERNAL_ERROR: 'server',
};

const isKnownCode = (code: string | undefined): code is TaskCommentErrorCode =>
  code !== undefined && Object.hasOwn(KIND_OF_CODE, code);

/** Вид ошибки без известного кода — по статусу. */
function kindOfStatus(status: number): TaskCommentFailureKind {
  if (status === 400 || status === 413) return 'rejected';
  if (status === 401) return 'unauthenticated';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'unsupported';
  if (status === 409) return 'stale';
  if (status === 429) return 'rate_limited';
  return 'server';
}

/** Свои тексты — там, где серверного нет или он бессмыслен: нет ответа, старый сервер, прокси. */
const MESSAGES: Partial<Record<TaskCommentFailureKind, string>> = {
  offline: 'Нет соединения с сервером. Проверьте интернет и повторите',
  cancelled: 'Запрос отменён',
  unsupported: 'Комментарии пока недоступны',
  rate_limited: 'Слишком много запросов. Повторите чуть позже',
  server: 'Не удалось выполнить запрос. Повторите позже',
};

/** Ошибка, которую определило само приложение, без запроса к серверу. */
export function localFailure(kind: TaskCommentFailureKind, message = MESSAGES[kind] ?? ''): TaskCommentFailure {
  return { kind, code: null, status: null, message, details: [], retryAfterSeconds: null };
}

export const timedOutFailure = (): TaskCommentFailure =>
  localFailure('offline', 'Сервер не ответил вовремя. Повторите');

export const unexpectedAnswerFailure = (): TaskCommentFailure =>
  localFailure('server', 'Сервер прислал неожиданный ответ. Повторите позже');

/** Ошибка `request` в терминах экрана комментариев. */
export function describeFailure(failure: RequestFailure): TaskCommentFailure {
  if (failure.aborted) return localFailure('cancelled');
  // Без статуса ответа не было. Текст ошибки fetch платформенный и часто английский — свой понятнее.
  if (failure.status === undefined) return localFailure('offline');
  const code = isKnownCode(failure.code) ? failure.code : null;
  const kind = code ? KIND_OF_CODE[code] : kindOfStatus(failure.status);
  return {
    kind,
    code,
    status: failure.status,
    message: code ? failure.error : MESSAGES[kind] ?? failure.error,
    details: failure.details ?? [],
    retryAfterSeconds: failure.retryAfterSeconds ?? null,
  };
}
