import { useState, useEffect, useCallback } from 'react';

import {
  getUserTasks,
  createUserTask,
  updateUserTask,
  deleteUserTask,
  type UserTask,
  type TaskFilter,
} from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export function useTodoList(filter: TaskFilter = 'all') {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);

  const refresh = useCallback(async () => {
    if (!token || isGuest) {
      setTasks([]);
      setTotal(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await getUserTasks({ filter, pageSize: 100 });

    setLoading(false);

    if (res.ok) {
      setTasks(res.data.tasks);
      setTotal(res.data.total);
    } else {
      setError(res.error);
    }
  }, [token, isGuest, filter]);

  useEffect(() => {
    refresh();
  }, [refresh, version]);

  const addTask = useCallback(
    async (
      title: string,
      scheduledAt?: string | null,
      deadline?: { from?: string | null; to?: string | null; time?: string | null },
      assigneeIds?: number[]
    ) => {
      const res = await createUserTask({
        title,
        scheduled_at: scheduledAt ?? null,
        deadline_from: deadline?.from ?? null,
        deadline_to: deadline?.to ?? null,
        deadline_time: deadline?.time ?? null,
        assignee_ids: assigneeIds?.length ? assigneeIds : undefined,
      });
      if (res.ok) {
        setTasks((prev) => [res.data, ...prev]);
        bump();
        refresh();
        return res.data;
      }
      return null;
    },
    [refresh, bump]
  );

  const toggleComplete = useCallback(
    async (task: UserTask) => {
      const res = await updateUserTask(task.id, { completed: !task.completed });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, completed: !t.completed } : t))
        );
        bump();
        refresh();
      }
    },
    [refresh, bump]
  );

  const removeTask = useCallback(
    async (task: UserTask) => {
      const res = await deleteUserTask(task.id);
      if (res.ok) {
        setTasks((prev) => prev.filter((t) => t.id !== task.id));
        bump();
        refresh();
      }
    },
    [refresh, bump]
  );

  const updateTask = useCallback(
    async (task: UserTask, updates: Partial<UserTask>) => {
      const res = await updateUserTask(task.id, updates);
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, ...res.data } : t))
        );
        bump();
        refresh();
        return res.data;
      }
      return null;
    },
    [refresh, bump]
  );

  return {
    tasks,
    total,
    loading,
    error,
    refresh,
    addTask,
    toggleComplete,
    removeTask,
    updateTask,
  };
}
