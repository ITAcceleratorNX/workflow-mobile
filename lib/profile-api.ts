import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/auth-store';

const { apiBaseUrl } = config;

type ProfileApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; unauthorized?: boolean };

async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ProfileApiResult<T>> {
  const token = useAuthStore.getState().token;
  if (!token) {
    return { ok: false, error: 'Не авторизован', unauthorized: true };
  }

  const url = `${apiBaseUrl}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as HeadersInit),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      useAuthStore.getState().clearAuth();
      return {
        ok: false,
        error: 'Сессия истекла. Войдите снова.',
        unauthorized: true,
      };
    }

    if (!res.ok) {
      const error =
        (data as { error?: string })?.error ||
        (data as { message?: string })?.message ||
        (Array.isArray((data as { details?: { message?: string }[] })?.details) &&
          (data as { details: { message?: string }[] }).details[0]?.message) ||
        'Произошла ошибка';
      return { ok: false, error };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Сетевая ошибка';
    return { ok: false, error: message };
  }
}

export async function updateProfile(
  userId: number,
  data: { full_name: string; phone: string }
): Promise<ProfileApiResult<unknown>> {
  return authRequest(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
}): Promise<ProfileApiResult<unknown>> {
  return authRequest('/users/change-password', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function sendEmailVerificationCode(
  email: string
): Promise<ProfileApiResult<unknown>> {
  return authRequest('/users/send-email-verification', {
    method: 'POST',
    body: JSON.stringify({ email }),
  });
}

export async function verifyEmail(
  code: string
): Promise<ProfileApiResult<unknown>> {
  return authRequest('/users/verify-email', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export async function updateNotificationsSettings(data: {
  emailNotifications: boolean;
  securityNotifications: boolean;
  marketingNotifications: boolean;
}): Promise<ProfileApiResult<unknown>> {
  return authRequest('/users/notifications-settings', {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

// ==================== Logs ====================

export interface RequestLog {
  id: number;
  request_id: number;
  user_id: number;
  action_type: string;
  action_description: string;
  old_values: unknown;
  new_values: unknown;
  created_at: string;
  user: { id: number; full_name: string; phone: string; role: string };
  request: { id: number; title: string; status: string };
}

export interface LogsResponse {
  logs: RequestLog[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

// ==================== Notifications ====================

export interface Notification {
  id: number;
  title: string;
  content: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  notifications: Notification[];
  totalPages?: number;
  total?: number;
}

export async function fetchNotifications(
  page: number,
  pageSize: number
): Promise<ProfileApiResult<NotificationsResponse>> {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));
  return authRequest<NotificationsResponse>(
    `/notifications/me?${params.toString()}`
  );
}

export async function markNotificationRead(
  id: number
): Promise<ProfileApiResult<unknown>> {
  return authRequest(`/notifications/${id}/read`, { method: 'PATCH' });
}

// ==================== Logs ====================

export async function fetchRequestLogs(
  userRole: string,
  page: number,
  pageSize: number,
  filters?: Record<string, unknown>
): Promise<ProfileApiResult<LogsResponse>> {
  const params = new URLSearchParams();
  params.append('page', String(page));
  params.append('pageSize', String(pageSize));
  if (filters && Object.keys(filters).length > 0) {
    params.append('filters', JSON.stringify(filters));
  }
  const url =
    userRole === 'manager' || userRole === 'admin-worker'
      ? `/request-logs/filtered?${params.toString()}`
      : `/request-logs/my?${params.toString()}`;
  return authRequest<LogsResponse>(url);
}
