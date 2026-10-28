import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import {
  NOTIFICATION_CATEGORY_META,
  formatBadgeCount,
  formatCategoryTime,
  formatUnreadLabel,
  orderCategoriesByActivity,
  type CategorySummaryItem,
  type NotificationCategory,
} from '@/lib/notification-categories';

import { CategoryIcon } from './category-visuals';

/**
 * Экран «Уведомления» (Figma «Категории»): порядок — по последнему событию, пустые категории
 * в конце с «Пока нет уведомлений».
 */
export function NotificationCategoryList({
  categories,
  onSelect,
}: {
  categories: CategorySummaryItem[];
  onSelect: (category: NotificationCategory) => void;
}) {
  const ui = useProductUi();
  return (
    <View style={[styles.card, { backgroundColor: ui.surface }]}>
      {orderCategoriesByActivity(categories).map((item, index) => {
        const meta = NOTIFICATION_CATEGORY_META[item.category];
        const last = item.last_notification;
        const unread = item.unread_count;
        const label = [meta.label, unread > 0 ? formatUnreadLabel(unread) : null].filter(Boolean).join(', ');
        return (
          <View key={item.category}>
            {index > 0 ? <View style={[styles.divider, { backgroundColor: ui.fg(0.08) }]} /> : null}
            <Pressable
              onPress={() => onSelect(item.category)}
              accessibilityRole="button"
              accessibilityLabel={label}
              style={({ pressed }) => [styles.row, pressed && { backgroundColor: ui.fg(0.04) }]}
            >
              <CategoryIcon category={item.category} muted={!last} />
              <View style={styles.text}>
                <Text style={[styles.title, { color: last ? ui.fg() : ui.fg(0.5) }]} numberOfLines={1}>
                  {meta.label}
                </Text>
                <Text
                  style={[styles.preview, { color: last ? ui.fg(0.75) : ui.fg(0.4) }]}
                  numberOfLines={last ? 2 : 1}
                >
                  {last ? last.content : 'Пока нет уведомлений'}
                </Text>
              </View>
              {last ? (
                <View style={styles.meta}>
                  <Text style={[styles.time, { color: unread > 0 ? ui.accent : ui.fg(0.45) }]}>
                    {formatCategoryTime(last.created_at)}
                  </Text>
                  {unread > 0 ? (
                    <View style={[styles.badge, { backgroundColor: ui.accent }]}>
                      <Text style={[styles.badgeText, { color: ui.onAccent }]}>{formatBadgeCount(unread)}</Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </Pressable>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden' },
  divider: { height: StyleSheet.hairlineWidth, marginLeft: 76 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  text: { flex: 1, minWidth: 0, gap: 2 },
  title: { fontSize: 16, fontWeight: '600', lineHeight: 21 },
  preview: { fontSize: 14, lineHeight: 19 },
  meta: { alignSelf: 'flex-start', alignItems: 'flex-end', gap: 6, paddingTop: 2 },
  time: { fontSize: 12 },
  badge: { minWidth: 20, height: 18, borderRadius: 9, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '700' },
});
