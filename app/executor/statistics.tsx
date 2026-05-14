import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageLoader, PullToRefresh, ScreenHeader, StatRow } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useRoleStatsDashboardStyles } from '@/hooks/use-role-stats-dashboard-styles';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getExecutorStats, type ExecutorStats } from '@/lib/api';

export default function ExecutorStatisticsScreen() {
  const insets = useSafeAreaInsets();
  const styles = useRoleStatsDashboardStyles();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const success = useThemeColor({}, 'success');
  const info = useThemeColor({}, 'info');
  const danger = useThemeColor({}, 'danger');

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

  return (
    <ThemedView style={[styles.screenRoot, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title="Статистика" />

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
                <MaterialIcons name="people" size={22} color={info} />
                <ThemedText style={[styles.quickStatValue, { color: text }]}>{stats?.inWork ?? 0}</ThemedText>
                <ThemedText style={[styles.quickStatLabel, { color: textMuted }]}>В работе</ThemedText>
              </View>
              <View style={[styles.quickStatCard, styles.quickStatDone]}>
                <MaterialIcons name="check-circle" size={22} color={success} />
                <ThemedText style={[styles.quickStatValue, { color: text }]}>{stats?.completed ?? 0}</ThemedText>
                <ThemedText style={[styles.quickStatLabel, { color: textMuted }]}>Завершено</ThemedText>
              </View>
              <View style={[styles.quickStatCard, styles.quickStatOnTime]}>
                <MaterialIcons name="schedule" size={22} color={success} />
                <ThemedText style={[styles.quickStatValue, { color: text }]}>{stats?.onTime ?? 0}</ThemedText>
                <ThemedText style={[styles.quickStatLabel, { color: textMuted }]}>В срок</ThemedText>
              </View>
              <View style={[styles.quickStatCard, styles.quickStatOverdue]}>
                <MaterialIcons name="warning" size={22} color={danger} />
                <ThemedText style={[styles.quickStatValue, { color: text }]}>{stats?.overdue ?? 0}</ThemedText>
                <ThemedText style={[styles.quickStatLabel, { color: textMuted }]}>Просрочено</ThemedText>
              </View>
            </View>

            <View style={styles.card}>
              <ThemedText style={[styles.cardTitle, { color: text }]}>Мои показатели</ThemedText>
              <StatRow label="Всего заявок" value={stats?.totalRequests ?? 0} />
              <StatRow label="Завершено" value={stats?.completed ?? 0} valueColor={success} />
              <StatRow label="В работе" value={stats?.inWork ?? 0} valueColor={info} />
              <StatRow label="В срок" value={stats?.onTime ?? 0} valueColor={success} />
              <StatRow label="Просрочено" value={stats?.overdue ?? 0} valueColor={danger} />
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
