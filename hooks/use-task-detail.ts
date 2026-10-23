import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  deleteUserTask,
  getUserTask,
  transferUserTask,
  updateUserTask,
  type UserTask,
} from '@/lib/user-tasks-api';
import { confirmTaskToggle, confirmTaskTransfer } from '@/lib/group-task-completion';
import { nextOccurrenceAfterCompletion, recurringCompletionNotice } from '@/lib/recurring-completion';
import { toTransferInput, transferRecipientLabel, type RecipientSelection } from '@/lib/task-recipients-api';
import { useToast } from '@/context/toast-context';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import { toastTaskCompleted, toastTaskDeleteFailed, toastTaskError } from '@/components/tasks/task-toasts';

export type TaskPatch = Partial<
  Pick<
    UserTask,
    | 'title'
    | 'description'
    | 'priority'
    | 'scheduled_at'
    | 'reminders_disabled'
    | 'remind_before_minutes'
    | 'remind_at'
    | 'recurrence_type'
    | 'recurrence_interval'
    | 'recurrence_custom_unit'
    | 'recurrence_weekdays'
  >
>;

type LoadState = { status: 'loading' } | { status: 'error'; message: string } | { status: 'ready' };

/**
 * One task for its card. Changes show at once and roll back if the server refuses; every saved
 * change refreshes the lists and badges. A change made elsewhere reloads the card quietly.
 */
export function useTaskDetail(taskId: number, { onGone }: { onGone: () => void }) {
  const [task, setTask] = useState<UserTask | null>(null);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [busy, setBusy] = useState<'complete' | 'delete' | 'transfer' | null>(null);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const bump = useUserTasksInvalidateStore((s) => s.bump);
  const { show: toast } = useToast();
  const taskRef = useRef(task);
  const onGoneRef = useRef(onGone);
  useLayoutEffect(() => {
    taskRef.current = task;
    onGoneRef.current = onGone;
  });
  /** Version bumped by this card's own save: no need to reload for it. */
  const ownVersion = useRef<number | null>(null);

  const load = useCallback(
    async (quiet: boolean) => {
      if (!token || isGuest) {
        setState({ status: 'error', message: 'Войдите в аккаунт, чтобы открыть задачу' });
        return;
      }
      if (!quiet) setState({ status: 'loading' });
      const res = await getUserTask(taskId);
      if (res.ok) {
        setTask(res.data);
        setState({ status: 'ready' });
      } else if (!quiet || taskRef.current == null) {
        setState({ status: 'error', message: res.error });
      }
    },
    [taskId, token, isGuest],
  );

  useEffect(() => {
    setTask(null);
    void load(false);
  }, [load]);

  const firstVersion = useRef(version);
  useEffect(() => {
    if (version === firstVersion.current || version === ownVersion.current) return;
    void load(true);
  }, [version, load]);

  const markOwnChange = useCallback(() => {
    ownVersion.current = useUserTasksInvalidateStore.getState().version + 1;
    bump();
  }, [bump]);

  const save = useCallback(
    async (patch: TaskPatch): Promise<boolean> => {
      const current = taskRef.current;
      if (!current) return false;
      setTask({ ...current, ...patch });
      const res = await updateUserTask(current.id, patch);
      if (!res.ok) {
        setTask((latest) => (latest?.id === current.id ? { ...latest, ...pickFields(current, patch) } : latest));
        toastTaskError(toast, 'Не удалось сохранить изменения', res.error);
        return false;
      }
      setTask(res.data);
      markOwnChange();
      return true;
    },
    [toast, markOwnChange],
  );

  const toggleComplete = useCallback(async () => {
    const current = taskRef.current;
    if (!current || busy) return;
    if (!(await confirmTaskToggle(current))) return;
    setBusy('complete');
    const next = !current.completed;
    setTask({ ...current, completed: next });
    const res = await updateUserTask(current.id, { completed: next });
    setBusy(null);
    if (!res.ok) {
      setTask((latest) => (latest?.id === current.id ? { ...latest, completed: current.completed } : latest));
      toastTaskError(toast, 'Не удалось обновить задачу', res.error);
      return;
    }
    setTask(res.data);
    markOwnChange();
    const nextAt = nextOccurrenceAfterCompletion(current, res.data);
    if (nextAt) toast({ ...recurringCompletionNotice(nextAt), variant: 'success', duration: 4000 });
    else if (res.data.completed) toastTaskCompleted(toast);
  }, [busy, toast, markOwnChange]);

  const remove = useCallback(async function remove(): Promise<boolean> {
    const current = taskRef.current;
    if (!current) return false;
    setBusy('delete');
    const res = await deleteUserTask(current.id);
    setBusy(null);
    if (!res.ok) {
      // The task stays on the screen; «Повторить» tries again and closes the card on success.
      toastTaskDeleteFailed(toast, res, () => {
        void remove().then((deleted) => {
          if (deleted) onGoneRef.current();
        });
      });
      return false;
    }
    bump();
    return true;
  }, [toast, bump]);

  const transfer = useCallback(
    async (selection: Exclude<RecipientSelection, { type: 'team' }>) => {
      const current = taskRef.current;
      if (!current) return;
      const label = transferRecipientLabel(selection);
      if (!(await confirmTaskTransfer(label))) return;
      setBusy('transfer');
      const res = await transferUserTask(current.id, toTransferInput(selection));
      setBusy(null);
      if (!res.ok) {
        toastTaskError(toast, 'Не удалось передать задачу', res.error);
        return;
      }
      toast({ variant: 'success', title: 'Задача передана', description: label, duration: 3000 });
      bump();
      // After handing over the user may no longer see the task.
      if (res.data) setTask(res.data);
      else onGoneRef.current();
    },
    [toast, bump],
  );

  return { task, state, busy, reload: () => load(false), save, toggleComplete, remove, transfer };
}

function pickFields(task: UserTask, patch: TaskPatch): TaskPatch {
  return Object.fromEntries(Object.keys(patch).map((key) => [key, task[key as keyof TaskPatch]])) as TaskPatch;
}
