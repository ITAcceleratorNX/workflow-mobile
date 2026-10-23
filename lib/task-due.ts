import {
  addCalendarDaysToDateKey,
  formatTaskTime,
  toAppDateKey,
  toUtcIsoFromAppDateTime,
} from '@/lib/dateTimeUtils';
import type { UserTask } from '@/lib/user-tasks-api';

/**
 * «Срок» of a task as the screens show it. The current editors keep it in `scheduled_at`; older
 * tasks may still carry a date (and a time) in `deadline_to`/`deadline_time`, read at noon
 * without a time — the same rule as the server's list filters.
 */

export type TaskDue = { dateKey: string; time: string | null };
export type DueTone = 'overdue' | 'upcoming' | 'none';
type DueSource = Pick<UserTask, 'scheduled_at' | 'deadline_to' | 'deadline_time' | 'completed'>;

export const DEFAULT_DUE_TIME = '18:00';
const LEGACY_DEFAULT_TIME = '12:00';
const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const MONTHS_GENITIVE = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const WEEKDAYS_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const TIME_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;

function legacyTime(value: string | null): string | null {
  const match = typeof value === 'string' ? TIME_RE.exec(value.trim()) : null;
  return match ? `${match[1].padStart(2, '0')}:${match[2]}` : null;
}

/** Date and time of the due moment, or null for a task without «Срок». */
export function taskDue(task: Pick<DueSource, 'scheduled_at' | 'deadline_to' | 'deadline_time'>): TaskDue | null {
  if (task.scheduled_at) {
    return { dateKey: toAppDateKey(task.scheduled_at), time: formatTaskTime(task.scheduled_at) || null };
  }
  if (task.deadline_to) {
    return { dateKey: String(task.deadline_to).slice(0, 10), time: legacyTime(task.deadline_time) };
  }
  return null;
}

/** The due instant (legacy dates without a time count at noon). */
export function taskDueInstant(task: Pick<DueSource, 'scheduled_at' | 'deadline_to' | 'deadline_time'>): Date | null {
  if (task.scheduled_at) return new Date(task.scheduled_at);
  const due = taskDue(task);
  return due ? new Date(toUtcIsoFromAppDateTime(due.dateKey, due.time ?? LEGACY_DEFAULT_TIME)) : null;
}

export function isTaskOverdue(task: DueSource, now: Date = new Date()): boolean {
  if (task.completed) return false;
  const instant = taskDueInstant(task);
  return instant != null && instant.getTime() < now.getTime();
}

function parts(dateKey: string) {
  const [year, month, day] = dateKey.split('-').map((part) => parseInt(part, 10));
  return { year, month: month - 1, day, weekday: new Date(Date.UTC(year, month - 1, day)).getUTCDay() };
}

/** «Сегодня», «Завтра», «Вчера» or «30 сен» (with the year when it is not the current one). */
export function formatDueDay(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return 'Сегодня';
  if (dateKey === addCalendarDaysToDateKey(todayKey, 1)) return 'Завтра';
  if (dateKey === addCalendarDaysToDateKey(todayKey, -1)) return 'Вчера';
  const { year, month, day } = parts(dateKey);
  const sameYear = year === parts(todayKey).year;
  return `${day} ${MONTHS_SHORT[month]}${sameYear ? '' : ` ${year}`}`;
}

/** «Сегодня · 15:00» in lists, «1 окт, 17:06» in the card and the editor. */
export function formatDue(due: TaskDue | null, todayKey: string, separator: ' · ' | ', ' = ' · '): string {
  if (!due) return 'Без срока';
  const day = formatDueDay(due.dateKey, todayKey);
  return due.time ? `${day}${separator}${due.time}` : day;
}

/** The due line of a list row and its tone. */
export function dueSummary(task: DueSource, todayKey: string, now: Date = new Date()): { text: string; tone: DueTone } {
  const due = taskDue(task);
  if (!due) return { text: 'Без срока', tone: 'none' };
  return { text: formatDue(due, todayKey), tone: isTaskOverdue(task, now) ? 'overdue' : 'upcoming' };
}

/** «Ср, 21 октября» — the day above the «Сегодня» list. */
export function formatDayHeading(dateKey: string): string {
  const { month, day, weekday } = parts(dateKey);
  return `${WEEKDAYS_SHORT[weekday]}, ${day} ${MONTHS_GENITIVE[month]}`;
}

/** «Среда, 21 октября» — the day of the calendar list. */
export function formatDayTitle(dateKey: string): string {
  const { month, day, weekday } = parts(dateKey);
  const name = WEEKDAYS[weekday];
  return `${name[0].toUpperCase()}${name.slice(1)}, ${day} ${MONTHS_GENITIVE[month]}`;
}

/** «21 октября» — for «+ Задача на 21 октября». */
export function formatDayShort(dateKey: string): string {
  const { month, day } = parts(dateKey);
  return `${day} ${MONTHS_GENITIVE[month]}`;
}

/** «2 задачи», «5 задач», «1 задача». */
export function pluralTasks(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'задача' : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14) ? 'задачи' : 'задач';
  return `${count} ${word}`;
}

/** «9 незавершённых», «1 незавершённая». */
export function pluralUnfinished(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const word = mod10 === 1 && mod100 !== 11 ? 'незавершённая' : 'незавершённых';
  return `${count} ${word}`;
}

/** The time a new task gets by default: the next 18:00 (today until then, tomorrow after). */
export function defaultDue(todayKey: string, now: Date = new Date()): TaskDue {
  const todayEvening = new Date(toUtcIsoFromAppDateTime(todayKey, DEFAULT_DUE_TIME));
  const dateKey = now.getTime() < todayEvening.getTime() ? todayKey : addCalendarDaysToDateKey(todayKey, 1);
  return { dateKey, time: DEFAULT_DUE_TIME };
}

export type QuickDue = { id: 'today' | 'tomorrow' | 'friday' | 'none'; label: string; dateKey: string | null };

/** The chips of the «Срок» sheet: today, tomorrow, the next Friday after tomorrow, no date. */
export function quickDueOptions(todayKey: string): QuickDue[] {
  const tomorrow = addCalendarDaysToDateKey(todayKey, 1);
  const afterTomorrowWeekday = parts(addCalendarDaysToDateKey(todayKey, 2)).weekday;
  const friday = addCalendarDaysToDateKey(todayKey, 2 + ((5 - afterTomorrowWeekday + 7) % 7));
  return [
    { id: 'today', label: 'Сегодня', dateKey: todayKey },
    { id: 'tomorrow', label: 'Завтра', dateKey: tomorrow },
    { id: 'friday', label: 'Пятница', dateKey: friday },
    { id: 'none', label: 'Без срока', dateKey: null },
  ];
}

/** `scheduled_at` for the API: the moment in the app time zone, or null without a date. */
export function dueToScheduledAt(due: TaskDue | null): string | null {
  return due ? toUtcIsoFromAppDateTime(due.dateKey, due.time ?? DEFAULT_DUE_TIME) : null;
}
