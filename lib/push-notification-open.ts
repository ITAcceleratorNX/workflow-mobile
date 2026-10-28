import type { Href } from 'expo-router';

/** Экран списка запросов на регистрацию (админ). */
export const ROUTE_ADMIN_REGISTRATION_REQUESTS = '/admin-worker/users' as const;

/** История уведомлений: туда ведёт push об удалённой задаче. */
export const ROUTE_NOTIFICATIONS = '/notifications' as const;

let lastDedupKey = '';
let lastDedupAt = 0;

/** Expo + FCM могут отдать одно нажатие двумя каналами подряд. */
export function shouldSkipDuplicatePushOpen(key: string, windowMs = 2500): boolean {
  const now = Date.now();
  if (lastDedupKey === key && now - lastDedupAt < windowMs) {
    return true;
  }
  lastDedupKey = key;
  lastDedupAt = now;
  return false;
}

export function fcmPayloadToRecord(
  raw: Record<string, string | object> | undefined | null
): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = v;
  }
  return out;
}

export function parseNumericFromPush(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const n = parseInt(value, 10);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/** ID для `/(tabs)/requests/[id]` из payload бэкенда. */
export function workflowRequestNavigateIdFromPayload(data: Record<string, unknown>): number | undefined {
  const group = parseNumericFromPush(data.request_group_id ?? data.requestGroupId);
  const rid = parseNumericFromPush(data.request_id ?? data.requestId);
  const id = group ?? rid;
  return id != null && !Number.isNaN(id) ? id : undefined;
}

export function pushPayloadType(data: Record<string, unknown>): string | undefined {
  return typeof data.type === 'string' ? data.type : undefined;
}

export function nonTaskPushNavigationDedupKey(data: Record<string, unknown>): string {
  const type = pushPayloadType(data) ?? '';
  return `nav:${type}:${String(data.registration_request_id ?? '')}:${String(data.request_group_id ?? data.requestGroupId ?? '')}:${String(data.request_id ?? data.requestId ?? '')}`;
}

/** Есть ли не-task сценарий, для которого нужен общий обработчик (cold start / tap). */
export function hasNonTaskPushNavigationIntent(data: Record<string, unknown>): boolean {
  const type = pushPayloadType(data);
  const id = workflowRequestNavigateIdFromPayload(data);
  return (
    type === 'new_registration_request' ||
    (id != null && !Number.isNaN(id)) ||
    (typeof type === 'string' && type.length > 0)
  );
}

// ---------- Задачник ----------

/** События задачника: `data.event` push и `event` записи истории (контракт workflow-service). */
export const TASK_PUSH_EVENTS = [
  'assigned',
  'group_assigned',
  'transferred',
  'reminder',
  'comment',
  'mention',
  'completed',
  'reopened',
  'file_added',
  'deadline_changed',
  'priority_changed',
  'overdue',
  'deleted',
] as const;

export type TaskPushEvent = (typeof TASK_PUSH_EVENTS)[number];

/**
 * `data.type` push задачника: назначение и передача, напоминание (с кнопками на iOS), остальные
 * события. Старые версии приложения знают только первые два и по ним тоже открывают задачу.
 */
const TASK_PUSH_TYPES: readonly string[] = ['user_task_assigned', 'task_reminder', 'user_task_event'];

/** Что открыть по уведомлению задачника. */
export interface TaskPushTarget {
  taskId: number;
  /** Комментарий, к которому прокрутить ленту задачи: у событий `comment` и `mention`. */
  commentId: string | null;
  /** null — сервер без `event` или событие, которого это приложение ещё не знает: просто открыть задачу. */
  event: TaskPushEvent | null;
}

function positiveId(value: unknown): number | null {
  const n = typeof value === 'string' && /^\d+$/.test(value.trim()) ? Number(value) : value;
  return typeof n === 'number' && Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** ID комментария — BIGINT десятичной строкой, как в API комментариев. */
function commentIdOf(value: unknown): string | null {
  const text = typeof value === 'number' && Number.isSafeInteger(value) ? String(value) : typeof value === 'string' ? value.trim() : '';
  return /^[1-9]\d*$/.test(text) ? text : null;
}

function taskEventOf(value: unknown): TaskPushEvent | null {
  return TASK_PUSH_EVENTS.find((event) => event === value) ?? null;
}

function taskTarget(taskId: unknown, commentId: unknown, event: unknown): TaskPushTarget | null {
  const id = positiveId(taskId);
  return id === null ? null : { taskId: id, commentId: commentIdOf(commentId), event: taskEventOf(event) };
}

/** `data` push задачника (все значения FCM — строки); null — push не о задаче или без её ID. */
export function parseTaskPush(data: Record<string, unknown> | null | undefined): TaskPushTarget | null {
  if (!data || !TASK_PUSH_TYPES.includes(pushPayloadType(data) ?? '')) return null;
  return taskTarget(data.task_id, data.comment_id, data.event);
}

/** Поля записи `GET /notifications/me`, по которым она ведёт к задаче. */
export interface TaskNotificationFields {
  category?: string | null;
  event?: string | null;
  task_id?: number | string | null;
  comment_id?: number | string | null;
}

/** Запись истории о задаче; null — уведомление не задачника или старая запись без ссылки на задачу. */
export function taskNotificationTarget(item: TaskNotificationFields): TaskPushTarget | null {
  return item.category === 'tasks' ? taskTarget(item.task_id, item.comment_id, item.event) : null;
}

/** Карточка задачи, при переходе к комментарию — с его ID. */
export function taskDetailsHref({ taskId, commentId }: TaskPushTarget): Href {
  return {
    pathname: '/client/tasks/details',
    params: commentId ? { taskId: String(taskId), commentId } : { taskId: String(taskId) },
  };
}

/**
 * Куда ведёт нажатие на push — строкой, как переходы виджетов: она ждёт в `pendingPostAuthHref`,
 * пока её не откроет `openAppHref`. Удалённую задачу не открыть — тогда в историю уведомлений.
 */
export function taskPushHref(target: TaskPushTarget): string {
  if (target.event === 'deleted') return ROUTE_NOTIFICATIONS;
  const query = new URLSearchParams({ taskId: String(target.taskId) });
  if (target.commentId) query.set('commentId', target.commentId);
  return `/client/tasks/details?${query}`;
}
