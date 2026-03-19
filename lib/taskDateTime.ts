import type { DateInput } from '@/lib/dateTimeUtils';

/** Отображение дат/времени задач в Asia/Almaty; API принимает UTC. */
const DISPLAY_TIMEZONE = 'Asia/Almaty';

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Возвращает YYYY-MM-DD календарного дня в Asia/Almaty для отображения и группировки.
 * Бэкенд хранит UTC; на фронте показываем день в Almaty.
 */
export function toAppDateKey(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: DISPLAY_TIMEZONE,
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

/**
 * Время HH:mm в Asia/Almaty для отображения (бэкенд отдаёт UTC).
 */
export function formatTaskTime(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  try {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: DISPLAY_TIMEZONE,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    return `${String(date.getUTCHours()).padStart(2, '0')}:${String(date.getUTCMinutes()).padStart(2, '0')}`;
  }
}

/**
 * Добавляет к ключу даты YYYY-MM-DD сдвиг в днях (для запроса календаря по UTC с запасом).
 */
export function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

/**
 * Час (0–23) в Asia/Almaty для группировки по слотам в календаре.
 */
export function getAlmatyHour(value: DateInput): number {
  const date = toDate(value);
  if (!date) return 0;
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: DISPLAY_TIMEZONE,
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
      timeZone: DISPLAY_TIMEZONE,
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
    return 5 * 60; // Asia/Almaty UTC+5
  }
}

/**
 * Собирает UTC ISO из выбранных пользователем даты (YYYY-MM-DD) и времени (HH:mm),
 * считая их локальным временем Asia/Almaty. Бэкенд хранит и считает напоминания в UTC.
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

