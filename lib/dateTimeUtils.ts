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

/** Длительность брони: «45 мин» или «2 ч» / «1 ч 30 мин» (если больше часа — часы, не сотни минут). */
export function formatBookingDurationRu(startIso: string, endIso: string): string | null {
  const start = toDate(startIso);
  const end = toDate(endIso);
  if (!start || !end || end.getTime() <= start.getTime()) return null;
  const totalMin = Math.round((end.getTime() - start.getTime()) / 60000);
  if (totalMin <= 0) return null;
  if (totalMin < 60) return `${totalMin} мин`;
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (m === 0) return `${h} ч`;
  return `${h} ч ${m} мин`;
}

/** "только что" / "N мин назад" / от часа — "N ч назад" или "N ч M мин назад" / "N дн назад" / или DD.MM.YYYY */
export function formatTimeAgo(dateStr: string): string {
  const date = toDate(dateStr);
  if (!date) return dateStr;
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const totalMinutes = Math.floor(diffMs / (1000 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (totalMinutes < 1) return 'только что';
  if (totalMinutes < 60) return `${totalMinutes} мин назад`;
  if (totalMinutes < 60 * 24) {
    const h = Math.floor(totalMinutes / 60);
    const m = totalMinutes % 60;
    return m === 0 ? `${h} ч назад` : `${h} ч ${m} мин назад`;
  }
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

// --- Задачи / календарь: день в Asia/Almaty, бэкенд хранит UTC ---

/**
 * YYYY-MM-DD календарного дня в Asia/Almaty (группировка задач, запросы календаря).
 * Отличается от formatDateForApi(date), который использует локальную дату устройства.
 */
export function toAppDateKey(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return fmt.format(date);
  } catch {
    const y = date.getUTCFullYear();
    const m = String(date.getUTCMonth() + 1).padStart(2, '0');
    const d = String(date.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

/** Время HH:mm в Asia/Almaty для задач (как formatTimeOnly, с fallback на UTC при сбое Intl) */
export function formatTaskTime(value: DateInput): string {
  const formatted = formatTimeOnly(value);
  if (formatted) return formatted;
  const date = toDate(value);
  if (!date) return '';
  return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
}

/**
 * Сдвиг ключа YYYY-MM-DD по календарю UTC (для запаса диапазона календаря).
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/** Час 0–23 в Asia/Almaty (слоты календаря дня) */
export function getAlmatyHour(value: DateInput): number {
  const date = toDate(value);
  if (!date) return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      hour: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = parts.find((p) => p.type === 'hour')?.value ?? '0';
    return parseInt(hour, 10) || 0;
  } catch {
    return date.getUTCHours();
  }
}

function getAlmatyOffsetMinutes(utcDate: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcDate);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';
    const y = Number(get('year'));
    const m = Number(get('month'));
    const d = Number(get('day'));
    const hh = Number(get('hour'));
    const mm = Number(get('minute'));
    const ss = Number(get('second'));
    const asLocalMs = Date.UTC(y, m - 1, d, hh, mm, ss);
    return Math.round((asLocalMs - utcDate.getTime()) / 60000);
  } catch {
    return 5 * 60;
  }
}

/**
 * UTC ISO из даты (YYYY-MM-DD) и времени (HH:mm), интерпретируемых как Asia/Almaty.
 */
export function toUtcIsoFromAppDateTime(dateKey: string, time: string): string {
  const [yS, mS, dS] = (dateKey || '').split('-');
  const [hhS, mmS] = (time || '').split(':');
  const y = Number(yS);
  const m = Number(mS);
  const d = Number(dS);
  const hh = Number(hhS);
  const mm = Number(mmS);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(hh) || !Number.isFinite(mm)) {
    return new Date().toISOString();
  }
  const asIfUtcMs = Date.UTC(y, m - 1, d, hh, mm, 0);
  const guessUtc = new Date(asIfUtcMs);
  const offsetMin = getAlmatyOffsetMinutes(guessUtc);
  const utcMs = asIfUtcMs - offsetMin * 60000;
  return new Date(utcMs).toISOString();
}
