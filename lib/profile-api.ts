import { networkFailure } from '@/lib/api-errors';
import type { CategoryNotification, CategorySummary, NotificationCategory } from '@/lib/notification-categories';
import { config } from '@/lib/config';
import { fetchWithSession, getAccessToken } from '@/lib/session';

const { apiBaseUrl } = config;

export type ProfileApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; unauthorized?: boolean };

async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ProfileApiResult<T>> {
  const token = await getAccessToken();
  if (!token) {
    return { ok: false, error: 'Не авторизован', unauthorized: true };
  }

  const basePath = path.split('?')[0];
  const method = (options.method ?? 'GET').toUpperCase();

  if (token === 'guest-demo') {
    if (basePath === '/notifications/me/summary') {
      return { ok: true, data: { categories: [], unread_count: 0 } as T };
    }
    if (basePath === '/notifications/me') {
      return {
        ok: true,
        data: {
          notifications: [],
          total: 0,
          totalPages: 0,
        } as T,
      };
    }
    if (method === 'PATCH' && /^\/notifications\/\d+\/read$/.test(basePath)) {
      return { ok: true, data: {} as T };
    }
    return { ok: false, error: 'В демо-режиме недоступно' };
  }

  const url = `${apiBaseUrl}${path}`;
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  try {
    // На 401 fetchWithSession продлевает сессию; 401 после него — сессия завершена, выход уже произошёл.
    const res = await fetchWithSession(url, { ...options, headers }, token);
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
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
    return networkFailure(path, e);
  }
}

export interface OwnProfileInput {
  full_name: string;
  phone: string;
  /** null — очистить должность. */
  position: string | null;
}

/** Свой профиль любой роли: ФИО, телефон, должность. Ответ — профиль после сохранения. */
export async function updateOwnProfile(
  data: OwnProfileInput
): Promise<ProfileApiResult<OwnProfileInput>> {
  return authRequest<OwnProfileInput>('/users/me/profile', {
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

/** Удалить свой email: уведомления на почту больше не приходят. */
export async function removeEmail(): Promise<ProfileApiResult<unknown>> {
  return authRequest('/users/email', { method: 'DELETE' });
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

export const CATEGORY_HISTORY_PAGE_SIZE = 20;

export interface CategoryHistoryPage {
  /** Новые первыми, как отдаёт сервер; порядок для экрана — newestFirst(). */
  notifications: CategoryNotification[];
  totalPages?: number;
  total?: number;
}

/** Категории роли со счётчиками и последним уведомлением. */
export async function fetchNotificationSummary(): Promise<ProfileApiResult<CategorySummary>> {
  return authRequest<CategorySummary>('/notifications/me/summary');
}

/** Страница истории одной категории. */
export async function fetchCategoryHistory(
  category: NotificationCategory,
  page: number
): Promise<ProfileApiResult<CategoryHistoryPage>> {
  const params = new URLSearchParams({
    page: String(page),
    pageSize: String(CATEGORY_HISTORY_PAGE_SIZE),
    category,
  });
  return authRequest<CategoryHistoryPage>(`/notifications/me?${params.toString()}`);
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
