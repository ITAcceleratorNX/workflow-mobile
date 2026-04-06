import { formatDateForApi } from '@/lib/dateTimeUtils';

export const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

export const MONTHS_NOMINATIVE = [
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
];

export const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

export function formatDateLabelRu(dateKey: string | null): string {
  if (!dateKey) return 'Без даты';
  const d = new Date(dateKey + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

export function nextMondayAfterToday(todayKey: string): string {
  const d = new Date(todayKey + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return formatDateForApi(d);
}

/** Ближайшая суббота (выходные) от текущего дня */
export function nextWeekendDayKey(todayKey: string): string {
  const d = new Date(todayKey + 'T12:00:00');
  const wd = d.getDay();
  if (wd === 6 || wd === 0) return formatDateForApi(d);
  d.setDate(d.getDate() + (6 - wd));
  return formatDateForApi(d);
}

export function parseTimeIntoDate(dateKey: string, time: string): Date {
  const [hh, mm] = (time || '09:00').split(':').map((x) => parseInt(x, 10));
  const d = new Date(dateKey + 'T12:00:00');
  d.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}

export function buildMonthCells(
  year: number,
  month: number
): { day: number; dateKey: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const cells: { day: number; dateKey: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: 0, dateKey: '', inMonth: false });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, dateKey: formatDateForApi(new Date(year, month, d)), inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ day: 0, dateKey: '', inMonth: false });
  return cells;
}
