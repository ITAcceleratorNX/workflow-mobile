import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutAnimation,
  Platform,
  Pressable,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import { getHealthyInsight, type HealthyInsightResponse } from '@/lib/healthy-api';
import {
  buildHealthyInsight,
  type HealthyInsightPeriod,
  type HealthyInsightResult,
  type HealthyMetricId,
} from '@/lib/healthy-ai-insights';
import type { EnergyLevel, StressLevel } from '@/stores/mood-store';
import { useMoodStore } from '@/stores/mood-store';
import type { SleepRating } from '@/stores/sleep-store';
import { useSleepStore } from '@/stores/sleep-store';
import { useStepsStore } from '@/stores/steps-store';
import { useWaterStore } from '@/stores/water-store';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const COLORS = {
  cardBg: '#2C2C2E',
  trackBg: '#3A3A3C',
  screenBg: '#212121',
  accent: '#F35713',
  accentSoft: '#E85D2B',
  textPrimary: '#FFFFFF',
  textMuted: '#8E8E93',
  positive: '#34C759',
  attention: 'rgba(232, 93, 43, 0.35)',
  attentionBorder: 'rgba(232, 93, 43, 0.55)',
  chipBg: '#3A3A3C',
};

const PERIODS: { key: HealthyInsightPeriod; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
];

function metricIcon(id: HealthyMetricId): React.ComponentProps<typeof MaterialIcons>['name'] {
  const m: Record<HealthyMetricId, React.ComponentProps<typeof MaterialIcons>['name']> = {
    sleep: 'bedtime',
    water: 'water-drop',
    steps: 'directions-walk',
    mood: 'sentiment-satisfied',
    energy: 'bolt',
    stress: 'spa',
  };
  return m[id];
}

function statusAccent(tone: HealthyInsightResult['statusTone']): string {
  if (tone === 'positive') return COLORS.positive;
  if (tone === 'attention') return COLORS.accentSoft;
  return COLORS.textMuted;
}

function normalizeServerInsight(result: HealthyInsightResponse): HealthyInsightResult {
  return {
    period: result.period ?? 'day',
    lowData: result.lowData ?? true,
    missingHints: Array.isArray(result.missingHints) ? result.missingHints : [],
    statusLabel: result.statusLabel ?? 'Мало данных',
    statusTone: result.statusTone ?? 'neutral',
    summary: result.summary ?? 'Данных пока недостаточно для точного вывода.',
    weakPoints: Array.isArray(result.weakPoints) ? result.weakPoints : [],
    improved: Array.isArray(result.improved) ? result.improved : [],
    worsened: Array.isArray(result.worsened) ? result.worsened : [],
    recommendations: Array.isArray(result.recommendations) ? result.recommendations : [],
    supportMessage: result.supportMessage ?? 'Продолжайте отмечать данные, чтобы анализ стал точнее.',
    weeklyFocus: result.weeklyFocus,
    monthlyDynamics: result.monthlyDynamics,
    strengths: Array.isArray(result.strengths) ? result.strengths : [],
    weaknessesNarrative: Array.isArray(result.weaknessesNarrative) ? result.weaknessesNarrative : [],
    patternsLine: result.patternsLine,
    monthlyFocus: result.monthlyFocus,
  };
}

function InsightBody({ result }: { result: HealthyInsightResult }) {
  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusAccent(result.statusTone) }]} />
        <ThemedText style={[styles.statusLabel, { color: COLORS.textPrimary }]} numberOfLines={2}>
          {result.statusLabel}
        </ThemedText>
      </View>

      <ThemedText style={[styles.summary, { color: COLORS.textMuted }]}>{result.summary}</ThemedText>

      {result.lowData && (
        <View style={styles.lowDataBanner}>
          <MaterialIcons name="info-outline" size={20} color={COLORS.accent} />
          <View style={styles.lowDataTextWrap}>
            <ThemedText style={[styles.lowDataTitle, { color: COLORS.textPrimary }]}>
              Недостаточно данных для точного вывода
            </ThemedText>
            {result.missingHints.length > 0 && (
              <ThemedText style={[styles.lowDataSub, { color: COLORS.textMuted }]}>
                Не хватает: {result.missingHints.join(', ')}.
              </ThemedText>
            )}
          </View>
        </View>
      )}

      {result.period === 'week' && !result.lowData && (result.improved.length > 0 || result.worsened.length > 0) && (
        <View style={styles.deltaBlock}>
          {result.improved.length > 0 && (
            <View style={styles.deltaRow}>
              <MaterialIcons name="trending-up" size={18} color={COLORS.positive} />
              <View style={styles.deltaTextCol}>
                <ThemedText style={[styles.deltaHeading, { color: COLORS.textPrimary }]}>Что улучшилось</ThemedText>
                {result.improved.map((line, i) => (
                  <ThemedText key={`i-${i}`} style={[styles.deltaLine, { color: COLORS.textMuted }]}>
                    {line}
                  </ThemedText>
                ))}
              </View>
            </View>
          )}
          {result.worsened.length > 0 && (
            <View style={[styles.deltaRow, { marginTop: result.improved.length ? 12 : 0 }]}>
              <MaterialIcons name="trending-down" size={18} color={COLORS.accentSoft} />
              <View style={styles.deltaTextCol}>
                <ThemedText style={[styles.deltaHeading, { color: COLORS.textPrimary }]}>Что просело</ThemedText>
                {result.worsened.map((line, i) => (
                  <ThemedText key={`w-${i}`} style={[styles.deltaLine, { color: COLORS.textMuted }]}>
                    {line}
                  </ThemedText>
                ))}
              </View>
            </View>
          )}
        </View>
      )}

      {result.period === 'week' && result.weeklyFocus && (
        <View style={[styles.focusCard, { borderColor: 'rgba(243, 87, 19, 0.35)' }]}>
          <MaterialIcons name="center-focus-strong" size={18} color={COLORS.accent} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText style={[styles.focusTitle, { color: COLORS.textPrimary }]}>Фокус недели</ThemedText>
            <ThemedText style={[styles.focusBody, { color: COLORS.textMuted }]}>{result.weeklyFocus}</ThemedText>
          </View>
        </View>
      )}

      {result.period === 'month' && !result.lowData && result.monthlyDynamics && (
        <ThemedText style={[styles.sectionText, { color: COLORS.textMuted }]}>{result.monthlyDynamics}</ThemedText>
      )}

      {result.period === 'month' && result.strengths.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Сильные стороны</ThemedText>
          {result.strengths.map((s, i) => (
            <View key={`s-${i}`} style={styles.bulletRow}>
              <MaterialIcons name="check-circle" size={16} color={COLORS.positive} style={styles.bulletIcon} />
              <ThemedText style={[styles.bulletText, { color: COLORS.textMuted }]}>{s}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {result.period === 'month' && result.weaknessesNarrative.length > 0 && (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Зоны внимания</ThemedText>
          {result.weaknessesNarrative.map((s, i) => (
            <View key={`wn-${i}`} style={styles.bulletRow}>
              <MaterialIcons name="remove-circle-outline" size={16} color={COLORS.textMuted} style={styles.bulletIcon} />
              <ThemedText style={[styles.bulletText, { color: COLORS.textMuted }]}>{s}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {result.period === 'month' && result.patternsLine && (
        <View style={[styles.patternsCard, { backgroundColor: COLORS.chipBg }]}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary, marginBottom: 6 }]}>Паттерны</ThemedText>
          <ThemedText style={[styles.sectionText, { color: COLORS.textMuted }]}>{result.patternsLine}</ThemedText>
        </View>
      )}

      {result.period === 'month' && result.monthlyFocus && (
        <View style={[styles.focusCard, { borderColor: 'rgba(243, 87, 19, 0.35)' }]}>
          <MaterialIcons name="flag" size={18} color={COLORS.accent} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText style={[styles.focusTitle, { color: COLORS.textPrimary }]}>Фокус месяца</ThemedText>
            <ThemedText style={[styles.focusBody, { color: COLORS.textMuted }]}>{result.monthlyFocus}</ThemedText>
          </View>
        </View>
      )}

      {result.weakPoints.length > 0 && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Главные просадки</ThemedText>
            {result.weakPoints.map((w) => (
              <View key={w.id} style={styles.weakRow}>
                <View style={[styles.weakIconWrap, { backgroundColor: COLORS.trackBg }]}>
                  <MaterialIcons name={metricIcon(w.id)} size={18} color={COLORS.accentSoft} />
                </View>
                <ThemedText style={[styles.weakLabel, { color: COLORS.textMuted }]}>{w.label}</ThemedText>
              </View>
            ))}
          </View>
        )}

      <View style={styles.section}>
        <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>
          Рекомендации
        </ThemedText>
        {result.recommendations.map((text, i) => (
          <View key={i} style={[styles.recCard, { backgroundColor: COLORS.trackBg }]}>
            <ThemedText style={[styles.recText, { color: COLORS.textPrimary }]}>{text}</ThemedText>
          </View>
        ))}
      </View>

      <View style={[styles.supportCard, { backgroundColor: COLORS.screenBg }]}>
        <MaterialIcons name="favorite-border" size={20} color={COLORS.accent} style={{ marginRight: 10 }} />
        <ThemedText style={[styles.supportText, { color: COLORS.textMuted }]}>{result.supportMessage}</ThemedText>
      </View>
    </Animated.View>
  );
}

export function HealthyAiInsights() {
  const [period, setPeriod] = useState<HealthyInsightPeriod>('day');
  const [remoteInsight, setRemoteInsight] = useState<HealthyInsightResult | null>(null);
  const [remoteGeneratedAt, setRemoteGeneratedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const goalSleepMinutes = useSleepStore((s) => s.settings.goalMinutes);
  const lastNightSleepMinutes = useSleepStore((s) => s.lastNightSleepMinutes);
  const avgSleep7DaysMinutes = useSleepStore((s) => s.avgSleep7DaysMinutes);
  const dayRecords = useSleepStore((s) => s.dayRecords);
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps ?? 10000);
  const stepsHistory = useStepsStore((s) => s.history);
  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const intakeTodayMl = useWaterStore((s) => s.intakeTodayMl);
  const healthWaterTodayMl = useWaterStore((s) => s.healthWaterTodayMl);
  const getTodayGoalMl = useWaterStore((s) => s.getTodayGoalMl);
  const moodRecords = useMoodStore((s) => s.records);
  const moodToday = moodRecords[todayKey] ?? null;

  const todaySleepRating = dayRecords[todayKey]?.rating ?? null;

  const waterIntakeMl = intakeTodayMl + (healthWaterTodayMl ?? 0);
  const waterGoalMl = getTodayGoalMl({
    heightCm,
    weightKg,
    stepsToday,
    sleepRating: todaySleepRating,
  });

  const moodRecordsByDate = useMemo(() => {
    const o: Record<string, { moodValue: number; energy: EnergyLevel; stress: StressLevel }> = {};
    for (const [k, v] of Object.entries(moodRecords)) {
      o[k] = { moodValue: v.moodValue, energy: v.energy, stress: v.stress };
    }
    return o;
  }, [moodRecords]);

  const sleepRatingsByDate = useMemo(() => {
    const o: Record<string, SleepRating> = {};
    for (const [k, v] of Object.entries(dayRecords)) {
      if (v.rating) o[k] = v.rating;
    }
    return o;
  }, [dayRecords]);

  const insight = useMemo(
    () =>
      buildHealthyInsight({
        period,
        todayKey,
        goalSleepMinutes,
        lastNightSleepMinutes,
        avgSleep7DaysMinutes,
        todaySleepRating,
        stepsToday,
        stepsGoal,
        stepsHistory,
        waterIntakeMl,
        waterGoalMl,
        moodToday: moodToday
          ? { moodValue: moodToday.moodValue, energy: moodToday.energy, stress: moodToday.stress }
          : null,
        moodRecordsByDate,
        sleepRatingsByDate,
      }),
    [
      period,
      todayKey,
      goalSleepMinutes,
      lastNightSleepMinutes,
      avgSleep7DaysMinutes,
      todaySleepRating,
      stepsToday,
      stepsGoal,
      stepsHistory,
      waterIntakeMl,
      waterGoalMl,
      moodToday,
      moodRecordsByDate,
      sleepRatingsByDate,
    ]
  );

  useEffect(() => {
    let cancelled = false;

    const loadInsight = async () => {
      setIsRefreshing(true);
      const result = await getHealthyInsight(period);
      if (cancelled) return;

      if (result.ok) {
        setRemoteInsight(normalizeServerInsight(result.data));
        setRemoteGeneratedAt(result.data.generated_at ?? null);
        setLoadError(null);
      } else {
        setRemoteInsight(null);
        setRemoteGeneratedAt(null);
        setLoadError(result.error);
      }

      setIsRefreshing(false);
    };

    loadInsight();
    return () => {
      cancelled = true;
    };
  }, [period]);

  const resolvedInsight = remoteInsight ?? insight;

  const onTab = useCallback((p: HealthyInsightPeriod) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPeriod(p);
  }, []);

  return (
    <View style={[styles.card, { backgroundColor: COLORS.cardBg }]}>
      <View style={styles.cardHeader}>
        <MaterialIcons name="auto-awesome" size={22} color={COLORS.accent} />
        <ThemedText style={[styles.cardTitle, { color: COLORS.textPrimary }]}>AI Insight</ThemedText>
      </View>

      <View style={styles.metaRow}>
        <ThemedText style={[styles.metaText, { color: COLORS.textMuted }]}>
          {remoteInsight
            ? remoteGeneratedAt
              ? `Обновлено: ${remoteGeneratedAt.slice(11, 16)}`
              : 'Серверный анализ'
            : loadError
              ? 'Локальный fallback'
              : isRefreshing
                ? 'Обновляем анализ...'
                : 'Подготовка анализа...'}
        </ThemedText>
        {loadError ? (
          <ThemedText style={[styles.metaText, { color: COLORS.accentSoft }]}>Сеть недоступна</ThemedText>
        ) : null}
      </View>

      <View style={[styles.segment, { backgroundColor: COLORS.trackBg }]}>
        {PERIODS.map(({ key, label }) => {
          const active = period === key;
          return (
            <Pressable
              key={key}
              onPress={() => onTab(key)}
              style={[styles.segmentItem, active && { backgroundColor: COLORS.accent }]}
            >
              <ThemedText
                style={[
                  styles.segmentLabel,
                  { color: active ? '#FFFFFF' : COLORS.textMuted },
                ]}
              >
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      <InsightBody key={period} result={resolvedInsight} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 18,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.22,
    shadowRadius: 8,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    gap: 12,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  segment: {
    flexDirection: 'row',
    borderRadius: 12,
    padding: 3,
    marginBottom: 16,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  body: {
    overflow: 'hidden',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  statusLabel: {
    fontSize: 22,
    fontWeight: '700',
    flex: 1,
  },
  summary: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 14,
  },
  lowDataBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.attentionBorder,
    backgroundColor: COLORS.attention,
    marginBottom: 14,
    gap: 10,
  },
  lowDataTextWrap: { flex: 1 },
  lowDataTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  lowDataSub: { fontSize: 13, lineHeight: 18 },
  deltaBlock: { marginBottom: 14 },
  deltaRow: { flexDirection: 'row', alignItems: 'flex-start' },
  deltaTextCol: { flex: 1, marginLeft: 8 },
  deltaHeading: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  deltaLine: { fontSize: 14, lineHeight: 20 },
  focusCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  focusTitle: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  focusBody: { fontSize: 14, lineHeight: 20 },
  section: { marginBottom: 14 },
  sectionTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  sectionText: { fontSize: 14, lineHeight: 20 },
  bulletRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  bulletIcon: { marginRight: 8, marginTop: 2 },
  bulletText: { flex: 1, fontSize: 14, lineHeight: 20 },
  patternsCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  weakRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  weakIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  weakLabel: { fontSize: 14, flex: 1 },
  recCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  recText: { fontSize: 14, lineHeight: 20 },
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    padding: 14,
    marginTop: 4,
  },
  supportText: { flex: 1, fontSize: 14, lineHeight: 20 },
});
