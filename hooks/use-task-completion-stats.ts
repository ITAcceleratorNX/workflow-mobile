import { useAsyncResource } from '@/hooks/use-async-resource';
import { useCallback, useEffect, useRef } from 'react';

import { addDaysToDateKey, toAppDateKey } from '@/lib/dateTimeUtils';
import { getTodayStats, getUserTasksCalendar, type CalendarTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

function getWeekRange(ref: Date): { start: Date; end: Date } {
  const d = new Date(ref);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function getMonthRange(ref: Date): { start: Date; end: Date } {
  const start = new Date(ref.getFullYear(), ref.getMonth(), 1);
  const end = new Date(ref.getFullYear(), ref.getMonth() + 1, 0);
  return { start, end };
}

function aggregateRange(tasks: CalendarTask[], startKey: string, endKey: string) {
  let total = 0;
  let completed = 0;
  for (const t of tasks) {
    if (!t.scheduled_at) continue;
    const k = toAppDateKey(t.scheduled_at);
    if (k >= startKey && k <= endKey) {
      total += 1;
      if (t.completed) completed += 1;
    }
  }
  return { completed, total };
}

/**
 * Загружает агрегаты «выполнено из запланированных» при открытии панели.
 * Сегодня — /user-tasks/today-stats; неделя/месяц — календарь + фильтр по дню в Asia/Almaty.
 */
export function useTaskCompletionStats(enabled: boolean) {

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);

  const load = useCallback(async () => {
    const now = new Date();
    const wr = getWeekRange(now), mr = getMonthRange(now);
    const wStart = toAppDateKey(wr.start), wEnd = toAppDateKey(wr.end);
    const mStart = toAppDateKey(mr.start), mEnd = toAppDateKey(mr.end);
    const [statsRes, weekRes, monthRes] = await Promise.all([
      getTodayStats(), getUserTasksCalendar(addDaysToDateKey(wStart, -1), addDaysToDateKey(wEnd, 1)),
      getUserTasksCalendar(addDaysToDateKey(mStart, -1), addDaysToDateKey(mEnd, 1)),
    ]);
    if (!statsRes.ok) throw new Error(statsRes.error);
    if (!weekRes.ok) throw new Error(weekRes.error);
    if (!monthRes.ok) throw new Error(monthRes.error);
    const week = aggregateRange(weekRes.data.tasks, wStart, wEnd), month = aggregateRange(monthRes.data.tasks, mStart, mEnd);
    return { todayCompleted: statsRes.data.todayCompleted, todayTotal: statsRes.data.todayTotal,
      weekCompleted: week.completed, weekTotal: week.total, monthCompleted: month.completed, monthTotal: month.total };
  }, []);
  const { data, loading, refresh } = useAsyncResource(load, { todayCompleted: 0, todayTotal: 0, weekCompleted: 0, weekTotal: 0, monthCompleted: 0, monthTotal: 0 }, enabled && !!token && !isGuest, token);

  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current === version) return;
    previousVersion.current = version;
    void refresh();
  }, [version, refresh]);

  return {
    ...data,
    loading,
    refresh,
  };
}
