import { useCallback, useMemo, useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient as ExpoLinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import Animated, { FadeIn } from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient as SvgLinearGradient,
  Path,
  Rect,
  Stop,
} from 'react-native-svg';

import { ThemedText } from '@/components/themed-text';
import { MoodCheckInCard } from '@/components/mood-check-in-card';
import { HealthyAiInsights } from '@/components/healthy-ai-insights';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useHealthySync } from '@/hooks/use-healthy-sync';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import { buildHealthyInsight } from '@/lib/healthy-ai-insights';
import type { EnergyLevel, StressLevel } from '@/stores/mood-store';
import { useMoodStore } from '@/stores/mood-store';
import {
  formatSleepDuration,
  type SleepRating,
  useSleepStore,
} from '@/stores/sleep-store';
import { useStepsStore } from '@/stores/steps-store';
import { useWaterStore, WATER_PORTIONS } from '@/stores/water-store';

const STEPS_PANEL_IMAGE = require('@/assets/images/footsteps-8682406.png');

// ===== Design tokens =====

/**
 * Палитра иллюстративных акцентов — одинаковая в обеих темах.
 * Soft-варианты с прозрачностью читаются и на светлом, и на тёмном фоне.
 */
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

/**
 * Динамические нейтральные цвета — берутся из активной темы.
 * Используется во всех «контейнерах» экрана, чтобы обеспечить адаптацию dark/light.
 */
function useHealthColors() {
  const background = useThemeColor({}, 'background');
  const surface = useThemeColor({}, 'surface');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const divider = useThemeColor({}, 'divider');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const accentSoft = useThemeColor({}, 'accentSoft');

  return useMemo(
    () => ({
      background,
      // карточки и поднятые поверхности
      cardBg: surfaceElevated,
      cardBgSubtle: surface,
      trackBg: surfaceMuted,
      divider,
      // текст
      textPrimary: text,
      textSecondary,
      textMuted,
      // бренд
      accent: primary,
      accentSoft,
      onAccent: onPrimary,
    }),
    [
      background,
      surfaceElevated,
      surface,
      surfaceMuted,
      divider,
      text,
      textSecondary,
      textMuted,
      primary,
      onPrimary,
      accentSoft,
    ]
  );
}

type HealthyTab = 'today' | 'insight' | 'settings';

const TABS: { key: HealthyTab; label: string }[] = [
  { key: 'today', label: 'Сегодня' },
  { key: 'insight', label: 'Insight' },
  { key: 'settings', label: 'Настройки' },
];

// ===== Helpers =====

function sleepRatingLabel(rating: SleepRating | null): string {
  if (rating === 'good') return 'Хороший сон';
  if (rating === 'ok') return 'Можно и лучше';
  if (rating === 'poor') return 'Не выспался';
  return 'Оцените сон';
}

function formatLiters(ml: number): string {
  if (ml >= 1000) return `${(ml / 1000).toFixed(1)} л`;
  return `${ml} мл`;
}

// ===== Illustrations (SVG) =====
// Иллюстрации — самодостаточный «арт» со своим внутренним фоном.
// Они одинаково корректно смотрятся в обеих темах и не привязаны к токенам.

const ILLUSTRATION_W = 140;
const ILLUSTRATION_H = 96;

/** Сцена сна: тёмное небо, луна, звёзды, облака */
function SleepIllustration() {
  return (
    <Svg width={ILLUSTRATION_W} height={ILLUSTRATION_H} viewBox="0 0 140 96">
      <Defs>
        <SvgLinearGradient id="sleepBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#2C3A66" />
          <Stop offset="100%" stopColor="#0E1530" />
        </SvgLinearGradient>
      </Defs>
      <Rect width={140} height={96} fill="url(#sleepBg)" />

      {/* stars */}
      <Path
        d="M22 14 L23.4 17.5 L27 18 L24.2 20.4 L25 24.2 L22 22.2 L19 24.2 L19.8 20.4 L17 18 L20.6 17.5 Z"
        fill="#FFE082"
        opacity={0.95}
      />
      <Circle cx={42} cy={32} r={1} fill="#FFE082" opacity={0.7} />
      <Circle cx={56} cy={14} r={1.4} fill="#FFE082" opacity={0.85} />
      <Circle cx={75} cy={26} r={0.9} fill="#FFE082" opacity={0.6} />
      <Circle cx={120} cy={20} r={1.2} fill="#FFE082" opacity={0.7} />

      {/* crescent moon */}
      <Circle cx={108} cy={32} r={15} fill="#FFE082" />
      <Circle cx={114} cy={29} r={13} fill="#1A2347" />

      {/* clouds */}
      <Path
        d="M-6 64 C 6 54, 24 54, 30 64 C 36 58, 50 58, 56 66 L 56 96 L -6 96 Z"
        fill="#1B2447"
      />
      <Path
        d="M40 74 C 50 64, 70 64, 78 74 C 88 68, 104 68, 116 76 C 128 72, 144 74, 146 80 L 146 96 L 40 96 Z"
        fill="#0B1226"
        opacity={0.95}
      />
    </Svg>
  );
}

/**
 * Сцена воды: тёмно-синий фон, капли вокруг, аккуратный «тумблер»-стакан.
 * Уровень воды зависит от progress (0..1) — меняется при добавлении воды.
 */
function WaterIllustration({ progress }: { progress: number }) {
  const p = Math.max(0, Math.min(1, progress));

  // Стакан: вертикальные стенки 56..88 по X, верх y=18, низ скруглённый до y=82
  const glassPath =
    'M56 18 L88 18 L88 74 Q88 82 80 82 L64 82 Q56 82 56 74 Z';

  // Вода: рассчитываем верхнюю кромку, остальное обрезает clipPath по форме стакана
  const yTop = 24; // верхняя граница «полного» стакана (отступ от ободка)
  const yBottom = 82;
  const yWater = yTop + (1 - p) * (yBottom - yTop);

  return (
    <Svg width={ILLUSTRATION_W} height={ILLUSTRATION_H} viewBox="0 0 140 96">
      <Defs>
        <SvgLinearGradient id="waterBg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#1A3A5C" />
          <Stop offset="100%" stopColor="#06121F" />
        </SvgLinearGradient>
        <SvgLinearGradient id="waterFill" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0%" stopColor="#7BD8FF" />
          <Stop offset="100%" stopColor="#1976D2" />
        </SvgLinearGradient>
        <ClipPath id="glassClip">
          <Path d={glassPath} />
        </ClipPath>
      </Defs>
      <Rect width={140} height={96} fill="url(#waterBg)" />

      {/* ambient drops */}
      <Circle cx={20} cy={60} r={3} fill="#4FC3F7" opacity={0.55} />
      <Circle cx={28} cy={78} r={2} fill="#4FC3F7" opacity={0.4} />
      <Circle cx={120} cy={38} r={2} fill="#4FC3F7" opacity={0.45} />
      <Circle cx={128} cy={70} r={2.5} fill="#4FC3F7" opacity={0.55} />

      {/* glass interior subtle tint */}
      <Path d={glassPath} fill="rgba(255,255,255,0.05)" />

      {/* water (clipped to glass shape) */}
      {p > 0.01 && (
        <G clipPath="url(#glassClip)">
          <Rect x={54} y={yWater} width={36} height={40} fill="url(#waterFill)" />
          {/* water surface highlight */}
          <Rect
            x={54}
            y={yWater}
            width={36}
            height={1.5}
            fill="rgba(255,255,255,0.55)"
          />
        </G>
      )}

      {/* glass outline */}
      <Path
        d={glassPath}
        fill="none"
        stroke="rgba(220,240,255,0.78)"
        strokeWidth={1.6}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* rim emphasis */}
      <Path
        d="M56 18 L88 18"
        stroke="rgba(255,255,255,0.9)"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      {/* glass side highlight */}
      <Path
        d="M60 24 L60 60"
        stroke="rgba(255,255,255,0.3)"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
    </Svg>
  );
}

/** Правая панель «Шаги»: оранжевый градиент + растровые следы из assets */
function StepsIllustration() {
  return (
    <ExpoLinearGradient
      colors={['#7A4428', '#2A1308']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.stepsPanelArt}
    >
      <Image
        source={STEPS_PANEL_IMAGE}
        style={styles.stepsPanelImage}
        resizeMode="contain"
      />
    </ExpoLinearGradient>
  );
}

// ===== Top Tabs =====

function TopTabs({
  active,
  onChange,
}: {
  active: HealthyTab;
  onChange: (t: HealthyTab) => void;
}) {
  const colors = useHealthColors();
  return (
    <View style={[styles.tabsBar, { backgroundColor: colors.cardBgSubtle }]}>
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            accessibilityRole="tab"
            accessibilityLabel={t.label}
            accessibilityState={{ selected: isActive }}
            style={[
              styles.tabItem,
              isActive && { backgroundColor: colors.trackBg },
            ]}
            hitSlop={6}
          >
            <ThemedText
              style={[
                styles.tabLabel,
                { color: isActive ? colors.textPrimary : colors.textSecondary },
              ]}
            >
              {t.label}
            </ThemedText>
          </Pressable>
        );
      })}
    </View>
  );
}

// ===== Today: AI Summary =====

function TodayAiSummary({ onPressMore }: { onPressMore: () => void }) {
  const colors = useHealthColors();
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
        period: 'day',
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

  return (
    <View
      style={[styles.card, styles.aiSummaryCard, { backgroundColor: colors.cardBg }]}
    >
      <View style={styles.aiSummaryHeader}>
        <View style={[styles.iconBubble, { backgroundColor: PALETTE.indigoSoft }]}>
          <MaterialIcons name="auto-awesome" size={18} color={PALETTE.indigo} />
        </View>
        <ThemedText
          style={[styles.aiSummaryLabel, { color: colors.textSecondary }]}
        >
          Твоя цель:
        </ThemedText>
      </View>
      <ThemedText
        style={[styles.aiSummaryTitle, { color: colors.textPrimary }]}
        numberOfLines={3}
      >
        {insight.statusLabel}
      </ThemedText>
      <ThemedText
        style={[styles.aiSummaryBody, { color: colors.textSecondary }]}
        numberOfLines={3}
      >
        {insight.summary}
      </ThemedText>
      <Pressable
        onPress={onPressMore}
        accessibilityRole="button"
        accessibilityLabel="Подробнее об AI-инсайте"
        style={[styles.aiSummaryMoreBtn, { backgroundColor: colors.trackBg }]}
        hitSlop={8}
      >
        <ThemedText
          style={[styles.aiSummaryMoreText, { color: colors.textPrimary }]}
        >
          Подробнее
        </ThemedText>
      </Pressable>
    </View>
  );
}

// ===== Today: Mini Cards =====

function MiniCard({
  iconName,
  iconColor,
  iconBg,
  title,
  primaryLine,
  subtitle,
  onPress,
  emptyHint,
}: {
  iconName: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  iconBg: string;
  title: string;
  primaryLine?: string;
  subtitle?: string;
  onPress?: () => void;
  emptyHint?: string;
}) {
  const colors = useHealthColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.miniCard,
        { backgroundColor: colors.cardBg },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
    >
      <View style={[styles.miniCardIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={iconName} size={22} color={iconColor} />
      </View>
      <View style={styles.miniCardBody}>
        <ThemedText style={[styles.miniCardTitle, { color: colors.textPrimary }]}>
          {title}
        </ThemedText>
        {primaryLine ? (
          <ThemedText
            style={[styles.miniCardPrimary, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {primaryLine}
          </ThemedText>
        ) : (
          <ThemedText
            style={[styles.miniCardEmpty, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {emptyHint ?? 'Нет данных'}
          </ThemedText>
        )}
        {subtitle ? (
          <ThemedText
            style={[styles.miniCardSub, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

/**
 * Карточка с иллюстрацией справа (как на дизайне для Сон / Вода / Шаги).
 * Слева — заголовок с маленькой иконкой, крупное значение и подпись.
 * Справа — иллюстрация (SVG или растр), прижатая к правому краю.
 */
function VisualMiniCard({
  iconName,
  iconColor,
  iconBg,
  title,
  primaryLine,
  subtitle,
  onPress,
  emptyHint,
  illustration,
}: {
  iconName: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  iconBg: string;
  title: string;
  primaryLine?: string;
  subtitle?: string;
  onPress?: () => void;
  emptyHint?: string;
  illustration: React.ReactNode;
}) {
  const colors = useHealthColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.visualCard,
        { backgroundColor: colors.cardBg },
        pressed && styles.cardPressed,
      ]}
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={title}
    >
      <View style={styles.visualCardLeft}>
        <View style={styles.visualCardHeader}>
          <View style={[styles.visualCardIcon, { backgroundColor: iconBg }]}>
            <MaterialIcons name={iconName} size={16} color={iconColor} />
          </View>
          <ThemedText
            style={[styles.visualCardTitle, { color: colors.textPrimary }]}
          >
            {title}
          </ThemedText>
        </View>
        {primaryLine ? (
          <ThemedText
            style={[styles.visualCardPrimary, { color: colors.textPrimary }]}
            numberOfLines={1}
          >
            {primaryLine}
          </ThemedText>
        ) : (
          <ThemedText
            style={[styles.visualCardEmpty, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {emptyHint ?? 'Нет данных'}
          </ThemedText>
        )}
        {subtitle ? (
          <ThemedText
            style={[styles.visualCardSub, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <View style={styles.visualCardArt} pointerEvents="none">
        {illustration}
      </View>
    </Pressable>
  );
}

function SleepMiniCard({ onPress }: { onPress: () => void }) {
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const lastNightMinutes = useSleepStore((s) => s.lastNightSleepMinutes);
  const rating = useSleepStore((s) => s.dayRecords[todayKey]?.rating ?? null);

  const primary = lastNightMinutes != null ? formatSleepDuration(lastNightMinutes) : undefined;
  const subtitle = rating ? sleepRatingLabel(rating) : undefined;

  return (
    <VisualMiniCard
      iconName="nightlight-round"
      iconColor={PALETTE.indigo}
      iconBg={PALETTE.indigoSoft}
      title="Сон"
      primaryLine={primary}
      subtitle={subtitle}
      onPress={onPress}
      emptyHint="Укажите сон"
      illustration={<SleepIllustration />}
    />
  );
}

function WaterMiniCard({ onPress }: { onPress: () => void }) {
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const todaySleepRating = useSleepStore((s) => s.dayRecords[todayKey]?.rating ?? null);
  const intakeTodayMl = useWaterStore((s) => s.intakeTodayMl);
  const healthWaterTodayMl = useWaterStore((s) => s.healthWaterTodayMl);
  const getTodayGoalMl = useWaterStore((s) => s.getTodayGoalMl);

  const totalMl = intakeTodayMl + (healthWaterTodayMl ?? 0);
  const goalMl = getTodayGoalMl({ heightCm, weightKg, stepsToday, sleepRating: todaySleepRating });

  const progress = goalMl > 0 ? totalMl / goalMl : 0;
  const primary = `${formatLiters(totalMl)} из ${formatLiters(goalMl)}`;

  return (
    <VisualMiniCard
      iconName="water-drop"
      iconColor={PALETTE.blue}
      iconBg={PALETTE.blueSoft}
      title="Вода"
      primaryLine={totalMl > 0 ? primary : undefined}
      subtitle={totalMl > 0 ? undefined : 'Добавьте воду'}
      onPress={onPress}
      emptyHint="Добавьте воду"
      illustration={<WaterIllustration progress={progress} />}
    />
  );
}

function StepsMiniCard({ onPress }: { onPress: () => void }) {
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps ?? 10000);

  const primary = stepsToday > 0 ? `${stepsToday.toLocaleString('ru-RU')} шагов` : undefined;
  const subtitle =
    stepsToday > 0
      ? `Цель ${stepsGoal.toLocaleString('ru-RU')}`
      : 'Заполните данные';

  return (
    <VisualMiniCard
      iconName="directions-walk"
      iconColor={PALETTE.orange}
      iconBg={PALETTE.orangeSoft}
      title="Шаги"
      primaryLine={primary}
      subtitle={subtitle}
      onPress={onPress}
      emptyHint="Заполните данные"
      illustration={<StepsIllustration />}
    />
  );
}

// ===== Today tab =====

function TodayTabContent({
  onPressMore,
  onOpenSleep,
  onOpenWaterAdd,
  onOpenSteps,
}: {
  onPressMore: () => void;
  onOpenSleep: () => void;
  onOpenWaterAdd: () => void;
  onOpenSteps: () => void;
}) {
  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <TodayAiSummary onPressMore={onPressMore} />
      <SleepMiniCard onPress={onOpenSleep} />
      <WaterMiniCard onPress={onOpenWaterAdd} />
      <StepsMiniCard onPress={onOpenSteps} />
      <MoodCheckInCard />
    </Animated.View>
  );
}

// ===== Insight tab =====

function InsightTabContent() {
  return (
    <Animated.View entering={FadeIn.duration(180)}>
      <HealthyAiInsights />
    </Animated.View>
  );
}

// ===== Settings tab =====

function SettingsRow({
  iconName,
  iconColor,
  iconBg,
  label,
  sublabel,
  onPress,
  isLast,
}: {
  iconName: React.ComponentProps<typeof MaterialIcons>['name'];
  iconColor: string;
  iconBg: string;
  label: string;
  sublabel?: string;
  onPress: () => void;
  isLast?: boolean;
}) {
  const colors = useHealthColors();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && {
          borderBottomWidth: StyleSheet.hairlineWidth,
          borderBottomColor: colors.divider,
        },
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.settingsIconBubble, { backgroundColor: iconBg }]}>
        <MaterialIcons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.settingsTextWrap}>
        <ThemedText style={[styles.settingsLabel, { color: colors.textPrimary }]}>
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText
            style={[styles.settingsSubLabel, { color: colors.textSecondary }]}
          >
            {sublabel}
          </ThemedText>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={colors.textMuted} />
    </Pressable>
  );
}

function WaterNormaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useHealthColors();
  const manualGoalMl = useWaterStore((s) => s.manualGoalMl);
  const setManualGoal = useWaterStore((s) => s.setManualGoal);
  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const todaySleepRating = useSleepStore((s) => s.dayRecords[todayKey]?.rating ?? null);
  const getTodayGoalMl = useWaterStore((s) => s.getTodayGoalMl);
  const autoGoalMl = getTodayGoalMl({ heightCm, weightKg, stepsToday, sleepRating: todaySleepRating });

  const [draft, setDraft] = useState<string>(manualGoalMl != null ? String(manualGoalMl) : '');

  const handleApply = useCallback(() => {
    const trimmed = draft.trim();
    if (!trimmed) {
      setManualGoal(null);
      onClose();
      return;
    }
    const ml = parseInt(trimmed, 10);
    if (!Number.isFinite(ml) || ml <= 0) {
      onClose();
      return;
    }
    setManualGoal(ml);
    onClose();
  }, [draft, setManualGoal, onClose]);

  const handleAuto = useCallback(() => {
    setManualGoal(null);
    setDraft('');
    onClose();
  }, [setManualGoal, onClose]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.cardBg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Норма воды
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.modalBody, { color: colors.textSecondary }]}>
            Авто-расчёт: {formatLiters(autoGoalMl)} (по росту, весу, шагам и сну)
          </ThemedText>
          <ThemedText style={[styles.modalSection, { color: colors.textSecondary }]}>
            Своя цель в мл
          </ThemedText>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="number-pad"
            placeholder="например, 2500"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.modalInput,
              { backgroundColor: colors.trackBg, color: colors.textPrimary },
            ]}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={handleAuto}
              style={({ pressed }) => [
                styles.modalSecondaryBtn,
                { backgroundColor: colors.trackBg },
                pressed && styles.cardPressed,
              ]}
            >
              <ThemedText
                style={[styles.modalSecondaryText, { color: colors.textPrimary }]}
              >
                Авто-расчёт
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [
                styles.modalPrimaryBtn,
                { backgroundColor: colors.accent },
                pressed && styles.cardPressed,
              ]}
            >
              <ThemedText
                style={[styles.modalPrimaryText, { color: colors.onAccent }]}
              >
                Сохранить
              </ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GoalsSummaryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useHealthColors();
  const sleepGoalMin = useSleepStore((s) => s.settings.goalMinutes);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps);
  const manualWaterMl = useWaterStore((s) => s.manualGoalMl);
  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const todaySleepRating = useSleepStore((s) => s.dayRecords[todayKey]?.rating ?? null);
  const getTodayGoalMl = useWaterStore((s) => s.getTodayGoalMl);
  const autoWaterMl = getTodayGoalMl({ heightCm, weightKg, stepsToday, sleepRating: todaySleepRating });

  const waterDisplay = manualWaterMl != null
    ? `${formatLiters(manualWaterMl)} (вручную)`
    : `${formatLiters(autoWaterMl)} (авто)`;

  const dividerStyle = {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.divider,
  } as const;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.cardBg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Текущие цели
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={[styles.goalRow, dividerStyle]}>
            <ThemedText style={[styles.goalLabel, { color: colors.textSecondary }]}>Сон</ThemedText>
            <ThemedText style={[styles.goalValue, { color: colors.textPrimary }]}>
              {Math.floor(sleepGoalMin / 60)}ч{sleepGoalMin % 60 ? ` ${sleepGoalMin % 60}м` : ''}
            </ThemedText>
          </View>
          <View style={[styles.goalRow, dividerStyle]}>
            <ThemedText style={[styles.goalLabel, { color: colors.textSecondary }]}>Вода</ThemedText>
            <ThemedText style={[styles.goalValue, { color: colors.textPrimary }]}>
              {waterDisplay}
            </ThemedText>
          </View>
          <View style={[styles.goalRow, dividerStyle]}>
            <ThemedText style={[styles.goalLabel, { color: colors.textSecondary }]}>Шаги</ThemedText>
            <ThemedText style={[styles.goalValue, { color: colors.textPrimary }]}>
              {stepsGoal != null ? stepsGoal.toLocaleString('ru-RU') : '—'}
            </ThemedText>
          </View>
          <ThemedText
            style={[styles.modalBody, { color: colors.textMuted, marginTop: Spacing.md }]}
          >
            Изменить цели можно в разделах «Сон», «Вода» и «Шаги».
          </ThemedText>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function SettingsTabContent({
  onOpenSleep,
  onOpenSteps,
  onOpenNotifications,
  onOpenWaterNorma,
  onOpenGoals,
}: {
  onOpenSleep: () => void;
  onOpenSteps: () => void;
  onOpenNotifications: () => void;
  onOpenWaterNorma: () => void;
  onOpenGoals: () => void;
}) {
  const colors = useHealthColors();
  return (
    <Animated.View
      entering={FadeIn.duration(180)}
      style={[styles.settingsList, { backgroundColor: colors.cardBg }]}
    >
      <SettingsRow
        iconName="nightlight-round"
        iconColor={PALETTE.indigo}
        iconBg={PALETTE.indigoSoft}
        label="Сон"
        sublabel="Режим сна"
        onPress={onOpenSleep}
      />
      <SettingsRow
        iconName="water-drop"
        iconColor={PALETTE.blue}
        iconBg={PALETTE.blueSoft}
        label="Вода"
        sublabel="Норма воды"
        onPress={onOpenWaterNorma}
      />
      <SettingsRow
        iconName="directions-walk"
        iconColor={PALETTE.pink}
        iconBg={PALETTE.pinkSoft}
        label="Шаги"
        sublabel="Цель шагов"
        onPress={onOpenSteps}
      />
      <SettingsRow
        iconName="notifications"
        iconColor={PALETTE.yellow}
        iconBg={PALETTE.yellowSoft}
        label="Уведомления"
        onPress={onOpenNotifications}
      />
      <SettingsRow
        iconName="emoji-events"
        iconColor={colors.accent}
        iconBg={colors.accentSoft}
        label="Цели"
        onPress={onOpenGoals}
      />
      <SettingsRow
        iconName="straighten"
        iconColor={PALETTE.green}
        iconBg={PALETTE.greenSoft}
        label="Рост и вес"
        onPress={onOpenSteps}
        isLast
      />
    </Animated.View>
  );
}

// ===== Water portion modal (quick add from Today) =====

function WaterAddModal({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const colors = useHealthColors();
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const addWater = useWaterStore((s) => s.addWater);

  const handleAdd = useCallback(
    (ml: number) => {
      addWater(ml, todayKey);
      onClose();
    },
    [addWater, todayKey, onClose]
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[styles.modalCard, { backgroundColor: colors.cardBg }]}
          onPress={(e) => e.stopPropagation()}
        >
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
              Добавить воду
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={colors.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.portionGrid}>
            {WATER_PORTIONS.map((ml) => (
              <Pressable
                key={ml}
                onPress={() => handleAdd(ml)}
                accessibilityRole="button"
                accessibilityLabel={`Добавить ${ml >= 1000 ? `${ml / 1000} литра` : `${ml} миллилитров`}`}
                style={({ pressed }) => [
                  styles.portionBtn,
                  { backgroundColor: colors.trackBg },
                  pressed && styles.cardPressed,
                ]}
              >
                <ThemedText style={[styles.portionText, { color: colors.textPrimary }]}>
                  {ml >= 1000 ? `${ml / 1000} л` : `${ml} мл`}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ===== Main screen =====

export default function ClientHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const colors = useHealthColors();
  const [tab, setTab] = useState<HealthyTab>('today');
  const [waterAddVisible, setWaterAddVisible] = useState(false);
  const [waterNormaVisible, setWaterNormaVisible] = useState(false);
  const [goalsVisible, setGoalsVisible] = useState(false);

  useHealthySync();

  const goToSleep = useCallback(() => router.push('/client/sleep-screen'), [router]);
  const goToSteps = useCallback(() => router.push('/steps'), [router]);
  const goToNotifications = useCallback(
    () => router.push('/notification-settings'),
    [router]
  );

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: colors.background, paddingTop: insets.top },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="chevron-left" size={26} color={colors.textPrimary} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: colors.textPrimary }]}>
          Healthy
        </ThemedText>
        <View style={styles.headerSide} />
      </View>

      <View style={styles.tabsBarWrap}>
        <TopTabs active={tab} onChange={setTab} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + Spacing.huge },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {tab === 'today' && (
          <TodayTabContent
            onPressMore={() => setTab('insight')}
            onOpenSleep={goToSleep}
            onOpenWaterAdd={() => setWaterAddVisible(true)}
            onOpenSteps={goToSteps}
          />
        )}
        {tab === 'insight' && <InsightTabContent />}
        {tab === 'settings' && (
          <SettingsTabContent
            onOpenSleep={goToSleep}
            onOpenSteps={goToSteps}
            onOpenNotifications={goToNotifications}
            onOpenWaterNorma={() => setWaterNormaVisible(true)}
            onOpenGoals={() => setGoalsVisible(true)}
          />
        )}
      </ScrollView>

      <WaterAddModal visible={waterAddVisible} onClose={() => setWaterAddVisible(false)} />
      <WaterNormaModal visible={waterNormaVisible} onClose={() => setWaterNormaVisible(false)} />
      <GoalsSummaryModal visible={goalsVisible} onClose={() => setGoalsVisible(false)} />
    </View>
  );
}

// ===== Styles =====
// Структурные стили (размеры/радиусы/отступы) — без цветов.
// Цвета подставляются inline в JSX через useHealthColors().

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: 4,
    paddingBottom: 4,
    minHeight: 44,
  },
  backButton: {
    width: 44,
    height: 44,
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  headerSide: { width: 44, height: 44 },
  headerTitle: {
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Tabs
  tabsBarWrap: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs + 2,
  },
  tabsBar: {
    flexDirection: 'row',
    borderRadius: Radius.lg - 2,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: Radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Generic card
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardPressed: { opacity: 0.85 },

  // AI summary
  aiSummaryCard: {
    paddingVertical: Spacing.lg,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
    marginBottom: 6,
  },
  aiSummaryLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  aiSummaryTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 22,
    marginBottom: 4,
  },
  aiSummaryBody: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.sm + 2,
  },
  aiSummaryMoreBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md - 2,
  },
  aiSummaryMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Mini card
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: Radius.lg,
    padding: Spacing.md + 2,
    marginBottom: Spacing.md,
    gap: Spacing.md + 2,
  },
  miniCardIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  miniCardBody: {
    flex: 1,
    gap: 2,
  },
  miniCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  miniCardPrimary: {
    fontSize: 17,
    fontWeight: '700',
  },
  miniCardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  miniCardEmpty: {
    fontSize: 14,
    fontStyle: 'italic',
  },
  iconBubble: {
    width: 30,
    height: 30,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Visual mini card (with right-side illustration)
  visualCard: {
    borderRadius: 18,
    marginBottom: Spacing.md,
    height: ILLUSTRATION_H,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  visualCardLeft: {
    flex: 1,
    paddingVertical: Spacing.sm + 2,
    paddingHorizontal: Spacing.lg,
    justifyContent: 'center',
    gap: 3,
  },
  visualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 2,
  },
  visualCardIcon: {
    width: 26,
    height: 26,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  visualCardTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  visualCardPrimary: {
    fontSize: 19,
    fontWeight: '700',
    lineHeight: 24,
  },
  visualCardEmpty: {
    fontSize: 15,
    fontStyle: 'italic',
  },
  visualCardSub: {
    fontSize: 13,
    lineHeight: 18,
  },
  visualCardArt: {
    width: ILLUSTRATION_W,
    height: ILLUSTRATION_H,
    overflow: 'hidden',
  },
  stepsPanelArt: {
    width: ILLUSTRATION_W,
    height: ILLUSTRATION_H,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  stepsPanelImage: {
    width: ILLUSTRATION_W * 0.78,
    height: ILLUSTRATION_H * 0.78,
  },

  // Settings list
  settingsList: {
    borderRadius: Radius.lg,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.md + 2,
    gap: Spacing.md + 2,
  },
  settingsIconBubble: {
    width: 32,
    height: 32,
    borderRadius: Radius.md - 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsTextWrap: { flex: 1, gap: 2 },
  settingsLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  settingsSubLabel: {
    fontSize: 13,
  },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  modalCard: {
    width: '100%',
    borderRadius: 18,
    padding: Spacing.xl - 4,
    gap: Spacing.sm,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
  },
  modalSection: {
    fontSize: 13,
    marginTop: Spacing.sm,
  },
  modalInput: {
    borderRadius: Radius.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md + 2,
    fontSize: 15,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: Spacing.sm + 2,
    marginTop: Spacing.md + 2,
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: Spacing.md,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  goalLabel: {
    fontSize: 14,
  },
  goalValue: {
    fontSize: 15,
    fontWeight: '600',
  },

  // Water portion grid
  portionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm + 2,
    marginTop: 4,
  },
  portionBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.md,
    alignItems: 'center',
  },
  portionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
