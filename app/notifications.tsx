import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, BackHandler, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationCategoryList } from '@/components/notifications/category-list';
import { CategoryEmptyState } from '@/components/notifications/category-visuals';
import { NotificationDetailModal } from '@/components/notifications/notification-detail-modal';
import { EmptyState } from '@/components/ui/empty-state';
import { useNotificationSummary } from '@/hooks/use-notification-summary';
import { useProductUi } from '@/hooks/use-product-ui';
import { formatTimeOnly } from '@/lib/dateTimeUtils';
import {
  NOTIFICATION_CATEGORY_META,
  formatUnreadLabel,
  historyRows,
  isNotificationCategory,
  type CategoryNotification,
  type HistoryRow,
  type NotificationCategory,
} from '@/lib/notification-categories';
import { taskDetailsHref, type TaskPushTarget } from '@/lib/push-notification-open';
import { useAuthStore } from '@/stores/auth-store';
import { useNotificationCategoriesStore } from '@/stores/notification-categories-store';

/**
 * «Уведомления» (Figma 241-2002): категории роли → история категории по дням, новые внизу →
 * полный текст в модальном окне. Открытая категория — `?category=` в адресе, без новых экранов.
 */
export default function NotificationsScreen() {
  const router = useRouter();
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ category?: string }>();
  const { categories, summary, loading, error, refresh } = useNotificationSummary();
  const [selected, setSelected] = useState<CategoryNotification | null>(null);

  // Категория из адреса показывается, только если она есть у роли.
  const requested = isNotificationCategory(params.category) ? params.category : null;
  const category = requested && (!summary || categories.some((c) => c.category === requested)) ? requested : null;

  const selectCategory = useCallback((next: NotificationCategory | null) => {
    router.setParams({ category: next ?? undefined });
  }, [router]);

  // Android «Назад» из истории возвращает к категориям, а не закрывает экран.
  useEffect(() => {
    if (!category) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      selectCategory(null);
      return true;
    });
    return () => sub.remove();
  }, [category, selectCategory]);

  const open = useCallback((notification: CategoryNotification) => {
    setSelected(notification);
    // Прочитанным уведомление становится только при открытии.
    void useNotificationCategoriesStore.getState().markRead(notification).then((saved) => {
      if (saved) setSelected((current) => (current?.id === notification.id ? { ...current, is_read: true } : current));
    });
  }, []);

  const openRequest = useCallback((requestGroupId: number) => {
    setSelected(null);
    router.push(`/(tabs)/requests/${requestGroupId}`);
  }, [router]);

  const openTask = useCallback((target: TaskPushTarget) => {
    setSelected(null);
    router.push(taskDetailsHref(target));
  }, [router]);

  const unread = categories.find((c) => c.category === category)?.unread_count ?? 0;

  return (
    <View style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
      <Header
        title={category ? NOTIFICATION_CATEGORY_META[category].label : 'Уведомления'}
        subtitle={category && unread > 0 ? formatUnreadLabel(unread) : undefined}
        onBack={() => (category ? selectCategory(null) : router.back())}
      />

      {category ? (
        <CategoryHistory key={category} category={category} onOpen={open} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {!summary && loading ? (
            <ActivityIndicator style={styles.status} color={ui.fg(0.5)} />
          ) : !summary && error ? (
            <EmptyState style={styles.status} icon="error-outline" title={error} action={<RetryButton onPress={refresh} />} />
          ) : categories.length === 0 ? (
            <EmptyState style={styles.status} icon="notifications-none" title="Нет уведомлений" description="Новые уведомления появятся здесь" />
          ) : (
            <NotificationCategoryList categories={categories} onSelect={selectCategory} />
          )}
        </ScrollView>
      )}

      <NotificationDetailModal
        notification={selected}
        onClose={() => setSelected(null)}
        onRequestPress={openRequest}
        onTaskPress={openTask}
      />
    </View>
  );
}

function Header({ title, subtitle, onBack }: { title: string; subtitle?: string; onBack: () => void }) {
  const ui = useProductUi();
  return (
    <View style={styles.header}>
      <Pressable onPress={onBack} hitSlop={8} accessibilityRole="button" accessibilityLabel="Назад" style={styles.back}>
        <MaterialIcons name="arrow-back" size={22} color={ui.fg()} />
      </Pressable>
      <View style={styles.headerText}>
        <Text style={[styles.headerTitle, { color: ui.fg() }]} numberOfLines={1} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? <Text style={[styles.headerSubtitle, { color: ui.accent }]}>{subtitle}</Text> : null}
      </View>
      <View style={styles.back} />
    </View>
  );
}

function RetryButton({ onPress }: { onPress: () => void }) {
  const ui = useProductUi();
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button">
      <Text style={[styles.retry, { color: ui.accent }]}>Повторить</Text>
    </Pressable>
  );
}

/** История категории: перевёрнутый список — открывается внизу, на самых новых; ранние подгружаются вверх. */
function CategoryHistory({
  category,
  onOpen,
}: {
  category: NotificationCategory;
  onOpen: (notification: CategoryNotification) => void;
}) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const history = useNotificationCategoriesStore((s) => (s.ownerToken === token ? s.histories[category] : undefined));
  const items = useMemo(() => history?.items ?? [], [history?.items]);
  const rows = useMemo(() => historyRows(items), [items]);

  const retry = useCallback(() => {
    if (token) void useNotificationCategoriesStore.getState().loadHistory(token, category);
  }, [token, category]);
  useEffect(retry, [retry]);

  const loadOlder = useCallback(() => {
    if (token) void useNotificationCategoriesStore.getState().loadOlder(token, category);
  }, [token, category]);

  if (items.length === 0) {
    return (
      <View style={styles.flex}>
        {!history || history.loading ? (
          <ActivityIndicator style={styles.status} color={ui.fg(0.5)} />
        ) : history.error ? (
          <EmptyState style={styles.status} icon="error-outline" title={history.error} action={<RetryButton onPress={retry} />} />
        ) : (
          <CategoryEmptyState category={category} />
        )}
      </View>
    );
  }

  return (
    <FlatList
      inverted
      data={rows}
      keyExtractor={(row) => row.key}
      renderItem={({ item }) => <HistoryRowView row={item} onOpen={onOpen} />}
      onEndReached={loadOlder}
      onEndReachedThreshold={0.5}
      ListFooterComponent={history?.loading ? <ActivityIndicator style={styles.older} color={ui.fg(0.5)} /> : null}
      contentContainerStyle={[styles.history, { paddingTop: insets.bottom + 24 }]}
      showsVerticalScrollIndicator={false}
    />
  );
}

function HistoryRowView({ row, onOpen }: { row: HistoryRow; onOpen: (notification: CategoryNotification) => void }) {
  const ui = useProductUi();
  if (row.type === 'day') {
    return (
      <Text style={[styles.day, { color: ui.fg(0.55) }]} accessibilityRole="header">
        {row.label}
      </Text>
    );
  }
  const { notification, first, last } = row;
  const unread = !notification.is_read;
  return (
    <View style={[styles.itemCard, { backgroundColor: ui.surface }, first && styles.itemFirst, last && styles.itemLast]}>
      {!first ? <View style={[styles.itemDivider, { backgroundColor: ui.fg(0.08) }]} /> : null}
      <Pressable
        onPress={() => onOpen(notification)}
        accessibilityRole="button"
        accessibilityLabel={`${unread ? 'Новое. ' : ''}${notification.title}`}
        style={({ pressed }) => [styles.item, unread && { backgroundColor: ui.accentSoft }, pressed && styles.pressed]}
      >
        <View style={styles.dotSlot}>
          {unread ? <View style={[styles.dot, { backgroundColor: ui.accent }]} /> : null}
        </View>
        <View style={styles.itemText}>
          <View style={styles.itemTop}>
            <Text style={[styles.itemTitle, unread && styles.itemTitleUnread, { color: unread ? ui.fg() : ui.fg(0.8) }]}>
              {notification.title}
            </Text>
            <Text style={[styles.itemTime, { color: ui.fg(0.55) }]}>{formatTimeOnly(notification.created_at)}</Text>
          </View>
          <Text style={[styles.itemContent, { color: unread ? ui.fg(0.8) : ui.fg(0.6) }]} numberOfLines={2}>
            {notification.content}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, alignItems: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '600', lineHeight: 21 },
  headerSubtitle: { marginTop: 1, fontSize: 12 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  status: { marginTop: 48 },
  retry: { fontSize: 14, fontWeight: '500' },
  history: { paddingHorizontal: 16, paddingBottom: 8 },
  older: { marginVertical: 12 },
  day: { fontSize: 13, fontWeight: '600', marginTop: 16, marginBottom: 8 },
  itemCard: { overflow: 'hidden' },
  itemFirst: { borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  itemLast: { borderBottomLeftRadius: 20, borderBottomRightRadius: 20 },
  itemDivider: { height: StyleSheet.hairlineWidth, marginLeft: 30 },
  item: { flexDirection: 'row', gap: 10, paddingVertical: 14, paddingLeft: 12, paddingRight: 16 },
  pressed: { opacity: 0.85 },
  dotSlot: { width: 8, alignItems: 'center', paddingTop: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  itemText: { flex: 1, minWidth: 0, gap: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  itemTitle: { flex: 1, fontSize: 15, lineHeight: 20, fontWeight: '500' },
  itemTitleUnread: { fontWeight: '600' },
  itemTime: { fontSize: 12, lineHeight: 20 },
  itemContent: { fontSize: 14, lineHeight: 19 },
});
