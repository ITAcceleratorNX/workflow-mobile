import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageLoader, PullToRefresh } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  getManagerStats,
  getManagerSLAStats,
  getManagerRatingStats,
  getManagerDetailedStats,
  type ManagerStatsRawItem,
} from '@/lib/api';

type ManagerStatsRaw = ManagerStatsRawItem[];

type StatsTab = 'stats' | 'analytics';

const PRIMARY_ORANGE = '#E25B21';
const GRAY_600 = '#3A3A3C';
const DARK_BG = '#1C1C1E';

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: number;
  valueColor?: string;
}) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  return (
    <View style={styles.statRow}>
      <ThemedText style={[styles.statLabel, { color: textMuted }]}>{label}</ThemedText>
      <ThemedText style={[styles.statValue, { color: valueColor ?? text }]}>{value}</ThemedText>
    </View>
  );
}

/** Агрегирует данные manager stats (по офисам и датам) в общие суммы */
function aggregateManagerStats(raw: ManagerStatsRaw) {
  let totalRequests = 0;
  let newRequests = 0;
  let inWorkRequests = 0;
  let completedRequests = 0;
  let overdueRequests = 0;
  let normalRequests = 0;
  let urgentRequests = 0;
  let plannedRequests = 0;

  for (const item of raw) {
    const data = item.data;
    if (typeof data !== 'object' || data === null) continue;
    for (const dateKey of Object.keys(data)) {
      const day = data[dateKey];
      if (typeof day !== 'object' || day === null) continue;
      totalRequests += typeof day.totalRequests === 'number' ? day.totalRequests : 0;
      newRequests += typeof day.newRequests === 'number' ? day.newRequests : 0;
      inWorkRequests += typeof day.inWorkRequests === 'number' ? day.inWorkRequests : 0;
      completedRequests += typeof day.completedRequests === 'number' ? day.completedRequests : 0;
      overdueRequests += typeof day.overdueRequests === 'number' ? day.overdueRequests : 0;
      normalRequests += typeof day.normalRequests === 'number' ? day.normalRequests : 0;
      urgentRequests += typeof day.urgentRequests === 'number' ? day.urgentRequests : 0;
      plannedRequests += typeof day.plannedRequests === 'number' ? day.plannedRequests : 0;
    }
  }

  return {
    totalRequests,
    statusCounts: {
      new: newRequests,
      inWork: inWorkRequests,
      completed: completedRequests,
      overdue: overdueRequests,
    },
    requestTypeSummary: {
      normal: normalRequests,
      urgent: urgentRequests,
      planned: plannedRequests,
    },
  };
}

export default function ManagerStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<StatsTab>('stats');
  const [rawStats, setRawStats] = useState<ManagerStatsRaw | null>(null);
  const [analyticsData, setAnalyticsData] = useState<{
    sla: Record<string, unknown> | null;
    ratings: Record<string, unknown> | null;
    detailed: Record<string, unknown> | null;
  }>({ sla: null, ratings: null, detailed: null });
  const [loading, setLoading] = useState(true);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const result = await getManagerStats();
    if (result.ok) setRawStats(result.data);
    else setError(result.error);
    setLoading(false);
    setRefreshing(false);
  }, []);

  const loadAnalytics = useCallback(async () => {
    setAnalyticsLoading(true);
    const [slaRes, ratingRes, detailedRes] = await Promise.all([
      getManagerSLAStats(),
      getManagerRatingStats(),
      getManagerDetailedStats(),
    ]);
    setAnalyticsData({
      sla: slaRes.ok ? slaRes.data : null,
      ratings: ratingRes.ok ? ratingRes.data : null,
      detailed: detailedRes.ok ? detailedRes.data : null,
    });
    setAnalyticsLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (activeTab === 'analytics') loadAnalytics();
  }, [activeTab, loadAnalytics]);

  const onRefresh = useCallback(() => {
    if (activeTab === 'stats') load(true);
    else loadAnalytics();
  }, [activeTab, load, loadAnalytics]);

  const stats = useMemo(
    () => (rawStats && rawStats.length > 0 ? aggregateManagerStats(rawStats) : null),
    [rawStats]
  );

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const sc = stats?.statusCounts;
  const rts: Record<string, number> = stats?.requestTypeSummary ?? {};

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={PRIMARY_ORANGE} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Аналитика
        </ThemedText>
      </View>

      {/* Вкладки как в браузере: Статистика | Аналитика */}
      <View style={styles.tabsRow}>
        <Pressable
          style={[styles.tab, activeTab === 'stats' && styles.tabActive]}
          onPress={() => setActiveTab('stats')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'stats' && styles.tabTextActive]}>
            Статистика
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'analytics' && styles.tabActive]}
          onPress={() => setActiveTab('analytics')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'analytics' && styles.tabTextActive]}>
            Аналитика
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === 'stats' && (
        <>
          {loading && !stats ? (
            <View style={styles.loadingBox}>
              <PageLoader size={80} />
              <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
            </View>
          ) : error ? (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorText}>{error}</ThemedText>
              <Pressable style={styles.retryButton} onPress={() => load()}>
                <ThemedText style={styles.retryText}>Повторить</ThemedText>
              </Pressable>
            </View>
          ) : (
            <PullToRefresh
              refreshing={refreshing}
              onRefresh={onRefresh}
              loaderSize={96}
              topOffset={insets.top + 8}
            >
              <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
              <View style={styles.quickStatsRow}>
            <View style={[styles.quickStatCard, styles.quickStatNew]}>
              <MaterialIcons name="schedule" size={22} color="#CA8A04" />
              <ThemedText style={styles.quickStatValue}>{sc?.new ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>Новые</ThemedText>
            </View>
            <View style={[styles.quickStatCard, styles.quickStatWork]}>
              <MaterialIcons name="people" size={22} color="#2563EB" />
              <ThemedText style={styles.quickStatValue}>{sc?.inWork ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>В работе</ThemedText>
            </View>
            <View style={[styles.quickStatCard, styles.quickStatDone]}>
              <MaterialIcons name="check-circle" size={22} color="#16A34A" />
              <ThemedText style={styles.quickStatValue}>{sc?.completed ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>Завершено</ThemedText>
            </View>
            <View style={[styles.quickStatCard, styles.quickStatOverdue]}>
              <MaterialIcons name="warning" size={22} color="#DC2626" />
              <ThemedText style={styles.quickStatValue}>{sc?.overdue ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>Просрочено</ThemedText>
            </View>
          </View>

          <View style={styles.card}>
            <ThemedText style={[styles.cardTitle, { color: text }]}>
              Статистика по заявкам
            </ThemedText>
            <StatRow label="Всего заявок" value={stats?.totalRequests ?? 0} />
            <StatRow label="Завершено" value={sc?.completed ?? 0} valueColor="#22C55E" />
            <StatRow label="В работе" value={sc?.inWork ?? 0} valueColor="#3B82F6" />
            <StatRow label="Новые" value={sc?.new ?? 0} valueColor={PRIMARY_ORANGE} />
            <StatRow label="Просрочено" value={sc?.overdue ?? 0} valueColor="#EF4444" />
          </View>

          <View style={styles.card}>
            <ThemedText style={[styles.cardTitle, { color: text }]}>
              По типам заявок
            </ThemedText>
            <StatRow label="Обычные" value={typeof rts.normal === 'number' ? rts.normal : 0} />
            <StatRow label="Экстренные" value={typeof rts.urgent === 'number' ? rts.urgent : 0} />
            <StatRow label="Плановые" value={typeof rts.planned === 'number' ? rts.planned : 0} />
          </View>
              </ScrollView>
            </PullToRefresh>
          )}
        </>
      )}

      {activeTab === 'analytics' && (
        <PullToRefresh
          refreshing={analyticsLoading}
          onRefresh={loadAnalytics}
          loaderSize={96}
          topOffset={insets.top + 8}
        >
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
          {analyticsLoading && !analyticsData.sla && !analyticsData.ratings ? (
            <View style={styles.loadingBox}>
              <PageLoader size={80} />
              <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <ThemedText style={[styles.cardTitle, { color: text }]}>SLA и время выполнения</ThemedText>
                <ThemedText style={[styles.cardDescription, { color: textMuted }]}>
                  Данные по срокам и среднему времени закрытия заявок (как в браузере).
                </ThemedText>
              </View>
              <View style={styles.card}>
                <ThemedText style={[styles.cardTitle, { color: text }]}>Рейтинги</ThemedText>
                <ThemedText style={[styles.cardDescription, { color: textMuted }]}>
                  Средние оценки по офисам, категориям, исполнителям (как в браузере).
                </ThemedText>
              </View>
            </>
          )}
          </ScrollView>
        </PullToRefresh>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backLabel: {
    fontSize: 16,
    color: PRIMARY_ORANGE,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    backgroundColor: GRAY_600,
    alignItems: 'center',
  },
  tabActive: {
    backgroundColor: PRIMARY_ORANGE,
  },
  tabText: {
    fontSize: 15,
    fontWeight: '500',
    color: 'rgba(255,255,255,0.8)',
  },
  tabTextActive: {
    color: '#fff',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  errorText: {
    color: '#FCA5A5',
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: PRIMARY_ORANGE,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  quickStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  quickStatCard: {
    flex: 1,
    minWidth: '47%',
    maxWidth: '48%',
    borderRadius: 12,
    padding: 14,
  },
  quickStatNew: {
    backgroundColor: 'rgba(202,138,4,0.2)',
  },
  quickStatWork: {
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  quickStatDone: {
    backgroundColor: 'rgba(22,163,74,0.2)',
  },
  quickStatOverdue: {
    backgroundColor: 'rgba(220,38,38,0.2)',
  },
  quickStatValue: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 6,
  },
  quickStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 2,
  },
  card: {
    backgroundColor: GRAY_600,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
  cardDescription: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
    marginBottom: 8,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statLabel: {
    fontSize: 15,
  },
  statValue: {
    fontSize: 16,
    fontWeight: '600',
  },
});
