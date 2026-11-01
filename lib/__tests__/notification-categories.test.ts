import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  NOTIFICATION_CATEGORY_META,
  applyNotificationRead,
  formatBadgeCount,
  formatCategoryTime,
  formatDayLabel,
  formatUnreadLabel,
  groupNotificationsByDay,
  historyRows,
  isNotificationCategory,
  orderCategoriesByActivity,
  splitRequestNumbers,
  type CategoryNotification,
  type CategorySummaryItem,
  type NotificationCategory,
} from '../notification-categories';

// 13:34 in Almaty (UTC+5), as on the Figma screens.
const NOW = new Date('2026-10-22T08:34:00Z');
const notification = (id: number, created_at: string, extra: Partial<CategoryNotification> = {}): CategoryNotification => ({
  id,
  title: `Уведомление ${id}`,
  content: `Текст ${id}`,
  created_at,
  is_read: false,
  category: 'service_requests',
  ...extra,
});
const item = (category: NotificationCategory, unread_count: number, last: CategoryNotification | null): CategorySummaryItem => ({
  category,
  unread_count,
  last_notification: last,
});

describe('notification categories', () => {
  it('lists the most recent category first, empty ones last in the role order', () => {
    const ordered = orderCategoriesByActivity([
      item('service_requests', 2, notification(1, '2026-10-22T06:53:00Z')),
      item('meeting_rooms', 1, notification(2, '2026-10-22T08:20:00Z', { category: 'meeting_rooms' })),
      item('tasks', 0, null),
      item('registrations', 0, null),
    ]);
    assert.deepEqual(ordered.map((c) => c.category), ['meeting_rooms', 'service_requests', 'tasks', 'registrations']);
  });

  it('groups the history by Almaty days, newest first', () => {
    const groups = groupNotificationsByDay(
      [
        notification(5, '2026-10-22T06:53:00Z'),
        notification(4, '2026-10-22T05:12:00Z'),
        notification(3, '2026-10-21T11:40:00Z'),
        notification(2, '2026-10-20T13:22:00Z'),
        notification(1, '2026-10-20T07:00:00Z'),
        notification(1, '2026-10-20T07:00:00Z'),
      ],
      NOW
    );
    assert.deepEqual(groups.map((g) => [g.label, g.items.map((n) => n.id)]), [
      ['Сегодня', [5, 4]],
      ['Вчера', [3]],
      ['20 октября', [2, 1]],
    ]);
    // 20:30 UTC on the 21st is already the 22nd in Almaty.
    assert.equal(formatDayLabel('2026-10-21T20:30:00Z', NOW), 'Сегодня');
    assert.equal(formatDayLabel('2025-10-20T08:00:00Z', NOW), '20 октября 2025 г.');
  });

  it('puts the newest notification first and each day header above its day', () => {
    const rows = historyRows(
      [notification(3, '2026-10-22T06:53:00Z'), notification(2, '2026-10-22T05:12:00Z'), notification(1, '2026-10-21T11:40:00Z')],
      NOW
    );
    assert.deepEqual(
      rows.map((r) => (r.type === 'day' ? r.label : `${r.notification.id}${r.first ? 'F' : ''}${r.last ? 'L' : ''}`)),
      ['Сегодня', '3F', '2L', 'Вчера', '1FL']
    );
  });

  it('formats times and counters as on the screens', () => {
    assert.equal(formatCategoryTime('2026-10-22T08:31:00Z', NOW), '13:31');
    assert.equal(formatCategoryTime('2026-10-21T08:31:00Z', NOW), 'Вчера');
    assert.equal(formatCategoryTime('2026-10-20T00:00:00Z', NOW).replace(/\s/g, ' '), '20 окт.');
    assert.equal(formatUnreadLabel(1), '1 непрочитанное');
    assert.equal(formatUnreadLabel(2), '2 непрочитанных');
    assert.equal(formatUnreadLabel(11), '11 непрочитанных');
    assert.equal(formatUnreadLabel(21), '21 непрочитанное');
    assert.equal(formatBadgeCount(120), '99+');
  });

  it('acceptance: 2 + 1 = 3, opening one request notification leaves 1 and 2', () => {
    const opened = notification(10, '2026-10-22T06:53:00Z');
    const summary = {
      unread_count: 3,
      categories: [
        item('service_requests', 2, opened),
        item('meeting_rooms', 1, notification(11, '2026-10-22T08:20:00Z', { category: 'meeting_rooms' })),
        item('tasks', 0, null),
      ],
    };
    const after = applyNotificationRead(summary, opened);
    assert.equal(after.unread_count, 2);
    assert.deepEqual(after.categories.map((c) => c.unread_count), [1, 1, 0]);
    assert.equal(after.categories[0].last_notification?.is_read, true);
    // A read notification opened again changes nothing; nothing goes below zero.
    assert.equal(applyNotificationRead(after, { ...opened, is_read: true }), after);
    const zero = { unread_count: 0, categories: [item('service_requests', 0, null)] };
    assert.deepEqual(applyNotificationRead(zero, opened), zero);
  });

  it('turns request numbers into links and keeps the words around them', () => {
    assert.deepEqual(splitRequestNumbers('Заявка № 1230 отклонена. Подзаявка №1229/2.'), [
      { type: 'text', value: 'Заявка ' },
      { type: 'request', value: '1230', requestGroupId: 1230 },
      { type: 'text', value: ' отклонена. Подзаявка ' },
      { type: 'request', value: '1229/2', requestGroupId: 1229 },
      { type: 'text', value: '.' },
    ]);
    assert.deepEqual(splitRequestNumbers('Без номера'), [{ type: 'text', value: 'Без номера' }]);
  });

  it('links request numbers only in service requests', () => {
    assert.equal(NOTIFICATION_CATEGORY_META.service_requests.linksRequests, true);
    for (const key of ['meeting_rooms', 'tasks', 'registrations'] as const) {
      assert.equal(NOTIFICATION_CATEGORY_META[key].linksRequests, false, key);
    }
    assert.equal(isNotificationCategory('registrations'), true);
    assert.equal(isNotificationCategory('toString'), false);
    assert.equal(isNotificationCategory(undefined), false);
  });
});
