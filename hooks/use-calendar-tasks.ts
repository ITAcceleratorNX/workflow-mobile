import { useState, useEffect, useCallback } from 'react';

import { getUserTasksCalendar, type CalendarTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function useCalendarTasks(startDate: Date, endDate: Date) {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);

  const refresh = useCallback(async () => {
    if (!token || isGuest) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const startStr = toDateKey(startDate);
    const endStr = toDateKey(endDate);

    const res = await getUserTasksCalendar(startStr, endStr);

    setLoading(false);

    if (res.ok) setTasks(res.data.tasks);
    else setError(res.error);
  }, [token, isGuest, startDate, endDate]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  return {
    tasks,
    loading,
    error,
    refresh,
  };
}
