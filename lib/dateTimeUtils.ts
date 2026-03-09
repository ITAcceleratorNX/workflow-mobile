/**
 * Централизованное форматирование даты и времени.
 * Часовой пояс приложения: Asia/Almaty (как в веб-версии).
 * API возвращает время в UTC (ISO); для отображения используем Asia/Almaty.
 */
const APP_TIMEZONE = 'Asia/Almaty';
const APP_LOCALE = 'ru-RU';

export type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function formatWithOptions(
  value: DateInput,
  options: Intl.DateTimeFormatOptions
): string {
  const date = toDate(value);
  if (!date) return '';

  try {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      timeZone: APP_TIMEZONE,
      ...options,
    }).format(date);
  } catch {
    return '';
  }
}

// --- API / ключи ---

/** Дата YYYY-MM-DD для API (календарный день без сдвига в UTC) */
export function formatDateForApi(date: Date): string {
  const y = date.getFullYear();
  const m = (date.getMonth() + 1).toString().padStart(2, '0');
  const d = date.getDate().toString().padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Ключ даты YYYY-MM-DD (то же, что formatDateForApi; для шагов и т.п.) */
export function toDateKey(date: Date): string {
  return formatDateForApi(date);
}

// --- Отображение из ISO ---

/** Дата "DD.MM.YYYY" в Asia/Almaty из ISO-строки (карточки бронирований и т.д.) */
export function formatDateOnly(value: DateInput): string {
  return formatWithOptions(value, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/** Дата для отображения из ISO (Almaty), с fallback при ошибке */
export function formatDisplayDateFromIso(iso: string): string {
  const formatted = formatDateOnly(iso);
  if (formatted) return formatted;
  const part = iso.slice(0, 10);
  if (part.length === 10) return part.split('-').reverse().join('.');
  return iso;
}

/** Время "HH:mm" в Asia/Almaty */
export function formatTimeOnly(value: DateInput): string {
  return formatWithOptions(value, {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Дата и время "DD.MM.YYYY HH:mm" в Asia/Almaty (заявки, логи и т.д.) */
export function formatRequestDate(iso: string): string {
  const date = toDate(iso);
  if (!date) return iso;
  const d = formatDateOnly(date);
  const t = formatTimeOnly(date);
  return d && t ? `${d} ${t}` : iso;
}

// --- Бронирования ---

/** Час в Almaty для слота "HH:00" (сопоставление с TIME_SLOTS) */
export function getAlmatySlotKey(iso: string): string {
  const date = toDate(iso);
  if (!date) return '';
  try {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '00';
    const h = hour.padStart(2, '0');
    return `${h}:00`;
  } catch {
    const h = date.getUTCHours().toString().padStart(2, '0');
    return `${h}:00`;
  }
}

// --- Относительное время ---

/** "только что" / "N мин назад" / "N ч назад" / "N дн назад" / или DD.MM.YYYY */
export function formatTimeAgo(dateStr: string): string {
  const date = toDate(dateStr);
  if (!date) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMinutes < 1) return 'только что';
  if (diffMinutes < 60) return `${diffMinutes} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;

  return formatDateOnly(date) || dateStr;
}

/** "Сегодня" / "Вчера" / или дата вида "15 мар., сб" */
export function formatDateRelative(dateStr: string): string {
  const d = toDate(dateStr + (dateStr.length === 10 ? 'T12:00:00' : ''));
  if (!d) return dateStr;
  const today = new Date();
  const key = formatDateForApi(d);
  if (key === formatDateForApi(today)) return 'Сегодня';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (key === formatDateForApi(yesterday)) return 'Вчера';
  try {
    return new Intl.DateTimeFormat(APP_LOCALE, {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    }).format(d);
  } catch {
    return formatDateOnly(d) || dateStr;
  }
}
