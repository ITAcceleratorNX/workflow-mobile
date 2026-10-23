import { useAsyncResource } from '@/hooks/use-async-resource';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NewsReactionsRow } from '@/components/news/news-reactions-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getNewsById, recordNewsView, type NewsDisplayItem } from '@/lib/news-api';

import { normalizeReactionCounts } from '@/lib/news-reactions';
import { useAuthStore } from '@/stores/auth-store';

export default function NewsDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const subtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');

  const numericNewsId = id && Number.isFinite(Number(id)) ? Number(id) : null;

  const token = useAuthStore((s) => s.token);
  const canReact = typeof token === 'string' && token.length > 0 && token !== 'guest-demo';

  const load = useCallback(async () => {
    if (numericNewsId == null) throw new Error('Новость не найдена');
    const result = await getNewsById(numericNewsId);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, [numericNewsId]);
  const { data: item, setData: setItem, loading, error } = useAsyncResource<NewsDisplayItem | null>(load, null);
  const title = item?.title ?? '', tag = item?.tag ?? '', desc = item?.desc ?? '';
  const image = item?.image ?? null, dateLabel = item?.date ?? null;
  const reactionCounts = normalizeReactionCounts(item?.reaction_counts);
  const myReaction = item?.my_reaction ?? null;

  useEffect(() => {
    if (numericNewsId == null || !canReact) return;
    void recordNewsView(numericNewsId);
  }, [numericNewsId, canReact]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={22} color={headerText} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: headerText }]}>
          Новость
        </ThemedText>
        <View style={styles.headerRightSpacer} />
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : error ? (
        <View style={styles.loadingBox}>
          <ThemedText style={[styles.errorText, { color: primary }]}>{error}</ThemedText>
        </View>
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {image ? (
            <Image source={{ uri: image }} style={styles.heroImage} contentFit="cover" />
          ) : null}
          <View style={[styles.bodyCard, { backgroundColor: cardBg }]}>
            <View style={styles.metaRow}>
              {tag ? (
                <View style={[styles.tagChip, { backgroundColor: primary }]}>
                  <ThemedText style={styles.tagText}>{tag}</ThemedText>
                </View>
              ) : null}
              {dateLabel ? (
                <ThemedText style={[styles.dateText, { color: subtitle }]}>
                  {dateLabel}
                </ThemedText>
              ) : null}
            </View>
            <ThemedText style={[styles.title, { color: headerText }]}>
              {title}
            </ThemedText>
            <ThemedText style={[styles.desc, { color: subtitle }]}>
              {desc}
            </ThemedText>
            {numericNewsId != null ? (
              <NewsReactionsRow
                newsId={numericNewsId}
                reactionCounts={reactionCounts}
                myReaction={myReaction}
                canInteract={canReact}
                centered
                onUpdated={(p) => {
                  setItem((previous) => previous ? { ...previous, ...p } : previous);
                }}
              />
            ) : null}
          </View>
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '600',
  },
  headerRightSpacer: {
    width: 44,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 16,
  },
  heroImage: {
    width: '100%',
    height: 220,
    borderRadius: 20,
    marginBottom: 8,
  },
  bodyCard: {
    borderRadius: 20,
    padding: 18,
    gap: 12,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  tagChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  desc: {
    fontSize: 15,
    lineHeight: 22,
  },
});

