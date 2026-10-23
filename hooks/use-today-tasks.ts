import { useAsyncResource } from '@/hooks/use-async-resource';
import { useEffect, useCallback, useRef } from 'react';

import {
  getUserTasks,
  getTodayStats,
  updateUserTask,
  type UserTask,
  type TodayStats,
} from '@/lib/user-tasks-api';
import { confirmTaskToggle } from '@/lib/group-task-completion';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export function useTodayTasks() {

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);

  const load = useCallback(async () => {
    const [tasksRes, statsRes] = await Promise.all([getUserTasks({ filter: 'today' }), getTodayStats()]);
    if (!tasksRes.ok) throw new Error(tasksRes.error);
    if (!statsRes.ok) throw new Error(statsRes.error);
    return { tasks: tasksRes.data.tasks, stats: statsRes.data };
  }, []);
  const { data: { tasks, stats }, setData, loading, error, refresh } = useAsyncResource<{ tasks: UserTask[]; stats: TodayStats }>(load, { tasks: [], stats: { todayCompleted: 0, todayTotal: 0, overdueCount: 0 } }, !!token && !isGuest, token);

  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current === version) return;
    previousVersion.current = version;
    void refresh();
  }, [version, refresh]);

  const toggleComplete = useCallback(
    async (task: UserTask) => {
      if (!(await confirmTaskToggle(task))) return;
      const res = await updateUserTask(task.id, { completed: !task.completed });
      if (res.ok) {
        setData((prev) => ({ ...prev, tasks: prev.tasks.map((t) => t.id === task.id ? { ...t, ...res.data } : t) }));
        bump();
      }
    },
    [bump, setData]
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
