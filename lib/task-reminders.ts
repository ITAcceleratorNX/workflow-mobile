import type { UserTask } from '@/lib/user-tasks-api';

/**
 * «Напоминание» of a task. The server reminds `remind_before_minutes` before «Срок»; without a
 * value — at the due moment itself; `reminders_disabled` turns reminders off.
 */

export type ReminderFields = Pick<UserTask, 'reminders_disabled' | 'remind_before_minutes'>;
export type ReminderOption = { value: string; label: string; fields: ReminderFields };

export const DEFAULT_REMINDER_MINUTES = 30;

const option = (value: string, label: string, minutes: number | null, disabled = false): ReminderOption => ({
  value,
  label,
  fields: { reminders_disabled: disabled, remind_before_minutes: minutes },
});

export const REMINDER_OPTIONS: readonly ReminderOption[] = [
  option('off', 'Без напоминания', null, true),
  option('at_due', 'В момент срока', null),
  option('5', 'За 5 мин', 5),
  option('15', 'За 15 мин', 15),
  option('30', 'За 30 мин', 30),
  option('60', 'За 1 час', 60),
  option('1440', 'За 1 день', 1440),
];

/** The fields of a new task: 30 minutes before «Срок». */
export const DEFAULT_REMINDER = REMINDER_OPTIONS.find((item) => item.value === String(DEFAULT_REMINDER_MINUTES))!;

/** The option value of the task's reminder (a value outside the list gets its own). */
export function reminderValue(fields: ReminderFields): string {
  if (fields.reminders_disabled) return 'off';
  return fields.remind_before_minutes == null || fields.remind_before_minutes === 0
    ? 'at_due'
    : String(fields.remind_before_minutes);
}

/** «За 30 мин», «Без напоминания», «За 2 ч». */
export function reminderLabel(fields: ReminderFields): string {
  const value = reminderValue(fields);
  const known = REMINDER_OPTIONS.find((item) => item.value === value);
  if (known) return known.label;
  const minutes = fields.remind_before_minutes ?? 0;
  if (minutes % 1440 === 0) return `За ${minutes / 1440} дн`;
  if (minutes % 60 === 0) return `За ${minutes / 60} ч`;
  return `За ${minutes} мин`;
}

/** Options for a picker: the list plus the task's own value when it is not in the list. */
export function reminderOptionsFor(fields: ReminderFields): ReminderOption[] {
  const value = reminderValue(fields);
  if (REMINDER_OPTIONS.some((item) => item.value === value)) return [...REMINDER_OPTIONS];
  return [...REMINDER_OPTIONS, { value, label: reminderLabel(fields), fields }];
}
