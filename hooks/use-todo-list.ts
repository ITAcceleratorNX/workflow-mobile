import { useScopedState } from '@/hooks/use-scoped-state';
import { useMemo, useRef, useEffect, useCallback } from 'react';

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
import { confirmTaskToggle } from '@/lib/group-task-completion';
import { nextOccurrenceAfterCompletion, recurringCompletionNotice } from '@/lib/recurring-completion';
import { toAssignmentInput, type RecipientSelection } from '@/lib/task-recipients-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import { useToast } from '@/context/toast-context';
import { toastTaskCompleted, toastTaskDeleteFailed, toastTaskError } from '@/components/tasks/task-toasts';

import type { TaskSortField, TaskSortDirection } from '@/lib/task-list-sort';

const DEFAULT_PAGE_SIZE = 50;
/** A task completed in a list of active tasks stays there, crossed out, for this long. */
const COMPLETED_LINGER_MS = 4000;
const VIEWS_WITHOUT_COMPLETED: readonly (TaskListView | undefined)[] = ['inbox', 'list_today', 'list_upcoming'];

/** Поля, которые реально принимает PATCH /user-tasks/:id (остальное только для оптимистичного UI). */
const USER_TASK_API_PATCH_KEYS = [
  'title',
  'description',
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

/** A new task from «Новая задача». */
export type NewTaskInput = {
  title: string;
  description?: string | null;
  scheduledAt?: string | null;
  remindersDisabled?: boolean;
  remindBeforeMinutes?: number | null;
  /** «Исполнитель»: null — the author's own task. */
  recipient?: RecipientSelection | null;
  priority?: TaskPriority;
  recurrence?: TaskRecurrencePayload;
  inbox?: boolean;
};

export type UseTodoListQuery = {
  filter?: TaskFilter;
  view?: TaskListView;
  today?: string;
  sortBy?: TaskSortField;
  sortDirection?: TaskSortDirection;
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
    filter: q.filter,
    view: q.view,
    today: q.today,
    sortBy: q.sortBy,
    sortDirection: q.sortDirection,
    fromDate: q.fromDate,
    toDate: q.toDate,
    completedOn: q.completedOn,
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
    if (q.sortBy) params.sort_by = q.sortBy;
    if (q.sortDirection) params.sort_direction = q.sortDirection;
    if (q.fromDate) params.from_date = q.fromDate;
    if (q.toDate) params.to_date = q.toDate;
    if (q.completedOn) params.completed_on = q.completedOn;
  } else if (q.filter) {
    params.filter = q.filter;
  }
  return params;
}

export function useTodoList(queryInput: UseTodoListQuery | TaskFilter = { filter: 'all' }) {
  const signature = querySignature(normalizeQuery(queryInput));
  // Stable across renders even when callers pass an inline query object.
  const query = useMemo(() => JSON.parse(signature) as UseTodoListQuery, [signature]);
  const enabled = query.enabled !== false;

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const scopeKey = JSON.stringify([signature, token, isGuest]);

  const [tasks, setTasks] = useScopedState<UserTask[]>(scopeKey, []);
  const [total, setTotal] = useScopedState(scopeKey, 0);
  const [page, setPage] = useScopedState(scopeKey, 1);
  const [totalPages, setTotalPages] = useScopedState(scopeKey, 0);
  const [loading, setLoading] = useScopedState(scopeKey, enabled && !!token && !isGuest);
  const [loadingMore, setLoadingMore] = useScopedState(scopeKey, false);
  const [error, setError] = useScopedState<string | null>(scopeKey, null);

  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);
  const { show: showToast } = useToast();

  // Each query/auth change owns its responses. A replacement refresh also invalidates
  // pending pagination so an older page cannot be appended to a newly sorted list.
  const requestScope = useRef({ key: scopeKey, active: true, generation: 0, loadingMore: false });
  useEffect(() => {
    requestScope.current = { key: scopeKey, active: true, generation: requestScope.current.generation + 1, loadingMore: false };
    return () => { requestScope.current.active = false; requestScope.current.generation += 1; };
  }, [scopeKey]);

  const tasksRef = useRef<UserTask[]>([]);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);
  const hasMore = page < totalPages;

  // Tasks just completed in a list of active tasks: kept in place, crossed out, for a moment, so the
  // check mark is seen and can be undone; a refresh in between keeps them too.
  const lingering = useRef(new Map<number, { task: UserTask; index: number; timer: ReturnType<typeof setTimeout> }>());
  const hidesCompleted = VIEWS_WITHOUT_COMPLETED.includes(query.view);
  useEffect(() => {
    const entries = lingering.current;
    return () => {
      entries.forEach((entry) => clearTimeout(entry.timer));
      entries.clear();
    };
  }, [scopeKey]);
  const withLingering = useCallback((rows: UserTask[]) => {
    if (lingering.current.size === 0) return rows;
    const out = rows.filter((row) => !lingering.current.has(row.id));
    [...lingering.current.values()]
      .sort((a, b) => a.index - b.index)
      .forEach((entry) => out.splice(Math.min(entry.index, out.length), 0, entry.task));
    return out;
  }, []);
  const stopLingering = useCallback((id: number) => {
    const entry = lingering.current.get(id);
    if (!entry) return;
    clearTimeout(entry.timer);
    lingering.current.delete(id);
  }, []);

  const fetchPage = useCallback(async (pageNum: number, append: boolean) => {
    if (!requestScope.current.active || requestScope.current.key !== scopeKey || !token || isGuest || !enabled) return null;
    const generation = append ? requestScope.current.generation : ++requestScope.current.generation;
    if (!append) {
      requestScope.current.loadingMore = false;
    }
    const res = await getUserTasks(toApiParams(query, pageNum));
    if (!requestScope.current.active || requestScope.current.key !== scopeKey || requestScope.current.generation !== generation) return null;
    if (!append) setLoadingMore(false);
    if (res.ok) {
      setTotal(res.data.total);
      setPage(res.data.page);
      setTotalPages(res.data.totalPages);
      setTasks((prev) => {
        if (!append) return withLingering(res.data.tasks);
        const seen = new Set(prev.map((task) => task.id));
        return [...prev, ...res.data.tasks.filter((task) => !seen.has(task.id))];
      });
    }
    return res;
  }, [scopeKey, token, isGuest, enabled, query, setLoadingMore, setTotal, setPage, setTotalPages, setTasks, withLingering]);

  const refresh = useCallback(async (reset = false) => {
    if (reset) {
      setTasks([]);
      setTotal(0);
      setPage(1);
      setTotalPages(0);
    }
    if (!enabled || !token || isGuest) {
      setTasks([]);
      setTotal(0);
      setPage(1);
      setTotalPages(0);
      setLoading(false);
      setLoadingMore(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const res = await fetchPage(1, false);
    if (!res) return;
    setLoading(false);
    if (!res.ok) setError(res.error);
  }, [
    enabled,
    token,
    isGuest,
    setLoading,
    setError,
    fetchPage,
    setTasks,
    setTotal,
    setPage,
    setTotalPages,
    setLoadingMore,
  ]);

  const silentRefresh = useCallback(async () => {
    const res = await fetchPage(1, false);
    if (!res) return;
    setLoading(false);
    setError(res.ok ? null : res.error);
  }, [fetchPage, setError, setLoading]);

  const loadMore = useCallback(async () => {
    if (!enabled || !token || isGuest || loading || requestScope.current.key !== scopeKey || requestScope.current.loadingMore || !hasMore) return;
    requestScope.current.loadingMore = true;
    setLoadingMore(true);
    const res = await fetchPage(page + 1, true);
    if (!res) return;
    requestScope.current.loadingMore = false;
    setLoadingMore(false);
    if (!res.ok) toastTaskError(showToast, 'Не удалось загрузить задачи', res.error);
  }, [enabled, token, isGuest, loading, scopeKey, hasMore, setLoadingMore, fetchPage, page, showToast]);

  useEffect(() => { void silentRefresh(); }, [silentRefresh]);

  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current === version) return;
    previousVersion.current = version;
    void silentRefresh();
  }, [version, silentRefresh]);

  const tempIdSeedRef = useRef(-1);
  const nextTempId = useCallback(() => {
    tempIdSeedRef.current -= 1;
    return tempIdSeedRef.current;
  }, []);

  const addTask = useCallback(
    async (input: NewTaskInput) => {
      if (!token || isGuest) {
        toastTaskError(showToast, 'Недоступно', 'Нужно войти в аккаунт, чтобы создавать задачи');
        return null;
      }
      const {
        title,
        description = null,
        scheduledAt = null,
        remindersDisabled = false,
        remindBeforeMinutes = null,
        recipient = null,
        priority = 'medium',
        recurrence,
        inbox = false,
      } = input;
      const optimisticId = nextTempId();
      const groupInput = recipient ? toAssignmentInput(recipient) : null;
      const singleUser =
        recipient?.type === 'legacy_user'
          ? recipient.user
          : recipient?.type === 'users' && recipient.users.length === 1
            ? recipient.users[0]
            : null;
      const team = recipient?.type === 'team' ? recipient.team : null;
      const executorId = singleUser?.id ?? null;
      const groupType = groupInput && !singleUser ? groupInput.type : null;
      const rec = recurrence ?? defaultRecurrenceNone();
      const now = new Date().toISOString();
      const optimistic: UserTask = {
        id: optimisticId,
        creator_id: 0,
        title,
        description,
        completed: false,
        completed_at: null,
        scheduled_at: scheduledAt,
        inbox,
        deadline_from: null,
        deadline_to: null,
        deadline_time: null,
        remind_at: null,
        priority,
        reminders_disabled: remindersDisabled,
        remind_before_minutes: remindBeforeMinutes,
        recurrence_type: rec.recurrence_type,
        recurrence_interval: rec.recurrence_interval,
        recurrence_custom_unit: rec.recurrence_custom_unit,
        recurrence_weekdays: rec.recurrence_weekdays,
        created_at: now,
        updated_at: now,
        assignee_ids: executorId != null ? [executorId] : [],
        assignees: singleUser ? [singleUser] : [],
        team_id: team?.id ?? null,
        team: team ? { id: team.id, name: team.name, leader_id: 0 } : null,
        executor_id: executorId,
        executor: singleUser ?? undefined,
        assignment_type: groupType,
        targetCompany: groupType === 'company' && recipient?.type === 'company' ? recipient.company : null,
        targetDepartment:
          groupType === 'department' && recipient?.type === 'department'
            ? { ...recipient.department, company_id: recipient.company.id, company: recipient.company }
            : null,
        targetUsers: groupType === 'users' && recipient?.type === 'users' ? recipient.users : [],
      };

      const before = tasksRef.current;
      setTasks((prev) => [optimistic, ...prev]);

      const res = await createUserTask({
        title,
        description,
        scheduled_at: scheduledAt,
        inbox,
        deadline_from: null,
        deadline_to: null,
        deadline_time: null,
        priority,
        reminders_disabled: remindersDisabled,
        remind_before_minutes: remindBeforeMinutes,
        // Получатель из оргструктуры сервер проверяет заново; team/executor при этом не передаём.
        ...(groupInput && !singleUser
          ? { assignment: groupInput }
          : { team_id: team?.id ?? null, executor_id: executorId }),
        recurrence_type: rec.recurrence_type,
        recurrence_interval: rec.recurrence_interval,
        recurrence_custom_unit: rec.recurrence_custom_unit,
        recurrence_weekdays: rec.recurrence_weekdays,
      });
      if (res.ok) {
        setTasks((prev) => prev.map((t) => (t.id === optimisticId ? res.data : t)));
        bump();
        return res.data;
      }
      if (requestScope.current.active && requestScope.current.key === scopeKey) setTasks(before);
      toastTaskError(showToast, 'Не удалось создать задачу', res.error);
      return null;
    },
    [token, isGuest, nextTempId, setTasks, scopeKey, showToast, bump]
  );

  const toggleComplete = useCallback(
    async (task: UserTask) => {
      if (!token || isGuest) {
        toastTaskError(showToast, 'Недоступно', 'Нужно войти в аккаунт, чтобы менять задачи');
        return;
      }
      if (!(await confirmTaskToggle(task))) return;
      const before = tasksRef.current;
      const nextCompleted = !task.completed;
      stopLingering(task.id);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));

      const res = await updateUserTask(task.id, { completed: nextCompleted });
      if (res.ok) {
        const saved = { ...task, ...res.data };
        if (saved.completed && hidesCompleted && requestScope.current.key === scopeKey) {
          const index = Math.max(0, tasksRef.current.findIndex((t) => t.id === task.id));
          const timer = setTimeout(() => {
            lingering.current.delete(task.id);
            setTasks((prev) => prev.filter((t) => !(t.id === task.id && t.completed)));
          }, COMPLETED_LINGER_MS);
          lingering.current.set(task.id, { task: saved, index, timer });
        }
        setTasks((prev) => prev.map((t) => (t.id === task.id ? saved : t)));
        bump();
        // Повтор выполнен, задача перенесена: без пояснения галочка, вернувшаяся назад, выглядит как сбой.
        const nextAt = nextOccurrenceAfterCompletion(task, res.data);
        if (nextAt) showToast({ ...recurringCompletionNotice(nextAt), variant: 'success', duration: 4000 });
        else if (saved.completed) toastTaskCompleted(showToast);
        return;
      }
      if (requestScope.current.active && requestScope.current.key === scopeKey) setTasks(before);
      toastTaskError(showToast, 'Не удалось обновить задачу', res.error);
    },
    [token, isGuest, setTasks, scopeKey, showToast, bump, hidesCompleted, stopLingering]
  );

  /**
   * true — сервер подтвердил удаление; false — задача осталась, тост предлагает «Повторить».
   * `onDeleted` runs after a deletion made by that retry, e.g. to close the task card.
   */
  const removeTask = useCallback(
    async function remove(task: UserTask, onDeleted?: () => void): Promise<boolean> {
      if (!token || isGuest) {
        toastTaskError(showToast, 'Недоступно', 'Нужно войти в аккаунт, чтобы удалять задачи');
        return false;
      }
      const before = tasksRef.current;
      stopLingering(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));

      const res = await deleteUserTask(task.id);
      if (res.ok) {
        bump();
        return true;
      }
      if (requestScope.current.active && requestScope.current.key === scopeKey) setTasks(before);
      toastTaskDeleteFailed(showToast, res, () => {
        void remove(task, onDeleted).then((deleted) => {
          if (deleted) onDeleted?.();
        });
      });
      return false;
    },
    [token, isGuest, setTasks, scopeKey, showToast, bump, stopLingering]
  );

  const updateTask = useCallback(
    async (task: UserTask, updates: Partial<UserTask>) => {
      if (!token || isGuest) {
        toastTaskError(showToast, 'Недоступно', 'Нужно войти в аккаунт, чтобы редактировать задачи');
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
      if (requestScope.current.active && requestScope.current.key === scopeKey) setTasks(before);
      toastTaskError(showToast, 'Не удалось сохранить изменения', res.error);
      return null;
    },
    [token, isGuest, setTasks, scopeKey, showToast, bump]
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
