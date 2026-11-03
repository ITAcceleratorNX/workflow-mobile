import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
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
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, PageLoader, ScreenHeader, Select } from '@/components/ui';
import { EmptyState } from '@/components/ui/empty-state';
import { ClientSurveyCard } from '@/components/surveys/client-survey-card';
import { useThemeColor } from '@/hooks/use-theme-color';
import { NEWS_ITEMS } from '@/constants/news';
import { getNewsAll } from '@/lib/news-api';
import type { NewsDisplayItem } from '@/lib/news-api';
import { emptyReactionCounts } from '@/lib/news-reactions';
import type { NewsReactionCounts, NewsReactionKind } from '@/lib/news-reactions';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import { NewsListItem } from '@/components/news/news-list-item';
import { NewsReactionsRow } from '@/components/news/news-reactions-row';
import { useAuthStore } from '@/stores/auth-store';
import { surveysApi } from '@/lib/surveys-api';
import { availableSurveys, completedSurveys, hasAvailableSurveys } from '@/lib/surveys/list';
import { completedLabel } from '@/lib/surveys/format';
import type { ClientSurvey } from '@/lib/surveys/types';
import { useProductUi } from '@/hooks/use-product-ui';

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

type NewsTab = 'news' | 'surveys';

function dateKeyInAlmaty(value: string | Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value instanceof Date ? value : new Date(value));
  const part = (type: string) => parts.find((item) => item.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')}`;
}

function NewsSurveyTabs({
  value,
  onChange,
  showSurveyDot,
}: {
  value: NewsTab;
  onChange: (tab: NewsTab) => void;
  showSurveyDot: boolean;
}) {
  const ui = useProductUi();
  const tabs: { value: NewsTab; label: string }[] = [
    { value: 'news', label: 'Новости' },
    { value: 'surveys', label: 'Опросы' },
  ];

  return (
    <View accessibilityRole="tablist" accessibilityLabel="Разделы новостей" style={[styles.tabs, { backgroundColor: ui.surface }]}>
      {tabs.map((tab) => {
        const selected = value === tab.value;
        const dot = tab.value === 'surveys' && showSurveyDot;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={dot ? `${tab.label}, есть доступные опросы` : tab.label}
            onPress={() => onChange(tab.value)}
            style={({ pressed }) => [
              styles.tab,
              selected && { backgroundColor: ui.accent },
              pressed && { opacity: 0.8 },
            ]}
          >
            <ThemedText style={[styles.tabText, { color: selected ? ui.onAccent : ui.fg(0.56) }]}>{tab.label}</ThemedText>
            {dot ? <View style={[styles.tabDot, { backgroundColor: selected ? ui.onAccent : ui.accent }]} /> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

export default function NewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const token = useAuthStore((s) => s.token);
  const canReact = typeof token === 'string' && token.length > 0 && token !== 'guest-demo';
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDate, setFilterDate] = useState('all');
  const [newsList, setNewsList] = useState<NewsDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTabState, setActiveTabState] = useState<NewsTab>(() => tab === 'surveys' ? 'surveys' : 'news');
  const activeTab: NewsTab = tab === 'surveys' ? 'surveys' : activeTabState;
  const [surveys, setSurveys] = useState<ClientSurvey[] | null>(null);
  const [surveysLoading, setSurveysLoading] = useState(true);
  const [surveysError, setSurveysError] = useState<string | null>(null);
  const surveyRequestId = useRef(0);

  const changeTab = useCallback((nextTab: NewsTab) => {
    setActiveTabState(nextTab);
    if (tab) router.replace('/client/news');
  }, [router, tab]);

  const loadSurveys = useCallback(async () => {
    const requestId = ++surveyRequestId.current;
    setSurveysLoading(true);
    setSurveysError(null);
    const result = await surveysApi.listSurveys();
    if (requestId !== surveyRequestId.current) return;
    if (result.ok) {
      // Закрытые опросы без прохождения скрыты по согласованию; пройденные остаются в истории.
      setSurveys(result.data.filter((survey) => survey.state !== 'closed'));
    } else {
      setSurveysError(result.error);
    }
    setSurveysLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadSurveys();
      return () => { surveyRequestId.current += 1; };
    }, [loadSurveys])
  );

  useEffect(() => {
    let cancelled = false;
    getNewsAll().then((res) => {
      if (cancelled) return;
      if (res.ok) setNewsList(res.data);
      else setNewsList(NEWS_ITEMS.map((i) => ({
        id: i.id,
        tag: i.tag || 'Новость',
        title: i.title,
        desc: i.desc,
        image: i.image,
        date: i.date,
        view_count: 0,
        reaction_counts: emptyReactionCounts(),
        my_reaction: null,
      })));
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

  const availableClientSurveys = useMemo(() => availableSurveys(surveys ?? []), [surveys]);
  const completedClientSurveys = useMemo(() => completedSurveys(surveys ?? []), [surveys]);
  const hasNewSurveys = hasAvailableSurveys(surveys ?? []);
  const todaySurveyKey = dateKeyInAlmaty(new Date());

  const patchNewsEngagement = useCallback(
    (newsId: string, patch: { reaction_counts: NewsReactionCounts; my_reaction: NewsReactionKind | null }) => {
      setNewsList((l) => l.map((it) => (it.id === newsId ? { ...it, ...patch } : it)));
    },
    []
  );

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
        footerSlot={
          <NewsReactionsRow
            newsId={Number(item.id)}
            reactionCounts={item.reaction_counts ?? emptyReactionCounts()}
            myReaction={item.my_reaction ?? null}
            canInteract={canReact}
            compact
            centered
            onUpdated={(p) => patchNewsEngagement(item.id, p)}
          />
        }
      />
    ),
    [headerSubtitle, router, canReact, patchNewsEngagement]
  );

  const renderSurveyItem = useCallback(({ item }: { item: ClientSurvey }) => {
    const doneLabel = item.state === 'completed' && item.completed_at
      ? completedLabel(dateKeyInAlmaty(item.completed_at), todaySurveyKey)
      : null;
    return (
      <ClientSurveyCard
        survey={item}
        completedLabel={doneLabel}
        onPress={item.state === 'available' ? () => router.push(`/client/surveys/${item.id}` as Href) : undefined}
      />
    );
  }, [router, todaySurveyKey]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: background }]}>
      <ScreenHeader title="Все новости" />
      <NewsSurveyTabs value={activeTab} onChange={changeTab} showSurveyDot={hasNewSurveys} />
      {activeTab === 'news' ? (
        <>
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
        </>
      ) : null}
      {activeTab === 'news' ? loading ? (
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
      ) : surveysLoading && surveys === null ? (
        <View style={styles.surveysLoading}>
          <PageLoader size={64} />
        </View>
      ) : surveysError && surveys === null ? (
        <View style={styles.surveysFeedback}>
          <EmptyState
            icon="error-outline"
            title="Не удалось загрузить опросы"
            description={surveysError}
            action={<Button title="Повторить" onPress={() => void loadSurveys()} size="compact" variant="outline" />}
          />
        </View>
      ) : (
        <FlatList
          data={[...availableClientSurveys, ...completedClientSurveys]}
          renderItem={renderSurveyItem}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={[styles.surveyListContent, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={styles.surveySeparator} />}
          ListEmptyComponent={
            <EmptyState
              icon="poll"
              title="Сейчас нет доступных опросов"
              description="Когда появится новый опрос, мы покажем его здесь и на главной"
              style={styles.surveyEmpty}
            />
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
  tabs: { height: 48, marginHorizontal: 16, marginTop: 4, marginBottom: 14, borderRadius: 8, padding: 4, flexDirection: 'row' },
  tab: { flex: 1, height: 40, borderRadius: 6, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  tabText: { fontSize: 15, fontWeight: '500' },
  tabDot: { width: 6, height: 6, borderRadius: 3 },
  surveysLoading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  surveysFeedback: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  surveyListContent: { paddingHorizontal: 16, paddingTop: 0, gap: 12 },
  surveySeparator: { height: 0 },
  surveyEmpty: { paddingTop: 136, maxWidth: 320, alignSelf: 'center' },
});
