import { useMemo, useRef, useState, useEffect, useCallback } from 'react';

import {
  getUserTasks,
  createUserTask,
  updateUserTask,
  deleteUserTask,
  type UserTask,
  type TaskPriority,
  type TaskFilter,
  type TaskListView,
} from '@/lib/user-tasks-api';
import { defaultRecurrenceNone, type TaskRecurrencePayload } from '@/lib/task-recurrence';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import { useToast } from '@/context/toast-context';

const DEFAULT_PAGE_SIZE = 50;

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
  'inbox',
] as const;

function pickUserTaskApiPatch(updates: Partial<UserTask>): Parameters<typeof updateUserTask>[1] {
  const out: Record<string, unknown> = {};
  const u = updates as Record<string, unknown>;
  for (const k of USER_TASK_API_PATCH_KEYS) {
    if (u[k] !== undefined) out[k] = u[k];
  }
  return out as Parameters<typeof updateUserTask>[1];
}

export type UseTodoListQuery = {
  filter?: TaskFilter;
  view?: TaskListView;
  today?: string;
  fromDate?: string;
  toDate?: string;
  completedOn?: string;
  light?: boolean;
  pageSize?: number;
  /** false — не грузить (например, режим календаря). */
  enabled?: boolean;
};

function normalizeQuery(input: UseTodoListQuery | TaskFilter): UseTodoListQuery {
  if (typeof input === 'string') return { filter: input };
  return input;
}

function querySignature(q: UseTodoListQuery): string {
  return JSON.stringify({
    filter: q.filter ?? null,
    view: q.view ?? null,
    today: q.today ?? null,
    fromDate: q.fromDate ?? null,
    toDate: q.toDate ?? null,
    completedOn: q.completedOn ?? null,
    light: q.light ?? false,
    pageSize: q.pageSize ?? DEFAULT_PAGE_SIZE,
    enabled: q.enabled !== false,
  });
}

function toApiParams(q: UseTodoListQuery, page: number) {
  const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
  const params: Parameters<typeof getUserTasks>[0] = {
    page,
    pageSize,
    light: q.light ? true : undefined,
  };
  if (q.view) {
    params.view = q.view;
    if (q.today) params.today = q.today;
    if (q.fromDate) params.from_date = q.fromDate;
    if (q.toDate) params.to_date = q.toDate;
    if (q.completedOn) params.completed_on = q.completedOn;
  } else if (q.filter) {
    params.filter = q.filter;
  }
  return params;
}

export function useTodoList(queryInput: UseTodoListQuery | TaskFilter = { filter: 'all' }) {
  const query = useMemo(() => normalizeQuery(queryInput), [queryInput]);
  const signature = useMemo(() => querySignature(query), [query]);
  const enabled = query.enabled !== false;

  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
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

  const hasMore = page < totalPages;

  const fetchPage = useCallback(
    async (pageNum: number, append: boolean) => {
      if (!token || isGuest || !enabled) {
        setTasks([]);
        setTotal(0);
        setPage(1);
        setTotalPages(0);
        return { ok: true as const };
      }

      const res = await getUserTasks(toApiParams(query, pageNum));
      if (!res.ok) return res;

      setTotal(res.data.total);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTasks((prev) => (append ? [...prev, ...res.data.tasks] : res.data.tasks));
      return res;
    },
    [token, isGuest, enabled, query]
  );

  const refresh = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    if (!token || isGuest) {
      setTasks([]);
      setTotal(0);
      setPage(1);
      setTotalPages(0);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    const res = await fetchPage(1, false);
    setLoading(false);
    if (!res.ok) setError(res.error);
  }, [token, isGuest, enabled, fetchPage]);

  const silentRefresh = useCallback(async () => {
    if (!enabled || !token || isGuest) return;
    await fetchPage(1, false);
  }, [enabled, token, isGuest, fetchPage]);

  const loadMore = useCallback(async () => {
    if (!enabled || !token || isGuest || loading || loadingMore || !hasMore) return;
    setLoadingMore(true);
    const res = await fetchPage(page + 1, true);
    setLoadingMore(false);
    if (!res.ok) {
      showToast({
        title: 'Не удалось загрузить задачи',
        description: res.error,
        variant: 'destructive',
        duration: 4000,
      });
    }
  }, [enabled, token, isGuest, loading, loadingMore, hasMore, fetchPage, page, showToast]);

  useEffect(() => {
    refresh();
  }, [signature, refresh]);

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
        executor_id?: number | null;
        executor?: { id: number; full_name: string } | null;
      },
      priority: TaskPriority = 'medium',
      recurrence?: TaskRecurrencePayload,
      options?: { inbox?: boolean }
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
      const executorId = assignment?.executor_id ?? assignment?.executor?.id ?? null;
      const executor = assignment?.executor ?? null;
      const rec = recurrence ?? defaultRecurrenceNone();
      const inboxFlag = options?.inbox === true;
      const optimistic: UserTask = {
        id: optimisticId,
        creator_id: 0,
        title,
        completed: false,
        completed_at: null,
        scheduled_at: scheduledAt ?? null,
        inbox: inboxFlag,
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
        assignee_ids: executorId != null ? [executorId] : [],
        assignees: executor ? [executor] : [],
        team_id: assignment?.team_id ?? null,
        executor_id: executorId,
        executor: executor ?? undefined,
      };

      const before = tasksRef.current;
      setTasks((prev) => [optimistic, ...prev]);

      const res = await createUserTask({
        title,
        scheduled_at: scheduledAt ?? null,
        inbox: inboxFlag,
        deadline_from: null,
        deadline_to: null,
        deadline_time: null,
        priority,
        reminders_disabled: remindersDisabled,
        remind_before_minutes: remindBeforeMinutes ?? null,
        team_id: assignment?.team_id ?? null,
        executor_id: executorId,
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
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, ...res.data } : t)));
        bump();
        return;
      }
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
            if (ids.length > 0 && (!merged.assignees || merged.assignees.length === 0)) {
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
      setTasks(before);
      showToast({ title: 'Не удалось сохранить изменения', description: res.error, variant: 'destructive', duration: 4000 });
      return null;
    },
    [token, isGuest, bump, showToast]
  );

  return {
    tasks,
    total,
    page,
    totalPages,
    hasMore,
    loading,
    loadingMore,
    error,
    refresh,
    loadMore,
    addTask,
    toggleComplete,
    removeTask,
    updateTask,
  };
}
