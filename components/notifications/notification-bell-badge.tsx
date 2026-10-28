import { StyleSheet, Text, View } from 'react-native';

import { useNotificationSummary } from '@/hooks/use-notification-summary';
import { useProductUi } from '@/hooks/use-product-ui';
import { formatBadgeCount } from '@/lib/notification-categories';

/** Общий счётчик непрочитанных у иконки-колокольчика (родитель — `position: 'relative'`). */
export function NotificationBellBadge() {
  const ui = useProductUi();
  const { unreadCount } = useNotificationSummary();
  if (unreadCount <= 0) return null;
  return (
    <View
      style={[styles.badge, { backgroundColor: ui.accent }]}
      accessibilityLabel={`Непрочитанных уведомлений: ${unreadCount}`}
    >
      <Text style={[styles.text, { color: ui.onAccent }]}>{formatBadgeCount(unreadCount)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -2,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { fontSize: 11, fontWeight: '700', lineHeight: 13 },
});
