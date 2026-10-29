import { MaterialIcons } from '@expo/vector-icons';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import { formatNotificationDateTime, type CategoryNotification } from '@/lib/notification-categories';
import { taskNotificationTarget, type TaskPushTarget } from '@/lib/push-notification-open';

import { NotificationText } from './category-visuals';

/** Полный текст уведомления (Figma «История - полный текст (модалка)»). */
export function NotificationDetailModal({
  notification,
  onClose,
  onRequestPress,
  onTaskPress,
}: {
  notification: CategoryNotification | null;
  onClose: () => void;
  onRequestPress: (requestGroupId: number) => void;
  onTaskPress: (target: TaskPushTarget) => void;
}) {
  const ui = useProductUi();
  // Удалённую задачу не открыть: у её уведомления кнопки нет.
  const task = notification ? taskNotificationTarget(notification) : null;
  const openableTask = task?.event === 'deleted' ? null : task;
  const line = ui.fg(0.1);

  return (
    <Modal visible={!!notification} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.overlay, { backgroundColor: ui.scrim }]} onPress={onClose} accessibilityLabel="Закрыть">
        <Pressable
          style={[styles.card, { backgroundColor: ui.surface, borderColor: line }]}
          onPress={(event) => event.stopPropagation()}
          accessibilityViewIsModal
        >
          <View style={[styles.header, { borderBottomColor: line }]}>
            <Text style={[styles.title, { color: ui.fg() }]} accessibilityRole="header">
              {notification?.title}
            </Text>
            <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel="Закрыть">
              <MaterialIcons name="close" size={22} color={ui.fg(0.7)} />
            </Pressable>
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent}>
            {notification ? (
              <NotificationText
                notification={notification}
                style={[styles.content, { color: ui.fg() }]}
                onRequestPress={onRequestPress}
              />
            ) : null}
            {notification?.created_at ? (
              <Text style={[styles.time, { color: ui.fg(0.55) }]}>{formatNotificationDateTime(notification.created_at)}</Text>
            ) : null}
          </ScrollView>
          <View style={[styles.footer, { borderTopColor: line }]}>
            {openableTask ? (
              <Pressable
                onPress={() => onTaskPress(openableTask)}
                accessibilityRole="button"
                style={({ pressed }) => [styles.button, { backgroundColor: ui.accent }, pressed && styles.pressed]}
              >
                <Text style={[styles.buttonText, { color: ui.onAccent }]}>Открыть задачу</Text>
              </Pressable>
            ) : null}
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              style={({ pressed }) => [styles.button, styles.outline, { borderColor: ui.fg(0.15) }, pressed && styles.pressed]}
            >
              <Text style={[styles.buttonText, { color: ui.fg() }]}>Закрыть</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 16 },
  card: { width: '100%', maxWidth: 361, maxHeight: '80%', borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  title: { flex: 1, fontSize: 18, fontWeight: '600', lineHeight: 24 },
  body: { flexGrow: 0 },
  bodyContent: { padding: 16, gap: 16 },
  content: { fontSize: 14, lineHeight: 23 },
  time: { fontSize: 12 },
  footer: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  button: { height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  outline: { borderWidth: 1 },
  buttonText: { fontSize: 14, fontWeight: '500' },
  pressed: { opacity: 0.8 },
});
