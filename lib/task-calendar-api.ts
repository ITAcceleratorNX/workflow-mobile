import { request } from '@/lib/api';

/** Состояние подключений внешних календарей (GET /calendar-integrations). */
export interface TaskCalendarStatus {
  google: {
    /** Google Календарь настроен на сервере. */
    available: boolean;
    connected: boolean;
    status: 'active' | 'error' | 'revoked' | null;
    account_email: string | null;
    last_synced_at: string | null;
    last_error: string | null;
  };
  ics: {
    enabled: boolean;
    feed_url: string | null;
    webcal_url: string | null;
  };
}

export function getTaskCalendarStatus() {
  return request<TaskCalendarStatus>('/calendar-integrations');
}

/** Адрес страницы согласия Google; после неё сервер вернёт в приложение (CALENDAR_RETURN_URL). */
export function getGoogleCalendarAuthUrl() {
  return request<{ url: string }>('/calendar-integrations/google/auth-url', {
    method: 'POST',
    body: JSON.stringify({ return_to: 'mobile' }),
  });
}

export function syncGoogleCalendar() {
  return request<{ ok: boolean; last_error: string | null }>('/calendar-integrations/google/sync', { method: 'POST' });
}

export function disconnectGoogleCalendar() {
  return request<void>('/calendar-integrations/google', { method: 'DELETE' });
}

/** Включает подписку; rotate — выпустить новую ссылку, старая перестанет работать. */
export function enableCalendarSubscription(rotate = false) {
  return request<{ feed_url: string; webcal_url: string }>('/calendar-integrations/ics', {
    method: 'POST',
    body: JSON.stringify({ rotate }),
  });
}

export function disableCalendarSubscription() {
  return request<void>('/calendar-integrations/ics', { method: 'DELETE' });
}
