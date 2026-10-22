import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { nextOccurrenceAfterCompletion, recurringCompletionNotice } from '../recurring-completion';

// 09:00 в Алматы (UTC+5) = 04:00 UTC.
const today = '2026-10-22T04:00:00.000Z';
const tomorrow = '2026-10-23T04:00:00.000Z';
const now = new Date('2026-10-22T10:00:00.000Z');

describe('a recurring task marked done', () => {
  it('is recognised by the server moving it to the next occurrence', () => {
    const before = { completed: false, scheduled_at: today, recurrence_type: 'daily' };
    // Ответ сервера: выполнение записано, задача снова не выполнена, но на завтра.
    assert.equal(nextOccurrenceAfterCompletion(before, { completed: false, scheduled_at: tomorrow, recurrence_type: 'daily' }), tomorrow);
  });

  it('takes the recurrence from the reply when the calendar item lacks it', () => {
    assert.equal(nextOccurrenceAfterCompletion({ completed: false, scheduled_at: today }, { completed: false, scheduled_at: tomorrow, recurrence_type: 'weekly' }), tomorrow);
  });

  it('ignores ordinary completion, reopening and an unchanged date', () => {
    assert.equal(nextOccurrenceAfterCompletion({ completed: false, scheduled_at: today, recurrence_type: 'none' }, { completed: true, scheduled_at: today }), null);
    assert.equal(nextOccurrenceAfterCompletion({ completed: true, scheduled_at: today, recurrence_type: 'daily' }, { completed: false, scheduled_at: today, recurrence_type: 'daily' }), null);
    // Последний повтор серии: сервер завершает задачу по-настоящему.
    assert.equal(nextOccurrenceAfterCompletion({ completed: false, scheduled_at: today, recurrence_type: 'daily' }, { completed: true, scheduled_at: today, recurrence_type: 'daily' }), null);
    assert.equal(nextOccurrenceAfterCompletion({ completed: false, scheduled_at: today, recurrence_type: 'daily' }, { completed: false, scheduled_at: '2026-10-22T04:00:00Z', recurrence_type: 'daily' }), null);
  });
});

describe('the notice about the next occurrence', () => {
  it('names today, tomorrow or the date with the time in Almaty', () => {
    assert.deepEqual(recurringCompletionNotice(tomorrow, now), { title: 'Выполнено', description: 'Следующий повтор — завтра в 09:00' });
    assert.equal(recurringCompletionNotice('2026-10-22T13:30:00.000Z', now).description, 'Следующий повтор — сегодня в 18:30');
    assert.match(recurringCompletionNotice('2026-10-26T04:00:00.000Z', now).description, /^Следующий повтор — пн, 26 октября в 09:00$/);
  });
});
