/**
 * Повтор задач (user_tasks): типы и подписи для UI.
 * Сервер — источник истины; клиент шлёт те же поля, что и API.
 */

import { formatDateForApi } from '@/lib/dateTimeUtils';

export type RecurrenceType = 'none' | 'daily' | 'weekly' | 'weekdays' | 'monthly' | 'custom';

export type RecurrenceCustomUnit = 'day' | 'week' | 'month';

export interface TaskRecurrencePayload {
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_custom_unit: RecurrenceCustomUnit | null;
  recurrence_weekdays: number[] | null;
}

const WEEKDAY_SHORT_RU: Record<number, string> = {
  1: 'Пн',
  2: 'Вт',
  3: 'Ср',
  4: 'Чт',
  5: 'Пт',
  6: 'Сб',
  7: 'Вс',
};

export function defaultRecurrenceNone(): TaskRecurrencePayload {
  return {
    recurrence_type: 'none',
    recurrence_interval: 1,
    recurrence_custom_unit: null,
    recurrence_weekdays: null,
  };
}

export function normalizeRecurrenceFromApi(raw: Partial<TaskRecurrencePayload> | null | undefined): TaskRecurrencePayload {
  const t = (raw?.recurrence_type as RecurrenceType) ?? 'none';
  const allowed: RecurrenceType[] = ['none', 'daily', 'weekly', 'weekdays', 'monthly', 'custom'];
  const type = allowed.includes(t) ? t : 'none';
  let interval = Number(raw?.recurrence_interval);
  if (!Number.isFinite(interval) || interval < 1) interval = 1;
  if (interval > 365) interval = 365;
  const cu = raw?.recurrence_custom_unit;
  const customUnit =
    cu === 'day' || cu === 'week' || cu === 'month' ? cu : null;
  let wds = raw?.recurrence_weekdays;
  if (!Array.isArray(wds)) wds = null;
  else {
    wds = [...new Set(wds.map((x) => Number(x)).filter((n) => n >= 1 && n <= 7))].sort((a, b) => a - b);
    if (wds.length === 0) wds = null;
  }
  return {
    recurrence_type: type,
    recurrence_interval: interval,
    recurrence_custom_unit: customUnit,
    recurrence_weekdays: wds,
  };
}

/** Понедельник = 1 … воскресенье = 7 (как на сервере) */
export function weekdayMon1Sun7FromDateKey(dateKey: string): number {
  const d = new Date(`${dateKey}T12:00:00`);
  if (Number.isNaN(d.getTime())) return 1;
  const day = d.getDay();
  return day === 0 ? 7 : day;
}

/** Подпись «Каждые N дней/недель/месяцев» для шапки кастомного повтора (род. падеж). */
export function formatEveryIntervalRu(n: number, unit: RecurrenceCustomUnit): string {
  const k = Math.min(365, Math.max(1, Math.floor(n)));
  if (unit === 'day') {
    if (k === 1) return '1 день';
    if (k >= 2 && k <= 4) return `${k} дня`;
    return `${k} дней`;
  }
  if (unit === 'week') {
    if (k === 1) return '1 неделя';
    if (k >= 2 && k <= 4) return `${k} недели`;
    return `${k} недель`;
  }
  if (k === 1) return '1 месяц';
  if (k >= 2 && k <= 4) return `${k} месяца`;
  return `${k} месяцев`;
}

/** Короткие подписи для строк в списках и узких рядов (без переполнения). */
export function formatRecurrenceSummaryCompactRu(
  r: TaskRecurrencePayload,
  opts?: { anchorDateKey?: string | null }
): string {
  if (!r || r.recurrence_type === 'none') return 'Нет';

  const anchor = opts?.anchorDateKey ?? '';

  switch (r.recurrence_type) {
    case 'daily':
      return 'Ежедневно';
    case 'weekly': {
      const wd = anchor ? weekdayMon1Sun7FromDateKey(anchor) : 1;
      return `Еженед. ${WEEKDAY_SHORT_RU[wd] ?? 'Пн'}`;
    }
    case 'weekdays':
      return 'По будням';
    case 'monthly': {
      if (anchor) {
        const parts = anchor.split('-');
        const dS = parts[2];
        const d = parseInt(dS ?? '1', 10) || 1;
        return `Ежемес. ${d}`;
      }
      return 'Ежемес.';
    }
    case 'custom': {
      const n = Math.max(1, r.recurrence_interval || 1);
      const u = r.recurrence_custom_unit;
      if (u === 'day') return n === 1 ? 'Ежедневно' : `${n} дн.`;
      if (u === 'week') {
        const wds = r.recurrence_weekdays ?? [];
        const wdPart =
          wds.length > 0
            ? wds.map((x) => WEEKDAY_SHORT_RU[x] ?? '').filter(Boolean).join('·')
            : '';
        if (n === 1) return wdPart ? `Нед. ${wdPart}` : 'Неделя';
        return wdPart ? `${n} нед. ${wdPart}` : `${n} нед.`;
      }
      if (u === 'month') return n === 1 ? 'Ежемес.' : `${n} мес.`;
      return 'Свой';
    }
    default:
      return 'Нет';
  }
}

export function formatRecurrenceSummaryRu(
  r: TaskRecurrencePayload,
  opts?: { anchorDateKey?: string | null }
): string {
  if (!r || r.recurrence_type === 'none') return 'Нет';

  const anchor = opts?.anchorDateKey ?? '';

  switch (r.recurrence_type) {
    case 'daily':
      return 'Каждый день';
    case 'weekly': {
      const wd = anchor ? weekdayMon1Sun7FromDateKey(anchor) : 1;
      return `Каждую неделю в ${WEEKDAY_SHORT_RU[wd] ?? 'Пн'}`;
    }
    case 'weekdays':
      return 'Каждый будний день (Пн - Пт)';
    case 'monthly': {
      if (anchor) {
        const [_, __, dS] = anchor.split('-');
        const d = parseInt(dS ?? '1', 10) || 1;
        return `Каждый месяц ${d} числа`;
      }
      return 'Каждый месяц';
    }
    case 'custom': {
      const n = Math.max(1, r.recurrence_interval || 1);
      const u = r.recurrence_custom_unit;
      if (u === 'day') {
        if (n === 1) return 'Каждый день';
        return `Каждые ${n} дн.`;
      }
      if (u === 'week') {
        const wds = r.recurrence_weekdays ?? [];
        const wdPart =
          wds.length > 0
            ? wds.map((x) => WEEKDAY_SHORT_RU[x] ?? '').filter(Boolean).join(', ')
            : '';
        if (n === 1) return wdPart ? `Каждую неделю (${wdPart})` : 'Каждую неделю';
        return wdPart ? `Каждые ${n} нед. (${wdPart})` : `Каждые ${n} нед.`;
      }
      if (u === 'month') {
        if (n === 1) return 'Каждый месяц';
        return `Каждые ${n} мес.`;
      }
      return 'Свой вариант';
    }
    default:
      return 'Нет';
  }
}

export const RECURRENCE_PRESET_OPTIONS: { type: RecurrenceType; label: string }[] = [
  { type: 'none', label: 'Нет' },
  { type: 'daily', label: 'Каждый день' },
  { type: 'weekly', label: 'Каждую неделю' },
  { type: 'weekdays', label: 'Каждый будний день' },
  { type: 'monthly', label: 'Каждый месяц' },
  { type: 'custom', label: 'Свой вариант' },
];

export function presetToPayload(type: RecurrenceType): TaskRecurrencePayload {
  if (type === 'none') return defaultRecurrenceNone();
  if (type === 'custom') {
    return {
      recurrence_type: 'custom',
      recurrence_interval: 1,
      recurrence_custom_unit: 'day',
      recurrence_weekdays: null,
    };
  }
  return {
    recurrence_type: type,
    recurrence_interval: 1,
    recurrence_custom_unit: null,
    recurrence_weekdays: null,
  };
}

export function customPayload(
  interval: number,
  unit: RecurrenceCustomUnit,
  weekdays: number[] | null
): TaskRecurrencePayload {
  const n = Math.min(365, Math.max(1, Math.floor(interval) || 1));
  return {
    recurrence_type: 'custom',
    recurrence_interval: n,
    recurrence_custom_unit: unit,
    recurrence_weekdays: unit === 'week' ? weekdays && weekdays.length ? [...new Set(weekdays)].sort((a, b) => a - b) : [1] : null,
  };
}

const MS_DAY = 24 * 60 * 60 * 1000;
const MS_WEEK = 7 * MS_DAY;

function addDaysToDateKey(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateForApi(d);
}

function daysInCalendarMonth(year: number, month0: number): number {
  return new Date(year, month0 + 1, 0).getDate();
}

function addMonthsKeepDayOrLast(dateKey: string, months: number): string {
  const [yS, mS, dS] = dateKey.split('-');
  const y = Number(yS);
  const m = Number(mS);
  const d = Number(dS);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) return dateKey;
  let ny = y;
  let nm = m + months;
  while (nm > 12) {
    nm -= 12;
    ny += 1;
  }
  while (nm < 1) {
    nm += 12;
    ny -= 1;
  }
  const dim = daysInCalendarMonth(ny, nm - 1);
  const nd = Math.min(d, dim);
  return `${ny}-${String(nm).padStart(2, '0')}-${String(nd).padStart(2, '0')}`;
}

function mondayDateKeyFromDateKey(dateKey: string): string {
  const wd = weekdayMon1Sun7FromDateKey(dateKey);
  return addDaysToDateKey(dateKey, -(wd - 1));
}

/**
 * Следующая дата повтора строго после `currentDateKey` (как computeNextScheduledOnce на сервере, по календарным дням).
 */
export function computeNextOccurrenceDateKey(currentDateKey: string, rule: TaskRecurrencePayload): string | null {
  const type = rule.recurrence_type;
  if (type === 'none') return null;

  const interval = Math.max(1, Math.min(365, Number(rule.recurrence_interval) || 1));
  const dateKey = currentDateKey;

  if (type === 'daily') {
    return addDaysToDateKey(dateKey, interval);
  }

  if (type === 'weekly') {
    return addDaysToDateKey(dateKey, 7 * interval);
  }

  if (type === 'weekdays') {
    let k = addDaysToDateKey(dateKey, 1);
    for (let i = 0; i < 14; i++) {
      const wd = weekdayMon1Sun7FromDateKey(k);
      if (wd >= 1 && wd <= 5) return k;
      k = addDaysToDateKey(k, 1);
    }
    return addDaysToDateKey(dateKey, 1);
  }

  if (type === 'monthly') {
    return addMonthsKeepDayOrLast(dateKey, interval);
  }

  if (type === 'custom') {
    const unit = rule.recurrence_custom_unit;
    const wds = rule.recurrence_weekdays?.length
      ? [...new Set(rule.recurrence_weekdays)].sort((a, b) => a - b)
      : [];

    if (unit === 'day') {
      return addDaysToDateKey(dateKey, interval);
    }

    if (unit === 'month') {
      return addMonthsKeepDayOrLast(dateKey, interval);
    }

    if (unit === 'week') {
      if (!wds.length) {
        return addDaysToDateKey(dateKey, 7 * interval);
      }

      const anchorMondayMs = new Date(`${mondayDateKeyFromDateKey(dateKey)}T12:00:00`).getTime();
      const tMs = new Date(`${dateKey}T12:00:00`).getTime();

      let probeKey = addDaysToDateKey(dateKey, 1);
      for (let step = 0; step < 800; step++) {
        const wd = weekdayMon1Sun7FromDateKey(probeKey);
        if (!wds.includes(wd)) {
          probeKey = addDaysToDateKey(probeKey, 1);
          continue;
        }

        const candMondayMs = new Date(`${mondayDateKeyFromDateKey(probeKey)}T12:00:00`).getTime();
        const weekIndex = Math.round((candMondayMs - anchorMondayMs) / MS_WEEK);
        if (weekIndex % interval !== 0) {
          probeKey = addDaysToDateKey(probeKey, 1);
          continue;
        }

        const probeMs = new Date(`${probeKey}T12:00:00`).getTime();
        if (probeMs > tMs) return probeKey;
        probeKey = addDaysToDateKey(probeKey, 1);
      }
      return addDaysToDateKey(dateKey, 7 * interval);
    }
  }

  return null;
}

/**
 * Даты в видимом месяце календаря, которые попадают под правило повтора (якорь — выбранный срок).
 */
export function getRecurrenceHighlightDateKeysForMonth(
  year: number,
  monthIndex0: number,
  anchorDateKey: string | null,
  rule: TaskRecurrencePayload
): Set<string> {
  const out = new Set<string>();
  if (!anchorDateKey || rule.recurrence_type === 'none') return out;

  const lastD = daysInCalendarMonth(year, monthIndex0);
  const monthStart = `${year}-${String(monthIndex0 + 1).padStart(2, '0')}-01`;
  const monthEnd = formatDateForApi(new Date(year, monthIndex0, lastD));

  if (rule.recurrence_type === 'weekdays') {
    for (let day = 1; day <= lastD; day++) {
      const dk = formatDateForApi(new Date(year, monthIndex0, day));
      const wd = weekdayMon1Sun7FromDateKey(dk);
      if (wd >= 1 && wd <= 5) out.add(dk);
    }
    return out;
  }

  let cur = anchorDateKey;
  let guard = 0;
  while (cur < monthStart && guard < 4000) {
    const next = computeNextOccurrenceDateKey(cur, rule);
    if (!next || next <= cur) break;
    cur = next;
    guard++;
  }

  guard = 0;
  while (cur <= monthEnd && guard < 4000) {
    if (cur >= monthStart) out.add(cur);
    const next = computeNextOccurrenceDateKey(cur, rule);
    if (!next || next <= cur) break;
    cur = next;
    guard++;
  }

  return out;
}
