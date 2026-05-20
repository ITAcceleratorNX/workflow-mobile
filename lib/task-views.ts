/**
 * Client-side views for user tasks (Todoist-like).
 * Входящие: в т.ч. без даты; с датой/сроком также попадают в «Сегодня», «Предстоящие» (и календарь через API).
 * День в календарных списках: scheduled_at, а у входящих при его отсутствии — deadline_to (и deadline_time для сортировки).
 */

import { toAppDateKey } from '@/lib/dateTimeUtils';
import type { UserTask } from '@/lib/user-tasks-api';

export type TaskMainView = 'inbox' | 'today' | 'upcoming' | 'completed';

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

function isInboxIncomplete(t: UserTask): boolean {
  if (t.completed) return false;
  return Boolean(t.inbox) || t.scheduled_at == null;
}

function isInboxCompletedRow(t: UserTask): boolean {
  return Boolean(t.completed && t.inbox);
}

/** Входящие: незавершённые без даты или с флагом inbox; завершённые — только с inbox. */
export function getInboxTasks(tasks: UserTask[]): UserTask[] {
  const priorityWeight = (p?: string) => (p === 'high' ? 3 : p === 'medium' ? 2 : 1);
  const incomplete = tasks
    .filter(isInboxIncomplete)
    .sort((a, b) => {
      const pa = priorityWeight(a.priority);
      const pb = priorityWeight(b.priority);
      if (pa !== pb) return pb - pa;
      return b.updated_at.localeCompare(a.updated_at);
    });
  const done = tasks.filter(isInboxCompletedRow).sort((a, b) => {
    const ca = a.completed_at ?? a.updated_at;
    const cb = b.completed_at ?? b.updated_at;
    return cb.localeCompare(ca);
  });
  return [...incomplete, ...done];
}

/** Today: просроченные и на сегодня по scheduled_at / у входящих по deadline_to; плюс выполненные сегодня с датой в списках. */
export function getTodaySections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const overdue: UserTask[] = [];
  const todayScheduled: UserTask[] = [];
  const doneToday: UserTask[] = [];

  for (const t of tasks) {
    const dayKey = taskScheduledDayKey(t);
    if (t.inbox && !dayKey) continue;

    if (t.completed) {
      const ref = t.completed_at;
      if (ref && toAppDateKey(ref) === todayKey) {
        doneToday.push(t);
      }
      continue;
    }
    if (!dayKey) continue;
    if (dayKey < todayKey) {
      overdue.push(t);
      continue;
    }
    if (dayKey === todayKey) {
      todayScheduled.push(t);
    }
  }

  overdue.sort(sortByScheduleThenTitle);
  todayScheduled.sort(sortByScheduleThenTitle);
  doneToday.sort((a, b) => {
    const ca = a.completed_at ?? a.updated_at;
    const cb = b.completed_at ?? b.updated_at;
    return cb.localeCompare(ca);
  });

  const sections: TaskSection[] = [];
  if (overdue.length > 0) {
    sections.push({ id: 'overdue', title: 'Просрочено', tasks: overdue });
  }
  if (todayScheduled.length > 0) {
    sections.push({ id: 'today', title: 'Сегодня', tasks: todayScheduled });
  }
  if (doneToday.length > 0) {
    sections.push({ id: 'done-today', title: 'Выполнено', tasks: doneToday });
  }
  return sections;
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
