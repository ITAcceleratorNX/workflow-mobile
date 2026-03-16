import { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  Modal,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { NEWS_ITEMS, NEWS_TAGS, type NewsItem } from '@/constants/news';

const NEWS_IMAGE_SIZE = 100;

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

  const [filterTag, setFilterTag] = useState('Все');
  const [selectedItem, setSelectedItem] = useState<NewsItem | null>(null);

  const filteredItems = useMemo(() => {
    if (filterTag === 'Все') return NEWS_ITEMS;
    return NEWS_ITEMS.filter((i) => i.tag === filterTag);
  }, [filterTag]);

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
      <View style={[styles.filters, { borderBottomColor: border }]}>
        <FlatList
          horizontal
          data={NEWS_TAGS}
          keyExtractor={(t) => t}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
          renderItem={({ item: tag }) => {
            const isActive = filterTag === tag;
            return (
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilterTag(tag);
                }}
                style={[
                  styles.filterChip,
                  { borderColor: border },
                  isActive && { backgroundColor: primary, borderColor: primary },
                ]}
              >
                <ThemedText
                  style={[styles.filterChipText, { color: isActive ? '#FFFFFF' : headerText }]}
                >
                  {tag}
                </ThemedText>
              </Pressable>
            );
          }}
        />
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
                  <View style={[styles.modalTag, { backgroundColor: primary }]}>
                    <ThemedText style={styles.modalTagText}>{selectedItem.tag}</ThemedText>
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
  filters: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterScroll: {
    paddingHorizontal: 16,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 10,
  },
  filterChipText: { fontSize: 14, fontWeight: '500' },
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
  modalTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginBottom: 12,
  },
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
