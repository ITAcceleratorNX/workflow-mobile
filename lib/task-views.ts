/**
 * Client-side views for user tasks (Todoist-like).
 * Inbox: tasks without date, or with inbox=true (optional date); completed inbox stay here.
 * Today / Upcoming: exclude inbox-flagged from scheduled lists; Today adds «Выполнено» for today (non-inbox).
 */

import { toAppDateKey } from '@/lib/dateTimeUtils';
import type { UserTask } from '@/lib/user-tasks-api';

export type TaskMainView = 'inbox' | 'today' | 'upcoming' | 'completed';

export interface TaskSection {
  id: string;
  title: string;
  tasks: UserTask[];
}

function sortByScheduleThenTitle(a: UserTask, b: UserTask): number {
  const priorityWeight = (p?: string) => (p === 'high' ? 3 : p === 'medium' ? 2 : 1);
  const pa = priorityWeight(a.priority);
  const pb = priorityWeight(b.priority);
  if (pa !== pb) return pb - pa;

  const ta = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
  const tb = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
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

/** Today: не-inbox просроченные и на сегодня; плюс выполненные сегодня (не inbox). todayKey — YYYY-MM-DD в Asia/Almaty. */
export function getTodaySections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const overdue: UserTask[] = [];
  const todayScheduled: UserTask[] = [];
  const doneToday: UserTask[] = [];

  for (const t of tasks) {
    if (t.inbox) {
      continue;
    }
    if (t.completed) {
      const ref = t.completed_at;
      if (ref && toAppDateKey(ref) === todayKey) {
        doneToday.push(t);
      }
      continue;
    }
    if (!t.scheduled_at) continue;
    const key = toAppDateKey(t.scheduled_at);
    if (key < todayKey) {
      overdue.push(t);
      continue;
    }
    if (key === todayKey) {
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

/** Overdue: tasks scheduled strictly before today. */
export function getOverdueSections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const overdue: UserTask[] = [];

  for (const t of tasks) {
    if (t.completed || t.inbox || !t.scheduled_at) continue;
    const key = toAppDateKey(t.scheduled_at);
    if (key < todayKey) overdue.push(t);
  }

  overdue.sort(sortByScheduleThenTitle);

  const sections: TaskSection[] = [];
  if (overdue.length > 0) {
    sections.push({ id: 'overdue', title: 'Просрочено', tasks: overdue });
  }
  return sections;
}

/** Upcoming: future scheduled tasks grouped by date (after today), excluding inbox-flagged. */
export function getUpcomingSections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const map = new Map<string, UserTask[]>();

  for (const t of tasks) {
    if (t.completed || t.inbox || !t.scheduled_at) continue;
    const key = toAppDateKey(t.scheduled_at);
    if (key <= todayKey) continue;
    const list = map.get(key) ?? [];
    list.push(t);
    map.set(key, list);
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
