import { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  Modal,
  TextInput as RNTextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader, Select } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { NEWS_ITEMS, type NewsItem } from '@/constants/news';
import { formatDateForApi } from '@/lib/dateTimeUtils';

const DATE_OPTIONS = [
  { value: 'all', label: 'Все даты' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'За неделю' },
  { value: 'month', label: 'За месяц' },
];

const NEWS_IMAGE_SIZE = 100;
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatNewsDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

function NewsRow({
  item,
  onPress,
  textColor,
  textMuted,
  primary,
}: {
  item: NewsItem;
  onPress: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
}) {
  const dateLabel = item.date ? formatNewsDate(item.date) : null;
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.9 : 1 }]}
    >
      <Image
        source={{ uri: item.image }}
        style={styles.rowImage}
        contentFit="cover"
      />
      <View style={styles.rowContent}>
        <View style={[styles.tag, { backgroundColor: primary }]}>
          <ThemedText style={styles.tagText}>{item.tag}</ThemedText>
        </View>
        <ThemedText style={[styles.rowTitle, { color: textColor }]} numberOfLines={2}>
          {item.title}
        </ThemedText>
        <ThemedText style={[styles.rowDesc, { color: textMuted }]} numberOfLines={2}>
          {item.desc}
        </ThemedText>
        {dateLabel && (
          <ThemedText style={[styles.rowDate, { color: textMuted }]}>{dateLabel}</ThemedText>
        )}
      </View>
      <MaterialIcons name="chevron-right" size={24} color={textMuted} />
    </Pressable>
  );
}

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);

  const todayKey = formatDateForApi(new Date());

  const filteredItems = useMemo(() => {
    let list = NEWS_ITEMS;
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
  }, [searchQuery, filterDate, todayKey]);

  const renderItem = useCallback(
    ({ item }: { item: NewsItem }) => (
      <NewsRow
        item={item}
        onPress={() => setSelectedItem(item)}
        textColor={headerText}
        textMuted={headerSubtitle}
        primary={primary}
      />
    ),
    [headerText, headerSubtitle, primary]
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
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: border }]} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <ThemedText style={[styles.emptyText, { color: headerSubtitle }]}>Нет новостей</ThemedText>
          </View>
        }
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={!!selectedItem}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedItem(null)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setSelectedItem(null)}
        >
          <Pressable
            style={[styles.modalContent, { backgroundColor: cardBg }]}
            onPress={(e) => e.stopPropagation()}
          >
            {selectedItem && (
              <>
                <Image
                  source={{ uri: selectedItem.image }}
                  style={styles.modalImage}
                  contentFit="cover"
                />
                <View style={styles.modalBody}>
                  <View style={styles.modalMeta}>
                    <View style={[styles.modalTag, { backgroundColor: primary }]}>
                      <ThemedText style={styles.modalTagText}>{selectedItem.tag}</ThemedText>
                    </View>
                    {selectedItem.date && (
                      <ThemedText style={[styles.modalDate, { color: headerSubtitle }]}>
                        {formatNewsDate(selectedItem.date)}
                      </ThemedText>
                    )}
                  </View>
                  <ThemedText style={[styles.modalTitle, { color: headerText }]}>
                    {selectedItem.title}
                  </ThemedText>
                  <ThemedText style={[styles.modalDesc, { color: headerSubtitle }]}>
                    {selectedItem.desc}
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => setSelectedItem(null)}
                  style={[styles.modalClose, { backgroundColor: primary }]}
                >
                  <ThemedText style={styles.modalCloseText}>Закрыть</ThemedText>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowImage: {
    width: NEWS_IMAGE_SIZE,
    height: NEWS_IMAGE_SIZE,
    borderRadius: 12,
    marginRight: 14,
  },
  rowContent: { flex: 1, minWidth: 0 },
  tag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 6,
  },
  tagText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  rowTitle: { fontSize: 16, fontWeight: '600', marginBottom: 4 },
  rowDesc: { fontSize: 14, lineHeight: 20 },
  rowDate: { fontSize: 12, marginTop: 4 },
  separator: { height: StyleSheet.hairlineWidth },
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
