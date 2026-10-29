import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, Text, View, type StyleProp, type TextStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import {
  NOTIFICATION_CATEGORY_META,
  splitRequestNumbers,
  type CategoryNotification,
  type NotificationCategory,
} from '@/lib/notification-categories';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** Иконка и цвет категории по макету. */
const CATEGORY_VISUAL: Record<NotificationCategory, { icon: IconName; color: string }> = {
  service_requests: { icon: 'build', color: '#F35713' },
  meeting_rooms: { icon: 'meeting-room', color: '#2A9D8F' },
  tasks: { icon: 'assignment', color: '#10B981' },
  registrations: { icon: 'person-add-alt-1', color: '#60A5FA' },
};

export function CategoryIcon({
  category,
  muted = false,
  size = 48,
}: {
  category: NotificationCategory;
  /** Категория без уведомлений — серая иконка. */
  muted?: boolean;
  size?: number;
}) {
  const ui = useProductUi();
  const { icon, color } = CATEGORY_VISUAL[category];
  return (
    <View
      style={[
        styles.icon,
        { width: size, height: size, borderRadius: size / 2, backgroundColor: muted ? ui.fg(0.08) : `${color}33` },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <MaterialIcons name={icon} size={Math.round(size * 0.46)} color={muted ? ui.fg(0.4) : color} />
    </View>
  );
}

/** Пустая история категории. */
export function CategoryEmptyState({ category }: { category: NotificationCategory }) {
  const ui = useProductUi();
  return (
    <View style={styles.empty} accessibilityRole="summary">
      <CategoryIcon category={category} size={64} />
      <Text style={[styles.emptyTitle, { color: ui.fg() }]}>Пока нет уведомлений</Text>
      <Text style={[styles.emptyHint, { color: ui.fg(0.55) }]}>{NOTIFICATION_CATEGORY_META[category].emptyHint}</Text>
    </View>
  );
}

/**
 * Текст уведомления. Номер заявки — ссылка только там, где переход существует (Сервисные
 * заявки); в остальных категориях текст выводится как есть.
 */
export function NotificationText({
  notification,
  style,
  onRequestPress,
}: {
  notification: CategoryNotification;
  style: StyleProp<TextStyle>;
  onRequestPress?: (requestGroupId: number) => void;
}) {
  const ui = useProductUi();
  const category = notification.category;
  if (!category || !NOTIFICATION_CATEGORY_META[category].linksRequests || !onRequestPress) {
    return <Text style={style}>{notification.content}</Text>;
  }
  return (
    <Text style={style}>
      {splitRequestNumbers(notification.content).map((part, index) =>
        part.type === 'text' ? (
          part.value
        ) : (
          <Text
            key={index}
            onPress={() => onRequestPress(part.requestGroupId)}
            accessibilityRole="link"
            style={[styles.link, { color: ui.accent }]}
          >
            № {part.value}
          </Text>
        )
      )}
    </Text>
  );
}

const styles = StyleSheet.create({
  icon: { alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 },
  emptyTitle: { marginTop: 12, fontSize: 16, fontWeight: '500', textAlign: 'center' },
  emptyHint: { marginTop: 4, maxWidth: 320, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  link: { fontWeight: '600', textDecorationLine: 'underline' },
});
