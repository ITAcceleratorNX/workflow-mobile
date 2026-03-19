import { useState, useEffect, useCallback } from 'react';

import { addDaysToDateKey, toAppDateKey } from '@/lib/taskDateTime';
import { getUserTasksCalendar, type CalendarTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

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

    const startKey = toAppDateKey(startDate);
    const endKey = toAppDateKey(endDate);
    const startStr = addDaysToDateKey(startKey, -1);
    const endStr = addDaysToDateKey(endKey, 1);

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
