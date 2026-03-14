import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageLoader, PullToRefresh, ScreenHeader, StatRow } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getDepartmentHeadStats, type DepartmentHeadStats } from '@/lib/api';

export default function DepartmentHeadStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');
  const [stats, setStats] = useState<DepartmentHeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const result = await getDepartmentHeadStats();
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
  const sc = stats?.statusCounts;
  const rts = stats?.requestTypeSummary ?? {};

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: screenBg }]}>
      <ScreenHeader title="Аналитика" />

      {loading && !stats ? (
        <View style={styles.loadingBox}>
          <PageLoader size={80} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={[styles.retryButton, { backgroundColor: primary }]} onPress={() => load()}>
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

          <View style={[styles.card, { backgroundColor: gray600 }]}>
            <ThemedText style={[styles.cardTitle, { color: text }]}>
              Статистика по заявкам
            </ThemedText>
            <StatRow
              label="Ожидает назначения"
              value={sc?.awaitingAssignment ?? 0}
              valueColor={primary}
            />
            <StatRow label="Всего заявок" value={stats?.totalRequests ?? 0} />
            <StatRow
              label="Завершено"
              value={sc?.completed ?? 0}
              valueColor="#22C55E"
            />
            <StatRow
              label="В работе"
              value={sc?.inWork ?? 0}
              valueColor="#3B82F6"
            />
            <StatRow
              label="Просрочено"
              value={sc?.overdue ?? 0}
              valueColor="#EF4444"
            />
          </View>

          <View style={[styles.card, { backgroundColor: gray600 }]}>
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
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
});
