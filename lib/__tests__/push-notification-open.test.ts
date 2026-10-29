import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  bookingPushHref,
  parseBookingPush,
  parseTaskPush,
  taskDetailsHref,
  taskNotificationTarget,
  taskPushHref,
  TASK_PUSH_EVENTS,
} from '../push-notification-open';

describe('task push data', () => {
  it('opens the task of every kind of task push, with its event', () => {
    assert.deepEqual(parseTaskPush({ type: 'user_task_assigned', event: 'group_assigned', task_id: '42' }), {
      taskId: 42,
      commentId: null,
      event: 'group_assigned',
    });
    assert.deepEqual(parseTaskPush({ type: 'task_reminder', event: 'reminder', task_id: '42', priority: 'high' }), {
      taskId: 42,
      commentId: null,
      event: 'reminder',
    });
    assert.deepEqual(parseTaskPush({ type: 'user_task_event', event: 'deleted', task_id: '42' }), {
      taskId: 42,
      commentId: null,
      event: 'deleted',
    });
  });

  it('knows each of the 13 events of the spec', () => {
    assert.equal(TASK_PUSH_EVENTS.length, 13);
    for (const event of TASK_PUSH_EVENTS) {
      assert.equal(parseTaskPush({ type: 'user_task_event', event, task_id: '7' })?.event, event);
    }
  });

  it('keeps the comment of a comment and a mention as the decimal string of the API', () => {
    assert.deepEqual(parseTaskPush({ type: 'user_task_event', event: 'mention', task_id: '5', comment_id: '9007199254740993' }), {
      taskId: 5,
      commentId: '9007199254740993',
      event: 'mention',
    });
    assert.equal(parseTaskPush({ type: 'user_task_event', event: 'comment', task_id: '5', comment_id: '' })?.commentId, null);
    assert.equal(parseTaskPush({ type: 'user_task_event', event: 'comment', task_id: '5', comment_id: 'abc' })?.commentId, null);
  });

  it('still opens the task of an older server without an event, or of an event this app does not know yet', () => {
    assert.deepEqual(parseTaskPush({ type: 'user_task_assigned', task_id: '3' }), { taskId: 3, commentId: null, event: null });
    assert.deepEqual(parseTaskPush({ type: 'user_task_event', event: 'archived', task_id: '3' }), {
      taskId: 3,
      commentId: null,
      event: null,
    });
  });

  it('reads a number id as well as the string FCM delivers', () => {
    assert.equal(parseTaskPush({ type: 'task_reminder', task_id: 8 })?.taskId, 8);
    assert.equal(parseTaskPush({ type: 'task_reminder', task_id: ' 8 ' })?.taskId, 8);
  });

  it('is not about a task without a valid task id or for other pushes', () => {
    assert.equal(parseTaskPush({ type: 'user_task_event', event: 'comment' }), null);
    assert.equal(parseTaskPush({ type: 'user_task_event', task_id: '0' }), null);
    assert.equal(parseTaskPush({ type: 'user_task_event', task_id: '12abc' }), null);
    assert.equal(parseTaskPush({ type: 'user_task_event', task_id: '-4' }), null);
    assert.equal(parseTaskPush({ type: 'new_request', task_id: '4', request_id: '4' }), null);
    assert.equal(parseTaskPush({ task_id: '4' }), null);
    assert.equal(parseTaskPush(null), null);
  });
});

describe('where a task push leads', () => {
  it('opens the card, at the comment when there is one', () => {
    assert.equal(taskPushHref({ taskId: 4, commentId: null, event: 'assigned' }), '/client/tasks/details?taskId=4');
    assert.equal(taskPushHref({ taskId: 4, commentId: '17', event: 'mention' }), '/client/tasks/details?taskId=4&commentId=17');
  });

  it('leads to the task notifications instead of a deleted task', () => {
    assert.equal(taskPushHref({ taskId: 4, commentId: null, event: 'deleted' }), '/notifications?category=tasks');
    assert.deepEqual(taskDetailsHref({ taskId: 4, commentId: null, event: 'deleted' }), {
      pathname: '/client/tasks/details',
      params: { taskId: '4' },
    });
  });
});

describe('a task entry of the notification history', () => {
  it('leads to its task and comment; ids may come as numbers or strings', () => {
    assert.deepEqual(taskNotificationTarget({ category: 'tasks', event: 'comment', task_id: 12, comment_id: '300' }), {
      taskId: 12,
      commentId: '300',
      event: 'comment',
    });
    assert.deepEqual(taskNotificationTarget({ category: 'tasks', event: 'overdue', task_id: '12', comment_id: null }), {
      taskId: 12,
      commentId: null,
      event: 'overdue',
    });
  });

  it('is no task entry outside the task category or without a task', () => {
    assert.equal(taskNotificationTarget({ category: null, task_id: 12 }), null);
    assert.equal(taskNotificationTarget({ task_id: 12 }), null);
    assert.equal(taskNotificationTarget({ category: 'tasks', task_id: null }), null);
  });
});

describe('booking push data', () => {
  it('opens the booking of a staff push about a new booking', () => {
    const data = { type: 'meeting_room_booking_created_staff', bookingId: '57', office_id: '3', timestamp: '2026-10-29T10:00:00.000Z' };
    assert.equal(parseBookingPush(data), 57);
    assert.equal(bookingPushHref(57), '/booking/details/57');
  });

  it('opens it from the staff pushes about a reschedule and a cancellation too', () => {
    assert.equal(parseBookingPush({ type: 'meeting_room_booking_rescheduled_staff', bookingId: '8' }), 8);
    assert.equal(parseBookingPush({ type: 'meeting_room_booking_cancelled_staff', booking_id: 9 }), 9);
  });

  it('ignores other pushes and a push without a valid booking', () => {
    assert.equal(parseBookingPush({ type: 'meeting_room_booking_created', bookingId: '57' }), null);
    assert.equal(parseBookingPush({ type: 'user_task_event', task_id: '57' }), null);
    assert.equal(parseBookingPush({ type: 'meeting_room_booking_created_staff', bookingId: '' }), null);
    assert.equal(parseBookingPush({ type: 'meeting_room_booking_created_staff', bookingId: '-1' }), null);
    assert.equal(parseBookingPush({ type: 'meeting_room_booking_created_staff', bookingId: '1; DROP' }), null);
    assert.equal(parseBookingPush(null), null);
  });
});
