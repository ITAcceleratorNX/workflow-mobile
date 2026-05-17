import type { ReactNode } from 'react';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Ellipse, Line, Path, Rect } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import type { EnergyLevel, StressLevel } from '@/stores/mood-store';
import { useMoodStore } from '@/stores/mood-store';

import { formatDateForApi } from '@/lib/dateTimeUtils';

const CARD_PADDING = 20;

const COLORS = {
  cardBg: '#2C2C2E',
  trackBg: '#3A3A3C',
  accent: '#E85D2B',
  textPrimary: '#ffffff',
  textMuted: '#8E8E93',
  moodGood: '#8BC34A',
  moodOk: '#C5A572',
  moodBad: '#E89B5C',
  moodVeryBad: '#E57373',
  energyFull: '#7CB342',
  energyGood: '#AED581',
  energyLow: '#FFA726',
  energyDepleted: '#E53935',
  stressCalm: '#81C784',
  stressNeutral: '#B0BEC5',
  stressTense: '#FFB74D',
  stressOverload: '#E57373',
  chipBg: '#3A3A3C',
  chipSelectedBg: 'rgba(232, 93, 43, 0.18)',
};

const MOOD_LEVELS = [
  { level: 0 as const, moodValue: 88, summary: 'Хорошее настроение' },
  { level: 1 as const, moodValue: 58, summary: 'Нормальное настроение' },
  { level: 2 as const, moodValue: 35, summary: 'Плохое настроение' },
  { level: 3 as const, moodValue: 12, summary: 'Очень плохое настроение' },
] as const;

const ENERGY_LEVELS: {
  key: EnergyLevel;
  fill: number;
  fillColor: string;
  borderActive: string;
}[] = [
  { key: 'full', fill: 1, fillColor: COLORS.energyFull, borderActive: COLORS.energyFull },
  { key: 'good', fill: 0.7, fillColor: COLORS.energyGood, borderActive: COLORS.energyGood },
  { key: 'low', fill: 0.3, fillColor: COLORS.energyLow, borderActive: COLORS.energyLow },
  { key: 'depleted', fill: 0.1, fillColor: COLORS.energyDepleted, borderActive: COLORS.energyDepleted },
];

const STRESS_LEVELS = [
  { key: 'calm' as const, level: 0 as const, summary: 'Спокойно' },
  { key: 'neutral' as const, level: 1 as const, summary: 'Нейтрально' },
  { key: 'tense' as const, level: 2 as const, summary: 'Напряжённо' },
  { key: 'overloaded' as const, level: 3 as const, summary: 'Перегружен' },
];

function moodSummaryFromValue(moodValue: number): string {
  const closest = MOOD_LEVELS.reduce((best, L) =>
    Math.abs(L.moodValue - moodValue) < Math.abs(best.moodValue - moodValue) ? L : best
  );
  return closest.summary;
}

function moodColorFromValue(moodValue: number): string {
  if (moodValue >= 70) return COLORS.moodGood;
  if (moodValue >= 45) return COLORS.moodOk;
  if (moodValue >= 22) return COLORS.moodBad;
  return COLORS.moodVeryBad;
}

type AdviceIconKind = 'leaf' | 'spark' | 'breath' | 'ripple' | 'mug' | 'pulse';

function getRecommendation(
  moodValue: number,
  energy: EnergyLevel,
  stress: StressLevel
): { text: string; icon: AdviceIconKind } {
  const energyBad = energy === 'depleted' || energy === 'low';
  const energyGood = energy === 'full' || energy === 'good';
  const stressLow = stress === 'calm';

  if (moodValue < 28 && energyBad && stress === 'overloaded') {
    return {
      text: 'Сегодня лучше отдохнуть. Короткая прогулка или расслабляющее занятие помогут. Помните: отдых — это нормально.',
      icon: 'leaf',
    };
  }
  if (moodValue > 72 && energyGood && stressLow) {
    return {
      text: 'Вы в отличной форме! Идеальный день для сложных задач или активного отдыха.',
      icon: 'spark',
    };
  }
  if (stress === 'overloaded') {
    return {
      text: 'Высокий уровень стресса. Попробуйте 10 минут глубокого дыхания или медитации. Вы справитесь!',
      icon: 'breath',
    };
  }
  if (stress === 'tense') {
    return {
      text: 'Заметное напряжение. Короткая пауза без экрана или лёгкая растяжка могут снять зажим.',
      icon: 'ripple',
    };
  }
  if (energy === 'depleted' || energy === 'low') {
    return {
      text: 'Мало энергии? Короткий отдых или полезный перекус могут помочь. Пейте воду и делайте перерывы.',
      icon: 'mug',
    };
  }
  return {
    text: 'Всё идёт хорошо! Поддерживайте баланс: регулярные перерывы и забота о себе.',
    icon: 'pulse',
  };
}

/** Круглое лицо настроения: 0 радость → 3 очень тяжело (линейный стиль Healthy). */
function MoodFaceGlyph({ level, size = 48 }: { level: 0 | 1 | 2 | 3; size?: number }) {
  const mouth: Record<0 | 1 | 2 | 3, string> = {
    0: 'M 26 58 Q 50 78 74 58',
    1: 'M 30 60 Q 50 70 70 60',
    2: 'M 30 64 Q 50 54 70 64',
    3: 'M 28 66 Q 50 46 72 66',
  };
  const eyeY = level >= 3 ? 40 : 38;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="44" fill={COLORS.trackBg} stroke="#5C5C5E" strokeWidth="2" />
      <Ellipse cx="36" cy={eyeY} rx="6" ry={level >= 2 ? 5 : 6} fill={COLORS.textPrimary} />
      <Ellipse cx="64" cy={eyeY} rx="6" ry={level >= 2 ? 5 : 6} fill={COLORS.textPrimary} />
      {level === 0 && (
        <>
          <Circle cx="26" cy="52" r="4" fill={COLORS.accent} opacity={0.45} />
          <Circle cx="74" cy="52" r="4" fill={COLORS.accent} opacity={0.45} />
        </>
      )}
      <Path
        d={mouth[level]}
        stroke={COLORS.textPrimary}
        strokeWidth="3.2"
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

/** Лицо-индикатор стресса: от ровной линии до «перегруза» с рябью. */
function StressFaceGlyph({ level, size = 48 }: { level: 0 | 1 | 2 | 3; size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      <Circle cx="50" cy="50" r="44" fill={COLORS.trackBg} stroke="#5C5C5E" strokeWidth="2" />
      {level === 0 && (
        <>
          <Path d="M 28 44 Q 36 38 44 44" stroke={COLORS.stressCalm} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M 56 44 Q 64 38 72 44" stroke={COLORS.stressCalm} strokeWidth="2.5" fill="none" strokeLinecap="round" />
          <Path d="M 32 62 Q 50 72 68 62" stroke={COLORS.stressCalm} strokeWidth="2.8" fill="none" strokeLinecap="round" />
        </>
      )}
      {level === 1 && (
        <>
          <Circle cx="36" cy="42" r="4.5" fill={COLORS.stressNeutral} />
          <Circle cx="64" cy="42" r="4.5" fill={COLORS.stressNeutral} />
          <Line x1="32" y1="60" x2="68" y2="60" stroke={COLORS.stressNeutral} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
      {level === 2 && (
        <>
          <Line x1="28" y1="36" x2="40" y2="40" stroke={COLORS.stressTense} strokeWidth="2.5" strokeLinecap="round" />
          <Line x1="72" y1="36" x2="60" y2="40" stroke={COLORS.stressTense} strokeWidth="2.5" strokeLinecap="round" />
          <Circle cx="36" cy="44" r="4" fill={COLORS.stressTense} />
          <Circle cx="64" cy="44" r="4" fill={COLORS.stressTense} />
          <Path d="M 30 64 L 38 58 L 46 64 L 54 58 L 62 64 L 70 58" stroke={COLORS.stressTense} strokeWidth="2.5" fill="none" strokeLinejoin="round" />
        </>
      )}
      {level === 3 && (
        <>
          <Circle cx="36" cy="40" r="5" fill={COLORS.stressOverload} />
          <Circle cx="64" cy="40" r="5" fill={COLORS.stressOverload} />
          <Path d="M 32 28 L 36 22 M 64 22 L 68 28 M 22 50 L 16 48 M 84 48 L 78 50" stroke={COLORS.stressOverload} strokeWidth="2" strokeLinecap="round" opacity={0.85} />
          <Path d="M 28 66 Q 50 52 72 66" stroke={COLORS.stressOverload} strokeWidth="3.2" fill="none" strokeLinecap="round" />
          <Path d="M 18 32 L 22 36 M 82 36 L 86 32" stroke={COLORS.accent} strokeWidth="1.8" strokeLinecap="round" opacity={0.6} />
        </>
      )}
    </Svg>
  );
}

function AdviceGlyph({ kind, size = 40 }: { kind: AdviceIconKind; size?: number }) {
  const a = COLORS.accent;
  const w = COLORS.textPrimary;
  const m = COLORS.textMuted;
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100">
      {kind === 'leaf' && (
        <Path
          d="M 50 18 C 78 22 88 48 50 88 C 12 48 22 22 50 18 Z"
          fill="none"
          stroke={COLORS.moodGood}
          strokeWidth="3"
          strokeLinejoin="round"
        />
      )}
      {kind === 'spark' && (
        <>
          <Path d="M 50 12 L 54 40 L 82 50 L 54 58 L 50 88 L 46 58 L 18 50 L 46 40 Z" fill={a} opacity={0.9} />
          <Circle cx="50" cy="50" r="8" fill="#fff" opacity={0.35} />
        </>
      )}
      {kind === 'breath' && (
        <>
          <Path d="M 50 22 C 70 38 70 62 50 78 C 30 62 30 38 50 22" fill="none" stroke={m} strokeWidth="2.5" />
          <Path d="M 50 32 C 62 42 62 58 50 68 C 38 58 38 42 50 32" fill="none" stroke={a} strokeWidth="2" />
        </>
      )}
      {kind === 'ripple' && (
        <>
          <Circle cx="50" cy="50" r="28" fill="none" stroke={m} strokeWidth="2" opacity={0.5} />
          <Circle cx="50" cy="50" r="18" fill="none" stroke={a} strokeWidth="2" opacity={0.7} />
          <Circle cx="50" cy="50" r="8" fill={a} opacity={0.35} />
        </>
      )}
      {kind === 'mug' && (
        <>
          <Rect x="28" y="38" width="34" height="30" rx="8" fill="none" stroke={w} strokeWidth="3" />
          <Path d="M 62 46 H 72 C 78 46 82 52 82 58 C 82 64 76 68 70 68 H 62" fill="none" stroke={w} strokeWidth="2.8" />
          <Path d="M 34 72 Q 50 80 66 72" fill="none" stroke={a} strokeWidth="2.5" opacity={0.8} />
        </>
      )}
      {kind === 'pulse' && (
        <>
          <Path d="M 22 50 L 38 50 L 44 30 L 56 70 L 62 50 L 78 50" fill="none" stroke={COLORS.moodGood} strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />
        </>
      )}
    </Svg>
  );
}

/** Компактная батарея: доля заливки 0–1, цвет заливки и обводки корпуса. */
function BatteryGlyph({
  fillRatio,
  fillColor,
  strokeColor,
  size = 44,
}: {
  fillRatio: number;
  fillColor: string;
  strokeColor: string;
  size?: number;
}) {
  const w = size;
  const h = size * 0.52;
  const capW = size * 0.09;
  const capH = size * 0.22;
  const r = size * 0.12;
  const bodyPad = size * 0.08;
  const innerW = w - capW - bodyPad * 2;
  const innerH = h - bodyPad * 2;
  const tipX = bodyPad + innerW + bodyPad * 0.25;
  const strokeW = size * 0.06;
  /** Внутренняя зона заливки — строго внутри обводки, чтобы при 100% не вылезала за скругления */
  const inset = strokeW * 0.55 + size * 0.028;
  const bodyWidth = innerW + bodyPad * 0.4;
  const fillLeft = bodyPad + inset;
  const fillMaxW = Math.max(0, bodyWidth - 2 * inset);
  const fillW = Math.max(0, fillMaxW * fillRatio);
  const fillTop = bodyPad + inset;
  const fillHeight = Math.max(0, innerH - 2 * inset);
  const fillRx = Math.max(1, r * 0.45 - inset * 0.35);

  return (
    <Svg width={w} height={h + 2} viewBox={`0 0 ${w} ${h + 2}`}>
      <Rect
        x={bodyPad}
        y={bodyPad}
        width={bodyWidth}
        height={innerH}
        rx={r}
        ry={r}
        stroke={strokeColor}
        strokeWidth={strokeW}
        fill="none"
      />
      <Rect
        x={tipX}
        y={h / 2 - capH / 2}
        width={capW}
        height={capH}
        rx={capW * 0.35}
        ry={capW * 0.35}
        fill={strokeColor}
      />
      <Rect
        x={fillLeft}
        y={fillTop}
        width={fillW}
        height={fillHeight}
        rx={fillRx}
        ry={fillRx}
        fill={fillColor}
      />
    </Svg>
  );
}

function LevelRow({ children }: { children: ReactNode }) {
  return <View style={styles.levelRow}>{children}</View>;
}

function moodLevelIndex(moodValue: number): number {
  let best = 0;
  let d = Infinity;
  MOOD_LEVELS.forEach((L, i) => {
    const diff = Math.abs(L.moodValue - moodValue);
    if (diff < d) {
      d = diff;
      best = i;
    }
  });
  return best;
}

export function MoodCheckInCard() {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [moodValue, setMoodValue] = useState(58);
  const [energy, setEnergy] = useState<EnergyLevel>('good');
  const [stress, setStress] = useState<StressLevel>('neutral');

  const setMood = useMoodStore((s) => s.setMood);
  const todayKey = formatDateForApi(new Date());

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

  const moodIdx = moodLevelIndex(moodValue);
  const previewMoodLevel = MOOD_LEVELS[moodIdx].level;
  const energyDef = ENERGY_LEVELS.find((e) => e.key === energy) ?? ENERGY_LEVELS[1];
  const stressDef = STRESS_LEVELS.find((s) => s.key === stress) ?? STRESS_LEVELS[1];

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
          <View style={styles.metricHeader}>
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(129, 199, 132, 0.25)' }]}>
              <MoodFaceGlyph level={1} size={32} />
            </View>
            <View style={styles.metricHeaderText}>
              <ThemedText style={[styles.metricTitle, { color: COLORS.textPrimary }]}>Настроение</ThemedText>
              <ThemedText style={[styles.metricSubtitle, { color: COLORS.textMuted }]}>
                Как вы себя чувствуете?
              </ThemedText>
            </View>
          </View>
          <View style={styles.previewArea}>
            <MoodFaceGlyph level={previewMoodLevel} size={80} />
            <ThemedText style={[styles.previewCaption, { color: moodColorFromValue(moodValue) }]}>
              {moodSummaryFromValue(moodValue)}
            </ThemedText>
          </View>
          <LevelRow>
            {MOOD_LEVELS.map((L, i) => {
              const active = moodIdx === i;
              return (
                <Pressable
                  key={L.moodValue}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setMoodValue(L.moodValue)}
                  style={[
                    styles.levelCell,
                    { backgroundColor: active ? COLORS.chipSelectedBg : COLORS.chipBg },
                    active && styles.levelCellSelected,
                  ]}
                >
                  <MoodFaceGlyph level={L.level} size={36} />
                </Pressable>
              );
            })}
          </LevelRow>
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
          <View style={styles.metricHeader}>
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(174, 213, 129, 0.22)' }]}>
              <BatteryGlyph
                fillRatio={0.85}
                fillColor={COLORS.energyGood}
                strokeColor={COLORS.textMuted}
                size={36}
              />
            </View>
            <View style={styles.metricHeaderText}>
              <ThemedText style={[styles.metricTitle, { color: COLORS.textPrimary }]}>Энергия</ThemedText>
              <ThemedText style={[styles.metricSubtitle, { color: COLORS.textMuted }]}>
                Оцените свой уровень энергии
              </ThemedText>
            </View>
          </View>
          <View style={styles.previewArea}>
            <BatteryGlyph
              fillRatio={energyDef.fill}
              fillColor={energyDef.fillColor}
              strokeColor={energyDef.borderActive}
              size={72}
            />
          </View>
          <LevelRow>
            {ENERGY_LEVELS.map((def) => {
              const active = energy === def.key;
              return (
                <Pressable
                  key={def.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setEnergy(def.key)}
                  style={[
                    styles.levelCell,
                    { backgroundColor: active ? COLORS.chipSelectedBg : COLORS.chipBg },
                    active && styles.levelCellSelected,
                  ]}
                >
                  <BatteryGlyph
                    fillRatio={def.fill}
                    fillColor={def.fillColor}
                    strokeColor={active ? def.borderActive : COLORS.textMuted}
                    size={40}
                  />
                </Pressable>
              );
            })}
          </LevelRow>
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
          <View style={styles.metricHeader}>
            <View style={[styles.metricIconWrap, { backgroundColor: 'rgba(179, 229, 252, 0.2)' }]}>
              <StressFaceGlyph level={0} size={32} />
            </View>
            <View style={styles.metricHeaderText}>
              <ThemedText style={[styles.metricTitle, { color: COLORS.textPrimary }]}>Стресс</ThemedText>
              <ThemedText style={[styles.metricSubtitle, { color: COLORS.textMuted }]}>
                Насколько вы чувствуете нагрузку?
              </ThemedText>
            </View>
          </View>
          <View style={styles.previewArea}>
            <StressFaceGlyph level={stressDef.level} size={80} />
            <ThemedText style={[styles.previewCaption, { color: COLORS.textMuted }]}>
              {stressDef.summary}
            </ThemedText>
          </View>
          <LevelRow>
            {STRESS_LEVELS.map((s) => {
              const active = stress === s.key;
              return (
                <Pressable
                  key={s.key}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setStress(s.key)}
                  style={[
                    styles.levelCell,
                    { backgroundColor: active ? COLORS.chipSelectedBg : COLORS.chipBg },
                    active && styles.levelCellSelected,
                  ]}
                >
                  <StressFaceGlyph level={s.level} size={36} />
                </Pressable>
              );
            })}
          </LevelRow>
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
              <View style={styles.recommendationGlyphWrap}>
                <AdviceGlyph kind={recommendation.icon} size={40} />
              </View>
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
                <MoodFaceGlyph level={MOOD_LEVELS[moodLevelIndex(moodValue)].level} size={22} />
                <ThemedText style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  {moodSummaryFromValue(moodValue)}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: COLORS.cardBg }]}>
                <BatteryGlyph
                  fillRatio={energyDef.fill}
                  fillColor={energyDef.fillColor}
                  strokeColor={energyDef.borderActive}
                  size={22}
                />
                <ThemedText style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  {energy === 'full'
                    ? 'Полный заряд'
                    : energy === 'good'
                      ? 'Хороший заряд'
                      : energy === 'low'
                        ? 'Низкий заряд'
                        : 'Почти разряжен'}
                </ThemedText>
              </View>
              <View style={[styles.badge, { backgroundColor: COLORS.cardBg }]}>
                <StressFaceGlyph level={stressDef.level} size={22} />
                <ThemedText style={[styles.badgeText, { color: COLORS.textMuted }]}>
                  {stressDef.summary}
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
    marginBottom: 16,
  },
  title: { fontSize: 17, fontWeight: '600' },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  metricIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  metricTitle: {
    fontSize: 17,
    fontWeight: '700',
  },
  metricSubtitle: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  previewArea: {
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  previewCaption: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
    textAlign: 'center',
  },
  levelRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 20,
  },
  levelCell: {
    flex: 1,
    aspectRatio: 1,
    maxWidth: '25.5%',
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  levelCellSelected: {
    borderColor: COLORS.accent,
  },
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
  recommendationBox: {
    borderRadius: 16,
    padding: 20,
  },
  recommendationRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
    alignItems: 'flex-start',
  },
  recommendationGlyphWrap: {
    width: 40,
    height: 40,
    marginTop: 2,
  },
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
  badgeText: { fontSize: 12 },
});
