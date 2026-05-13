import { useState, useEffect, useCallback, useRef } from 'react';

import { addDaysToDateKey, toAppDateKey } from '@/lib/dateTimeUtils';
import { getUserTasksCalendar, updateUserTask, type CalendarTask } from '@/lib/user-tasks-api';
import { useToast } from '@/context/toast-context';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export function useCalendarTasks(startDate: Date, endDate: Date) {
  const [tasks, setTasks] = useState<CalendarTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingTaskIds, setTogglingTaskIds] = useState<number[]>([]);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const { show: showToast } = useToast();
  const tasksRef = useRef<CalendarTask[]>([]);

  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

  const fetchRange = useCallback(async () => {
    const startKey = toAppDateKey(startDate);
    const endKey = toAppDateKey(endDate);
    const startStr = addDaysToDateKey(startKey, -1);
    const endStr = addDaysToDateKey(endKey, 1);
    return getUserTasksCalendar(startStr, endStr);
  }, [startDate, endDate]);

  const refresh = useCallback(async () => {
    if (!token || isGuest) {
      setTasks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await fetchRange();

    setLoading(false);

    if (res.ok) setTasks(res.data.tasks);
    else setError(res.error);
  }, [token, isGuest, fetchRange]);

  const silentRefresh = useCallback(async () => {
    if (!token || isGuest) return;
    const res = await fetchRange();
    if (res.ok) setTasks(res.data.tasks);
  }, [token, isGuest, fetchRange]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const skipVersionSyncRef = useRef(true);
  useEffect(() => {
    if (skipVersionSyncRef.current) {
      skipVersionSyncRef.current = false;
      return;
    }
    if (version === 0) return;
    silentRefresh();
  }, [version, silentRefresh]);

  const toggleComplete = useCallback(
    async (task: CalendarTask) => {
      if (!token || isGuest) {
        showToast({
          title: 'Недоступно',
          description: 'Нужно войти в аккаунт, чтобы менять задачи',
          variant: 'destructive',
          duration: 4000,
        });
        return;
      }

      const before = tasksRef.current;
      const nextCompleted = !task.completed;
      setTogglingTaskIds((prev) => [...prev, task.id]);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));

      const res = await updateUserTask(task.id, { completed: nextCompleted });
      setTogglingTaskIds((prev) => prev.filter((id) => id !== task.id));

      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: res.data.completed } : t)));
        return;
      }

      setTasks(before);
      showToast({
        title: 'Не удалось обновить задачу',
        description: res.error,
        variant: 'destructive',
        duration: 4000,
      });
    },
    [token, isGuest, showToast]
  );

  return {
    tasks,
    loading,
    error,
    refresh,
    toggleComplete,
    togglingTaskIds,
  };
}
