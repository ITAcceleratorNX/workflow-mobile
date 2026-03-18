import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui/screen-header';
import { NewsListItem } from '@/components/news/news-list-item';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  getNewsAdminList,
  deleteNews,
  hideNews,
  archiveNews,
  unhideNews,
  type NewsDisplayItem,
} from '@/lib/news-api';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatNewsDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'hidden', label: 'Скрытые' },
  { value: 'archived', label: 'Архив' },
] as const;

export default function AdminWorkerNewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');
  const border = useThemeColor({}, 'border');

  const [items, setItems] = useState<NewsDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'hidden' | 'archived' | ''>('');
  const [actionId, setActionId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const status = statusFilter || undefined;
    const res = await getNewsAdminList(status as 'active' | 'hidden' | 'archived' | undefined);
    if (res.ok) setItems(res.data);
    else setItems([]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  useFocusEffect(
    useCallback(() => {
      loadList();
    }, [loadList])
  );

  const openCreate = useCallback(() => {
    router.push({ pathname: '/admin-worker/news-editor', params: { mode: 'create' } });
  }, [router]);

  const openEdit = useCallback(
    (item: NewsDisplayItem) => {
      router.push({
        pathname: '/admin-worker/news-editor',
        params: {
          mode: 'edit',
          id: item.id,
          title: item.title,
          content: item.desc,
          imageUrl: item.image || '',
        },
      });
    },
    [router]
  );

  const handleDelete = useCallback(
    (item: NewsDisplayItem) => {
      Alert.alert(
        'Удалить новость?',
        `«${item.title}» будет удалена безвозвратно.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              const numId = parseInt(item.id, 10);
              if (isNaN(numId)) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setActionId(item.id);
              const res = await deleteNews(numId);
              setActionId(null);
              if (res.ok) {
                show({ title: 'Удалено', description: 'Новость удалена', variant: 'success' });
                loadList();
              } else {
                show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
              }
            },
          },
        ]
      );
    },
    [show, loadList]
  );

  const handleHide = useCallback(
    async (id: string) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActionId(id);
      const res = await hideNews(numId);
      setActionId(null);
      if (res.ok) {
        show({ title: 'Скрыто', description: 'Новость скрыта с главной', variant: 'success' });
        loadList();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    },
    [show, loadList]
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActionId(id);
      const res = await archiveNews(numId);
      setActionId(null);
      if (res.ok) {
        show({ title: 'Архивировано', description: 'Новость архивирована', variant: 'success' });
        loadList();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    },
    [show, loadList]
  );

  const handleUnhide = useCallback(
    async (id: string) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActionId(id);
      const res = await unhideNews(numId);
      setActionId(null);
      if (res.ok) {
        show({ title: 'Восстановлено', description: 'Новость снова активна', variant: 'success' });
        loadList();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    },
    [show, loadList]
  );

  const sortedItems = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const renderItem = useCallback(
    ({ item }: { item: NewsDisplayItem }) => {
      const status = item.status ?? 'active';
      const isBusy = actionId === item.id;
      const statusLabel = status === 'active' ? 'Активна' : status === 'hidden' ? 'Скрыта' : 'Архив';
      return (
        <NewsListItem
          title={item.title}
          tag={item.tag || 'Новость'}
          dateLabel={item.date ? formatNewsDate(item.date) : null}
          description={item.desc}
          imageUrl={item.image}
          onPress={() => openEdit(item)}
          rightSlot={
            <View style={styles.overlay}>
              <View
                style={[
                  styles.statusPill,
                  status === 'active' && styles.statusActive,
                  status === 'hidden' && styles.statusHidden,
                  status === 'archived' && styles.statusArchived,
                ]}
              >
                <ThemedText style={styles.statusText}>{statusLabel}</ThemedText>
              </View>

              <View style={styles.overlayActions}>
                <Pressable
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    openEdit(item);
                  }}
                  disabled={isBusy}
                  style={styles.overlayBtn}
                  hitSlop={8}
                >
                  <MaterialIcons name="edit" size={18} color="#FFFFFF" />
                </Pressable>
                <Pressable onPress={() => handleDelete(item)} disabled={isBusy} style={styles.overlayBtn} hitSlop={8}>
                  <MaterialIcons name="delete-outline" size={18} color="#FFFFFF" />
                </Pressable>
                {status === 'active' && (
                  <Pressable onPress={() => handleHide(item.id)} disabled={isBusy} style={styles.overlayBtn} hitSlop={8}>
                    {isBusy ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <MaterialIcons name="visibility-off" size={18} color="#FFFFFF" />
                    )}
                  </Pressable>
                )}
                {(status === 'active' || status === 'hidden') && (
                  <Pressable onPress={() => handleArchive(item.id)} disabled={isBusy} style={styles.overlayBtn} hitSlop={8}>
                    <MaterialIcons name="archive" size={18} color="#FFFFFF" />
                  </Pressable>
                )}
                {(status === 'hidden' || status === 'archived') && (
                  <Pressable onPress={() => handleUnhide(item.id)} disabled={isBusy} style={styles.overlayBtn} hitSlop={8}>
                    <MaterialIcons name="visibility" size={18} color="#FFFFFF" />
                  </Pressable>
                )}
              </View>
            </View>
          }
        />
      );
    },
    [openEdit, handleDelete, handleHide, handleArchive, handleUnhide, actionId]
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: screenBg }]}>
      <ScreenHeader title="Управление новостями" inlineTitle hideBackLabel />

      <View style={[styles.filters, { borderColor: border }]}>
        <ThemedText style={[styles.filterLabel, { color: textMuted }]}>Статус</ThemedText>
        <View style={styles.filterChips}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value || 'all'}
              style={[styles.chip, { backgroundColor: statusFilter === opt.value ? primary : gray600 }]}
              onPress={() => setStatusFilter(opt.value as typeof statusFilter)}
            >
              <ThemedText style={styles.chipText}>{opt.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={[styles.addBtn, { backgroundColor: primary }]} onPress={openCreate}>
        <MaterialIcons name="add" size={24} color="#fff" />
        <ThemedText style={styles.addBtnText}>Добавить новость</ThemedText>
      </Pressable>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primary} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={sortedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText style={[styles.emptyText, { color: textMuted }]}>Нет новостей. Добавьте первую.</ThemedText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  filters: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 14, marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: { fontSize: 14, color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16 },
  listContent: { paddingHorizontal: 16, gap: 12 },
  separator: { height: 12 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 16 },

  overlay: {
    alignItems: 'flex-end',
    gap: 8,
  },
  statusPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(17,24,39,0.65)',
  },
  statusActive: { backgroundColor: 'rgba(16,185,129,0.85)' },
  statusHidden: { backgroundColor: 'rgba(245,158,11,0.85)' },
  statusArchived: { backgroundColor: 'rgba(107,114,128,0.85)' },
  statusText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  overlayActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(17,24,39,0.55)',
    borderRadius: 999,
    overflow: 'hidden',
  },
  overlayBtn: {
    width: 34,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
