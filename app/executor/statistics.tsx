import { useCallback, useEffect, useState } from 'react';
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
import { getExecutorStats, type ExecutorStats } from '@/lib/api';

const PRIMARY_ORANGE = '#E25B21';
const GRAY_600 = '#3A3A3C';
const DARK_BG = '#1C1C1E';

function StatRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: number | string;
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

export default function ExecutorStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [stats, setStats] = useState<ExecutorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const result = await getExecutorStats();
    if (result.ok) setStats(result.data);
    else setError(result.error);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => load(true), [load]);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={PRIMARY_ORANGE} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Статистика
        </ThemedText>
      </View>

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
          loaderSize={50}
          topOffset={insets.top + 8}
        >
          <ScrollView contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}>
          <View style={styles.quickStatsRow}>
            <View style={[styles.quickStatCard, styles.quickStatWork]}>
              <MaterialIcons name="people" size={22} color="#2563EB" />
              <ThemedText style={styles.quickStatValue}>{stats?.inWork ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>В работе</ThemedText>
            </View>
            <View style={[styles.quickStatCard, styles.quickStatDone]}>
              <MaterialIcons name="check-circle" size={22} color="#16A34A" />
              <ThemedText style={styles.quickStatValue}>{stats?.completed ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>Завершено</ThemedText>
            </View>
            <View style={[styles.quickStatCard, styles.quickStatOnTime]}>
              <MaterialIcons name="schedule" size={22} color="#22C55E" />
              <ThemedText style={styles.quickStatValue}>{stats?.onTime ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>В срок</ThemedText>
            </View>
            <View style={[styles.quickStatCard, styles.quickStatOverdue]}>
              <MaterialIcons name="warning" size={22} color="#DC2626" />
              <ThemedText style={styles.quickStatValue}>{stats?.overdue ?? 0}</ThemedText>
              <ThemedText style={styles.quickStatLabel}>Просрочено</ThemedText>
            </View>
          </View>

          <View style={styles.card}>
            <ThemedText style={[styles.cardTitle, { color: text }]}>Мои показатели</ThemedText>
            <StatRow label="Всего заявок" value={stats?.totalRequests ?? 0} />
            <StatRow label="Завершено" value={stats?.completed ?? 0} valueColor="#22C55E" />
            <StatRow label="В работе" value={stats?.inWork ?? 0} valueColor="#3B82F6" />
            <StatRow label="В срок" value={stats?.onTime ?? 0} valueColor="#22C55E" />
            <StatRow label="Просрочено" value={stats?.overdue ?? 0} valueColor="#EF4444" />
          </View>

          <View style={styles.card}>
            <ThemedText style={[styles.cardTitle, { color: text }]}>Рейтинг и время</ThemedText>
            <StatRow label="Средний рейтинг" value={stats?.averageRating ?? '0.00'} />
            <StatRow
              label="Среднее время выполнения (ч)"
              value={stats?.averageExecutionHours ?? '0.00'}
            />
          </View>
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
  quickStatWork: {
    backgroundColor: 'rgba(37,99,235,0.2)',
  },
  quickStatDone: {
    backgroundColor: 'rgba(22,163,74,0.2)',
  },
  quickStatOnTime: {
    backgroundColor: 'rgba(34,197,94,0.2)',
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
