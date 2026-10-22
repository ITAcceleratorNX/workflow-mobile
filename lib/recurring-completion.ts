import { addCalendarDaysToDateKey, formatTaskTime, formatWithOptions, toAppDateKey } from '@/lib/dateTimeUtils';

type TaskCompletionState = {
  completed: boolean;
  scheduled_at?: string | null;
  recurrence_type?: string | null;
};

const sameInstant = (a: string, b: string) => new Date(a).getTime() === new Date(b).getTime();

/**
 * «Выполнено» у повторяющейся задачи: сервер записывает выполнение в историю и переносит задачу
 * на следующий повтор — в ответе она снова не выполнена, но с новой датой. Возвращает эту дату;
 * null — обычное выполнение или отмена. Тип повтора берётся из ответа: в календаре его может не быть.
 */
export function nextOccurrenceAfterCompletion(before: TaskCompletionState, after: TaskCompletionState): string | null {
  if (before.completed || after.completed) return null;
  const recurrence = after.recurrence_type ?? before.recurrence_type;
  if (!recurrence || recurrence === 'none' || !after.scheduled_at) return null;
  if (before.scheduled_at && sameInstant(before.scheduled_at, after.scheduled_at)) return null;
  return after.scheduled_at;
}

/**
 * Тост после выполнения повтора: без него переключатель, вернувшийся в «не выполнено», выглядит как сбой.
 * «Следующий повтор — завтра в 09:00»; дальше завтрашнего дня — «пт, 24 октября в 09:00».
 */
export function recurringCompletionNotice(nextAt: string, now: Date = new Date()): { title: string; description: string } {
  const dateKey = toAppDateKey(nextAt);
  const todayKey = toAppDateKey(now);
  const day =
    dateKey === todayKey
      ? 'сегодня'
      : dateKey === addCalendarDaysToDateKey(todayKey, 1)
        ? 'завтра'
        : formatWithOptions(nextAt, { weekday: 'short', day: 'numeric', month: 'long' });
  return { title: 'Выполнено', description: `Следующий повтор — ${day} в ${formatTaskTime(nextAt)}` };
}
