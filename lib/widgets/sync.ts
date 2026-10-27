import AsyncStorage from '@react-native-async-storage/async-storage';

import { config } from '@/lib/config';
import { toAppDateKey } from '@/lib/dateTimeUtils';
import { useAuthStore } from '@/stores/auth-store';

import {
  buildWidgetTimeline,
  signedOutWidgetSnapshot,
  snapshotWhenRefreshFailed,
  type WidgetSession,
  type WidgetTask,
  type WidgetTimelineEntry,
  type WorkflowWidgetSnapshot,
} from './model';
import { publishWidgetActions, publishWidgetTimeline } from './publish';

const CACHE_KEY = 'workflow-widget-snapshot';
const PAGE_SIZE = 100;
const MAX_PAGES = 3;
const REQUEST_TIMEOUT_MS = 12000;

let generation = 0;
let running: Promise<void> | null = null;
let rerun = false;

export function sessionFromAuthState(state: {
  token: string | null;
  isGuest: boolean;
  user: { id?: number | null } | null;
}): WidgetSession {
  const userId = state.user?.id;
  return {
    token: state.token,
    isGuest: state.isGuest,
    userId: typeof userId === 'number' && userId > 0 ? userId : null,
  };
}

export async function readWidgetSessionFromStorage(): Promise<WidgetSession> {
  try {
    const raw = await AsyncStorage.getItem('auth-storage');
    if (!raw) return { token: null, isGuest: false, userId: null };
    const parsed = JSON.parse(raw) as { state?: { token?: string | null; isGuest?: boolean; user?: { id?: number } | null } };
    const state = parsed.state ?? {};
    return sessionFromAuthState({
      token: state.token ?? null,
      isGuest: state.isGuest === true,
      user: state.user ?? null,
    });
  } catch {
    return { token: null, isGuest: false, userId: null };
  }
}

function signedOut(now: Date): WidgetTimelineEntry[] {
  return [{ at: now.toISOString(), snapshot: signedOutWidgetSnapshot(now) }];
}

async function readCache(): Promise<WorkflowWidgetSnapshot | null> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as WorkflowWidgetSnapshot;
    if (!parsed || typeof parsed.kind !== 'string' || typeof parsed.dayKey !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writeCache(snapshot: WorkflowWidgetSnapshot | null): Promise<void> {
  try {
    if (!snapshot || snapshot.kind === 'signedOut' || snapshot.kind === 'offline') {
      await AsyncStorage.removeItem(CACHE_KEY);
      return;
    }
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Виджет остаётся на последней успешной публикации в памяти процесса.
  }
}

function parseTasks(body: unknown): { tasks: WidgetTask[]; totalPages: number } | null {
  if (!body || typeof body !== 'object') return null;
  const page = body as { tasks?: unknown; totalPages?: unknown };
  if (!Array.isArray(page.tasks)) return null;
  const tasks: WidgetTask[] = [];
  for (const raw of page.tasks) {
    if (!raw || typeof raw !== 'object') continue;
    const row = raw as Record<string, unknown>;
    const id = typeof row.id === 'number' ? row.id : Number(row.id);
    if (!Number.isInteger(id) || id <= 0) continue;
    const priority = row.priority === 'high' || row.priority === 'low' || row.priority === 'medium' ? row.priority : 'medium';
    tasks.push({
      id,
      title: typeof row.title === 'string' ? row.title : '',
      completed: row.completed === true,
      scheduledAt: typeof row.scheduled_at === 'string' ? row.scheduled_at : null,
      deadlineTo: typeof row.deadline_to === 'string' ? row.deadline_to : null,
      deadlineTime: typeof row.deadline_time === 'string' ? row.deadline_time : null,
      inbox: row.inbox === true,
      priority,
    });
  }
  const totalPages = typeof page.totalPages === 'number' && page.totalPages > 0 ? page.totalPages : 1;
  return { tasks, totalPages };
}

async function fetchTodayTasks(
  token: string,
  todayKey: string
): Promise<{ ok: true; tasks: WidgetTask[] } | { ok: false; status?: number }> {
  const tasks: WidgetTask[] = [];
  for (let page = 1; page <= MAX_PAGES; page += 1) {
    const url = `${config.apiBaseUrl}/user-tasks?${new URLSearchParams({
      view: 'list_today',
      today: todayKey,
      light: '1',
      page: String(page),
      pageSize: String(PAGE_SIZE),
    })}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        signal: controller.signal,
      });
    } catch {
      return { ok: false };
    } finally {
      clearTimeout(timer);
    }
    if (response.status === 401 || response.status === 403) return { ok: false, status: response.status };
    if (!response.ok) return { ok: false, status: response.status };
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      return { ok: false, status: response.status };
    }
    const parsed = parseTasks(body);
    if (!parsed) return { ok: false, status: response.status };
    tasks.push(...parsed.tasks);
    if (page >= parsed.totalPages) break;
  }
  return { ok: true, tasks };
}

async function refresh(session: WidgetSession): Promise<void> {
  const now = new Date();
  const signedOutSession = !session.token || session.isGuest || session.token === 'guest-demo';
  if (signedOutSession) {
    await writeCache(null);
    publishWidgetTimeline(signedOut(now));
    publishWidgetActions();
    return;
  }

  const todayKey = toAppDateKey(now);
  const result = await fetchTodayTasks(session.token as string, todayKey);
  if (result.ok) {
    const entries = buildWidgetTimeline(result.tasks, now, session.userId, now.toISOString());
    await writeCache(entries[0]?.snapshot ?? null);
    publishWidgetTimeline(entries);
    publishWidgetActions();
    return;
  }

  if (result.status === 401 || result.status === 403) {
    await writeCache(null);
    publishWidgetTimeline(signedOut(now));
    publishWidgetActions();
    return;
  }

  const cache = await readCache();
  const snapshot = snapshotWhenRefreshFailed(cache, session.userId, now);
  publishWidgetTimeline([{ at: now.toISOString(), snapshot }]);
  publishWidgetActions();
}

async function drain(session: () => WidgetSession | Promise<WidgetSession>): Promise<void> {
  if (running) {
    rerun = true;
    return running;
  }
  running = (async () => {
    do {
      rerun = false;
      const current = ++generation;
      const nextSession = await session();
      if (current !== generation) continue;
      await refresh(nextSession);
    } while (rerun);
  })().finally(() => {
    running = null;
  });
  return running;
}

/** Обновить виджеты из уже восстановленной сессии приложения. */
export function syncWorkflowWidgets(): Promise<void> {
  return drain(() => sessionFromAuthState(useAuthStore.getState()));
}

/** Фоновый запуск: сессия читается из хранилища, память стора может быть ещё пустой. */
export function syncWorkflowWidgetsFromStorage(): Promise<void> {
  return drain(() => readWidgetSessionFromStorage());
}
