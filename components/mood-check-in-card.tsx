import { useEffect, useCallback, useRef, useState, useMemo } from 'react';
import {
  LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Ellipse, Line, Path } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import type { EnergyLevel, StressLevel } from '@/stores/mood-store';
import { useMoodStore } from '@/stores/mood-store';
import { useThemeColor } from '@/hooks/use-theme-color';

import { formatDateForApi } from '@/lib/dateTimeUtils';

const CARD_PADDING = 20;

type MoodPalette = {
  cardBg: string;
  trackBg: string;
  badgeBg: string;
  recommendationTint: string;
  accent: string;
  textPrimary: string;
  textMuted: string;
  onPrimary: string;
  moodLow: string;
  moodMid: string;
  moodHigh: string;
  stressHigh: string;
  faceBg: string;
  faceInk: string;
};

function useMoodCheckInPalette(): MoodPalette {
  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const success = useThemeColor({}, 'success');
  const danger = useThemeColor({}, 'danger');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const surfaceMuted = useThemeColor({ dark: '#3A3A3C' }, 'surfaceMuted');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const faceBg = useThemeColor({ light: '#E5E5EA', dark: '#424244' }, 'surfaceMuted');
  const faceInk = useThemeColor({}, 'text');

  return useMemo(
    () => ({
      cardBg: surfaceElevated,
      trackBg: surfaceMuted,
      badgeBg: cardBackground,
      recommendationTint: surfaceMuted,
      accent: primary,
      textPrimary: text,
      textMuted,
      onPrimary,
      moodLow: textMuted,
      moodMid: primary,
      moodHigh: success,
      stressHigh: danger,
      faceBg,
      faceInk,
    }),
    [
      surfaceElevated,
      surfaceMuted,
      cardBackground,
      primary,
      text,
      textMuted,
      onPrimary,
      success,
      danger,
      faceBg,
      faceInk,
    ]
  );
}

function getMoodLabel(value: number): string {
  if (value < 33) return 'Плохо';
  if (value < 67) return 'Нормально';
  return 'Отлично!';
}

function getMoodColor(value: number, p: MoodPalette): string {
  if (value < 33) return p.moodLow;
  if (value < 67) return p.moodMid;
  return p.moodHigh;
}

function getRecommendation(
  moodValue: number,
  energy: EnergyLevel,
  stress: StressLevel
): { text: string; emoji: string } {
  if (moodValue < 30 && energy === 'low' && stress === 'high') {
    return {
      text: 'Сегодня лучше отдохнуть. Короткая прогулка или расслабляющее занятие помогут. Помните: отдых — это нормально.',
      emoji: '🌿',
    };
  }
  if (moodValue > 70 && energy === 'high' && stress === 'low') {
    return {
      text: 'Вы в отличной форме! Идеальный день для сложных задач или активного отдыха.',
      emoji: '✨',
    };
  }
  if (stress === 'high') {
    return {
      text: 'Высокий уровень стресса. Попробуйте 10 минут глубокого дыхания или медитации. Вы справитесь!',
      emoji: '🧘',
    };
  }
  if (energy === 'low') {
    return {
      text: 'Мало энергии? Короткий сон или полезный перекус могут помочь. Пейте воду и делайте перерывы.',
      emoji: '☕',
    };
  }
  return {
    text: 'Всё идёт хорошо! Поддерживайте баланс: регулярные перерывы и забота о себе.',
    emoji: '💚',
  };
}

// --- Animated Face (SVG) ---
function MoodFace({
  value,
  faceBg,
  faceInk,
  accent,
}: {
  value: number;
  faceBg: string;
  faceInk: string;
  accent: string;
}) {
  const baseY = 75 - (value / 100) * 10;
  const curvature = (value - 50) * 0.2;
  const mouthPath = `M 30 ${baseY - curvature * 0.5} Q 50 ${baseY + curvature} 70 ${baseY - curvature * 0.5}`;
  const cheekOpacity = Math.max(0, (value - 70) / 30);

  return (
    <Svg viewBox="0 0 100 100" width={120} height={120}>
      <Circle cx="50" cy="50" r="45" fill={faceBg} />
      <Line x1="28" y1="25" x2="38" y2="25" stroke={faceInk} strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="62" y1="25" x2="72" y2="25" stroke={faceInk} strokeWidth="2.5" strokeLinecap="round" />
      <Ellipse cx="33" cy="40" rx="5" ry="5" fill={faceInk} />
      <Ellipse cx="67" cy="40" rx="5" ry="5" fill={faceInk} />
      <Circle cx="20" cy="55" r="6" fill={accent} opacity={cheekOpacity} />
      <Circle cx="80" cy="55" r="6" fill={accent} opacity={cheekOpacity} />
      <Path d={mouthPath} stroke={faceInk} strokeWidth="3" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// --- Energy Icon with animated fill bar ---
const ENERGY_HEIGHTS: Record<EnergyLevel, number> = {
  low: 0.33,
  medium: 0.66,
  high: 1,
};

function EnergyIconCircle({
  energy,
  trackBg,
  iconColor,
  energyColors,
}: {
  energy: EnergyLevel;
  trackBg: string;
  iconColor: string;
  energyColors: Record<EnergyLevel, string>;
}) {
  const heightPercent = useSharedValue(ENERGY_HEIGHTS[energy]);

  useEffect(() => {
    heightPercent.value = withTiming(ENERGY_HEIGHTS[energy], {
      duration: 500,
      easing: Easing.out(Easing.ease),
    });
  }, [energy, heightPercent]);

  const ICON_SIZE = 96;
  const animatedBarStyle = useAnimatedStyle(() => ({
    height: heightPercent.value * ICON_SIZE,
  }));

  return (
    <View style={[styles.iconCircle, { backgroundColor: trackBg, overflow: 'hidden' }]}>
      <Animated.View
        style={[
          styles.energyBar,
          { backgroundColor: energyColors[energy] },
          animatedBarStyle,
        ]}
      />
      <View style={[StyleSheet.absoluteFill, styles.iconOverlay]} pointerEvents="none">
        <MaterialIcons name="bolt" size={40} color={iconColor} />
      </View>
    </View>
  );
}

// --- Stress Icon with animated pulsing rings ---
const STRESS_INTENSITY: Record<StressLevel, number> = {
  low: 1,
  medium: 2,
  high: 3,
};

function StressRing({ delay, color }: { delay: number; color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.5);

  useEffect(() => {
    scale.value = withDelay(
      delay,
      withRepeat(
        withTiming(1.5, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
    opacity.value = withDelay(
      delay,
      withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      )
    );
  }, [delay, color, scale, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.stressRing,
        { borderColor: color },
        animatedStyle,
      ]}
    />
  );
}

function StressIconCircle({
  stress,
  trackBg,
  iconColor,
  stressColors,
}: {
  stress: StressLevel;
  trackBg: string;
  iconColor: string;
  stressColors: Record<StressLevel, string>;
}) {
  const intensity = STRESS_INTENSITY[stress];
  const color = stressColors[stress];

  return (
    <View style={styles.stressIconWrapper}>
      <View style={[styles.stressCircleInner, { backgroundColor: trackBg }]} />
      <View style={styles.stressRingsContainer}>
        {[...Array(intensity)].map((_, i) => (
          <View key={`${stress}-${i}`} style={styles.stressRingWrapper}>
            <StressRing delay={i * 500} color={color} />
          </View>
        ))}
      </View>
      <View style={[styles.stressCircleInner, styles.stressIconOverlay]} pointerEvents="none">
        <MaterialIcons name="psychology" size={40} color={iconColor} />
      </View>
    </View>
  );
}

// --- Simple Slider ---
function SimpleSlider({
  value,
  onValueChange,
  max = 100,
  trackColor,
  fillColor,
  thumbColor,
}: {
  value: number;
  onValueChange: (v: number) => void;
  max?: number;
  trackColor: string;
  fillColor: string;
  thumbColor: string;
}) {
  const trackRef = useRef<View>(null);

  const onLayout = useCallback((_e: LayoutChangeEvent) => {
    trackRef.current?.measureInWindow(() => {});
  }, []);

  const updateFromPageX = useCallback(
    (pageX: number) => {
      if (!trackRef.current) return;
      trackRef.current.measureInWindow((x, _y, w) => {
        const posInTrack = pageX - x;
        const ratio = Math.max(0, Math.min(1, posInTrack / w));
        onValueChange(Math.round(ratio * max));
      });
    },
    [max, onValueChange]
  );

  const panGesture = Gesture.Pan()
    .activeOffsetX([-5, 5])
    .failOffsetY([-25, 25])
    .onStart((e) => {
      'worklet';
      runOnJS(updateFromPageX)(e.absoluteX);
    })
    .onUpdate((e) => {
      'worklet';
      runOnJS(updateFromPageX)(e.absoluteX);
    });

  const tapGesture = Gesture.Tap()
    .onEnd((e) => {
      'worklet';
      runOnJS(updateFromPageX)(e.absoluteX);
    });

  const composedGesture = Gesture.Race(panGesture, tapGesture);

  const percent = max > 0 ? (value / max) * 100 : 0;

  const thumbHalf = 13;
  const trackH = 22;
  const shellPad = 4;
  const thumbTop = shellPad + (trackH - thumbHalf * 2) / 2;

  return (
    <GestureDetector gesture={composedGesture}>
      <View style={styles.sliderTouchArea}>
        <View style={styles.sliderTrackShell}>
          <View ref={trackRef} style={[styles.sliderTrack, { backgroundColor: trackColor }]} onLayout={onLayout}>
            <View style={[styles.sliderFill, { width: `${percent}%`, backgroundColor: fillColor }]} />
          </View>
          <View
            style={[
              styles.sliderThumb,
              {
                left: `${Math.min(percent, 98)}%`,
                marginLeft: -thumbHalf,
                top: thumbTop,
                backgroundColor: thumbColor,
              },
            ]}
            pointerEvents="none"
          />
        </View>
      </View>
    </GestureDetector>
  );
}

export function MoodCheckInCard() {
  const p = useMoodCheckInPalette();
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [moodValue, setMoodValue] = useState(50);
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [stress, setStress] = useState<StressLevel>('medium');

  const setMood = useMoodStore((s) => s.setMood);
  const todayKey = formatDateForApi(new Date());

  const energyColors = useMemo<Record<EnergyLevel, string>>(
    () => ({
      low: p.moodLow,
      medium: p.moodMid,
      high: p.moodHigh,
    }),
    [p.moodLow, p.moodMid, p.moodHigh]
  );

  const stressColors = useMemo<Record<StressLevel, string>>(
    () => ({
      low: p.moodHigh,
      medium: p.moodMid,
      high: p.stressHigh,
    }),
    [p.moodHigh, p.moodMid, p.stressHigh]
  );

  const sliderChrome = useMemo(
    () => ({
      track: p.trackBg,
      fill: p.accent,
      thumb: p.textPrimary,
    }),
    [p.trackBg, p.accent, p.textPrimary]
  );

  const energyOptions: Record<EnergyLevel, { label: string }> = {
    low: { label: 'Низкий' },
    medium: { label: 'Средний' },
    high: { label: 'Высокий' },
  };

  const stressOptions: Record<StressLevel, { label: string }> = {
    low: { label: 'Низкий' },
    medium: { label: 'Средний' },
    high: { label: 'Высокий' },
  };

  const recommendation = getRecommendation(moodValue, energy, stress);

  const handleFinish = useCallback(() => {
    setMood(todayKey, {
      moodValue,
      energy,
      stress,
      recommendation: recommendation.text,
    });
    setStep(4);
  }, [moodValue, energy, stress, recommendation.text, setMood, todayKey]);

  return (
    <View style={[styles.card, { backgroundColor: p.cardBg }]}>
      <View style={styles.header}>
        <MaterialIcons name="favorite" size={20} color={p.accent} />
        <ThemedText style={[styles.title, { color: p.textPrimary }]}>
          Проверка настроения
        </ThemedText>
      </View>

      {step === 1 && (
        <>
          <View style={styles.stepMainColumn}>
            <View style={styles.stepVisualArea}>
              <MoodFace value={moodValue} faceBg={p.faceBg} faceInk={p.faceInk} accent={p.accent} />
            </View>
            <View style={styles.stepTextBlock}>
              <ThemedText style={[styles.stepTitle, styles.stepTitleInFace, { color: p.textPrimary }]}>
                Как вы себя чувствуете?
              </ThemedText>
              <ThemedText style={[styles.moodLabel, { color: getMoodColor(moodValue, p) }]}>
                {getMoodLabel(moodValue)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sliderSection}>
            <SimpleSlider
              value={moodValue}
              onValueChange={setMoodValue}
              trackColor={sliderChrome.track}
              fillColor={sliderChrome.fill}
              thumbColor={sliderChrome.thumb}
            />
            <View style={styles.sliderLabels}>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Низко</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Средне</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Высоко</ThemedText>
            </View>
          </View>
          <Pressable style={[styles.primaryBtn, { backgroundColor: p.accent }]} onPress={() => setStep(2)}>
            <ThemedText style={[styles.primaryBtnText, { color: p.onPrimary }]}>Далее</ThemedText>
          </Pressable>
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.stepMainColumn}>
            <View style={styles.stepVisualArea}>
              <EnergyIconCircle
                energy={energy}
                trackBg={p.trackBg}
                iconColor={p.textPrimary}
                energyColors={energyColors}
              />
            </View>
            <View style={styles.stepTextBlock}>
              <ThemedText style={[styles.stepTitle, styles.stepTitleNoExtraMb, { color: p.textPrimary }]}>
                Уровень энергии
              </ThemedText>
              <ThemedText style={[styles.stepSubtitle, styles.stepSubtitleTight, { color: p.textMuted }]}>
                {energyOptions[energy].label}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sliderSection}>
            <SimpleSlider
              value={['low', 'medium', 'high'].indexOf(energy)}
              onValueChange={(v) => setEnergy(['low', 'medium', 'high'][v] as EnergyLevel)}
              max={2}
              trackColor={sliderChrome.track}
              fillColor={sliderChrome.fill}
              thumbColor={sliderChrome.thumb}
            />
            <View style={styles.sliderLabels}>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Низкий</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Средний</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Высокий</ThemedText>
            </View>
          </View>
          <View style={styles.btnRow}>
            <Pressable style={[styles.secondaryBtn, { backgroundColor: p.trackBg }]} onPress={() => setStep(1)}>
              <ThemedText style={[styles.secondaryBtnText, { color: p.textPrimary }]}>Назад</ThemedText>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { backgroundColor: p.accent, flex: 1 }]} onPress={() => setStep(3)}>
              <ThemedText style={[styles.primaryBtnText, { color: p.onPrimary }]}>Далее</ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <View style={styles.stepMainColumn}>
            <View style={styles.stepVisualArea}>
              <StressIconCircle
                stress={stress}
                trackBg={p.trackBg}
                iconColor={p.textPrimary}
                stressColors={stressColors}
              />
            </View>
            <View style={styles.stepTextBlock}>
              <ThemedText style={[styles.stepTitle, styles.stepTitleNoExtraMb, { color: p.textPrimary }]}>
                Уровень стресса
              </ThemedText>
              <ThemedText style={[styles.stepSubtitle, styles.stepSubtitleTight, { color: p.textMuted }]}>
                {stressOptions[stress].label}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sliderSection}>
            <SimpleSlider
              value={['low', 'medium', 'high'].indexOf(stress)}
              onValueChange={(v) => setStress(['low', 'medium', 'high'][v] as StressLevel)}
              max={2}
              trackColor={sliderChrome.track}
              fillColor={sliderChrome.fill}
              thumbColor={sliderChrome.thumb}
            />
            <View style={styles.sliderLabels}>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Низкий</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Средний</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: p.textMuted }]}>Высокий</ThemedText>
            </View>
          </View>
          <View style={styles.btnRow}>
            <Pressable style={[styles.secondaryBtn, { backgroundColor: p.trackBg }]} onPress={() => setStep(2)}>
              <ThemedText style={[styles.secondaryBtnText, { color: p.textPrimary }]}>Назад</ThemedText>
            </Pressable>
            <Pressable style={[styles.primaryBtn, { backgroundColor: p.accent, flex: 1 }]} onPress={handleFinish}>
              <ThemedText style={[styles.primaryBtnText, { color: p.onPrimary }]}>Готово</ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {step === 4 && (
        <>
          <View style={[styles.recommendationBox, { backgroundColor: p.recommendationTint }]}>
            <View style={styles.recommendationRow}>
              <ThemedText style={styles.recommendationEmoji}>{recommendation.emoji}</ThemedText>
              <View style={styles.recommendationText}>
                <ThemedText style={[styles.recommendationTitle, { color: p.textPrimary }]}>
                  Совет на день
                </ThemedText>
                <ThemedText style={[styles.recommendationBody, { color: p.textMuted }]}>
                  {recommendation.text}
                </ThemedText>
              </View>
            </View>
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: p.badgeBg }]}>
                <ThemedText style={styles.badgeEmoji}>
                  {moodValue < 30 ? '😢' : moodValue > 70 ? '😊' : '😐'}
                </ThemedText>
                <ThemedText style={[styles.badgeText, { color: p.textMuted }]}>
                  {moodValue < 30 ? 'Грустно' : moodValue > 70 ? 'Радость' : 'Нейтрально'}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: p.badgeBg }]}>
                <MaterialIcons name="bolt" size={12} color={p.textMuted} />
                <ThemedText style={[styles.badgeText, { color: p.textMuted }]}>
                  {energyOptions[energy].label}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: p.badgeBg }]}>
                <MaterialIcons name="psychology" size={12} color={p.textMuted} />
                <ThemedText style={[styles.badgeText, { color: p.textMuted }]}>
                  {stressOptions[stress].label}
                </ThemedText>
              </View>
            </View>
          </View>
          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: p.trackBg, marginTop: 16 }]}
            onPress={() => setStep(1)}
          >
            <ThemedText style={[styles.secondaryBtnText, { color: p.textPrimary }]}>Обновить</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 20,
    padding: CARD_PADDING,
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  title: { fontSize: 17, fontWeight: '600' },
  stepTitle: {
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'center',
    marginBottom: 16,
  },
  stepTitleInFace: { marginBottom: 8 },
  stepTitleNoExtraMb: { marginBottom: 6 },
  stepSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  stepSubtitleTight: { marginBottom: 0 },
  /** Общая высота шагов 1–3: визуал + текст */
  stepMainColumn: {
    minHeight: 252,
    marginBottom: 4,
  },
  stepVisualArea: {
    minHeight: 160,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepTextBlock: {
    minHeight: 88,
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  moodLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginTop: 8,
  },
  sliderTouchArea: {
    paddingVertical: 14,
    marginHorizontal: -4,
  },
  /** Ползунок снаружи overflow трека — круг не обрезается */
  sliderTrackShell: {
    position: 'relative',
    paddingVertical: 4,
    marginBottom: 8,
  },
  sliderTrack: {
    height: 22,
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    borderRadius: 11,
  },
  sliderThumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  sliderSection: { marginBottom: 20 },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
  },
  sliderLabel: { fontSize: 12 },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600' },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '500' },
  btnRow: { flexDirection: 'row', gap: 12 },
  iconCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  energyBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    opacity: 0.3,
    borderBottomLeftRadius: 48,
    borderBottomRightRadius: 48,
  },
  stressRing: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 48,
    borderWidth: 2,
  },
  stressIconWrapper: {
    width: 144,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stressCircleInner: {
    width: 96,
    height: 96,
    borderRadius: 48,
    overflow: 'hidden',
  },
  stressRingsContainer: {
    position: 'absolute',
    width: 144,
    height: 144,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stressRingWrapper: {
    position: 'absolute',
    left: 24,
    top: 24,
    width: 96,
    height: 96,
    borderRadius: 48,
  },
  stressIconOverlay: {
    position: 'absolute',
    left: 24,
    top: 24,
    width: 96,
    height: 96,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconOverlay: { alignItems: 'center', justifyContent: 'center' },
  recommendationBox: {
    borderRadius: 16,
    padding: 20,
  },
  recommendationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  recommendationEmoji: { fontSize: 32 },
  recommendationText: { flex: 1 },
  recommendationTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  recommendationBody: {
    fontSize: 14,
    lineHeight: 22,
  },
  badgesRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 6,
  },
  badgeEmoji: { fontSize: 14 },
  badgeText: { fontSize: 12 },
});
