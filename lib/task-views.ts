/**
 * Client-side views for user tasks (Todoist-like).
 * Входящие: в т.ч. без даты; с датой/сроком также попадают в «Сегодня», «Предстоящие» (и календарь через API).
 * День в календарных списках: scheduled_at, а у входящих при его отсутствии — deadline_to (и deadline_time для сортировки).
 */

import { toAppDateKey } from '@/lib/dateTimeUtils';
import type { UserTask } from '@/lib/user-tasks-api';

export type TaskMainView = 'inbox' | 'today' | 'upcoming' | 'completed';

/** Стартовые значения формы создания задачи — зависят от экрана, с которого её открыли. */
export interface TaskCreateDefaults {
  /** YYYY-MM-DD (Asia/Almaty); null — «Без даты». */
  dateKey: string | null;
  /** Задача остаётся во «Входящих», даже если у неё есть дата. */
  inbox: boolean;
}

export function getListTaskCreateDefaults(
  view: TaskMainView,
  keys: { todayKey: string; tomorrowKey: string; upcomingDateKey: string | null }
): TaskCreateDefaults {
  switch (view) {
    case 'inbox':
      return { dateKey: keys.tomorrowKey, inbox: true };
    case 'today':
      return { dateKey: keys.todayKey, inbox: false };
    case 'upcoming':
      return { dateKey: keys.upcomingDateKey ?? keys.tomorrowKey, inbox: false };
    case 'completed':
      return { dateKey: null, inbox: false };
  }
}

/** Выбранный в календаре день, но не раньше сегодня — новая задача не должна сразу стать просроченной. */
export function getCalendarTaskCreateDefaults(selectedDateKey: string, todayKey: string): TaskCreateDefaults {
  return { dateKey: selectedDateKey < todayKey ? todayKey : selectedDateKey, inbox: false };
}

export interface TaskSection {
  id: string;
  title: string;
  tasks: UserTask[];
}

function deadlineToDateKey(deadlineTo: UserTask['deadline_to']): string | null {
  if (deadlineTo == null || deadlineTo === '') return null;
  if (typeof deadlineTo === 'string') return deadlineTo.slice(0, 10);
  const k = toAppDateKey(deadlineTo);
  return k || null;
}

/** Календарный день (Asia/Almaty для scheduled_at): для входящих учитывается срок deadline_to, если нет расписания. */
function taskScheduledDayKey(t: UserTask): string | null {
  if (t.scheduled_at) return toAppDateKey(t.scheduled_at);
  if (t.inbox) return deadlineToDateKey(t.deadline_to);
  return null;
}

/** Current «Срок» field, with a fallback for legacy deadlines regardless of inbox. */
export function taskDueDayKey(task: UserTask): string | null {
  return task.scheduled_at ? toAppDateKey(task.scheduled_at) : deadlineToDateKey(task.deadline_to);
}

function effectiveSortTime(t: UserTask): number {
  if (t.scheduled_at) return new Date(t.scheduled_at).getTime();
  if (t.inbox && t.deadline_to) {
    const dk = deadlineToDateKey(t.deadline_to);
    if (!dk) return 0;
    if (typeof t.deadline_time === 'string' && /^\d{1,2}:\d{2}$/.test(t.deadline_time)) {
      const [h, m] = t.deadline_time.split(':');
      return new Date(`${dk}T${String(h).padStart(2, '0')}:${m}:00`).getTime();
    }
    return new Date(`${dk}T12:00:00`).getTime();
  }
  return 0;
}

function sortByScheduleThenTitle(a: UserTask, b: UserTask): number {
  const priorityWeight = (p?: string) => (p === 'high' ? 3 : p === 'medium' ? 2 : 1);
  const pa = priorityWeight(a.priority);
  const pb = priorityWeight(b.priority);
  if (pa !== pb) return pb - pa;

  const ta = effectiveSortTime(a);
  const tb = effectiveSortTime(b);
  if (ta !== tb) return ta - tb;
  return a.title.localeCompare(b.title, 'ru');
}

/** Выполненные за календарный день завершения (Almaty), новые сверху. */
export function getCompletedTasks(tasks: UserTask[], dateKey: string): UserTask[] {
  return tasks
    .filter((t) => t.completed)
    .filter((t) => {
      const ref = t.completed_at ?? t.updated_at;
      if (!ref) return false;
      return toAppDateKey(ref) === dateKey;
    })
    .sort((a, b) => {
      const ca = a.completed_at ?? a.updated_at;
      const cb = b.completed_at ?? b.updated_at;
      return cb.localeCompare(ca);
    });
}

/** All active tasks, preserving the server order. */
export function getInboxTasks(tasks: UserTask[]): UserTask[] {
  return tasks.filter((task) => !task.completed);
}

export function getTodaySections(tasks: UserTask[], todayKey: string, preserveOrder = false): TaskSection[] {
  const todayTasks = tasks.filter((task) => !task.completed && taskDueDayKey(task) === todayKey);
  if (!preserveOrder) todayTasks.sort(sortByScheduleThenTitle);
  return todayTasks.length ? [{ id: "today", title: "Сегодня", tasks: todayTasks }] : [];
}

/** Overdue: задачи со днём строго до today (по расписанию или по дедлайну у входящих). */
export function getOverdueSections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const overdue: UserTask[] = [];

  for (const t of tasks) {
    const dayKey = taskScheduledDayKey(t);
    if (t.inbox && !dayKey) continue;
    if (t.completed || !dayKey) continue;
    if (dayKey < todayKey) overdue.push(t);
  }

  overdue.sort(sortByScheduleThenTitle);

  const sections: TaskSection[] = [];
  if (overdue.length > 0) {
    sections.push({ id: 'overdue', title: 'Просрочено', tasks: overdue });
  }
  return sections;
}

/** Upcoming: будущие по дню (после today), включая входящие с датой/сроком. */
export function getUpcomingSections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const map = new Map<string, UserTask[]>();

  for (const t of tasks) {
    const dayKey = taskScheduledDayKey(t);
    if (t.inbox && !dayKey) continue;
    if (t.completed || !dayKey) continue;
    if (dayKey <= todayKey) continue;
    const list = map.get(dayKey) ?? [];
    list.push(t);
    map.set(dayKey, list);
  }

  const keys = [...map.keys()].sort();
  return keys.map((dateKey) => ({
    id: `day-${dateKey}`,
    title: formatSectionDateLabel(dateKey, todayKey),
    tasks: (map.get(dateKey) ?? []).sort(sortByScheduleThenTitle),
  }));
}

export const MONTHS_SHORT = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

export function formatSectionDateLabel(dateKey: string, todayKey: string): string {
  const d = new Date(dateKey + 'T12:00:00');
  if (dateKey === todayKey) return 'Сегодня';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, '0')}-${String(yesterday.getDate()).padStart(2, '0')}`;
  if (dateKey === yKey) return 'Вчера';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tKey = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
  if (dateKey === tKey) return 'Завтра';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
