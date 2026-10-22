/**
 * Тексты экрана «Календарь»: итог возврата от Google (?calendar=…) и строка состояния подключения.
 * Те же, что в workflow-web lib/task-calendar.ts.
 */

/** Куда сервер возвращает приложение после Google (TASK_CALENDAR_MOBILE_RETURN_URL на бэкенде). */
export const CALENDAR_RETURN_URL = 'workflowmobile://calendar-settings';

export interface CalendarNotice {
  title: string;
  description: string;
  tone: 'success' | 'error';
}

const RESULTS: Record<string, CalendarNotice> = {
  google_connected: {
    title: 'Google Календарь подключён',
    description: 'Задачи со сроком появятся в календаре «Workflow — задачи» в течение минуты.',
    tone: 'success',
  },
  google_denied: {
    title: 'Подключение отменено',
    description: 'Без разрешения Google задачи в календарь не передаются.',
    tone: 'error',
  },
  google_scope_missing: {
    title: 'Нет доступа к календарю',
    description: 'Подключите ещё раз и отметьте галочку доступа к календарю на экране Google.',
    tone: 'error',
  },
  google_failed: {
    title: 'Не удалось подключить',
    description: 'Google не подтвердил подключение. Попробуйте ещё раз.',
    tone: 'error',
  },
  google_unavailable: {
    title: 'Google Календарь недоступен',
    description: 'Подключение не настроено на сервере.',
    tone: 'error',
  },
  google_invalid_state: {
    title: 'Ссылка устарела',
    description: 'Ссылка подключения действует 10 минут. Начните подключение заново.',
    tone: 'error',
  },
};

/** Сообщение по параметру ?calendar= после возврата от Google, или null. */
export function calendarResultNotice(result: string | null | undefined): CalendarNotice | null {
  if (!result) return null;
  return RESULTS[result] ?? null;
}

/** Параметр calendar из адреса возврата, например workflowmobile://calendar-settings?calendar=google_connected. */
export function calendarResultFromUrl(url: string | null | undefined): string | null {
  // Без URLSearchParams.get: в React Native он реализован не во всех версиях.
  const match = /[?&]calendar=([^&#]*)/.exec(url ?? '');
  return match ? decodeURIComponent(match[1]) : null;
}

const dateTimeFormat = new Intl.DateTimeFormat('ru-RU', {
  day: 'numeric',
  month: 'long',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Asia/Almaty',
});

/** «Синхронизировано 21 октября в 15:10» или null, если ещё не было. */
export function lastSyncedLabel(lastSyncedAt: string | null | undefined): string | null {
  if (!lastSyncedAt) return null;
  const date = new Date(lastSyncedAt);
  if (Number.isNaN(date.getTime())) return null;
  return `Синхронизировано ${dateTimeFormat.format(date).replace(', ', ' в ')}`;
}
