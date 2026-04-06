import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnimatedProgressDonut, AnimatedStatBar } from '@/components/tasks/TaskStatsVisualization';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useTaskCompletionStats } from '@/hooks/use-task-completion-stats';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';

function ratio(completed: number, total: number) {
  return total > 0 ? completed / total : 0;
}

export default function TaskStatsScreen() {
  const insets = useSafeAreaInsets();
  const isGuest = useAuthStore((s) => s.isGuest);
  const token = useAuthStore((s) => s.token);

  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');
  const accentAmber = '#F59E0B';
  const accentBlue = '#3B82F6';

  const {
    todayCompleted,
    todayTotal,
    weekCompleted,
    weekTotal,
    monthCompleted,
    monthTotal,
    loading,
    refresh,
  } = useTaskCompletionStats(true);

  const statsFirstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (statsFirstFocus.current) {
        statsFirstFocus.current = false;
        return;
      }
      refresh();
    }, [refresh])
  );

  const donutSize = 92;
  const stroke = 9;

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Статистика задач" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: Math.max(insets.bottom, 24) },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {!token || isGuest ? (
          <View style={[styles.guestCard, { backgroundColor: cardBg, borderColor: border }]}>
            <MaterialIcons name="lock-outline" size={40} color={muted} />
            <ThemedText style={[styles.guestTitle, { color: headerText }]}>Войдите в аккаунт</ThemedText>
            <ThemedText style={[styles.guestText, { color: muted }]}>
              Статистика доступна после входа
            </ThemedText>
          </View>
        ) : loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={primary} />
            <ThemedText style={[styles.loaderHint, { color: muted }]}>Загружаем данные…</ThemedText>
          </View>
        ) : (
          <>
            <ThemedText style={[styles.sectionTitle, { color: muted }]}>Обзор</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.donutRow}
            >
              <AnimatedProgressDonut
                size={donutSize}
                strokeWidth={stroke}
                progress={ratio(todayCompleted, todayTotal)}
                color={primary}
                trackColor={border}
                label="Сегодня"
                subtitle={`${todayCompleted} из ${todayTotal}`}
                textColor={headerText}
                mutedColor={muted}
              />
              <AnimatedProgressDonut
                size={donutSize}
                strokeWidth={stroke}
                progress={ratio(weekCompleted, weekTotal)}
                color={accentBlue}
                trackColor={border}
                label="Неделя"
                subtitle={`${weekCompleted} из ${weekTotal}`}
                textColor={headerText}
                mutedColor={muted}
              />
              <AnimatedProgressDonut
                size={donutSize}
                strokeWidth={stroke}
                progress={ratio(monthCompleted, monthTotal)}
                color={accentAmber}
                trackColor={border}
                label="Месяц"
                subtitle={`${monthCompleted} из ${monthTotal}`}
                textColor={headerText}
                mutedColor={muted}
              />
            </ScrollView>

            <ThemedText style={[styles.sectionTitle, { color: muted, marginTop: 8 }]}>График</ThemedText>
            <View style={[styles.chartCard, { backgroundColor: cardBg, borderColor: border }]}>
              <AnimatedStatBar
                label="Сегодня"
                completed={todayCompleted}
                total={todayTotal}
                color={primary}
                trackColor={border}
                textColor={headerText}
                mutedColor={muted}
              />
              <AnimatedStatBar
                label="Неделя"
                completed={weekCompleted}
                total={weekTotal}
                color={accentBlue}
                trackColor={border}
                textColor={headerText}
                mutedColor={muted}
              />
              <AnimatedStatBar
                label="Месяц"
                completed={monthCompleted}
                total={monthTotal}
                color={accentAmber}
                trackColor={border}
                textColor={headerText}
                mutedColor={muted}
              />
              <View style={[styles.legendRow, { borderTopColor: border }]}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: primary }]} />
                  <ThemedText style={[styles.legendText, { color: muted }]}>Сегодня</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: accentBlue }]} />
                  <ThemedText style={[styles.legendText, { color: muted }]}>Неделя</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: accentAmber }]} />
                  <ThemedText style={[styles.legendText, { color: muted }]}>Месяц</ThemedText>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 4 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 12,
  },
  donutRow: {
    flexDirection: 'row',
    gap: 20,
    paddingVertical: 8,
    paddingRight: 8,
    marginBottom: 8,
  },
  chartCard: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
    paddingBottom: 12,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 8,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 12,
    fontWeight: '600',
  },
  loader: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loaderHint: {
    fontSize: 14,
  },
  guestCard: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 24,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  guestTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 8,
  },
  guestText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
