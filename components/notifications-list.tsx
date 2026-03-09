import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  fetchNotifications,
  markNotificationRead,
  type Notification,
} from '@/lib/profile-api';

import { formatTimeAgo } from '@/lib/dateTimeUtils';

const PAGE_SIZE = 10;

export function NotificationsList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');

  const loadNotifications = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setError(null);

      const result = await fetchNotifications(pageNum, PAGE_SIZE);

      if (append) {
        setLoadingMore(false);
      } else {
        setLoading(false);
      }

      if (!result.ok) {
        if (result.unauthorized) return;
        setError(result.error);
        if (!append) setNotifications([]);
        return;
      }

      const list = result.data.notifications ?? [];
      const total = result.data.totalPages ?? (list.length >= PAGE_SIZE ? 2 : 1);

      if (append) {
        setNotifications((prev) => {
          const ids = new Set(prev.map((n) => n.id));
          const newOnes = list.filter((n) => !ids.has(n.id));
          return [...prev, ...newOnes];
        });
      } else {
        setNotifications(list);
      }
      setPage(pageNum);
      setTotalPages(total);
    },
    []
  );

  useEffect(() => {
    loadNotifications(1, false);
  }, [loadNotifications]);

  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      setSelectedNotification(notification);
      if (!notification.is_read) {
        const result = await markNotificationRead(notification.id);
        if (result.ok) {
          setNotifications((prev) =>
            prev.map((n) =>
              n.id === notification.id ? { ...n, is_read: true } : n
            )
          );
          setSelectedNotification((n) =>
            n?.id === notification.id ? { ...n, is_read: true } : n
          );
        }
      }
    },
    []
  );

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    loadNotifications(page + 1, true);
  }, [loadingMore, page, totalPages, loadNotifications]);

  return (
    <View style={[styles.card, { borderColor: border }]}>
      <ThemedText style={styles.title}>Все уведомления</ThemedText>
      <ThemedText style={[styles.subtitle, { color: textMuted }]}>
        Нажмите на уведомление, чтобы отметить как прочитанное
      </ThemedText>

      {loading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={border} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>
            Загрузка...
          </ThemedText>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ThemedText style={[styles.errorText, { color: primary }]}>{error}</ThemedText>
          <Button
            title="Повторить"
            onPress={() => loadNotifications(1, false)}
            variant="secondary"
          />
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.centered}>
          <MaterialIcons name="notifications-none" size={48} color={textMuted} />
          <ThemedText style={[styles.emptyText, { color: textMuted }]}>
            Нет уведомлений
          </ThemedText>
          <ThemedText style={[styles.emptySubtext, { color: textMuted }]}>
            Новые уведомления появятся здесь
          </ThemedText>
        </View>
      ) : (
        <>
          <ScrollView
            style={styles.list}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => handleNotificationPress(n)}
                style={({ pressed }) => [
                  styles.item,
                  { borderColor: border },
                  !n.is_read && { borderLeftWidth: 4, borderLeftColor: primary },
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={styles.itemHeader}>
                  <ThemedText
                    style={[styles.itemTitle, { color: text }]}
                    numberOfLines={2}
                  >
                    {n.title}
                  </ThemedText>
                  {!n.is_read && (
                    <View style={[styles.newBadge, { backgroundColor: `${primary}33` }]}>
                      <ThemedText style={[styles.newBadgeText, { color: primary }]}>Новое</ThemedText>
                    </View>
                  )}
                </View>
                <ThemedText
                  style={[styles.itemContent, { color: textMuted }]}
                  numberOfLines={2}
                >
                  {n.content}
                </ThemedText>
                <View style={styles.itemFooter}>
                  <MaterialIcons name="schedule" size={14} color={textMuted} />
                  <ThemedText style={[styles.itemTime, { color: textMuted }]}>
                    {formatTimeAgo(n.created_at)}
                  </ThemedText>
                </View>
              </Pressable>
            ))}
          </ScrollView>

          {page < totalPages && (
            <Button
              title={loadingMore ? 'Загрузка...' : 'Загрузить ещё'}
              onPress={handleLoadMore}
              disabled={loadingMore}
              variant="secondary"
            />
          )}

          <Modal
            visible={!!selectedNotification}
            transparent
            animationType="fade"
            onRequestClose={() => setSelectedNotification(null)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setSelectedNotification(null)}
            >
              <Pressable
                style={[
                  styles.modalContent,
                  { borderColor: border, backgroundColor: background },
                ]}
                onPress={(e) => e.stopPropagation()}
              >
                <View style={[styles.modalHeader, { borderBottomColor: border }]}>
                  <ThemedText style={[styles.modalTitle, { color: text }]}>
                    {selectedNotification?.title}
                  </ThemedText>
                  <Pressable
                    onPress={() => setSelectedNotification(null)}
                    hitSlop={12}
                  >
                    <MaterialIcons name="close" size={24} color={textMuted} />
                  </Pressable>
                </View>
                <ScrollView style={styles.modalBody}>
                  <ThemedText style={[styles.modalBodyText, { color: text }]}>
                    {selectedNotification?.content}
                  </ThemedText>
                  <ThemedText style={[styles.modalTime, { color: textMuted }]}>
                    {selectedNotification?.created_at
                      ? new Date(selectedNotification.created_at).toLocaleString(
                          'ru-RU'
                        )
                      : ''}
                  </ThemedText>
                </ScrollView>
              </Pressable>
            </Pressable>
          </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
  centered: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  emptySubtext: {
    fontSize: 12,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 10,
    gap: 8,
  },
  itemPressed: {
    opacity: 0.9,
  },
  itemHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 8,
  },
  itemTitle: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  newBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  newBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  itemContent: {
    fontSize: 14,
    lineHeight: 20,
  },
  itemFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  itemTime: {
    fontSize: 12,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    borderRadius: 16,
    borderWidth: 1,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
  },
  modalTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: '600',
  },
  modalBody: {
    padding: 16,
    maxHeight: 400,
  },
  modalBodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  modalTime: {
    fontSize: 12,
    marginTop: 12,
  },
});
