/**
 * Ближайшая задача для системного виджета и адреса, которыми виджет открывает приложение.
 *
 * «На сегодня» — тот же календарный день Asia/Almaty, что у списка «Сегодня»:
 * день планирования это `scheduled_at`, а у входящей без него — `deadline_to`.
 * Выполненные и задачи других дней в виджет не попадают. Ближайшая — с наименьшим
 * расстоянием до текущего момента; при равенстве берётся ещё не наступившая.
 */

import { formatTaskTime, toAppDateKey } from '@/lib/dateTimeUtils';

/** Алматы без перехода на летнее время: полночь дня считается как UTC+5. */
const ALMATY_OFFSET_HOURS = 5;

export type WidgetTaskPriority = 'low' | 'medium' | 'high';

export interface WidgetTask {
  id: number;
  title: string;
  completed: boolean;
  scheduledAt: string | null;
  deadlineTo: string | null;
  deadlineTime: string | null;
  inbox: boolean;
  priority: WidgetTaskPriority | string | null;
}

export type WidgetSnapshotKind = 'task' | 'empty' | 'signedOut' | 'offline';

export interface WorkflowWidgetSnapshot {
  kind: WidgetSnapshotKind;
  eyebrow: string;
  title: string;
  subtitle: string;
  inline: string;
  url: string;
  taskId: number | null;
  dayKey: string;
  userId: number | null;
  stale: boolean;
  fetchedAt: string | null;
}

export interface WidgetTimelineEntry {
  at: string;
  snapshot: WorkflowWidgetSnapshot;
}

export interface WidgetSession {
  token: string | null;
  isGuest: boolean;
  userId: number | null;
}

export const WIDGET_URLS = {
  tasks: 'workflowmobile://widget/tasks',
  createTask: 'workflowmobile://widget/task/create',
  createRequest: 'workflowmobile://widget/request/create',
  task: (id: number) => `workflowmobile://widget/task/${id}`,
} as const;

export const WIDGET_HREFS = {
  tasks: '/client/tasks?tab=today',
  createTask: '/client/tasks?tab=today&compose=1',
  createRequest: '/requests/create',
  task: (id: number) => `/client/tasks/details?taskId=${id}`,
} as const;

const EMPTY_TITLE = 'Задач нет';
const EMPTY_SUBTITLE = 'На сегодня ничего не запланировано';
const SIGNED_OUT_TITLE = 'Войдите в аккаунт';
const OFFLINE_TITLE = 'Задачи недоступны';
const OFFLINE_SUBTITLE = 'Нет сети. Откройте приложение, когда связь появится';
const STALE_SUBTITLE = 'Нет сети';
const UNTIMED_EYEBROW = 'Сегодня';
const FALLBACK_TITLE = 'Без названия';

function priorityWeight(priority: WidgetTask['priority']): number {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  return 1;
}

function planDayKey(task: WidgetTask): string | null {
  if (task.scheduledAt) {
    const key = toAppDateKey(task.scheduledAt);
    return key || null;
  }
  if (!task.inbox || !task.deadlineTo) return null;
  const sliced = task.deadlineTo.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(sliced)) return sliced;
  const key = toAppDateKey(task.deadlineTo);
  return key || null;
}

function wallClockMs(dateKey: string, hours: number, minutes: number): number {
  const [year, month, day] = dateKey.split('-').map((part) => Number(part));
  return Date.UTC(year, month - 1, day, hours - ALMATY_OFFSET_HOURS, minutes, 0, 0);
}

function taskInstantMs(task: WidgetTask): number | null {
  if (task.scheduledAt) {
    const ms = new Date(task.scheduledAt).getTime();
    return Number.isFinite(ms) ? ms : null;
  }
  const day = planDayKey(task);
  if (!day || !task.deadlineTime || !/^\d{1,2}:\d{2}$/.test(task.deadlineTime)) return null;
  const [hours, minutes] = task.deadlineTime.split(':').map((part) => Number(part));
  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) return null;
  return wallClockMs(day, hours, minutes);
}

function taskTitle(task: WidgetTask): string {
  const title = task.title.trim();
  return title || FALLBACK_TITLE;
}

function compareUntimed(a: WidgetTask, b: WidgetTask): number {
  const byPriority = priorityWeight(b.priority) - priorityWeight(a.priority);
  if (byPriority !== 0) return byPriority;
  return taskTitle(a).localeCompare(taskTitle(b), 'ru');
}

/** Незавершённые задачи календарного дня `now` в Asia/Almaty. */
export function tasksForWidgetDay(tasks: readonly WidgetTask[], now: Date): WidgetTask[] {
  const todayKey = toAppDateKey(now);
  return tasks.filter((task) => !task.completed && planDayKey(task) === todayKey);
}

/**
 * Ближайшая незавершённая задача на сегодня.
 * Среди задач со временем побеждает минимальный |момент − сейчас|;
 * без времени — самая приоритетная, как в списке дня.
 */
export function pickNearestTask(tasks: readonly WidgetTask[], now: Date): WidgetTask | null {
  const today = tasksForWidgetDay(tasks, now);
  if (today.length === 0) return null;

  const timed = today
    .map((task) => ({ task, at: taskInstantMs(task) }))
    .filter((item): item is { task: WidgetTask; at: number } => item.at != null);

  if (timed.length === 0) {
    return [...today].sort(compareUntimed)[0] ?? null;
  }

  const nowMs = now.getTime();
  return timed
    .slice()
    .sort((a, b) => {
      const byDistance = Math.abs(a.at - nowMs) - Math.abs(b.at - nowMs);
      if (byDistance !== 0) return byDistance;
      const aUpcoming = a.at >= nowMs ? 0 : 1;
      const bUpcoming = b.at >= nowMs ? 0 : 1;
      if (aUpcoming !== bUpcoming) return aUpcoming - bUpcoming;
      return compareUntimed(a.task, b.task);
    })[0].task;
}

export function nextAlmatyMidnight(now: Date): Date {
  const todayKey = toAppDateKey(now);
  const [year, month, day] = todayKey.split('-').map((part) => Number(part));
  return new Date(Date.UTC(year, month - 1, day + 1, -ALMATY_OFFSET_HOURS, 0, 0, 0));
}

function timeLabel(task: WidgetTask): string | null {
  const instant = taskInstantMs(task);
  if (instant == null) return null;
  const label = formatTaskTime(new Date(instant));
  return label || null;
}

function taskSnapshot(
  task: WidgetTask,
  now: Date,
  userId: number | null,
  fetchedAt: string | null
): WorkflowWidgetSnapshot {
  const eyebrow = timeLabel(task) ?? UNTIMED_EYEBROW;
  const title = taskTitle(task);
  return {
    kind: 'task',
    eyebrow,
    title,
    subtitle: '',
    inline: `${eyebrow} ${title}`,
    url: WIDGET_URLS.task(task.id),
    taskId: task.id,
    dayKey: toAppDateKey(now),
    userId,
    stale: false,
    fetchedAt,
  };
}

export function emptyWidgetSnapshot(now: Date, userId: number | null, fetchedAt: string | null): WorkflowWidgetSnapshot {
  return {
    kind: 'empty',
    eyebrow: UNTIMED_EYEBROW,
    title: EMPTY_TITLE,
    subtitle: EMPTY_SUBTITLE,
    inline: 'Задач на сегодня нет',
    url: WIDGET_URLS.tasks,
    taskId: null,
    dayKey: toAppDateKey(now),
    userId,
    stale: false,
    fetchedAt,
  };
}

export function signedOutWidgetSnapshot(now: Date = new Date()): WorkflowWidgetSnapshot {
  return {
    kind: 'signedOut',
    eyebrow: 'Workflow',
    title: SIGNED_OUT_TITLE,
    subtitle: 'Задачи появятся после входа',
    inline: 'Войдите в Workflow',
    url: WIDGET_URLS.tasks,
    taskId: null,
    dayKey: toAppDateKey(now),
    userId: null,
    stale: false,
    fetchedAt: null,
  };
}

export function offlineWidgetSnapshot(now: Date, userId: number | null): WorkflowWidgetSnapshot {
  return {
    kind: 'offline',
    eyebrow: 'Нет сети',
    title: OFFLINE_TITLE,
    subtitle: OFFLINE_SUBTITLE,
    inline: 'Нет сети',
    url: WIDGET_URLS.tasks,
    taskId: null,
    dayKey: toAppDateKey(now),
    userId,
    stale: true,
    fetchedAt: null,
  };
}

export function snapshotAt(
  tasks: readonly WidgetTask[],
  now: Date,
  userId: number | null,
  fetchedAt: string | null
): WorkflowWidgetSnapshot {
  const nearest = pickNearestTask(tasks, now);
  if (!nearest) return emptyWidgetSnapshot(now, userId, fetchedAt);
  return taskSnapshot(nearest, now, userId, fetchedAt);
}

function sameGlance(a: WorkflowWidgetSnapshot, b: WorkflowWidgetSnapshot): boolean {
  return a.kind === b.kind && a.taskId === b.taskId && a.dayKey === b.dayKey && a.inline === b.inline;
}

/**
 * Расписание виджета до ближайшей полуночи Алматы: смена задачи в середине
 * интервала между двумя временами и пустое состояние нового дня.
 */
export function buildWidgetTimeline(
  tasks: readonly WidgetTask[],
  now: Date,
  userId: number | null,
  fetchedAt: string | null = now.toISOString()
): WidgetTimelineEntry[] {
  const midnight = nextAlmatyMidnight(now);
  const switchPoints = new Set<number>();
  const today = tasksForWidgetDay(tasks, now);
  const instants = [...new Set(today.map(taskInstantMs).filter((at): at is number => at != null))].sort(
    (a, b) => a - b
  );
  for (let index = 0; index < instants.length - 1; index += 1) {
    const midpoint = instants[index] + (instants[index + 1] - instants[index]) / 2;
    if (midpoint > now.getTime() && midpoint < midnight.getTime()) switchPoints.add(midpoint);
  }
  switchPoints.add(midnight.getTime());

  const entries: WidgetTimelineEntry[] = [
    { at: now.toISOString(), snapshot: snapshotAt(tasks, now, userId, fetchedAt) },
  ];
  for (const at of [...switchPoints].sort((a, b) => a - b)) {
    const when = new Date(at);
    const snapshot = snapshotAt(tasks, when, userId, fetchedAt);
    const previous = entries[entries.length - 1];
    if (previous && sameGlance(previous.snapshot, snapshot)) continue;
    entries.push({ at: when.toISOString(), snapshot });
  }
  return entries;
}

/**
 * Сбой сети не стирает сегодняшнюю задачу. Чужой день, другой пользователь
 * и отсутствие кэша показывают отдельное состояние без вчерашних данных.
 */
export function snapshotWhenRefreshFailed(
  cache: WorkflowWidgetSnapshot | null,
  userId: number | null,
  now: Date
): WorkflowWidgetSnapshot {
  const todayKey = toAppDateKey(now);
  const reusable =
    cache != null &&
    cache.userId === userId &&
    cache.dayKey === todayKey &&
    (cache.kind === 'task' || cache.kind === 'empty');
  if (!reusable || !cache) return offlineWidgetSnapshot(now, userId);
  if (cache.kind === 'empty') return { ...cache, stale: true };
  return { ...cache, stale: true, subtitle: STALE_SUBTITLE };
}

const WIDGET_APP_PATHS = new Set(['/client/tasks', '/client/tasks/details', '/requests/create']);

/** Внутренний адрес, который виджет открывает после входа. */
export function isWidgetAppHref(href: string): boolean {
  const path = href.split('?')[0];
  return WIDGET_APP_PATHS.has(path);
}

export function parseWidgetLink(url: string): { href: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== 'workflowmobile:') return null;
  if (parsed.hostname !== 'widget') return null;
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parts.length === 1 && parts[0] === 'tasks') return { href: WIDGET_HREFS.tasks };
  if (parts[0] === 'task' && parts[1] === 'create') return { href: WIDGET_HREFS.createTask };
  if (parts[0] === 'request' && parts[1] === 'create') return { href: WIDGET_HREFS.createRequest };
  if (parts[0] === 'task' && parts[1] && /^\d+$/.test(parts[1])) {
    const id = Number(parts[1]);
    if (Number.isInteger(id) && id > 0) return { href: WIDGET_HREFS.task(id) };
  }
  return null;
}

/** Гость и отсутствие токена — не сессия задачника: сначала вход, потом действие виджета. */
export function canOpenWidgetDestination(session: { token?: string | null; isGuest?: boolean }): boolean {
  return Boolean(session.token) && session.isGuest !== true && session.token !== 'guest-demo';
}
