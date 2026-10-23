import { useAsyncResource } from '@/hooks/use-async-resource';
import { useState, useEffect, useCallback, useRef } from 'react';

import { addDaysToDateKey, toAppDateKey } from '@/lib/dateTimeUtils';
import { getUserTasksCalendar, updateUserTask, type CalendarTask } from '@/lib/user-tasks-api';
import { confirmTaskToggle } from '@/lib/group-task-completion';
import { nextOccurrenceAfterCompletion, recurringCompletionNotice } from '@/lib/recurring-completion';
import { useToast } from '@/context/toast-context';
import { toastTaskCompleted, toastTaskError } from '@/components/tasks/task-toasts';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export function useCalendarTasks(startDate: Date, endDate: Date) {

  const [togglingTaskIds, setTogglingTaskIds] = useState<number[]>([]);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);
  const { show: showToast } = useToast();
  const tasksRef = useRef<CalendarTask[]>([]);

  const fetchRange = useCallback(async () => {
    const startKey = toAppDateKey(startDate);
    const endKey = toAppDateKey(endDate);
    const startStr = addDaysToDateKey(startKey, -1);
    const endStr = addDaysToDateKey(endKey, 1);
    const response = await getUserTasksCalendar(startStr, endStr);
    if (!response.ok) throw new Error(response.error);
    return response.data.tasks;
  }, [startDate, endDate]);

  const { data: tasks, setData: setTasks, loading, error, refresh } = useAsyncResource<CalendarTask[]>(fetchRange, [], !!token && !isGuest, token);
  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current === version) return;
    previousVersion.current = version;
    void refresh();
  }, [version, refresh]);

  const toggleComplete = useCallback(
    async (task: CalendarTask) => {
      if (!token || isGuest) {
        toastTaskError(showToast, 'Недоступно', 'Нужно войти в аккаунт, чтобы менять задачи');
        return;
      }

      if (!(await confirmTaskToggle(task))) return;
      const before = tasksRef.current;
      const nextCompleted = !task.completed;
      setTogglingTaskIds((prev) => [...prev, task.id]);
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: nextCompleted } : t)));

      const res = await updateUserTask(task.id, { completed: nextCompleted });
      setTogglingTaskIds((prev) => prev.filter((id) => id !== task.id));

      if (res.ok) {
        // Выполненный повтор сервер переносит на следующую дату — переносим и в календаре.
        setTasks((prev) =>
          prev.map((t) =>
            t.id === task.id ? { ...t, completed: res.data.completed, scheduled_at: res.data.scheduled_at ?? t.scheduled_at } : t
          )
        );
        // Lists and tab badges follow the change made in the calendar.
        bump();
        const nextAt = nextOccurrenceAfterCompletion(task, res.data);
        if (nextAt) showToast({ ...recurringCompletionNotice(nextAt), variant: 'success', duration: 4000 });
        else if (res.data.completed) toastTaskCompleted(showToast);
        return;
      }

      setTasks(before);
      toastTaskError(showToast, 'Не удалось обновить задачу', res.error);
    },
    [token, isGuest, showToast, setTasks, bump]
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
