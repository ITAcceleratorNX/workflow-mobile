/**
 * Повтор задач (user_tasks): типы и подписи для UI.
 * Сервер — источник истины; клиент шлёт те же поля, что и API.
 */

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
