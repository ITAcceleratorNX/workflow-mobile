import { useAuthStore } from '@/stores/auth-store';

/** Экран списка запросов на регистрацию (админ). */
export const ROUTE_ADMIN_REGISTRATION_REQUESTS = '/admin-worker/users' as const;

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

export function parseTaskIdFromPushPayload(data: Record<string, unknown>): number | null {
  const raw = data?.task_id;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
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

export function buildDeferredTaskDetailsHref(taskId: number): string {
  return `/client/tasks/details?taskId=${encodeURIComponent(String(taskId))}`;
}

export function isGuestOrDemoSession(): boolean {
  const { isGuest, token } = useAuthStore.getState();
  return isGuest || !token || token === 'guest-demo';
}
