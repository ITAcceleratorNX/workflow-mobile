import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  UIManager,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { Circle, Path, Svg } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
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

// ===== Design tokens =====
// Нейтрали (фон/текст) — через InsightThemeContext + useThemeColor.
// Насыщенные акценты метрик — общая палитра для light/dark.

type InsightThemeColors = {
  cardBg: string;
  cardBgSubtle: string;
  trackBg: string;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
};

const InsightThemeContext = createContext<InsightThemeColors | null>(null);

function useHealthyInsightThemeColors(): InsightThemeColors {
  const cardBg = useThemeColor({}, 'surfaceElevated');
  const cardBgSubtle = useThemeColor({}, 'surface');
  const trackBg = useThemeColor({}, 'surfaceMuted');
  const divider = useThemeColor({}, 'divider');
  const textPrimary = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  const accent = useThemeColor({}, 'primary');
  const accentSoft = useThemeColor({}, 'accentSoft');
  return useMemo(
    () => ({
      cardBg,
      cardBgSubtle,
      trackBg,
      divider,
      textPrimary,
      textSecondary,
      textMuted,
      accent,
      accentSoft,
    }),
    [
      cardBg,
      cardBgSubtle,
      trackBg,
      divider,
      textPrimary,
      textSecondary,
      textMuted,
      accent,
      accentSoft,
    ]
  );
}

function useInsightTheme(): InsightThemeColors {
  const ctx = useContext(InsightThemeContext);
  if (!ctx) {
    throw new Error('useInsightTheme must be used within HealthyAiInsights');
  }
  return ctx;
}

const PALETTE = {
  blue: '#4FC3F7',
  blueSoft: 'rgba(79, 195, 247, 0.18)',
  indigo: '#7B6FF7',
  indigoSoft: 'rgba(123, 111, 247, 0.18)',
  pink: '#E85D87',
  pinkSoft: 'rgba(232, 93, 135, 0.18)',
  orange: '#FF8A50',
  orangeSoft: 'rgba(255, 138, 80, 0.22)',
  green: '#4CAF50',
  greenSoft: 'rgba(76, 175, 80, 0.18)',
  yellow: '#FFC107',
  yellowSoft: 'rgba(255, 193, 7, 0.18)',
  red: '#FF5252',
  redSoft: 'rgba(255, 82, 82, 0.18)',
} as const;

const PERIODS: { key: HealthyInsightPeriod; label: string }[] = [
  { key: 'day', label: 'День' },
  { key: 'week', label: 'Неделя' },
  { key: 'month', label: 'Месяц' },
];

// ===== Helpers =====

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

function statusVisual(tone: HealthyInsightResult['statusTone']) {
  if (tone === 'positive') {
    return { color: PALETTE.green, bg: PALETTE.greenSoft, icon: 'check-circle' as const };
  }
  if (tone === 'attention') {
    return { color: PALETTE.orange, bg: PALETTE.orangeSoft, icon: 'priority-high' as const };
  }
  return { color: PALETTE.indigo, bg: PALETTE.indigoSoft, icon: 'auto-awesome' as const };
}

function dynamicsVisual(
  label: HealthyInsightResult['dynamicsLabel'],
  neutrals: Pick<InsightThemeColors, 'textSecondary' | 'trackBg'>
) {
  if (label === 'better') {
    return { text: 'Лучше', color: PALETTE.green, bg: PALETTE.greenSoft, icon: 'trending-up' as const };
  }
  if (label === 'worse') {
    return { text: 'Тяжелее', color: PALETTE.orange, bg: PALETTE.orangeSoft, icon: 'trending-down' as const };
  }
  return {
    text: 'Стабильно',
    color: neutrals.textSecondary,
    bg: neutrals.trackBg,
    icon: 'trending-flat' as const,
  };
}

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

// ===== Visual primitives =====

function IconBubble({ icon, color, bg, size = 18 }: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
  bg: string;
  size?: number;
}) {
  return (
    <View style={[styles.iconBubble, { backgroundColor: bg }]}>
      <MaterialIcons name={icon} size={size} color={color} />
    </View>
  );
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
  const n = useInsightTheme();
  if (cur == null && prev == null) return null;
  const d = delta(cur, prev);
  const dPositive = cur != null && prev != null && cur > prev;
  const dNegative = cur != null && prev != null && cur < prev;
  const curFill = Math.min(1, Math.max(0, cur ?? 0));
  const prevFill = Math.min(1, Math.max(0, prev ?? 0));

  return (
    <View style={styles.metricBarRow}>
      <View style={styles.metricBarLabelCol}>
        <MaterialIcons name={icon} size={15} color={n.textSecondary} />
        <ThemedText style={[styles.metricBarLabel, { color: n.textSecondary }]}>{label}</ThemedText>
      </View>
      <View style={styles.metricBarTrackCol}>
        <View style={[styles.metricBarTrack, { backgroundColor: n.trackBg }]}>
          <View style={[styles.metricBarFill, { width: `${curFill * 100}%`, backgroundColor: n.accent }]} />
        </View>
        <View style={[styles.metricBarTrack, { backgroundColor: n.trackBg, marginTop: 3, opacity: 0.55 }]}>
          <View style={[styles.metricBarFill, { width: `${prevFill * 100}%`, backgroundColor: n.textSecondary }]} />
        </View>
      </View>
      <View style={styles.metricBarValueCol}>
        <ThemedText style={[styles.metricBarPct, { color: n.textPrimary }]}>{pct(cur)}</ThemedText>
        {d != null && (
          <ThemedText style={[styles.metricBarDelta, {
            color: dPositive ? PALETTE.green : dNegative ? PALETTE.orange : n.textSecondary,
          }]}>{d}</ThemedText>
        )}
      </View>
    </View>
  );
}

function MiniSparkline({ values, color, width = 100, height = 38 }: {
  values: (number | null)[];
  color: string;
  width?: number;
  height?: number;
}) {
  const pts = values
    .map((v, i) => (v != null ? { x: i, y: v, idx: i } : null))
    .filter((p): p is { x: number; y: number; idx: number } => p !== null);
  if (pts.length < 2) return null;

  const maxV = Math.max(...pts.map((p) => p.y), 0.01);
  const n = values.length - 1 || 1;
  const mapped = pts.map((p) => ({
    sx: (p.x / n) * width,
    sy: height - (p.y / maxV) * (height - 4) - 2,
  }));
  const d = mapped
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.sx.toFixed(1)} ${p.sy.toFixed(1)}`)
    .join(' ');
  const last = mapped[mapped.length - 1];

  return (
    <Svg width={width} height={height}>
      <Path d={d} stroke={color} strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
      {last && <Circle cx={last.sx} cy={last.sy} r={3} fill={color} />}
    </Svg>
  );
}

// ===== Modal shell =====

function InsightModal({
  visible,
  title,
  onClose,
  children,
}: {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const c = useInsightTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: c.cardBg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={[styles.modalHeader, { borderBottomColor: c.divider }]}>
            <ThemedText style={[styles.modalTitle, { color: c.textPrimary }]}>{title}</ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={c.textSecondary} />
            </Pressable>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={styles.modalScroll} contentContainerStyle={styles.modalScrollContent}>
            {children}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ===== Section row (clickable, opens modal) =====

function SectionRow({
  icon,
  iconColor,
  iconBg,
  title,
  hint,
  count,
  onPress,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  iconBg: string;
  title: string;
  hint?: string;
  count?: number;
  onPress: () => void;
}) {
  const c = useInsightTheme();
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.sectionRow,
        { borderBottomColor: c.divider },
        pressed && styles.cardPressed,
      ]}
    >
      <IconBubble icon={icon} color={iconColor} bg={iconBg} size={18} />
      <View style={styles.sectionRowBody}>
        <View style={styles.sectionRowTitleRow}>
          <ThemedText style={[styles.sectionRowTitle, { color: c.textPrimary }]}>{title}</ThemedText>
          {count != null && count > 0 && (
            <View style={[styles.countBadge, { backgroundColor: c.trackBg }]}>
              <ThemedText style={[styles.countBadgeText, { color: c.textSecondary }]}>{count}</ThemedText>
            </View>
          )}
        </View>
        {hint ? (
          <ThemedText style={[styles.sectionRowHint, { color: c.textSecondary }]} numberOfLines={1}>
            {hint}
          </ThemedText>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={c.textMuted} />
    </Pressable>
  );
}

// ===== Inline blocks =====

function StatusHero({ result }: { result: HealthyInsightResult }) {
  const visual = statusVisual(result.statusTone);
  const c = useInsightTheme();
  return (
    <View style={[styles.card, styles.heroCard, { backgroundColor: c.cardBg }]}>
      <View style={styles.heroHeader}>
        <IconBubble icon={visual.icon} color={visual.color} bg={visual.bg} size={20} />
        <ThemedText style={[styles.heroLabel, { color: c.textSecondary }]}>Статус</ThemedText>
      </View>
      <ThemedText style={[styles.heroTitle, { color: c.textPrimary }]} numberOfLines={3}>
        {result.statusLabel}
      </ThemedText>
      <ThemedText style={[styles.heroBody, { color: c.textSecondary }]}>
        {result.summary}
      </ThemedText>
    </View>
  );
}

function DynamicsCard({ result }: { result: HealthyInsightResult }) {
  if (!result.dynamicsLabel || !result.dynamicsSummary?.trim()) return null;
  const c = useInsightTheme();
  const cfg = dynamicsVisual(result.dynamicsLabel, {
    textSecondary: c.textSecondary,
    trackBg: c.trackBg,
  });
  return (
    <View style={[styles.card, styles.dynamicsCard, { backgroundColor: c.cardBg }]}>
      <View style={[styles.dynamicsBadge, { backgroundColor: cfg.bg }]}>
        <MaterialIcons name={cfg.icon} size={14} color={cfg.color} />
        <ThemedText style={[styles.dynamicsBadgeText, { color: cfg.color }]}>{cfg.text}</ThemedText>
      </View>
      <ThemedText style={[styles.dynamicsSummary, { color: c.textSecondary }]}>
        {result.dynamicsSummary}
      </ThemedText>
    </View>
  );
}

function HighlightCard({
  icon,
  iconColor,
  iconBg,
  title,
  body,
}: {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  iconBg: string;
  title: string;
  body: string;
}) {
  const c = useInsightTheme();
  return (
    <View style={[styles.card, styles.highlightCard, { backgroundColor: c.cardBg }]}>
      <IconBubble icon={icon} color={iconColor} bg={iconBg} size={18} />
      <View style={styles.highlightBody}>
        <ThemedText style={[styles.highlightTitle, { color: c.textPrimary }]}>{title}</ThemedText>
        <ThemedText style={[styles.highlightText, { color: c.textSecondary }]}>{body}</ThemedText>
      </View>
    </View>
  );
}

function SupportCard({ text }: { text: string }) {
  const c = useInsightTheme();
  return (
    <View style={[styles.card, styles.supportCard, { backgroundColor: c.cardBg }]}>
      <IconBubble icon="favorite-border" color={c.accent} bg={c.accentSoft} size={16} />
      <ThemedText style={[styles.supportText, { color: c.textSecondary }]}>{text}</ThemedText>
    </View>
  );
}

function LowDataBanner({ hints }: { hints: string[] }) {
  const c = useInsightTheme();
  return (
    <View style={[styles.card, styles.lowDataBanner, { backgroundColor: c.cardBg }]}>
      <IconBubble icon="info-outline" color={c.accent} bg={c.accentSoft} size={18} />
      <View style={styles.highlightBody}>
        <ThemedText style={[styles.highlightTitle, { color: c.textPrimary }]}>
          Недостаточно данных
        </ThemedText>
        {hints.length > 0 && (
          <ThemedText style={[styles.highlightText, { color: c.textSecondary }]}>
            Не хватает: {hints.join(', ')}.
          </ThemedText>
        )}
      </View>
    </View>
  );
}

// ===== Modal contents =====

function ListBlock({
  items,
  icon,
  color,
}: {
  items: string[];
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  color: string;
}) {
  const c = useInsightTheme();
  if (!items.length) return null;
  return (
    <View style={styles.modalList}>
      {items.map((line, i) => (
        <View key={`l-${i}`} style={styles.modalListItem}>
          <MaterialIcons name={icon} size={16} color={color} style={styles.modalListIcon} />
          <ThemedText style={[styles.modalListText, { color: c.textSecondary }]}>{line}</ThemedText>
        </View>
      ))}
    </View>
  );
}

function ModalSubTitle({ children }: { children: React.ReactNode }) {
  const c = useInsightTheme();
  return (
    <ThemedText style={[styles.modalSubTitle, { color: c.textPrimary }]}>{children}</ThemedText>
  );
}

function ComparisonModalBody({ result }: { result: HealthyInsightResult }) {
  const c = useInsightTheme();
  const ratios = result.metricRatios;
  return (
    <>
      {ratios && (
        <>
          <View style={styles.metricBarLegendRow}>
            <View style={[styles.metricBarLegendDot, { backgroundColor: c.accent }]} />
            <ThemedText style={[styles.metricBarLegendLabel, { color: c.textSecondary }]}>Сейчас</ThemedText>
            <View style={[styles.metricBarLegendDot, { backgroundColor: c.textSecondary, opacity: 0.55, marginLeft: 14 }]} />
            <ThemedText style={[styles.metricBarLegendLabel, { color: c.textSecondary }]}>Прошлый период</ThemedText>
          </View>
          <View style={{ marginTop: Spacing.sm + 2 }}>
            <MetricBar label="Сон" icon="bedtime" cur={ratios.cur.sleep} prev={ratios.prev.sleep} />
            <MetricBar label="Настроение" icon="sentiment-satisfied" cur={ratios.cur.mood} prev={ratios.prev.mood} />
            <MetricBar label="Шаги" icon="directions-walk" cur={ratios.cur.steps} prev={ratios.prev.steps} />
          </View>
        </>
      )}
      {(result.vsPreviousPeriod ?? []).length > 0 && (
        <>
          <ModalSubTitle>Что изменилось</ModalSubTitle>
          <ListBlock items={result.vsPreviousPeriod ?? []} icon="swap-horiz" color={c.textSecondary} />
        </>
      )}
    </>
  );
}

function TrendsModalBody({ result }: { result: HealthyInsightResult }) {
  const c = useInsightTheme();
  const sp = result.sparklines;
  if (!sp) return null;
  const items: { values: (number | null)[]; color: string; label: string }[] = [];
  if (sp.sleep.some((v) => v != null)) items.push({ values: sp.sleep, color: PALETTE.indigo, label: 'Сон' });
  if (sp.mood.some((v) => v != null)) items.push({ values: sp.mood, color: PALETTE.green, label: 'Настроение' });
  if (sp.steps.some((v) => v != null)) items.push({ values: sp.steps, color: PALETTE.orange, label: 'Шаги' });

  if (items.length === 0) {
    return (
      <ThemedText style={[styles.modalText, { color: c.textSecondary }]}>
        Недостаточно отметок для построения тренда.
      </ThemedText>
    );
  }

  return (
    <View style={{ gap: Spacing.md + 2 }}>
      {items.map((it) => (
        <View key={it.label} style={styles.trendRow}>
          <View style={styles.trendLabelCol}>
            <ThemedText style={[styles.trendLabel, { color: c.textPrimary }]}>{it.label}</ThemedText>
          </View>
          <MiniSparkline values={it.values} color={it.color} width={180} height={50} />
        </View>
      ))}
    </View>
  );
}

function HelpfulModalBody({ result }: { result: HealthyInsightResult }) {
  const c = useInsightTheme();
  const links = result.metricLinks ?? [];
  const habits = result.helpfulHabits ?? [];
  return (
    <>
      {links.length > 0 && (
        <>
          <ModalSubTitle>Связи между метриками</ModalSubTitle>
          <ListBlock items={links} icon="timeline" color={PALETTE.indigo} />
        </>
      )}
      {habits.length > 0 && (
        <>
          <ModalSubTitle>Что помогает по журналу</ModalSubTitle>
          <ListBlock items={habits} icon="eco" color={PALETTE.green} />
        </>
      )}
      {links.length === 0 && habits.length === 0 && (
        <ThemedText style={[styles.modalText, { color: c.textSecondary }]}>
          Пока недостаточно повторяющихся данных, чтобы выделить связи.
        </ThemedText>
      )}
    </>
  );
}

function StrengthsWeakModalBody({ result }: { result: HealthyInsightResult }) {
  const c = useInsightTheme();
  const hasStrengths = result.strengths.length > 0;
  const hasWeak = result.weakPoints.length > 0 || result.weaknessesNarrative.length > 0;
  const hasImproved = result.improved.length > 0;
  const hasWorsened = result.worsened.length > 0;

  if (!hasStrengths && !hasWeak && !hasImproved && !hasWorsened) {
    return (
      <ThemedText style={[styles.modalText, { color: c.textSecondary }]}>
        Картина выглядит ровной — без выраженных сильных и слабых сторон.
      </ThemedText>
    );
  }

  return (
    <>
      {hasStrengths && (
        <>
          <ModalSubTitle>Сильные стороны</ModalSubTitle>
          <ListBlock items={result.strengths} icon="check-circle" color={PALETTE.green} />
        </>
      )}
      {hasImproved && (
        <>
          <ModalSubTitle>Что улучшилось</ModalSubTitle>
          <ListBlock items={result.improved} icon="trending-up" color={PALETTE.green} />
        </>
      )}
      {hasWeak && (
        <>
          <ModalSubTitle>Зоны внимания</ModalSubTitle>
          {result.weakPoints.map((w) => (
            <View key={w.id} style={styles.modalListItem}>
              <MaterialIcons name={metricIcon(w.id)} size={16} color={PALETTE.orange} style={styles.modalListIcon} />
              <ThemedText style={[styles.modalListText, { color: c.textSecondary }]}>{w.label}</ThemedText>
            </View>
          ))}
          {result.weaknessesNarrative
            .filter((line) => !result.weakPoints.some((w) => w.label === line))
            .map((line, i) => (
              <View key={`wn-${i}`} style={styles.modalListItem}>
                <MaterialIcons name="remove-circle-outline" size={16} color={PALETTE.orange} style={styles.modalListIcon} />
                <ThemedText style={[styles.modalListText, { color: c.textSecondary }]}>{line}</ThemedText>
              </View>
            ))}
        </>
      )}
      {hasWorsened && (
        <>
          <ModalSubTitle>Что просело</ModalSubTitle>
          <ListBlock items={result.worsened} icon="trending-down" color={PALETTE.orange} />
        </>
      )}
    </>
  );
}

function PatternsModalBody({ result }: { result: HealthyInsightResult }) {
  const c = useInsightTheme();
  return (
    <>
      {result.patternsLine && (
        <ThemedText style={[styles.modalText, { color: c.textSecondary }]}>{result.patternsLine}</ThemedText>
      )}
      {result.monthlyDynamics && (
        <>
          <ModalSubTitle>Динамика месяца</ModalSubTitle>
          <ThemedText style={[styles.modalText, { color: c.textSecondary }]}>{result.monthlyDynamics}</ThemedText>
        </>
      )}
    </>
  );
}

// ===== Insight body =====

type ModalKey =
  | 'rationale'
  | 'compare'
  | 'trends'
  | 'helpful'
  | 'strengths'
  | 'recommendations'
  | 'patterns'
  | null;

function InsightBody({ result }: { result: HealthyInsightResult }) {
  const [openModal, setOpenModal] = useState<ModalKey>(null);
  const c = useInsightTheme();

  // Для day отделяем actionToday от рекомендаций, чтобы не дублировать
  const filteredRecommendations =
    result.period === 'day' && result.actionToday?.trim()
      ? result.recommendations.filter((t) => t.trim() !== result.actionToday?.trim())
      : result.recommendations;

  const isDay = result.period === 'day';
  const showCompare = !isDay && !result.lowData
    && (result.metricRatios != null || (result.vsPreviousPeriod ?? []).length > 0);
  const showTrends = !isDay && !result.lowData && result.sparklines != null
    && (result.sparklines.sleep.some((v) => v != null)
      || result.sparklines.mood.some((v) => v != null)
      || result.sparklines.steps.some((v) => v != null));
  const showHelpful = !isDay && !result.lowData
    && ((result.metricLinks ?? []).length > 0 || (result.helpfulHabits ?? []).length > 0);
  const showStrengths = !isDay && !result.lowData
    && (result.strengths.length > 0
      || result.weakPoints.length > 0
      || result.weaknessesNarrative.length > 0
      || result.improved.length > 0
      || result.worsened.length > 0);
  const showPatterns = result.period === 'month' && !result.lowData
    && (!!result.patternsLine || !!result.monthlyDynamics);
  const showWeakPointsForDay = isDay && result.weakPoints.length > 0;
  const showRecommendations = filteredRecommendations.length > 0;
  const showRationale = !!result.rationale?.trim();

  const focusBody = isDay
    ? null
    : result.period === 'week'
      ? result.weeklyFocus
      : result.monthlyFocus;

  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <StatusHero result={result} />

      {result.lowData && <LowDataBanner hints={result.missingHints} />}

      {!result.lowData && !isDay && <DynamicsCard result={result} />}

      {!result.lowData && isDay && !!result.actionToday?.trim() && (
        <HighlightCard
          icon="bolt"
          iconColor={c.accent}
          iconBg={c.accentSoft}
          title="Один шаг сегодня"
          body={result.actionToday}
        />
      )}

      {!result.lowData && !isDay && !!focusBody?.trim() && (
        <HighlightCard
          icon={result.period === 'week' ? 'center-focus-strong' : 'flag'}
          iconColor={c.accent}
          iconBg={c.accentSoft}
          title={result.period === 'week' ? 'Фокус недели' : 'Фокус месяца'}
          body={focusBody}
        />
      )}

      {(showCompare || showTrends || showHelpful || showStrengths || showPatterns
        || showWeakPointsForDay || showRecommendations || showRationale) && (
        <View style={[styles.sectionList, { backgroundColor: c.cardBg }]}>
          {showCompare && (
            <SectionRow
              icon="compare-arrows"
              iconColor={PALETTE.blue}
              iconBg={PALETTE.blueSoft}
              title="Сравнение с прошлым периодом"
              hint="Сон, настроение, шаги — на графике"
              onPress={() => setOpenModal('compare')}
            />
          )}
          {showTrends && (
            <SectionRow
              icon="show-chart"
              iconColor={PALETTE.indigo}
              iconBg={PALETTE.indigoSoft}
              title={result.period === 'week' ? 'Тренд за неделю' : 'Тренд за месяц'}
              hint="Мини-графики по метрикам"
              onPress={() => setOpenModal('trends')}
            />
          )}
          {showHelpful && (
            <SectionRow
              icon="eco"
              iconColor={PALETTE.green}
              iconBg={PALETTE.greenSoft}
              title="Связи и помощники"
              hint="Что в журнале коррелирует с лучшим самочувствием"
              count={(result.metricLinks?.length ?? 0) + (result.helpfulHabits?.length ?? 0)}
              onPress={() => setOpenModal('helpful')}
            />
          )}
          {showStrengths && (
            <SectionRow
              icon="balance"
              iconColor={PALETTE.orange}
              iconBg={PALETTE.orangeSoft}
              title="Сильные стороны и зоны внимания"
              hint="Что держится и что просело"
              onPress={() => setOpenModal('strengths')}
            />
          )}
          {showPatterns && (
            <SectionRow
              icon="auto-graph"
              iconColor={PALETTE.pink}
              iconBg={PALETTE.pinkSoft}
              title="Паттерны месяца"
              hint="Что повторяется в ваших данных"
              onPress={() => setOpenModal('patterns')}
            />
          )}
          {showWeakPointsForDay && (
            <SectionRow
              icon="priority-high"
              iconColor={PALETTE.orange}
              iconBg={PALETTE.orangeSoft}
              title="Главные просадки сегодня"
              count={result.weakPoints.length}
              onPress={() => setOpenModal('strengths')}
            />
          )}
          {showRecommendations && (
            <SectionRow
              icon="lightbulb-outline"
              iconColor={PALETTE.yellow}
              iconBg={PALETTE.yellowSoft}
              title="Рекомендации"
              count={filteredRecommendations.length}
              onPress={() => setOpenModal('recommendations')}
            />
          )}
          {showRationale && (
            <SectionRow
              icon="psychology"
              iconColor={PALETTE.indigo}
              iconBg={PALETTE.indigoSoft}
              title="Почему такой вывод"
              hint="Как AI пришёл к этому статусу"
              onPress={() => setOpenModal('rationale')}
            />
          )}
        </View>
      )}

      {!!result.positiveHighlight?.trim() && !result.lowData && (
        <HighlightCard
          icon="wb-sunny"
          iconColor={PALETTE.green}
          iconBg={PALETTE.greenSoft}
          title="Позитивный сигнал"
          body={result.positiveHighlight}
        />
      )}

      <SupportCard text={result.supportMessage} />

      <InsightModal visible={openModal === 'compare'} onClose={() => setOpenModal(null)} title="Сравнение с прошлым периодом">
        <ComparisonModalBody result={result} />
      </InsightModal>

      <InsightModal
        visible={openModal === 'trends'}
        onClose={() => setOpenModal(null)}
        title={result.period === 'week' ? 'Тренд за неделю' : 'Тренд за месяц'}
      >
        <TrendsModalBody result={result} />
      </InsightModal>

      <InsightModal visible={openModal === 'helpful'} onClose={() => setOpenModal(null)} title="Связи и помощники">
        <HelpfulModalBody result={result} />
      </InsightModal>

      <InsightModal visible={openModal === 'strengths'} onClose={() => setOpenModal(null)} title="Сильные стороны и зоны внимания">
        <StrengthsWeakModalBody result={result} />
      </InsightModal>

      <InsightModal visible={openModal === 'patterns'} onClose={() => setOpenModal(null)} title="Паттерны месяца">
        <PatternsModalBody result={result} />
      </InsightModal>

      <InsightModal visible={openModal === 'recommendations'} onClose={() => setOpenModal(null)} title="Рекомендации">
        <ListBlock items={filteredRecommendations} icon="check-circle-outline" color={PALETTE.yellow} />
      </InsightModal>

      <InsightModal visible={openModal === 'rationale'} onClose={() => setOpenModal(null)} title="Почему такой вывод">
        <ThemedText style={[styles.modalText, { color: c.textSecondary }]}>{result.rationale}</ThemedText>
      </InsightModal>
    </Animated.View>
  );
}

// ===== Public =====

export function HealthyAiInsights() {
  const [period, setPeriod] = useState<HealthyInsightPeriod>('day');
  const [remoteInsight, setRemoteInsight] = useState<HealthyInsightResult | null>(null);
  const [remoteGeneratedAt, setRemoteGeneratedAt] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Local store data — для офлайн fallback анализа
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
  const waterGoalMl = getTodayGoalMl({ heightCm, weightKg, stepsToday, sleepRating: todaySleepRating });

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

  const localInsight = useMemo(
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
      period, todayKey, goalSleepMinutes, lastNightSleepMinutes, avgSleep7DaysMinutes,
      todaySleepRating, stepsToday, stepsGoal, stepsHistory, waterIntakeMl, waterGoalMl,
      moodToday, moodRecordsByDate, sleepRatingsByDate,
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

  const resolvedInsight: HealthyInsightResult = remoteInsight ?? localInsight;

  const onTab = useCallback((p: HealthyInsightPeriod) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setPeriod(p);
  }, []);

  const metaText = remoteInsight
    ? remoteGeneratedAt
      ? `Обновлено: ${formatTimeOnly(remoteGeneratedAt) || remoteGeneratedAt.slice(11, 16)}`
      : 'Серверный анализ'
    : isRefreshing
      ? 'Обновляем анализ...'
      : loadError
        ? 'Локальный режим'
        : 'Подготовка анализа...';

  const insightTheme = useHealthyInsightThemeColors();

  return (
    <InsightThemeContext.Provider value={insightTheme}>
    <View style={styles.root}>
      {/* Period tabs */}
      <View style={[styles.segment, { backgroundColor: insightTheme.cardBgSubtle }]}>
        {PERIODS.map(({ key, label }) => {
          const active = period === key;
          return (
            <Pressable
              key={key}
              onPress={() => onTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={[styles.segmentItem, active && { backgroundColor: insightTheme.trackBg }]}
            >
              <ThemedText style={[styles.segmentLabel, { color: active ? insightTheme.textPrimary : insightTheme.textSecondary }]}>
                {label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>

      {/* Meta */}
      <View style={styles.metaRow}>
        <ThemedText style={[styles.metaText, { color: insightTheme.textMuted }]}>{metaText}</ThemedText>
      </View>

      <InsightBody key={period} result={resolvedInsight} />
    </View>
    </InsightThemeContext.Provider>
  );
}

// ===== Styles =====

const styles = StyleSheet.create({
  root: { paddingTop: 4 },

  // Segment (period tabs)
  segment: {
    flexDirection: 'row',
    borderRadius: 14,
    padding: 4,
    marginBottom: 6,
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

  metaRow: {
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 10,
  },
  metaText: { fontSize: 11 },

  // Generic card
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardPressed: { opacity: 0.85 },

  // Hero
  heroCard: { gap: 6 },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 4,
  },
  heroLabel: { fontSize: 13, fontWeight: '500' },
  heroTitle: { fontSize: 19, fontWeight: '700', lineHeight: 24 },
  heroBody: { fontSize: 14, lineHeight: 20 },

  // Dynamics card
  dynamicsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  dynamicsBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
    gap: 4,
  },
  dynamicsBadgeText: { fontSize: 12, fontWeight: '700' },
  dynamicsSummary: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Highlight card (action today / focus / positive signal)
  highlightCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  highlightBody: { flex: 1, gap: 4 },
  highlightTitle: { fontSize: 15, fontWeight: '600' },
  highlightText: { fontSize: 14, lineHeight: 20 },

  lowDataBanner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },

  // Section list (rows similar to Settings list)
  sectionList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.md + 2,
    gap: Spacing.md + 2,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sectionRowBody: { flex: 1, gap: 2 },
  sectionRowTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionRowTitle: { fontSize: 15, fontWeight: '600' },
  sectionRowHint: { fontSize: 12, lineHeight: 16 },

  countBadge: {
    paddingHorizontal: 7,
    paddingVertical: 1,
    borderRadius: 8,
    minWidth: 20,
    alignItems: 'center',
  },
  countBadgeText: { fontSize: 11, fontWeight: '600' },

  // Icon bubble
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Support
  supportCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  supportText: { flex: 1, fontSize: 13, lineHeight: 18 },

  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalCard: {
    width: '100%',
    maxHeight: '85%',
    borderRadius: 18,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  modalScroll: { maxHeight: 520 },
  modalScrollContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 18, gap: 10 },
  modalSubTitle: { fontSize: 14, fontWeight: '700', marginTop: 8 },
  modalText: { fontSize: 14, lineHeight: 20 },

  modalList: { gap: 8 },
  modalListItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  modalListIcon: { marginTop: 2 },
  modalListText: { flex: 1, fontSize: 14, lineHeight: 20 },

  // Metric bars
  metricBarRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    gap: 8,
  },
  metricBarLabelCol: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 110,
    gap: 5,
  },
  metricBarLabel: { fontSize: 12, flexShrink: 1 },
  metricBarTrackCol: { flex: 1 },
  metricBarTrack: { height: 6, borderRadius: 3, overflow: 'hidden' },
  metricBarFill: { height: '100%', borderRadius: 3 },
  metricBarValueCol: { width: 50, alignItems: 'flex-end' },
  metricBarPct: { fontSize: 12, fontWeight: '600' },
  metricBarDelta: { fontSize: 11 },
  metricBarLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricBarLegendDot: { width: 8, height: 8, borderRadius: 4 },
  metricBarLegendLabel: { fontSize: 11 },

  // Trend rows in modal
  trendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 4,
  },
  trendLabelCol: { width: 100 },
  trendLabel: { fontSize: 13, fontWeight: '600' },
});
