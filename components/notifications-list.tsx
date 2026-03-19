import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';

import { Button, PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  fetchNotifications,
  markNotificationRead,
  type Notification,
} from '@/lib/profile-api';
import { decrementBadge } from '@/lib/pushNotifications';
import { getContentSegmentsWithRequestIds } from '@/lib/notificationUtils';
import { formatTimeAgo } from '@/lib/dateTimeUtils';

const PAGE_SIZE = 10;

export function NotificationsList() {
  const router = useRouter();
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
  const background = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'border');
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
          void decrementBadge();
        }
      }
    },
    []
  );

  const handleLoadMore = useCallback(() => {
    if (loadingMore || page >= totalPages) return;
    loadNotifications(page + 1, true);
  }, [loadingMore, page, totalPages, loadNotifications]);

  const handleOpenRequest = useCallback(
    (requestGroupId: number) => {
      setSelectedNotification(null);
      router.push(`/(tabs)/requests/${requestGroupId}`);
    },
    [router]
  );

  const handleScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (loadingMore || page >= totalPages) return;
      const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
      const paddingToBottom = 80;
      if (
        layoutMeasurement.height + contentOffset.y >=
        contentSize.height - paddingToBottom
      ) {
        handleLoadMore();
      }
    },
    [handleLoadMore, loadingMore, page, totalPages]
  );

  return (
    <View style={[styles.card, { backgroundColor: background }]}>
      {loading && notifications.length === 0 ? (
        <View style={styles.centered}>
          <PageLoader size={80} />
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
            onScroll={handleScroll}
            scrollEventThrottle={16}
          >
            {notifications.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => handleNotificationPress(n)}
                style={({ pressed }) => [
                  styles.item,
                  !n.is_read && { backgroundColor: `${primary}22` },
                  pressed && styles.itemPressed,
                ]}
              >
                <View style={styles.rowLeft}>
                  <View style={[styles.avatar, { backgroundColor: `${primary}33` }]}>
                    <MaterialIcons name="notifications" size={20} color={primary} />
                  </View>
                </View>
                <View style={styles.rowCenter}>
                  <ThemedText
                    style={[styles.itemTitle, { color: text }]}
                    numberOfLines={2}
                  >
                    {n.title}
                  </ThemedText>
                  <ThemedText
                    style={[styles.itemContent, { color: textMuted }]}
                    numberOfLines={2}
                  >
                    {n.content}
                  </ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText style={[styles.itemTime, { color: textMuted }]}>
                    {formatTimeAgo(n.created_at)}
                  </ThemedText>
                  {!n.is_read && (
                    <View style={[styles.newDot, { backgroundColor: primary }]} />
                  )}
                </View>
              </Pressable>
            ))}
          </ScrollView>

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
                  <View style={styles.modalBodyContent}>
                    {selectedNotification?.content != null
                      ? getContentSegmentsWithRequestIds(
                          selectedNotification.content
                        ).map((seg, idx) =>
                          seg.type === 'text' ? (
                            <ThemedText
                              key={idx}
                              style={[styles.modalBodyText, { color: text }]}
                            >
                              {seg.value}
                            </ThemedText>
                          ) : (
                            <Pressable
                              key={idx}
                              onPress={() =>
                                handleOpenRequest(seg.requestGroupId)
                              }
                              style={({ pressed }) => [
                                styles.requestIdLink,
                                { borderBottomColor: primary },
                                pressed && styles.requestIdLinkPressed,
                              ]}
                            >
                              <ThemedText
                                style={[styles.requestIdLinkText, { color: primary }]}
                              >
                                № {seg.value}
                              </ThemedText>
                            </Pressable>
                          )
                        )
                      : null}
                  </View>
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
    paddingHorizontal: 0,
    paddingTop: 4,
    borderRadius: 12,
    gap: 16,
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
    flexGrow: 1,
  },
  item: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  itemPressed: {
    opacity: 0.9,
  },
  rowLeft: {
    marginRight: 12,
  },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowCenter: {
    flex: 1,
    gap: 2,
  },
  rowRight: {
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginLeft: 8,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '600',
  },
  itemContent: {
    fontSize: 13,
    lineHeight: 18,
  },
  itemTime: {
    fontSize: 11,
  },
  newDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
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
  modalBodyContent: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  modalBodyText: {
    fontSize: 15,
    lineHeight: 22,
  },
  requestIdLink: {
    borderBottomWidth: 1,
    paddingHorizontal: 2,
    marginHorizontal: 1,
  },
  requestIdLinkPressed: {
    opacity: 0.7,
  },
  requestIdLinkText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
  },
  modalTime: {
    fontSize: 12,
    marginTop: 12,
  },
});
