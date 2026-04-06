import { useMemo, useRef, useState, useEffect, useCallback } from 'react';

import {
  getUserTasks,
  createUserTask,
  updateUserTask,
  deleteUserTask,
  type UserTask,
  type TaskPriority,
  type TaskFilter,
} from '@/lib/user-tasks-api';
import { defaultRecurrenceNone, type TaskRecurrencePayload } from '@/lib/task-recurrence';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import { useToast } from '@/context/toast-context';

/** Поля, которые реально принимает PATCH /user-tasks/:id (остальное только для оптимистичного UI). */
const USER_TASK_API_PATCH_KEYS = [
  'title',
  'priority',
  'completed',
  'scheduled_at',
  'deadline_from',
  'deadline_to',
  'deadline_time',
  'assignee_ids',
  'team_id',
  'executor_id',
  'reminders_disabled',
  'remind_at',
  'remind_before_minutes',
  'recurrence_type',
  'recurrence_interval',
  'recurrence_custom_unit',
  'recurrence_weekdays',
] as const;

function pickUserTaskApiPatch(updates: Partial<UserTask>): Parameters<typeof updateUserTask>[1] {
  const out: Record<string, unknown> = {};
  const u = updates as Record<string, unknown>;
  for (const k of USER_TASK_API_PATCH_KEYS) {
    if (u[k] !== undefined) out[k] = u[k];
  }
  return out as Parameters<typeof updateUserTask>[1];
}

export function useTodoList(filter: TaskFilter = 'all') {
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);
  const { show: showToast } = useToast();

  const tasksRef = useRef<UserTask[]>([]);
  useEffect(() => {
    tasksRef.current = tasks;
  }, [tasks]);

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

  /** Синхронизация с сервером без лоадера (после мутаций и bump из других экранов). */
  const silentRefresh = useCallback(async () => {
    if (!token || isGuest) return;
    const res = await getUserTasks({ filter, pageSize: 100 });
    if (!res.ok) return;
    setTasks(res.data.tasks);
    setTotal(res.data.total);
  }, [token, isGuest, filter]);

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

  const tempIdSeedRef = useRef(-1);
  const nextTempId = useCallback(() => {
    tempIdSeedRef.current -= 1;
    return tempIdSeedRef.current;
  }, []);

  const nowIso = useMemo(() => () => new Date().toISOString(), []);

  const addTask = useCallback(
    async (
      title: string,
      scheduledAt?: string | null,
      remindersDisabled?: boolean,
      remindBeforeMinutes?: number | null,
      assignment?: {
        team_id?: number | null;
        assignees?: { id: number; full_name: string }[];
      },
      priority: TaskPriority = 'medium',
      recurrence?: TaskRecurrencePayload
    ) => {
      if (!token || isGuest) {
        showToast({
          title: 'Недоступно',
          description: 'Нужно войти в аккаунт, чтобы создавать задачи',
          variant: 'destructive',
          duration: 4000,
        });
        return null;
      }
      const optimisticId = nextTempId();
      const assignees = assignment?.assignees ?? [];
      const assigneeIds = assignees.map((a) => a.id);
      const rec = recurrence ?? defaultRecurrenceNone();
      const optimistic: UserTask = {
        id: optimisticId,
        creator_id: 0,
        title,
        completed: false,
        completed_at: null,
        scheduled_at: scheduledAt ?? null,
        deadline_from: null,
        deadline_to: null,
        deadline_time: null,
        remind_at: null,
        priority,
        reminders_disabled: remindersDisabled ?? false,
        remind_before_minutes: remindBeforeMinutes ?? null,
        recurrence_type: rec.recurrence_type,
        recurrence_interval: rec.recurrence_interval,
        recurrence_custom_unit: rec.recurrence_custom_unit,
        recurrence_weekdays: rec.recurrence_weekdays,
        created_at: nowIso(),
        updated_at: nowIso(),
        assignee_ids: assigneeIds,
        assignees,
        team_id: assignment?.team_id ?? null,
        executor_id: null,
      };

      const before = tasksRef.current;
      setTasks((prev) => [optimistic, ...prev]);

      const res = await createUserTask({
        title,
        scheduled_at: scheduledAt ?? null,
        deadline_from: null,
        deadline_to: null,
        deadline_time: null,
        assignee_ids: assigneeIds.length > 0 ? assigneeIds : undefined,
        priority,
        reminders_disabled: remindersDisabled,
        remind_before_minutes: remindBeforeMinutes ?? null,
        team_id: assignment?.team_id ?? null,
        executor_id: null,
        recurrence_type: rec.recurrence_type,
        recurrence_interval: rec.recurrence_interval,
        recurrence_custom_unit: rec.recurrence_custom_unit,
        recurrence_weekdays: rec.recurrence_weekdays,
      });
      if (res.ok) {
        const merged: UserTask = {
          ...res.data,
          title: res.data.title ?? title,
          priority: res.data.priority ?? priority,
        };
        setTasks((prev) => prev.map((t) => (t.id === optimisticId ? merged : t)));
        bump();
        return res.data;
      }
      // rollback
      setTasks(before);
      showToast({ title: 'Не удалось создать задачу', description: res.error, variant: 'destructive', duration: 4000 });
      return null;
    },
    [token, isGuest, bump, nextTempId, showToast, nowIso]
  );

  const toggleComplete = useCallback(
    async (task: UserTask) => {
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
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));

      const res = await updateUserTask(task.id, { completed: nextCompleted });
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => (t.id === task.id ? { ...t, ...res.data } : t))
        );
        bump();
        return;
      }
      // rollback
      setTasks(before);
      showToast({ title: 'Не удалось обновить задачу', description: res.error, variant: 'destructive', duration: 4000 });
    },
    [token, isGuest, bump, showToast]
  );

  const removeTask = useCallback(
    async (task: UserTask) => {
      if (!token || isGuest) {
        showToast({
          title: 'Недоступно',
          description: 'Нужно войти в аккаунт, чтобы удалять задачи',
          variant: 'destructive',
          duration: 4000,
        });
        return;
      }
      const before = tasksRef.current;
      setTasks((prev) => prev.filter((t) => t.id !== task.id));

      const res = await deleteUserTask(task.id);
      if (res.ok) {
        bump();
        return;
      }
      // rollback
      setTasks(before);
      showToast({ title: 'Не удалось удалить задачу', description: res.error, variant: 'destructive', duration: 4000 });
    },
    [token, isGuest, bump, showToast]
  );

  const updateTask = useCallback(
    async (task: UserTask, updates: Partial<UserTask>) => {
      if (!token || isGuest) {
        showToast({
          title: 'Недоступно',
          description: 'Нужно войти в аккаунт, чтобы редактировать задачи',
          variant: 'destructive',
          duration: 4000,
        });
        return null;
      }
      const before = tasksRef.current;
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...updates } : t)));

      const apiPatch = pickUserTaskApiPatch(updates);
      const res = await updateUserTask(task.id, apiPatch);
      if (res.ok) {
        setTasks((prev) =>
          prev.map((t) => {
            if (t.id !== task.id) return t;
            const merged: UserTask = { ...t, ...res.data };
            let ids = merged.assignee_ids;
            if (ids == null) {
              ids =
                merged.assignees?.length ? merged.assignees.map((a) => a.id) : (t.assignee_ids ?? []);
            }
            merged.assignee_ids = ids;
            if (
              ids.length > 0 &&
              (!merged.assignees || merged.assignees.length === 0)
            ) {
              merged.assignees = ids.map((id) => {
                const fromPrev = t.assignees?.find((a) => a.id === id);
                const fromUpdates = updates.assignees?.find((a) => a.id === id);
                return fromPrev ?? fromUpdates ?? { id, full_name: `Пользователь #${id}` };
              });
            }
            return merged;
          })
        );
        bump();
        return res.data;
      }
      // rollback
      setTasks(before);
      showToast({ title: 'Не удалось сохранить изменения', description: res.error, variant: 'destructive', duration: 4000 });
      return null;
    },
    [token, isGuest, bump, showToast]
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
