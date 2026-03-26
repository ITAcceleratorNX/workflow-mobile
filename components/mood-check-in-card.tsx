import { useEffect, useCallback, useRef, useState } from 'react';
import {
  Dimensions,
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

import { formatDateForApi } from '@/lib/dateTimeUtils';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_PADDING = 20;

const COLORS = {
  cardBg: '#2C2C2E',
  trackBg: '#3A3A3C',
  accent: '#E85D2B',
  accentDark: '#D94F15',
  textPrimary: '#ffffff',
  textMuted: '#8E8E93',
  low: '#8E8E93',
  medium: '#E85D2B',
  high: '#4CAF50',
  stressHigh: '#B8400E',
};

function getMoodLabel(value: number): string {
  if (value < 33) return 'Плохо';
  if (value < 67) return 'Нормально';
  return 'Отлично!';
}

function getMoodColor(value: number): string {
  if (value < 33) return COLORS.low;
  if (value < 67) return COLORS.medium;
  return COLORS.high;
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
function MoodFace({ value }: { value: number }) {
  const baseY = 75 - (value / 100) * 10;
  const curvature = (value - 50) * 0.2;
  const mouthPath = `M 30 ${baseY - curvature * 0.5} Q 50 ${baseY + curvature} 70 ${baseY - curvature * 0.5}`;
  const cheekOpacity = Math.max(0, (value - 70) / 30);

  return (
    <Svg viewBox="0 0 100 100" width={120} height={120}>
      <Circle cx="50" cy="50" r="45" fill="#424244" />
      <Line x1="28" y1="25" x2="38" y2="25" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <Line x1="62" y1="25" x2="72" y2="25" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
      <Ellipse cx="33" cy="40" rx="5" ry="5" fill="#FFFFFF" />
      <Ellipse cx="67" cy="40" rx="5" ry="5" fill="#FFFFFF" />
      <Circle cx="20" cy="55" r="6" fill={COLORS.accent} opacity={cheekOpacity} />
      <Circle cx="80" cy="55" r="6" fill={COLORS.accent} opacity={cheekOpacity} />
      <Path d={mouthPath} stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" fill="none" />
    </Svg>
  );
}

// --- Energy Icon with animated fill bar ---
const ENERGY_HEIGHTS: Record<EnergyLevel, number> = {
  low: 0.33,
  medium: 0.66,
  high: 1,
};

const ENERGY_COLORS: Record<EnergyLevel, string> = {
  low: COLORS.low,
  medium: COLORS.medium,
  high: COLORS.high,
};

function EnergyIconCircle({ energy }: { energy: EnergyLevel }) {
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
    <View style={[styles.iconCircle, { backgroundColor: COLORS.trackBg, overflow: 'hidden' }]}>
      <Animated.View
        style={[
          styles.energyBar,
          { backgroundColor: ENERGY_COLORS[energy] },
          animatedBarStyle,
        ]}
      />
      <View style={[StyleSheet.absoluteFill, styles.iconOverlay]} pointerEvents="none">
        <MaterialIcons name="bolt" size={40} color={COLORS.textPrimary} />
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

const STRESS_COLORS: Record<StressLevel, string> = {
  low: '#4CAF50',
  medium: COLORS.medium,
  high: COLORS.stressHigh,
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

function StressIconCircle({ stress }: { stress: StressLevel }) {
  const intensity = STRESS_INTENSITY[stress];
  const color = STRESS_COLORS[stress];

  return (
    <View style={styles.stressIconWrapper}>
      <View style={[styles.stressCircleInner, { backgroundColor: COLORS.trackBg }]} />
      <View style={styles.stressRingsContainer}>
        {[...Array(intensity)].map((_, i) => (
          <View key={`${stress}-${i}`} style={styles.stressRingWrapper}>
            <StressRing delay={i * 500} color={color} />
          </View>
        ))}
      </View>
      <View style={[styles.stressCircleInner, styles.stressIconOverlay]} pointerEvents="none">
        <MaterialIcons name="psychology" size={40} color={COLORS.textPrimary} />
      </View>
    </View>
  );
}

// --- Simple Slider ---
function SimpleSlider({
  value,
  onValueChange,
  max = 100,
}: {
  value: number;
  onValueChange: (v: number) => void;
  max?: number;
}) {
  const trackRef = useRef<View>(null);

  const onLayout = useCallback((e: LayoutChangeEvent) => {
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
          <View ref={trackRef} style={styles.sliderTrack} onLayout={onLayout}>
            <View style={[styles.sliderFill, { width: `${percent}%` }]} />
          </View>
          <View
            style={[
              styles.sliderThumb,
              {
                left: `${Math.min(percent, 98)}%`,
                marginLeft: -thumbHalf,
                top: thumbTop,
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
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [moodValue, setMoodValue] = useState(50);
  const [energy, setEnergy] = useState<EnergyLevel>('medium');
  const [stress, setStress] = useState<StressLevel>('medium');

  const setMood = useMoodStore((s) => s.setMood);
  const todayKey = formatDateForApi(new Date());

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
    <View style={styles.card}>
      <View style={styles.header}>
        <MaterialIcons name="favorite" size={20} color={COLORS.accent} />
        <ThemedText style={[styles.title, { color: COLORS.textPrimary }]}>
          Проверка настроения
        </ThemedText>
      </View>

      {step === 1 && (
        <>
          <View style={styles.stepMainColumn}>
            <View style={styles.stepVisualArea}>
              <MoodFace value={moodValue} />
            </View>
            <View style={styles.stepTextBlock}>
              <ThemedText style={[styles.stepTitle, styles.stepTitleInFace, { color: COLORS.textPrimary }]}>
                Как вы себя чувствуете?
              </ThemedText>
              <ThemedText
                style={[styles.moodLabel, { color: getMoodColor(moodValue) }]}
              >
                {getMoodLabel(moodValue)}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sliderSection}>
            <SimpleSlider value={moodValue} onValueChange={setMoodValue} />
            <View style={styles.sliderLabels}>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Низко</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Средне</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Высоко</ThemedText>
            </View>
          </View>
          <Pressable
            style={[styles.primaryBtn, { backgroundColor: COLORS.accent }]}
            onPress={() => setStep(2)}
          >
            <ThemedText style={styles.primaryBtnText}>Далее</ThemedText>
          </Pressable>
        </>
      )}

      {step === 2 && (
        <>
          <View style={styles.stepMainColumn}>
            <View style={styles.stepVisualArea}>
              <EnergyIconCircle energy={energy} />
            </View>
            <View style={styles.stepTextBlock}>
              <ThemedText style={[styles.stepTitle, styles.stepTitleNoExtraMb, { color: COLORS.textPrimary }]}>
                Уровень энергии
              </ThemedText>
              <ThemedText style={[styles.stepSubtitle, styles.stepSubtitleTight, { color: COLORS.textMuted }]}>
                {energyOptions[energy].label}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sliderSection}>
            <SimpleSlider
              value={['low', 'medium', 'high'].indexOf(energy)}
              onValueChange={(v) =>
                setEnergy(['low', 'medium', 'high'][v] as EnergyLevel)
              }
              max={2}
            />
            <View style={styles.sliderLabels}>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Низкий</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Средний</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Высокий</ThemedText>
            </View>
          </View>
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: COLORS.trackBg }]}
              onPress={() => setStep(1)}
            >
              <ThemedText style={styles.secondaryBtnText}>Назад</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: COLORS.accent, flex: 1 }]}
              onPress={() => setStep(3)}
            >
              <ThemedText style={styles.primaryBtnText}>Далее</ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {step === 3 && (
        <>
          <View style={styles.stepMainColumn}>
            <View style={styles.stepVisualArea}>
              <StressIconCircle stress={stress} />
            </View>
            <View style={styles.stepTextBlock}>
              <ThemedText style={[styles.stepTitle, styles.stepTitleNoExtraMb, { color: COLORS.textPrimary }]}>
                Уровень стресса
              </ThemedText>
              <ThemedText style={[styles.stepSubtitle, styles.stepSubtitleTight, { color: COLORS.textMuted }]}>
                {stressOptions[stress].label}
              </ThemedText>
            </View>
          </View>
          <View style={styles.sliderSection}>
            <SimpleSlider
              value={['low', 'medium', 'high'].indexOf(stress)}
              onValueChange={(v) =>
                setStress(['low', 'medium', 'high'][v] as StressLevel)
              }
              max={2}
            />
            <View style={styles.sliderLabels}>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Низкий</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Средний</ThemedText>
              <ThemedText style={[styles.sliderLabel, { color: COLORS.textMuted }]}>Высокий</ThemedText>
            </View>
          </View>
          <View style={styles.btnRow}>
            <Pressable
              style={[styles.secondaryBtn, { backgroundColor: COLORS.trackBg }]}
              onPress={() => setStep(2)}
            >
              <ThemedText style={styles.secondaryBtnText}>Назад</ThemedText>
            </Pressable>
            <Pressable
              style={[styles.primaryBtn, { backgroundColor: COLORS.accent, flex: 1 }]}
              onPress={handleFinish}
            >
              <ThemedText style={styles.primaryBtnText}>Готово</ThemedText>
            </Pressable>
          </View>
        </>
      )}

      {step === 4 && (
        <>
          <View style={[styles.recommendationBox, { backgroundColor: COLORS.trackBg }]}>
            <View style={styles.recommendationRow}>
              <ThemedText style={styles.recommendationEmoji}>{recommendation.emoji}</ThemedText>
              <View style={styles.recommendationText}>
                <ThemedText style={[styles.recommendationTitle, { color: COLORS.textPrimary }]}>
                  Совет на день
                </ThemedText>
                <ThemedText style={[styles.recommendationBody, { color: COLORS.textMuted }]}>
                  {recommendation.text}
                </ThemedText>
              </View>
            </View>
            <View style={styles.badgesRow}>
              <View style={[styles.badge, { backgroundColor: COLORS.cardBg }]}>
                <ThemedText style={styles.badgeEmoji}>
                  {moodValue < 30 ? '😢' : moodValue > 70 ? '😊' : '😐'}
                </ThemedText>
                <ThemedText style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  {moodValue < 30 ? 'Грустно' : moodValue > 70 ? 'Радость' : 'Нейтрально'}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: COLORS.cardBg }]}>
                <MaterialIcons name="bolt" size={12} color={COLORS.textMuted} />
                <ThemedText style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  {energyOptions[energy].label}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: COLORS.cardBg }]}>
                <MaterialIcons name="psychology" size={12} color={COLORS.textMuted} />
                <ThemedText style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  {stressOptions[stress].label}
                </ThemedText>
              </View>
            </View>
          </View>
          <Pressable
            style={[styles.secondaryBtn, { backgroundColor: COLORS.trackBg, marginTop: 16 }]}
            onPress={() => setStep(1)}
          >
            <ThemedText style={styles.secondaryBtnText}>Обновить</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.cardBg,
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
    backgroundColor: COLORS.trackBg,
    borderRadius: 11,
    overflow: 'hidden',
    position: 'relative',
  },
  sliderFill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: COLORS.accent,
    borderRadius: 11,
  },
  sliderThumb: {
    position: 'absolute',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: COLORS.textPrimary,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
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
  valueBox: {
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  valueLabel: { fontSize: 13, marginBottom: 4 },
  valueNumber: { fontSize: 24, fontWeight: '600' },
  primaryBtn: {
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  primaryBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  secondaryBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  secondaryBtnText: { fontSize: 16, fontWeight: '500', color: COLORS.textPrimary },
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
