import { useState, useEffect, useCallback, useRef } from 'react';

import {
  getUserTasks,
  getTodayStats,
  updateUserTask,
  type UserTask,
  type TodayStats,
} from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export function useTodayTasks() {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [stats, setStats] = useState<TodayStats>({ todayCompleted: 0, todayTotal: 0, overdueCount: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);

  const refresh = useCallback(async () => {
    if (!token || isGuest) {
      setTasks([]);
      setStats({ todayCompleted: 0, todayTotal: 0, overdueCount: 0 });
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const [tasksRes, statsRes] = await Promise.all([
      getUserTasks({ filter: 'today' }),
      getTodayStats(),
    ]);

    setLoading(false);

    if (tasksRes.ok) setTasks(tasksRes.data.tasks);
    else setError(tasksRes.error);

    if (statsRes.ok) setStats(statsRes.data);
  }, [token, isGuest]);

  const silentRefresh = useCallback(async () => {
    if (!token || isGuest) return;
    const [tasksRes, statsRes] = await Promise.all([
      getUserTasks({ filter: 'today' }),
      getTodayStats(),
    ]);
    if (tasksRes.ok) setTasks(tasksRes.data.tasks);
    if (statsRes.ok) setStats(statsRes.data);
  }, [token, isGuest]);

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
    async (task: UserTask) => {
      const res = await updateUserTask(task.id, { completed: !task.completed });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t))
        );
        bump();
      }
    },
    [bump]
  );

  return {
    tasks,
    stats,
    loading,
    error,
    refresh,
    toggleComplete,
  };
}
