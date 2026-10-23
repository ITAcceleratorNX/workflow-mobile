/** A month as a grid of weeks for calendars (weeks start on Monday). Pure, works on YYYY-MM-DD keys. */

export type MonthRef = { year: number; month: number };

export type MonthCell = { key: string; day: number } | null;

export const WEEKDAY_SHORT_MON_FIRST = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const;

const MONTH_NAMES = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
] as const;

const pad = (value: number) => String(value).padStart(2, '0');

export function dateKeyOf(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

/** The month of a YYYY-MM-DD key (month is 0-based). */
export function monthOfKey(dateKey: string): MonthRef {
  const [year, month] = dateKey.split('-').map((part) => parseInt(part, 10));
  return { year, month: month - 1 };
}

export function shiftMonth(ref: MonthRef, delta: number): MonthRef {
  const index = ref.year * 12 + ref.month + delta;
  return { year: Math.floor(index / 12), month: ((index % 12) + 12) % 12 };
}

export function sameMonth(a: MonthRef, b: MonthRef): boolean {
  return a.year === b.year && a.month === b.month;
}

/** «Октябрь 2026». */
export function monthTitle(ref: MonthRef): string {
  return `${MONTH_NAMES[ref.month]} ${ref.year}`;
}

/** Weeks of the month, Monday first; days of other months are null. */
export function monthWeeks(ref: MonthRef): MonthCell[][] {
  const first = new Date(Date.UTC(ref.year, ref.month, 1));
  const daysInMonth = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();
  const leading = (first.getUTCDay() + 6) % 7;
  const cells: MonthCell[] = Array.from({ length: leading }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ key: dateKeyOf(ref.year, ref.month, day), day });
  }
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: MonthCell[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** First and last day keys of the month, for range requests. */
export function monthRange(ref: MonthRef): { start: string; end: string } {
  const daysInMonth = new Date(Date.UTC(ref.year, ref.month + 1, 0)).getUTCDate();
  return { start: dateKeyOf(ref.year, ref.month, 1), end: dateKeyOf(ref.year, ref.month, daysInMonth) };
}
