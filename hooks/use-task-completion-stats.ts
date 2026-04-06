import { useCallback, useEffect, useState } from 'react';

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
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [todayTotal, setTodayTotal] = useState(0);
  const [weekCompleted, setWeekCompleted] = useState(0);
  const [weekTotal, setWeekTotal] = useState(0);
  const [monthCompleted, setMonthCompleted] = useState(0);
  const [monthTotal, setMonthTotal] = useState(0);
  const [loading, setLoading] = useState(false);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);

  const load = useCallback(async () => {
    if (!token || isGuest) {
      setTodayCompleted(0);
      setTodayTotal(0);
      setWeekCompleted(0);
      setWeekTotal(0);
      setMonthCompleted(0);
      setMonthTotal(0);
      return;
    }

    setLoading(true);
    try {
      const now = new Date();
      const wr = getWeekRange(now);
      const mr = getMonthRange(now);
      const wStart = toAppDateKey(wr.start);
      const wEnd = toAppDateKey(wr.end);
      const mStart = toAppDateKey(mr.start);
      const mEnd = toAppDateKey(mr.end);

      const [statsRes, weekCalRes, monthCalRes] = await Promise.all([
        getTodayStats(),
        getUserTasksCalendar(addDaysToDateKey(wStart, -1), addDaysToDateKey(wEnd, 1)),
        getUserTasksCalendar(addDaysToDateKey(mStart, -1), addDaysToDateKey(mEnd, 1)),
      ]);

      if (statsRes.ok) {
        setTodayCompleted(statsRes.data.todayCompleted);
        setTodayTotal(statsRes.data.todayTotal);
      }

      if (weekCalRes.ok) {
        const w = aggregateRange(weekCalRes.data.tasks, wStart, wEnd);
        setWeekCompleted(w.completed);
        setWeekTotal(w.total);
      }

      if (monthCalRes.ok) {
        const m = aggregateRange(monthCalRes.data.tasks, mStart, mEnd);
        setMonthCompleted(m.completed);
        setMonthTotal(m.total);
      }
    } finally {
      setLoading(false);
    }
  }, [token, isGuest]);

  useEffect(() => {
    if (!enabled) return;
    load();
  }, [enabled, version, load]);

  return {
    todayCompleted,
    todayTotal,
    weekCompleted,
    weekTotal,
    monthCompleted,
    monthTotal,
    loading,
    refresh: load,
  };
}
