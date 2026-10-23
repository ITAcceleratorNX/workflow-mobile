import assert from 'node:assert/strict';
import test from 'node:test';
import { getTodaySections, getInboxTasks } from '../task-views';
import { TASK_SORT_OPTIONS, taskSortQuery } from '../task-list-sort';
import { millisecondsUntilNextTaskDay } from '../task-day-clock';
import type { UserTask } from '../user-tasks-api';

const makeTask = (id: number, fields: Partial<UserTask> = {}): UserTask => ({
  id, creator_id: 1, title: `Task ${id}`, completed: false, completed_at: null,
  scheduled_at: null, deadline_from: null, deadline_to: null, deadline_time: null,
  remind_at: null, priority: "medium", reminders_disabled: true, remind_before_minutes: null,
  recurrence_type: "none", recurrence_interval: 1, recurrence_custom_unit: null, recurrence_weekdays: null,
  created_at: "2026-10-23T00:00:00Z", updated_at: "2026-10-23T00:00:00Z", assignee_ids: [], inbox: false,
  ...fields,
});
const ids = (tasks: UserTask[]) => tasks.map((task) => task.id);

test('today excludes undated, yesterday, tomorrow and completed tasks; creation and inbox flag do not decide membership', () => {
  const rows = [
    makeTask(1),
    makeTask(2, { scheduled_at: "2026-10-22T18:59:59.999Z" }),
    makeTask(3, { scheduled_at: "2026-10-22T19:00:00Z", created_at: "2026-01-01T00:00:00Z" }),
    makeTask(4, { scheduled_at: "2026-10-23T18:59:59.999Z", inbox: true }),
    makeTask(5, { scheduled_at: "2026-10-23T19:00:00Z" }),
    makeTask(6, { scheduled_at: "2026-10-23T04:00:00Z", completed: true, completed_at: "2026-10-23T05:00:00Z" }),
    makeTask(7, { deadline_to: "2026-10-23", deadline_time: "09:00" }),
    makeTask(8, { scheduled_at: "2026-10-24T04:00:00Z", deadline_to: "2026-10-23" }),
  ];
  const sections = getTodaySections(rows, '2026-10-23', true);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].id, 'today');
  assert.deepEqual(ids(sections[0].tasks), [3, 4, 7]);
  assert.deepEqual(ids(getInboxTasks(rows)), [1, 2, 3, 4, 5, 7, 8]);
  assert.deepEqual(ids(getTodaySections(rows, '2026-10-24', true)[0].tasks), [5, 8]);
  assert.equal(sections[0].tasks[0], rows[2], 'same task, not a duplicate');
});

test('explicit sort preserves server order across pages and does not mutate task data', () => {
  const rows = [makeTask(3, { priority: 'low', scheduled_at: '2026-10-23T15:00:00Z' }), makeTask(1, { priority: 'high', scheduled_at: '2026-10-23T04:00:00Z' })];
  const original = structuredClone(rows);
  assert.deepEqual(ids(getTodaySections(rows, '2026-10-23', true)[0].tasks), [3, 1]);
  assert.deepEqual(ids(getTodaySections(rows, '2026-10-23')[0].tasks), [1, 3], 'legacy priority order retained without a selected sort');
  assert.deepEqual(rows, original);
});

test('changing/removing the deadline and completing a task updates today immediately', () => {
  const task = makeTask(1, { scheduled_at: '2026-10-23T04:00:00Z' });
  assert.equal(getTodaySections([task], '2026-10-23').length, 1);
  for (const patch of [{ scheduled_at: null }, { scheduled_at: '2026-10-24T04:00:00Z' }, { completed: true }]) {
    assert.deepEqual(getTodaySections([{ ...task, ...patch }], '2026-10-23'), []);
  }
});

test('six explicit sort choices map to API fields/directions, with no forced default', () => {
  assert.deepEqual(taskSortQuery('default'), {});
  assert.equal(TASK_SORT_OPTIONS.length, 7);
  assert.equal(new Set(TASK_SORT_OPTIONS.map((option) => option.value)).size, 7);
  for (const option of TASK_SORT_OPTIONS.filter((item) => item.field)) {
    assert.deepEqual(taskSortQuery(option.value), { sortBy: option.field, sortDirection: option.direction });
  }
});

test('day rollover is scheduled at Almaty midnight, including month/year boundaries', () => {
  for (const iso of ['2026-10-23T18:59:59.500Z', '2026-12-31T18:59:59.500Z', '2024-02-28T17:59:59.500Z']) {
    assert.equal(millisecondsUntilNextTaskDay(new Date(iso)), 500, iso);
  }
  assert.equal(millisecondsUntilNextTaskDay(new Date('2026-10-22T19:00:00Z')), 86_400_000);
});
