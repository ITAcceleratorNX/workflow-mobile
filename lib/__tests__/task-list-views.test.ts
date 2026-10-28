import assert from 'node:assert/strict';
import test from 'node:test';
import { dueSummary, dueToScheduledAt, defaultDue, formatDayHeading, formatDayTitle, formatDue, isTaskOverdue, pluralTasks, pluralUnfinished, quickDueOptions } from '../task-due';
import { DEFAULT_TASK_SORT, parseTaskSort, sortableTaskView, taskSortLabel, taskSortQuery } from '../task-list-sort';
import { monthRange, monthTitle, monthWeeks, shiftMonth } from '../month-grid';
import { DEFAULT_REMINDER, REMINDER_OPTIONS, reminderLabel, reminderOptionsFor, reminderValue } from '../task-reminders';
import { hasOtherRecipient, taskRecipientLabel, taskRecipientSummary } from '../task-recipient-display';
import { millisecondsUntilNextTaskDay } from '../task-day-clock';
import type { UserTask } from '../user-tasks-api';

const makeTask = (fields: Partial<UserTask> = {}): UserTask =>
  ({
    id: 1, creator_id: 1, title: 'Task', completed: false, scheduled_at: null, deadline_to: null, deadline_time: null,
    priority: 'medium', reminders_disabled: false, remind_before_minutes: null, ...fields,
  }) as UserTask;

test('due line: today, tomorrow, other days and years, legacy dates, no date', () => {
  const today = '2026-10-21';
  const now = new Date('2026-10-21T06:14:00Z'); // 11:14 in Almaty
  assert.deepEqual(dueSummary(makeTask({ scheduled_at: '2026-10-21T10:00:00Z' }), today, now), { text: 'Сегодня · 15:00', tone: 'upcoming' });
  assert.deepEqual(dueSummary(makeTask({ scheduled_at: '2026-10-22T04:00:00Z' }), today, now), { text: 'Завтра · 09:00', tone: 'upcoming' });
  assert.deepEqual(dueSummary(makeTask({ scheduled_at: '2026-09-30T12:05:00Z' }), today, now), { text: '30 сен · 17:05', tone: 'overdue' });
  assert.equal(dueSummary(makeTask({ scheduled_at: '2027-05-03T04:00:00Z' }), today, now).text, '3 мая 2027 · 09:00');
  assert.deepEqual(dueSummary(makeTask({ deadline_to: '2026-10-01' }), today, now), { text: '1 окт', tone: 'overdue' });
  assert.equal(dueSummary(makeTask({ deadline_to: '2026-10-25', deadline_time: '9:30' }), today, now).text, '25 окт · 09:30');
  assert.deepEqual(dueSummary(makeTask(), today, now), { text: 'Без срока', tone: 'none' });
  assert.equal(formatDue({ dateKey: '2026-10-01', time: '17:06' }, today, ', '), '1 окт, 17:06');
});

test('a task is overdue only while it is open and its moment has passed', () => {
  const now = new Date('2026-10-21T06:14:00Z');
  assert.equal(isTaskOverdue(makeTask({ scheduled_at: '2026-10-21T06:13:00Z' }), now), true);
  assert.equal(isTaskOverdue(makeTask({ scheduled_at: '2026-10-21T06:15:00Z' }), now), false);
  assert.equal(isTaskOverdue(makeTask({ scheduled_at: '2026-10-01T06:00:00Z', completed: true }), now), false);
  assert.equal(isTaskOverdue(makeTask({ deadline_to: '2026-10-21' }), now), false, 'a legacy date counts at noon');
  assert.equal(isTaskOverdue(makeTask(), now), false);
});

test('a new task is due at the next 18:00 in the app time zone', () => {
  assert.deepEqual(defaultDue('2026-10-21', new Date('2026-10-21T12:59:00Z')), { dateKey: '2026-10-21', time: '18:00' });
  assert.deepEqual(defaultDue('2026-10-21', new Date('2026-10-21T13:00:00Z')), { dateKey: '2026-10-22', time: '18:00' });
  assert.equal(dueToScheduledAt({ dateKey: '2026-10-21', time: '18:00' }), '2026-10-21T13:00:00.000Z');
  assert.equal(dueToScheduledAt(null), null);
});

test('quick due chips: Friday is the next one after tomorrow', () => {
  const dates = (today: string) => quickDueOptions(today).map((option) => option.dateKey);
  assert.deepEqual(dates('2026-10-21'), ['2026-10-21', '2026-10-22', '2026-10-23', null]); // Wednesday
  assert.deepEqual(dates('2026-10-22').slice(1, 3), ['2026-10-23', '2026-10-30']); // Thursday: tomorrow is Friday
  assert.deepEqual(dates('2026-10-24').slice(1, 3), ['2026-10-25', '2026-10-30']); // Saturday
});

test('headings and counts read naturally in Russian', () => {
  assert.equal(formatDayHeading('2026-10-21'), 'Ср, 21 октября');
  assert.equal(formatDayTitle('2026-10-21'), 'Среда, 21 октября');
  assert.deepEqual([1, 2, 5, 11, 21, 22, 25, 112].map(pluralTasks), ['1 задача', '2 задачи', '5 задач', '11 задач', '21 задача', '22 задачи', '25 задач', '112 задач']);
  assert.deepEqual([1, 9, 21].map(pluralUnfinished), ['1 незавершённая', '9 незавершённых', '21 незавершённая']);
});

test('sort: a field and a direction, sent to the API; stored values from another version fall back', () => {
  assert.deepEqual(DEFAULT_TASK_SORT, { field: 'deadline', direction: 'asc' });
  assert.deepEqual(taskSortQuery({ field: 'priority', direction: 'desc' }), { sortBy: 'priority', sortDirection: 'desc' });
  assert.equal(taskSortLabel({ field: 'deadline', direction: 'asc' }), 'По сроку');
  assert.deepEqual(parseTaskSort({ field: 'created_at', direction: 'desc' }), { field: 'created_at', direction: 'desc' });
  for (const raw of [null, 'deadline_asc', { field: 'title', direction: 'asc' }, { field: 'deadline' }]) {
    assert.deepEqual(parseTaskSort(raw), DEFAULT_TASK_SORT, JSON.stringify(raw));
  }
});

test('sort: «Входящие», «Сегодня» and «Предстоящие» are sorted by priority, deadline or creation date; «Выполненные» keep their order', () => {
  assert.equal(sortableTaskView('inbox'), 'inbox');
  assert.equal(sortableTaskView('today'), 'today');
  assert.equal(sortableTaskView('upcoming'), 'upcoming');
  assert.equal(sortableTaskView('completed'), null);
  assert.deepEqual(taskSortQuery({ field: 'priority', direction: 'asc' }), { sortBy: 'priority', sortDirection: 'asc' });
  assert.equal(taskSortLabel({ field: 'priority', direction: 'desc' }), 'По приоритету');
  assert.equal(taskSortLabel({ field: 'created_at', direction: 'desc' }), 'По дате');
  assert.deepEqual(parseTaskSort({ field: 'priority', direction: 'asc' }), { field: 'priority', direction: 'asc' });
});

test('month grid: Monday first, padded weeks, ranges and month steps across years', () => {
  const weeks = monthWeeks({ year: 2026, month: 9 });
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[0].map((cell) => cell?.day ?? null), [null, null, null, 1, 2, 3, 4]);
  assert.deepEqual(weeks[4].map((cell) => cell?.day ?? null), [26, 27, 28, 29, 30, 31, null]);
  assert.equal(monthWeeks({ year: 2027, month: 1 }).length, 4, 'February 2027 starts on Monday and has 28 days');
  assert.deepEqual(monthRange({ year: 2024, month: 1 }), { start: '2024-02-01', end: '2024-02-29' });
  assert.deepEqual(shiftMonth({ year: 2026, month: 11 }, 1), { year: 2027, month: 0 });
  assert.deepEqual(shiftMonth({ year: 2026, month: 0 }, -1), { year: 2025, month: 11 });
  assert.equal(monthTitle({ year: 2026, month: 9 }), 'Октябрь 2026');
});

test('reminders: options map to the server fields both ways', () => {
  assert.deepEqual(DEFAULT_REMINDER.fields, { reminders_disabled: false, remind_before_minutes: 30 });
  assert.equal(reminderValue({ reminders_disabled: true, remind_before_minutes: 15 }), 'off');
  assert.equal(reminderLabel({ reminders_disabled: false, remind_before_minutes: null }), 'В момент срока');
  assert.equal(reminderLabel({ reminders_disabled: false, remind_before_minutes: 120 }), 'За 2 ч');
  assert.equal(reminderOptionsFor({ reminders_disabled: false, remind_before_minutes: 45 }).at(-1)?.label, 'За 45 мин');
  assert.equal(reminderOptionsFor({ reminders_disabled: false, remind_before_minutes: 30 }).length, REMINDER_OPTIONS.length);
});

test('recipient line: groups and teams, the person given the task, or the author of a task given to me', () => {
  const me = 1;
  const summary = (fields: Partial<UserTask>) => taskRecipientSummary(makeTask(fields), me);
  assert.deepEqual(summary({ assignment_type: 'department', targetDepartment: { id: 3, name: 'Отдел продаж' } } as Partial<UserTask>), { icon: 'group', label: 'Отдел продаж' });
  assert.deepEqual(summary({ team_id: 4, team: { id: 4, name: 'АйТи-отдел' } } as Partial<UserTask>), { icon: 'group', label: 'АйТи-отдел' });
  assert.deepEqual(summary({ executor_id: 5, executor: { id: 5, full_name: 'Дамир Аблахат' } } as Partial<UserTask>), { icon: 'person', label: 'Дамир Аблахат' });
  assert.deepEqual(
    summary({ creator_id: 7, creator: { id: 7, full_name: 'Айдана' }, executor_id: me, executor: { id: me, full_name: 'Я сам' } } as Partial<UserTask>),
    { icon: 'person', label: 'от Айдана' }
  );
  assert.equal(summary({}), null);
  assert.equal(taskRecipientLabel(makeTask({ executor_id: me, executor: { id: me, full_name: 'Я сам' } } as Partial<UserTask>), me), 'Я');
  assert.equal(hasOtherRecipient(makeTask({ executor_id: 5, executor: { id: 5, full_name: 'Дамир' } } as Partial<UserTask>), me), true);
  assert.equal(hasOtherRecipient(makeTask(), me), false);
});

test('day rollover is scheduled at Almaty midnight, including month/year boundaries', () => {
  for (const iso of ['2026-10-23T18:59:59.500Z', '2026-12-31T18:59:59.500Z', '2024-02-28T17:59:59.500Z']) {
    assert.equal(millisecondsUntilNextTaskDay(new Date(iso)), 500, iso);
  }
  assert.equal(millisecondsUntilNextTaskDay(new Date('2026-10-22T19:00:00Z')), 86_400_000);
});
