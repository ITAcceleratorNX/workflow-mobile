/**
 * Client-side views for user tasks (Todoist-like) without backend changes.
 * Inbox: no scheduled_at
 * Today: tasks scheduled for today
 * Upcoming: scheduled strictly after today, grouped by calendar day
 */

import { formatDateForApi } from '@/lib/dateTimeUtils';
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

/** Выполненные: по дате завершения (новые сверху). */
export function getCompletedTasks(tasks: UserTask[]): UserTask[] {
  return tasks
    .filter((t) => t.completed)
    .sort((a, b) => {
      const ca = a.completed_at ?? a.updated_at;
      const cb = b.completed_at ?? b.updated_at;
      return cb.localeCompare(ca);
    });
}

/** Inbox: unscheduled tasks. */
export function getInboxTasks(tasks: UserTask[]): UserTask[] {
  const priorityWeight = (p?: string) => (p === 'high' ? 3 : p === 'medium' ? 2 : 1);
  return tasks
    .filter((t) => !t.scheduled_at)
    .filter((t) => !t.completed)
    .sort((a, b) => {
      const pa = priorityWeight(a.priority);
      const pb = priorityWeight(b.priority);
      if (pa !== pb) return pb - pa;
      return b.updated_at.localeCompare(a.updated_at);
    });
}

/** Today view: tasks scheduled for today. */
export function getTodaySections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const overdue: UserTask[] = [];
  const todayScheduled: UserTask[] = [];

  for (const t of tasks) {
    if (t.completed) continue;
    if (!t.scheduled_at) continue;
    const key = formatDateForApi(new Date(t.scheduled_at));
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

  const sections: TaskSection[] = [];
  if (overdue.length > 0) {
    sections.push({ id: 'overdue', title: 'Просрочено', tasks: overdue });
  }
  if (todayScheduled.length > 0) {
    sections.push({ id: 'today', title: 'Сегодня', tasks: todayScheduled });
  }
  return sections;
}

/** Overdue: tasks scheduled strictly before today. */
export function getOverdueSections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const overdue: UserTask[] = [];

  for (const t of tasks) {
    if (t.completed || !t.scheduled_at) continue;
    const key = formatDateForApi(new Date(t.scheduled_at));
    if (key < todayKey) overdue.push(t);
  }

  overdue.sort(sortByScheduleThenTitle);

  const sections: TaskSection[] = [];
  if (overdue.length > 0) {
    sections.push({ id: 'overdue', title: 'Просрочено', tasks: overdue });
  }
  return sections;
}

/** Upcoming: future scheduled tasks grouped by date (after today). */
export function getUpcomingSections(tasks: UserTask[], todayKey: string): TaskSection[] {
  const map = new Map<string, UserTask[]>();

  for (const t of tasks) {
    if (t.completed || !t.scheduled_at) continue;
    const key = formatDateForApi(new Date(t.scheduled_at));
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
  if (dateKey === formatDateForApi(yesterday)) return 'Вчера';
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (dateKey === formatDateForApi(tomorrow)) return 'Завтра';
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}
