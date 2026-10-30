/**
 * Категории истории уведомлений (ТЗ «Структуризация уведомлений по категориям», макет Figma 241-2002).
 * Состав категорий для роли, счётчики и последнее уведомление приходят из
 * GET /notifications/me/summary; здесь только подписи, порядок и группировка — как в workflow-web.
 */

import { formatTimeOnly, formatWithOptions, toAppDateKey } from '@/lib/dateTimeUtils';

export type NotificationCategory = 'service_requests' | 'meeting_rooms' | 'tasks' | 'registrations';

export interface CategoryNotification {
  id: number;
  title: string;
  content: string;
  created_at: string;
  is_read: boolean;
  /** null — запись, которую сервер не отнёс ни к одной категории. */
  category: NotificationCategory | null;
  event?: string | null;
  task_id?: number | null;
  /** BIGINT: сервер может прислать строкой. */
  comment_id?: number | string | null;
}

export interface CategorySummaryItem {
  category: NotificationCategory;
  unread_count: number;
  last_notification: CategoryNotification | null;
}

export interface CategorySummary {
  categories: CategorySummaryItem[];
  unread_count: number;
}

export interface NotificationCategoryMeta {
  label: string;
  /** Подсказка пустой истории. */
  emptyHint: string;
  /** Номер заявки в тексте ведёт к заявке; у бронирований, регистраций и задач перехода нет. */
  linksRequests: boolean;
}

export const NOTIFICATION_CATEGORY_META: Record<NotificationCategory, NotificationCategoryMeta> = {
  service_requests: {
    label: 'Сервисные заявки',
    emptyHint: 'Здесь появятся уведомления по вашим заявкам',
    linksRequests: true,
  },
  meeting_rooms: {
    label: 'Переговорные',
    emptyHint: 'Здесь появятся уведомления о бронированиях переговорных',
    linksRequests: false,
  },
  tasks: {
    label: 'Задачник',
    emptyHint: 'Здесь появятся уведомления по вашим задачам',
    linksRequests: false,
  },
  registrations: {
    label: 'Регистрации',
    emptyHint: 'Здесь появятся заявки на регистрацию',
    linksRequests: false,
  },
};

export function isNotificationCategory(value: unknown): value is NotificationCategory {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(NOTIFICATION_CATEGORY_META, value);
}

function time(value: string): number {
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/**
 * Порядок списка категорий по макету: сначала категории с уведомлениями — по времени последнего,
 * затем пустые в порядке матрицы ролей.
 */
export function orderCategoriesByActivity(items: CategorySummaryItem[]): CategorySummaryItem[] {
  const withLast = items.filter((item) => item.last_notification);
  const empty = items.filter((item) => !item.last_notification);
  withLast.sort((a, b) => time(b.last_notification!.created_at) - time(a.last_notification!.created_at));
  return [...withLast, ...empty];
}

/** История идёт от новых к старым: новые сверху. */
export function newestFirst(items: CategoryNotification[]): CategoryNotification[] {
  const unique = new Map<number, CategoryNotification>();
  for (const item of items) unique.set(item.id, item);
  return Array.from(unique.values()).sort((a, b) => time(b.created_at) - time(a.created_at) || b.id - a.id);
}

function yesterdayKey(now: Date): string {
  return toAppDateKey(new Date(now.getTime() - 24 * 60 * 60 * 1000));
}

/** «Сегодня», «Вчера» или календарная дата («20 октября», с годом — если не текущий). */
export function formatDayLabel(value: string, now: Date = new Date()): string {
  const key = toAppDateKey(value);
  if (key === toAppDateKey(now)) return 'Сегодня';
  if (key === yesterdayKey(now)) return 'Вчера';
  const sameYear = key.slice(0, 4) === toAppDateKey(now).slice(0, 4);
  return formatWithOptions(
    value,
    sameYear ? { day: 'numeric', month: 'long' } : { day: 'numeric', month: 'long', year: 'numeric' }
  );
}

export interface NotificationDayGroup {
  key: string;
  label: string;
  items: CategoryNotification[];
}

export function groupNotificationsByDay(items: CategoryNotification[], now: Date = new Date()): NotificationDayGroup[] {
  const groups: NotificationDayGroup[] = [];
  for (const item of newestFirst(items)) {
    const key = toAppDateKey(item.created_at);
    const last = groups[groups.length - 1];
    if (last?.key === key) last.items.push(item);
    else groups.push({ key, label: formatDayLabel(item.created_at, now), items: [item] });
  }
  return groups;
}

/** Строка списка истории: заголовок дня или уведомление в карточке своего дня. */
export type HistoryRow =
  | { type: 'day'; key: string; label: string }
  | { type: 'item'; key: string; notification: CategoryNotification; first: boolean; last: boolean };

/** Строки для FlatList: сверху самое новое уведомление, заголовок дня — над уведомлениями этого дня. */
export function historyRows(items: CategoryNotification[], now: Date = new Date()): HistoryRow[] {
  const rows: HistoryRow[] = [];
  for (const group of groupNotificationsByDay(items, now)) {
    rows.push({ type: 'day', key: `day:${group.key}`, label: group.label });
    group.items.forEach((notification, index) =>
      rows.push({
        type: 'item',
        key: `n:${notification.id}`,
        notification,
        first: index === 0,
        last: index === group.items.length - 1,
      })
    );
  }
  return rows;
}

/** Время в списке категорий: сегодня — «13:20», вчера — «Вчера», раньше — «21 окт.». */
export function formatCategoryTime(value: string, now: Date = new Date()): string {
  const key = toAppDateKey(value);
  if (key === toAppDateKey(now)) return formatTimeOnly(value);
  if (key === yesterdayKey(now)) return 'Вчера';
  const sameYear = key.slice(0, 4) === toAppDateKey(now).slice(0, 4);
  return formatWithOptions(
    value,
    sameYear ? { day: 'numeric', month: 'short' } : { day: '2-digit', month: '2-digit', year: 'numeric' }
  );
}

/** «1 непрочитанное», «2 непрочитанных», «21 непрочитанное». */
export function formatUnreadLabel(count: number): string {
  const word = count % 10 === 1 && count % 100 !== 11 ? 'непрочитанное' : 'непрочитанных';
  return `${count} ${word}`;
}

export function formatBadgeCount(count: number): string {
  return count > 99 ? '99+' : String(count);
}

/** Сводка после прочтения одного уведомления: счётчики его категории и общий — на одно меньше. */
export function applyNotificationRead(summary: CategorySummary, notification: CategoryNotification): CategorySummary {
  if (notification.is_read) return summary;
  let changed = false;
  const categories = summary.categories.map((item) => {
    if (item.category !== notification.category) return item;
    changed = item.unread_count > 0;
    return {
      ...item,
      unread_count: Math.max(0, item.unread_count - 1),
      last_notification:
        item.last_notification?.id === notification.id
          ? { ...item.last_notification, is_read: true }
          : item.last_notification,
    };
  });
  return {
    categories,
    unread_count: changed ? Math.max(0, summary.unread_count - 1) : summary.unread_count,
  };
}

export type NotificationTextPart =
  | { type: 'text'; value: string }
  /** `value` — номер как в тексте («1238/2»), `requestGroupId` — заявка для перехода (1238). */
  | { type: 'request'; value: string; requestGroupId: number };

/** Текст с номерами заявок «№ 1238» / «№ 1238/2»; окружающие слова («Заявка») остаются текстом. */
export function splitRequestNumbers(content: string): NotificationTextPart[] {
  const parts: NotificationTextPart[] = [];
  const re = /№\s*(\d+)(?:\/(\d+))?/g;
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(content)) !== null) {
    if (match.index > last) parts.push({ type: 'text', value: content.slice(last, match.index) });
    parts.push({
      type: 'request',
      value: match[2] != null ? `${match[1]}/${match[2]}` : match[1],
      requestGroupId: Number(match[1]),
    });
    last = re.lastIndex;
  }
  if (last < content.length) parts.push({ type: 'text', value: content.slice(last) });
  return parts;
}

/** Дата и время в модалке полного текста: «22 октября 2026 г., 13:34». */
export function formatNotificationDateTime(value: string): string {
  return formatWithOptions(value, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}
