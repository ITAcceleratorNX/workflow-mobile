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
import { HealthyAiInsights } from '@/components/healthy-ai-insights';
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

const COLORS = {
  background: '#1A1A1A',
  cardBg: '#2A2A2A',
  cardBgSubtle: '#242424',
  trackBg: '#3A3A3A',
  divider: 'rgba(255,255,255,0.06)',

  textPrimary: '#FFFFFF',
  textSecondary: '#A0A0A5',
  textMuted: '#6E6E73',

  accent: '#F35713',
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
};

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
  return (
    <View style={styles.tabsBar}>
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <Pressable
            key={t.key}
            onPress={() => onChange(t.key)}
            style={[styles.tabItem, isActive && styles.tabItemActive]}
            hitSlop={6}
          >
            <ThemedText
              style={[
                styles.tabLabel,
                { color: isActive ? COLORS.textPrimary : COLORS.textSecondary },
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
    <View style={[styles.card, styles.aiSummaryCard]}>
      <View style={styles.aiSummaryHeader}>
        <View style={[styles.iconBubble, { backgroundColor: COLORS.indigoSoft }]}>
          <MaterialIcons name="auto-awesome" size={18} color={COLORS.indigo} />
        </View>
        <ThemedText style={[styles.aiSummaryLabel, { color: COLORS.textSecondary }]}>
          Твоя цель:
        </ThemedText>
      </View>
      <ThemedText style={[styles.aiSummaryTitle, { color: COLORS.textPrimary }]} numberOfLines={3}>
        {insight.statusLabel}
      </ThemedText>
      <ThemedText style={[styles.aiSummaryBody, { color: COLORS.textSecondary }]} numberOfLines={3}>
        {insight.summary}
      </ThemedText>
      <Pressable onPress={onPressMore} style={styles.aiSummaryMoreBtn} hitSlop={8}>
        <ThemedText style={[styles.aiSummaryMoreText, { color: COLORS.textPrimary }]}>
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
  return (
    <Pressable
      style={({ pressed }) => [styles.miniCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={[styles.miniCardIcon, { backgroundColor: iconBg }]}>
        <MaterialIcons name={iconName} size={22} color={iconColor} />
      </View>
      <View style={styles.miniCardBody}>
        <ThemedText style={[styles.miniCardTitle, { color: COLORS.textPrimary }]}>
          {title}
        </ThemedText>
        {primaryLine ? (
          <ThemedText style={[styles.miniCardPrimary, { color: COLORS.textPrimary }]} numberOfLines={1}>
            {primaryLine}
          </ThemedText>
        ) : (
          <ThemedText style={[styles.miniCardEmpty, { color: COLORS.textSecondary }]} numberOfLines={1}>
            {emptyHint ?? 'Нет данных'}
          </ThemedText>
        )}
        {subtitle ? (
          <ThemedText style={[styles.miniCardSub, { color: COLORS.textSecondary }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={COLORS.textMuted} />
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
  return (
    <Pressable
      style={({ pressed }) => [styles.visualCard, pressed && styles.cardPressed]}
      onPress={onPress}
    >
      <View style={styles.visualCardLeft}>
        <View style={styles.visualCardHeader}>
          <View style={[styles.visualCardIcon, { backgroundColor: iconBg }]}>
            <MaterialIcons name={iconName} size={16} color={iconColor} />
          </View>
          <ThemedText style={[styles.visualCardTitle, { color: COLORS.textPrimary }]}>
            {title}
          </ThemedText>
        </View>
        {primaryLine ? (
          <ThemedText
            style={[styles.visualCardPrimary, { color: COLORS.textPrimary }]}
            numberOfLines={1}
          >
            {primaryLine}
          </ThemedText>
        ) : (
          <ThemedText
            style={[styles.visualCardEmpty, { color: COLORS.textSecondary }]}
            numberOfLines={1}
          >
            {emptyHint ?? 'Нет данных'}
          </ThemedText>
        )}
        {subtitle ? (
          <ThemedText
            style={[styles.visualCardSub, { color: COLORS.textSecondary }]}
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
      iconColor={COLORS.indigo}
      iconBg={COLORS.indigoSoft}
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
      iconColor={COLORS.blue}
      iconBg={COLORS.blueSoft}
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
      iconColor={COLORS.orange}
      iconBg={COLORS.orangeSoft}
      title="Шаги"
      primaryLine={primary}
      subtitle={subtitle}
      onPress={onPress}
      emptyHint="Заполните данные"
      illustration={<StepsIllustration />}
    />
  );
}

// ===== Today: Mood quick check-in =====

/** Минималистичные круглые «смайлы» как на макете: жёлто-оранжевые → красно-оранжевые */
type MoodFaceVariant = 'happy' | 'neutral' | 'sad' | 'verySad';

const MOOD_FACE_FILL_WARM = '#FFCC80';
const MOOD_FACE_FILL_SAD = '#FF8A65';
const MOOD_FACE_STROKE = '#3E2723';
const MOOD_FACE_LINE = '#1A1A1A';

const QUICK_MOODS: { value: number; variant: MoodFaceVariant }[] = [
  { value: 85, variant: 'happy' },
  { value: 60, variant: 'neutral' },
  { value: 35, variant: 'sad' },
  { value: 15, variant: 'verySad' },
];

function MoodFaceIcon({ variant }: { variant: MoodFaceVariant }) {
  const warm = variant === 'happy' || variant === 'neutral';
  const fill = warm ? MOOD_FACE_FILL_WARM : MOOD_FACE_FILL_SAD;

  const mouth =
    variant === 'happy' ? (
      <Path
        d="M 13 23 Q 20 30 27 23"
        stroke={MOOD_FACE_LINE}
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
      />
    ) : variant === 'neutral' ? (
      <Path
        d="M 13 24 L 27 24"
        stroke={MOOD_FACE_LINE}
        strokeWidth={1.7}
        strokeLinecap="round"
      />
    ) : variant === 'sad' ? (
      <Path
        d="M 13 25 Q 20 21 27 25"
        stroke={MOOD_FACE_LINE}
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
      />
    ) : (
      <Path
        d="M 13 26 Q 20 17 27 26"
        stroke={MOOD_FACE_LINE}
        strokeWidth={1.7}
        fill="none"
        strokeLinecap="round"
      />
    );

  return (
    <Svg width={36} height={36} viewBox="0 0 40 40">
      <Circle
        cx={20}
        cy={20}
        r={16}
        fill={fill}
        stroke={MOOD_FACE_STROKE}
        strokeWidth={1.15}
      />
      <Circle cx={14} cy={16} r={1.85} fill={MOOD_FACE_LINE} />
      <Circle cx={26} cy={16} r={1.85} fill={MOOD_FACE_LINE} />
      {mouth}
    </Svg>
  );
}

function MoodMiniCard() {
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const moodToday = useMoodStore((s) => s.records[todayKey] ?? null);
  const setMood = useMoodStore((s) => s.setMood);

  const handleSelect = useCallback(
    (value: number) => {
      setMood(todayKey, {
        moodValue: value,
        energy: moodToday?.energy ?? 'medium',
        stress: moodToday?.stress ?? 'medium',
      });
    },
    [setMood, todayKey, moodToday?.energy, moodToday?.stress]
  );

  return (
    <View style={styles.miniCardTall}>
      <View style={styles.miniCardTallHeader}>
        <View style={[styles.miniCardIcon, { backgroundColor: COLORS.greenSoft }]}>
          <MaterialIcons name="mood" size={22} color={COLORS.green} />
        </View>
        <View style={styles.miniCardTallTitleBlock}>
          <ThemedText style={[styles.miniCardTitle, { color: COLORS.textPrimary }]}>
            Настроение
          </ThemedText>
          <ThemedText style={[styles.miniCardSub, { color: COLORS.textSecondary }]}>
            {moodToday ? 'Как ты себя чувствуешь?' : 'Отметьте настроение'}
          </ThemedText>
        </View>
      </View>
      <View style={styles.moodRow}>
        {QUICK_MOODS.map((m) => {
          const isSelected =
            moodToday != null && Math.abs(moodToday.moodValue - m.value) < 13;
          return (
            <Pressable
              key={m.value}
              onPress={() => handleSelect(m.value)}
              style={[
                styles.moodPill,
                isSelected && styles.moodPillActive,
              ]}
            >
              <MoodFaceIcon variant={m.variant} />
            </Pressable>
          );
        })}
      </View>
    </View>
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
      <MoodMiniCard />
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
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.settingsRow,
        !isLast && styles.settingsRowDivider,
        pressed && styles.cardPressed,
      ]}
    >
      <View style={[styles.settingsIconBubble, { backgroundColor: iconBg }]}>
        <MaterialIcons name={iconName} size={20} color={iconColor} />
      </View>
      <View style={styles.settingsTextWrap}>
        <ThemedText style={[styles.settingsLabel, { color: COLORS.textPrimary }]}>
          {label}
        </ThemedText>
        {sublabel ? (
          <ThemedText style={[styles.settingsSubLabel, { color: COLORS.textSecondary }]}>
            {sublabel}
          </ThemedText>
        ) : null}
      </View>
      <MaterialIcons name="chevron-right" size={22} color={COLORS.textMuted} />
    </Pressable>
  );
}

function WaterNormaModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: COLORS.textPrimary }]}>
              Норма воды
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <ThemedText style={[styles.modalBody, { color: COLORS.textSecondary }]}>
            Авто-расчёт: {formatLiters(autoGoalMl)} (по росту, весу, шагам и сну)
          </ThemedText>
          <ThemedText style={[styles.modalSection, { color: COLORS.textSecondary }]}>
            Своя цель в мл
          </ThemedText>
          <TextInput
            value={draft}
            onChangeText={setDraft}
            keyboardType="number-pad"
            placeholder="например, 2500"
            placeholderTextColor={COLORS.textMuted}
            style={styles.modalInput}
          />
          <View style={styles.modalActions}>
            <Pressable
              onPress={handleAuto}
              style={({ pressed }) => [styles.modalSecondaryBtn, pressed && styles.cardPressed]}
            >
              <ThemedText style={[styles.modalSecondaryText, { color: COLORS.textPrimary }]}>
                Авто-расчёт
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={handleApply}
              style={({ pressed }) => [styles.modalPrimaryBtn, pressed && styles.cardPressed]}
            >
              <ThemedText style={styles.modalPrimaryText}>Сохранить</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function GoalsSummaryModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
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

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: COLORS.textPrimary }]}>
              Текущие цели
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.goalRow}>
            <ThemedText style={[styles.goalLabel, { color: COLORS.textSecondary }]}>Сон</ThemedText>
            <ThemedText style={[styles.goalValue, { color: COLORS.textPrimary }]}>
              {Math.floor(sleepGoalMin / 60)}ч{sleepGoalMin % 60 ? ` ${sleepGoalMin % 60}м` : ''}
            </ThemedText>
          </View>
          <View style={styles.goalRow}>
            <ThemedText style={[styles.goalLabel, { color: COLORS.textSecondary }]}>Вода</ThemedText>
            <ThemedText style={[styles.goalValue, { color: COLORS.textPrimary }]}>
              {waterDisplay}
            </ThemedText>
          </View>
          <View style={styles.goalRow}>
            <ThemedText style={[styles.goalLabel, { color: COLORS.textSecondary }]}>Шаги</ThemedText>
            <ThemedText style={[styles.goalValue, { color: COLORS.textPrimary }]}>
              {stepsGoal != null ? stepsGoal.toLocaleString('ru-RU') : '—'}
            </ThemedText>
          </View>
          <ThemedText style={[styles.modalBody, { color: COLORS.textMuted, marginTop: 12 }]}>
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
  return (
    <Animated.View entering={FadeIn.duration(180)} style={styles.settingsList}>
      <SettingsRow
        iconName="nightlight-round"
        iconColor={COLORS.indigo}
        iconBg={COLORS.indigoSoft}
        label="Сон"
        sublabel="Режим сна"
        onPress={onOpenSleep}
      />
      <SettingsRow
        iconName="water-drop"
        iconColor={COLORS.blue}
        iconBg={COLORS.blueSoft}
        label="Вода"
        sublabel="Норма воды"
        onPress={onOpenWaterNorma}
      />
      <SettingsRow
        iconName="directions-walk"
        iconColor={COLORS.pink}
        iconBg={COLORS.pinkSoft}
        label="Шаги"
        sublabel="Цель шагов"
        onPress={onOpenSteps}
      />
      <SettingsRow
        iconName="notifications"
        iconColor={COLORS.yellow}
        iconBg={COLORS.yellowSoft}
        label="Уведомления"
        onPress={onOpenNotifications}
      />
      <SettingsRow
        iconName="emoji-events"
        iconColor={COLORS.accent}
        iconBg="rgba(243, 87, 19, 0.18)"
        label="Цели"
        onPress={onOpenGoals}
      />
      <SettingsRow
        iconName="straighten"
        iconColor={COLORS.green}
        iconBg={COLORS.greenSoft}
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
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.modalHeader}>
            <ThemedText style={[styles.modalTitle, { color: COLORS.textPrimary }]}>
              Добавить воду
            </ThemedText>
            <Pressable onPress={onClose} hitSlop={12}>
              <MaterialIcons name="close" size={22} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          <View style={styles.portionGrid}>
            {WATER_PORTIONS.map((ml) => (
              <Pressable
                key={ml}
                onPress={() => handleAdd(ml)}
                style={({ pressed }) => [
                  styles.portionBtn,
                  pressed && styles.cardPressed,
                ]}
              >
                <ThemedText style={[styles.portionText, { color: COLORS.textPrimary }]}>
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
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="chevron-left" size={26} color={COLORS.textPrimary} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: COLORS.textPrimary }]}>
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
          { paddingBottom: insets.bottom + 28 },
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.background },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16 },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
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
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 6,
  },
  tabsBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.cardBgSubtle,
    borderRadius: 14,
    padding: 4,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabItemActive: {
    backgroundColor: COLORS.trackBg,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '600',
  },

  // Generic card
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  cardPressed: { opacity: 0.85 },

  // AI summary
  aiSummaryCard: {
    paddingVertical: 16,
  },
  aiSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
    marginBottom: 10,
  },
  aiSummaryMoreBtn: {
    alignSelf: 'flex-end',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: COLORS.trackBg,
  },
  aiSummaryMoreText: {
    fontSize: 13,
    fontWeight: '600',
  },

  // Mini card
  miniCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    gap: 14,
  },
  miniCardIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
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
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    marginBottom: 12,
    height: ILLUSTRATION_H,
    overflow: 'hidden',
    flexDirection: 'row',
    alignItems: 'stretch',
  },
  visualCardLeft: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    justifyContent: 'center',
    gap: 3,
  },
  visualCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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

  // Mood quick check-in
  miniCardTall: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
  },
  miniCardTallHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginBottom: 14,
  },
  miniCardTallTitleBlock: {
    flex: 1,
    gap: 2,
  },
  moodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  moodPill: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: COLORS.trackBg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  moodPillActive: {
    backgroundColor: 'rgba(255, 204, 128, 0.22)',
    borderWidth: 1,
    borderColor: MOOD_FACE_FILL_WARM,
  },

  // Settings list
  settingsList: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 14,
  },
  settingsRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
  },
  settingsIconBubble: {
    width: 32,
    height: 32,
    borderRadius: 10,
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
    padding: 24,
  },
  modalCard: {
    width: '100%',
    backgroundColor: COLORS.cardBg,
    borderRadius: 18,
    padding: 20,
    gap: 8,
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
    marginTop: 8,
  },
  modalInput: {
    backgroundColor: COLORS.trackBg,
    color: COLORS.textPrimary,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    marginTop: 4,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  modalSecondaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.trackBg,
    alignItems: 'center',
  },
  modalSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
  },
  modalPrimaryBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
  },
  modalPrimaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  goalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.divider,
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
    gap: 10,
    marginTop: 4,
  },
  portionBtn: {
    flexBasis: '30%',
    flexGrow: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: COLORS.trackBg,
    alignItems: 'center',
  },
  portionText: {
    fontSize: 15,
    fontWeight: '600',
  },
});
