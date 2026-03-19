import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  TextInput as RNTextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader, Select } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { NEWS_ITEMS } from '@/constants/news';
import { getNewsAll } from '@/lib/news-api';
import type { NewsDisplayItem } from '@/lib/news-api';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import { NewsListItem } from '@/components/news/news-list-item';

const DATE_OPTIONS = [
  { value: 'all', label: 'Все даты' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'За неделю' },
  { value: 'month', label: 'За месяц' },
];

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatNewsDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [newsList, setNewsList] = useState<NewsDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getNewsAll().then((res) => {
      if (cancelled) return;
      if (res.ok) setNewsList(res.data);
      else setNewsList(NEWS_ITEMS.map((i) => ({ id: i.id, tag: i.tag || 'Новость', title: i.title, desc: i.desc, image: i.image, date: i.date })));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, []);

  const todayKey = formatDateForApi(new Date());

  const filteredItems = useMemo(() => {
    let list = newsList;
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.desc.toLowerCase().includes(q) ||
          i.tag.toLowerCase().includes(q)
      );
    }
    if (filterDate === 'today') {
      list = list.filter((i) => i.date === todayKey);
    } else if (filterDate === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weekKey = formatDateForApi(weekAgo);
      list = list.filter((i) => i.date && i.date >= weekKey && i.date <= todayKey);
    } else if (filterDate === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      const monthKey = formatDateForApi(monthAgo);
      list = list.filter((i) => i.date && i.date >= monthKey && i.date <= todayKey);
    }
    return list.sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  }, [searchQuery, filterDate, todayKey, newsList]);

  const renderItem = useCallback(
    ({ item }: { item: NewsDisplayItem }) => (
      <NewsListItem
        title={item.title}
        tag={item.tag}
        dateLabel={item.date ? formatNewsDate(item.date) : null}
        description={item.desc}
        imageUrl={item.image}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push(`/client/news/${item.id}`);
        }}
        rightSlot={<MaterialIcons name="chevron-right" size={24} color={headerSubtitle} />}
      />
    ),
    [headerSubtitle, router]
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Все новости" />
      <View style={[styles.searchRow, { backgroundColor: cardBg, borderColor: border }]}>
        <MaterialIcons name="search" size={20} color={headerSubtitle} />
        <RNTextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Поиск новостей..."
          placeholderTextColor={headerSubtitle}
          style={[styles.searchInput, { color: headerText }]}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={headerSubtitle} />
          </Pressable>
        )}
      </View>
      <View style={[styles.filters, { borderBottomColor: border }]}>
        <View style={styles.filterRow}>
          <ThemedText style={[styles.filterLabel, { color: headerSubtitle }]}>Дата</ThemedText>
          <View style={styles.selectWrap}>
            <Select
              value={filterDate}
              onValueChange={setFilterDate}
              options={DATE_OPTIONS}
              placeholder="Все даты"
            />
          </View>
        </View>
      </View>
      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primary} />
          <ThemedText style={[styles.loadingText, { color: headerSubtitle }]}>Загрузка...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={filteredItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText style={[styles.emptyText, { color: headerSubtitle }]}>Нет новостей</ThemedText>
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
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  filters: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  filterLabel: { fontSize: 14, marginRight: 12, minWidth: 50 },
  selectWrap: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16, gap: 12 },
  separator: { height: 12 },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12, paddingVertical: 48 },
  loadingText: { fontSize: 16 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalImage: {
    width: '100%',
    height: 200,
  },
  modalBody: { padding: 20 },
  modalMeta: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
  modalTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  modalDate: { fontSize: 14 },
  modalTagText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  modalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  modalDesc: { fontSize: 16, lineHeight: 24 },
  modalClose: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  modalCloseText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
});
