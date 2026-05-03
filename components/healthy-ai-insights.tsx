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
import { Circle, Path, Svg } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { formatDateForApi, formatTimeOnly } from '@/lib/dateTimeUtils';
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

function dynamicsConfig(label: HealthyInsightResult['dynamicsLabel']) {
  if (label === 'better') return { text: 'Лучше', icon: 'trending-up' as const, color: COLORS.positive };
  if (label === 'worse') return { text: 'Тяжелее', icon: 'trending-down' as const, color: COLORS.accentSoft };
  return { text: 'Стабильно', icon: 'trending-flat' as const, color: COLORS.textMuted };
}

type MetricRatios = NonNullable<HealthyInsightResult['metricRatios']>;

function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${Math.round(v * 100)}%`;
}

function delta(cur: number | null | undefined, prev: number | null | undefined): string | null {
  if (cur == null || prev == null) return null;
  const d = Math.round((cur - prev) * 100);
  if (d === 0) return null;
  return d > 0 ? `+${d}%` : `${d}%`;
}

function MetricBar({
  label,
  icon,
  cur,
  prev,
}: {
  label: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  cur: number | null | undefined;
  prev: number | null | undefined;
}) {
  const d = delta(cur, prev);
  const dPositive = cur != null && prev != null && cur > prev;
  const dNegative = cur != null && prev != null && cur < prev;
  const curFill = Math.min(1, Math.max(0, cur ?? 0));
  const prevFill = Math.min(1, Math.max(0, prev ?? 0));

  if (cur == null && prev == null) return null;

  return (
    <View style={styles.metricBarRow}>
      <View style={styles.metricBarLabelCol}>
        <MaterialIcons name={icon} size={15} color={COLORS.textMuted} />
        <ThemedText style={[styles.metricBarLabel, { color: COLORS.textMuted }]}>{label}</ThemedText>
      </View>
      <View style={styles.metricBarTrackCol}>
        <View style={[styles.metricBarTrack, { backgroundColor: COLORS.trackBg }]}>
          <View style={[styles.metricBarFill, { width: `${curFill * 100}%`, backgroundColor: COLORS.accent }]} />
        </View>
        <View style={[styles.metricBarTrack, { backgroundColor: COLORS.trackBg, marginTop: 3, opacity: 0.55 }]}>
          <View style={[styles.metricBarFill, { width: `${prevFill * 100}%`, backgroundColor: COLORS.textMuted }]} />
        </View>
      </View>
      <View style={styles.metricBarValueCol}>
        <ThemedText style={[styles.metricBarPct, { color: COLORS.textPrimary }]}>{pct(cur)}</ThemedText>
        {d != null && (
          <ThemedText style={[styles.metricBarDelta, {
            color: dPositive ? COLORS.positive : dNegative ? COLORS.accentSoft : COLORS.textMuted,
          }]}>{d}</ThemedText>
        )}
      </View>
    </View>
  );
}

function MetricCompareSection({ ratios }: { ratios: MetricRatios }) {
  const hasAny =
    ratios.cur.sleep != null || ratios.cur.mood != null || ratios.cur.steps != null;
  if (!hasAny) return null;

  return (
    <View style={styles.section}>
      <View style={styles.metricBarLegend}>
        <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Сравнение с прошлым периодом</ThemedText>
        <View style={styles.metricBarLegendRow}>
          <View style={[styles.metricBarLegendDot, { backgroundColor: COLORS.accent }]} />
          <ThemedText style={[styles.metricBarLegendLabel, { color: COLORS.textMuted }]}>Сейчас</ThemedText>
          <View style={[styles.metricBarLegendDot, { backgroundColor: COLORS.textMuted, opacity: 0.55, marginLeft: 10 }]} />
          <ThemedText style={[styles.metricBarLegendLabel, { color: COLORS.textMuted }]}>Раньше</ThemedText>
        </View>
      </View>
      <MetricBar label="Сон" icon="bedtime" cur={ratios.cur.sleep} prev={ratios.prev.sleep} />
      <MetricBar label="Настроение" icon="sentiment-satisfied" cur={ratios.cur.mood} prev={ratios.prev.mood} />
      <MetricBar label="Шаги" icon="directions-walk" cur={ratios.cur.steps} prev={ratios.prev.steps} />
    </View>
  );
}

type Sparklines = NonNullable<NonNullable<HealthyInsightResult['sparklines']>>;

function MiniSparkline({ values, color }: { values: (number | null)[]; color: string }) {
  const W = 80;
  const H = 32;
  const pts = values
    .map((v, i) => (v != null ? { x: i, y: v, idx: i } : null))
    .filter((p): p is { x: number; y: number; idx: number } => p !== null);

  if (pts.length < 2) return null;

  const maxV = Math.max(...pts.map((p) => p.y), 0.01);
  const n = values.length - 1 || 1;

  const mapped = pts.map((p) => ({
    sx: (p.x / n) * W,
    sy: H - (p.y / maxV) * (H - 4) - 2,
  }));

  const d = mapped
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`)
    .join(' ');

  const last = mapped[mapped.length - 1];

  return (
    <Svg width={W} height={H}>
      <Path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {last && <Circle cx={last.sx} cy={last.sy} r={3} fill={color} />}
    </Svg>
  );
}

function SparklineSection({ sparklines, period }: { sparklines: Sparklines; period: HealthyInsightResult['period'] }) {
  const hasSleep = sparklines.sleep.some((v) => v != null);
  const hasMood = sparklines.mood.some((v) => v != null);
  const hasSteps = sparklines.steps.some((v) => v != null);
  if (!hasSleep && !hasMood && !hasSteps) return null;

  const label = period === 'week' ? 'Тренд за неделю' : 'Тренд за месяц';

  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>{label}</ThemedText>
      <View style={styles.sparklineGrid}>
        {hasSleep && (
          <View style={styles.sparklineItem}>
            <MiniSparkline values={sparklines.sleep} color={COLORS.accent} />
            <ThemedText style={[styles.sparklineLabel, { color: COLORS.textMuted }]}>Сон</ThemedText>
          </View>
        )}
        {hasMood && (
          <View style={styles.sparklineItem}>
            <MiniSparkline values={sparklines.mood} color={COLORS.positive} />
            <ThemedText style={[styles.sparklineLabel, { color: COLORS.textMuted }]}>Настроение</ThemedText>
          </View>
        )}
        {hasSteps && (
          <View style={styles.sparklineItem}>
            <MiniSparkline values={sparklines.steps} color={COLORS.textMuted} />
            <ThemedText style={[styles.sparklineLabel, { color: COLORS.textMuted }]}>Шаги</ThemedText>
          </View>
        )}
      </View>
    </View>
  );
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
    dynamicsLabel: result.dynamicsLabel,
    dynamicsSummary: result.dynamicsSummary,
    vsPreviousPeriod: Array.isArray(result.vsPreviousPeriod) ? result.vsPreviousPeriod : [],
    metricLinks: Array.isArray(result.metricLinks) ? result.metricLinks : [],
    helpfulHabits: Array.isArray(result.helpfulHabits) ? result.helpfulHabits : [],
    rationale: result.rationale,
    positiveHighlight: result.positiveHighlight,
    actionToday: result.actionToday,
    metricRatios: result.metricRatios,
    sparklines: result.sparklines,
  };
}

function InsightBody({ result }: { result: HealthyInsightResult }) {
  const displayRecommendations =
    result.period === 'day' && result.actionToday?.trim()
      ? result.recommendations.filter((t) => t.trim() !== result.actionToday?.trim()).slice(0, 2)
      : result.recommendations;

  const showDelta =
    (result.period === 'week' || result.period === 'month')
    && !result.lowData
    && (result.improved.length > 0 || result.worsened.length > 0);

  const rationaleText = result.rationale?.trim();
  const highlightText = result.positiveHighlight?.trim();

  return (
    <Animated.View entering={FadeIn.duration(220)} style={styles.body}>
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusAccent(result.statusTone) }]} />
        <ThemedText style={[styles.statusLabel, { color: COLORS.textPrimary }]} numberOfLines={2}>
          {result.statusLabel}
        </ThemedText>
      </View>

      <ThemedText style={[styles.summary, { color: COLORS.textMuted }]}>{result.summary}</ThemedText>

      {!!rationaleText && (
        <View style={[styles.rationaleCard, { backgroundColor: COLORS.trackBg }]}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary, marginBottom: 6 }]}>
            Почему такой вывод
          </ThemedText>
          <ThemedText style={[styles.sectionText, { color: COLORS.textMuted }]}>{rationaleText}</ThemedText>
        </View>
      )}

      {!!highlightText && (
        <View style={[styles.highlightCard, { borderColor: 'rgba(52, 199, 89, 0.35)' }]}>
          <MaterialIcons name="wb-sunny" size={18} color={COLORS.positive} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText style={[styles.focusTitle, { color: COLORS.textPrimary }]}>Позитивный сигнал</ThemedText>
            <ThemedText style={[styles.focusBody, { color: COLORS.textMuted }]}>{highlightText}</ThemedText>
          </View>
        </View>
      )}

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

      {result.period !== 'day' && !!result.dynamicsSummary?.trim() && (
        <View style={styles.dynamicsRow}>
          {result.dynamicsLabel ? (() => {
            const cfg = dynamicsConfig(result.dynamicsLabel);
            return (
              <View style={[styles.dynamicsChip, { backgroundColor: COLORS.chipBg }]}>
                <MaterialIcons name={cfg.icon} size={14} color={cfg.color} />
                <ThemedText style={[styles.dynamicsChipText, { color: cfg.color, marginLeft: 4 }]}>
                  {cfg.text}
                </ThemedText>
              </View>
            );
          })() : null}
          <ThemedText style={[styles.dynamicsSummaryText, { color: COLORS.textMuted }]}>
            {result.dynamicsSummary}
          </ThemedText>
        </View>
      )}

      {result.period !== 'day' && (result.vsPreviousPeriod ?? []).length > 0 && (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>К прошлому периоду</ThemedText>
          {(result.vsPreviousPeriod ?? []).map((line, i) => (
            <View key={`vp-${i}`} style={styles.bulletRow}>
              <MaterialIcons name="swap-horiz" size={16} color={COLORS.textMuted} style={styles.bulletIcon} />
              <ThemedText style={[styles.bulletText, { color: COLORS.textMuted }]}>{line}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {result.period !== 'day' && result.metricRatios && !result.lowData && (
        <MetricCompareSection ratios={result.metricRatios} />
      )}

      {result.period !== 'day' && result.sparklines && !result.lowData && (
        <SparklineSection sparklines={result.sparklines} period={result.period} />
      )}

      {(result.metricLinks ?? []).length > 0 && (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Связи по вашим данным</ThemedText>
          {(result.metricLinks ?? []).map((line, i) => (
            <View key={`ml-${i}`} style={styles.bulletRow}>
              <MaterialIcons name="timeline" size={16} color={COLORS.accentSoft} style={styles.bulletIcon} />
              <ThemedText style={[styles.bulletText, { color: COLORS.textMuted }]}>{line}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {(result.helpfulHabits ?? []).length > 0 && (
        <View style={styles.section}>
          <ThemedText style={[styles.sectionTitle, { color: COLORS.textPrimary }]}>Что помогает по журналу</ThemedText>
          {(result.helpfulHabits ?? []).map((line, i) => (
            <View key={`hh-${i}`} style={styles.bulletRow}>
              <MaterialIcons name="eco" size={16} color={COLORS.positive} style={styles.bulletIcon} />
              <ThemedText style={[styles.bulletText, { color: COLORS.textMuted }]}>{line}</ThemedText>
            </View>
          ))}
        </View>
      )}

      {result.period === 'day' && !!result.actionToday?.trim() && (
        <View style={[styles.actionTodayCard, { borderColor: 'rgba(243, 87, 19, 0.45)' }]}>
          <MaterialIcons name="bolt" size={20} color={COLORS.accent} />
          <View style={{ flex: 1, marginLeft: 10 }}>
            <ThemedText style={[styles.focusTitle, { color: COLORS.textPrimary }]}>Один шаг сегодня</ThemedText>
            <ThemedText style={[styles.focusBody, { color: COLORS.textMuted }]}>{result.actionToday}</ThemedText>
          </View>
        </View>
      )}

      {showDelta && (
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
        {displayRecommendations.map((text, i) => (
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
              ? `Обновлено: ${formatTimeOnly(remoteGeneratedAt) || remoteGeneratedAt.slice(11, 16)}`
              : 'Серверный анализ'
            : loadError
              ? 'Локальный fallback'
              : isRefreshing
                ? 'Обновляем анализ...'
                : 'Подготовка анализа...'}
        </ThemedText>
        {loadError ? (
          <ThemedText style={[styles.metaHint, { color: COLORS.accentSoft }]}>
            Локально — синхронизируйте при сети для полного сравнения периодов на сервере.
          </ThemedText>
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
  metaHint: {
    fontSize: 11,
    lineHeight: 14,
    flexShrink: 1,
    textAlign: 'right',
    maxWidth: '62%',
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
  rationaleCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
  },
  dynamicsRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 14,
    flexWrap: 'wrap',
  },
  dynamicsChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dynamicsChipText: {
    fontSize: 12,
    fontWeight: '700',
  },
  metricBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  metricBarLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 100,
    gap: 5,
  },
  metricBarLabel: {
    fontSize: 12,
    flexShrink: 1,
  },
  metricBarTrackCol: {
    flex: 1,
  },
  metricBarTrack: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  metricBarFill: {
    height: '100%',
    borderRadius: 3,
  },
  metricBarValueCol: {
    width: 44,
    alignItems: 'flex-end',
  },
  metricBarPct: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricBarDelta: {
    fontSize: 11,
  },
  metricBarLegend: {
    marginBottom: 10,
  },
  metricBarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  metricBarLegendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  metricBarLegendLabel: {
    fontSize: 11,
  },
  sparklineGrid: {
    flexDirection: 'row',
    gap: 16,
    flexWrap: 'wrap',
  },
  sparklineItem: {
    alignItems: 'center',
    gap: 4,
  },
  sparklineLabel: {
    fontSize: 11,
  },
  dynamicsSummaryText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
  actionTodayCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
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
