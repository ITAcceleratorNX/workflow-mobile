import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Switch,
} from 'react-native';
import Animated, {
  createAnimatedComponent,
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import { useStepsStore } from '@/stores/steps-store';
import {
  formatSleepDuration,
  FULL_SLEEP_ADVICE,
  getScheduledSleepMinutes,
  type SleepRating,
  useSleepStore,
} from '@/stores/sleep-store';
import { useWaterStore, WATER_PORTIONS } from '@/stores/water-store';

const { width, height } = Dimensions.get('window');
const ADVICE_MODAL_HEIGHT = Math.floor(height * 0.85);
const CARD_PADDING = 16;
const CIRCLE_SIZE = Math.min(width - CARD_PADDING * 2 - 32, 260);
const CIRCLE_R = (CIRCLE_SIZE - 24) / 2;
const CIRCLE_CX = CIRCLE_SIZE / 2;
const CIRCLE_CIRCUMFERENCE = 2 * Math.PI * CIRCLE_R;

const AnimatedCircle = createAnimatedComponent(Circle);

// Design spec colors
const COLORS = {
  background: '#1a1a1a',
  backgroundAlt: '#222222',
  cardBg: '#2a2a2a',
  accent: '#FF5722',
  textPrimary: '#ffffff',
  textSecondary: '#888888',
  blueAccent: '#4FC3F7',
  trackGray: '#3a3a3a',
  warningBorder: 'rgba(255, 87, 34, 0.5)',
  warningBg: 'rgba(255, 87, 34, 0.15)',
};

function formatHealthDate(date: Date): string {
  const s = new Intl.DateTimeFormat('ru-RU', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(date);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// --- Steps Card ---
function StepsCard({
  stepsToday,
  stepsGoal,
  animateTrigger,
}: {
  stepsToday: number;
  stepsGoal: number;
  animateTrigger?: number;
}) {
  const progress = useMemo(() => {
    if (stepsGoal <= 0) return 0;
    return Math.min(stepsToday / stepsGoal, 1);
  }, [stepsToday, stepsGoal]);

  const animatedProgress = useSharedValue(0);

  useEffect(() => {
    animatedProgress.value = withSequence(
      withTiming(0, { duration: 0 }),
      withTiming(progress, {
        duration: 1000,
        easing: Easing.out(Easing.cubic),
      })
    );
  }, [progress, animateTrigger]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCLE_CIRCUMFERENCE * (1 - animatedProgress.value),
  }));

  return (
    <View style={styles.card}>
      <View style={styles.circleWrap}>
        <Svg width={CIRCLE_SIZE} height={CIRCLE_SIZE}>
          <Circle
            cx={CIRCLE_CX}
            cy={CIRCLE_CX}
            r={CIRCLE_R}
            stroke={COLORS.trackGray}
            strokeWidth={12}
            strokeLinecap="round"
            fill="none"
          />
          <AnimatedCircle
            cx={CIRCLE_CX}
            cy={CIRCLE_CX}
            r={CIRCLE_R}
            stroke={COLORS.accent}
            strokeWidth={12}
            strokeLinecap="round"
            strokeDasharray={CIRCLE_CIRCUMFERENCE}
            fill="none"
            rotation={-90}
            originX={CIRCLE_CX}
            originY={CIRCLE_CX}
            animatedProps={animatedProps}
          />
        </Svg>
        <View style={styles.circleCenter} pointerEvents="none">
          <MaterialIcons name="directions-walk" size={36} color={COLORS.accent} style={styles.stepsIcon} />
          <ThemedText style={[styles.stepsValue, { color: COLORS.textPrimary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.35}>
            {stepsToday.toLocaleString('ru-RU')}
          </ThemedText>
          <ThemedText style={[styles.stepsGoal, { color: COLORS.textSecondary }]}>
            из {stepsGoal.toLocaleString('ru-RU')}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.stepsLabel, { color: COLORS.textSecondary }]}>
        Шаги сегодня
      </ThemedText>
    </View>
  );
}

// --- Today's Recommendation Card ---
function RecommendationCard({ onPress }: { onPress?: () => void }) {
  const [showDetailModal, setShowDetailModal] = useState(false);
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const dayRecord = useSleepStore((s) => s.dayRecords[todayKey]);
  const recommendations = dayRecord?.recommendations ?? [];
  const rating = dayRecord?.rating ?? null;
  const shortAdvice = recommendations.length > 0 ? recommendations[0] : 'Сну нужно уделить внимание. Попробуйте ложиться в одно время и избегайте экранов за 1 час до сна.';

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.recommendationHeader}>
        <View style={[styles.recommendationIconWrap, { backgroundColor: COLORS.accent }]}>
          <MaterialIcons name="lightbulb-outline" size={24} color="#fff" />
        </View>
        <MaterialIcons name="bed" size={24} color={COLORS.blueAccent} style={styles.recommendationSleepIcon} />
      </View>
      <ThemedText style={[styles.recommendationTitle, { color: COLORS.textPrimary }]}>
        Рекомендация на сегодня
      </ThemedText>
      <ThemedText style={[styles.recommendationBody, { color: COLORS.textSecondary }]}>
        {shortAdvice}
      </ThemedText>
      {rating && (
        <Pressable
          style={styles.detailBtn}
          onPress={(e) => {
            e?.stopPropagation?.();
            setShowDetailModal(true);
          }}
        >
          <ThemedText style={[styles.detailBtnText, { color: COLORS.accent }]}>Подробнее</ThemedText>
          <MaterialIcons name="arrow-forward" size={16} color={COLORS.accent} />
        </Pressable>
      )}

      <Modal
        visible={showDetailModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDetailModal(false)}
      >
        <Pressable
          style={styles.adviceModalOverlay}
          onPress={() => setShowDetailModal(false)}
        >
          <View style={styles.adviceModalContent}>
            <View style={styles.adviceModalHeader}>
              <ThemedText style={[styles.adviceModalTitle, { color: COLORS.textPrimary }]}>
                Как улучшить сон
              </ThemedText>
              <Pressable onPress={() => setShowDetailModal(false)} hitSlop={12}>
                <MaterialIcons name="close" size={24} color={COLORS.textSecondary} />
              </Pressable>
            </View>
            <ScrollView
              style={styles.adviceModalScroll}
              contentContainerStyle={styles.adviceModalScrollContent}
              showsVerticalScrollIndicator={true}
            >
              <ThemedText style={[styles.adviceModalBody, { color: COLORS.textSecondary }]}>
                {rating ? FULL_SLEEP_ADVICE[rating as SleepRating] : shortAdvice}
              </ThemedText>
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </Pressable>
  );
}

// --- Last Night Sleep Card ---
function LastNightSleepCard({ onPress }: { onPress?: () => void }) {
  const lastNightMinutes = useSleepStore((s) => s.lastNightSleepMinutes);
  const avg7DaysMinutes = useSleepStore((s) => s.avgSleep7DaysMinutes);

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <MaterialIcons name="nightlight-round" size={24} color={COLORS.accent} style={styles.cardIcon} />
      <ThemedText style={[styles.cardTitle, { color: COLORS.textPrimary }]}>Сон прошлой ночью</ThemedText>
      {lastNightMinutes != null ? (
        <>
          <View style={styles.sleepValueWrap}>
            <ThemedText style={[styles.sleepValue, { color: COLORS.textPrimary }]}>
              {formatSleepDuration(lastNightMinutes)}
            </ThemedText>
          </View>
          {avg7DaysMinutes != null && (
            <ThemedText style={[styles.sleepSubtext, { color: COLORS.textSecondary }]}>
              Среднее за 7 дней: {formatSleepDuration(avg7DaysMinutes)}
            </ThemedText>
          )}
        </>
      ) : (
        <ThemedText style={[styles.sleepSubtext, { color: COLORS.textSecondary }]}>
          Нет данных сна из Apple Health
        </ThemedText>
      )}
    </Pressable>
  );
}

// --- Sleep Schedule Card ---
function SleepScheduleCard({ onPress }: { onPress?: () => void }) {
  const settings = useSleepStore((s) => s.settings);
  const setSettings = useSleepStore((s) => s.setSettings);
  const scale = useSharedValue(1);
  const scheduledMinutes = getScheduledSleepMinutes(settings);
  const scheduleWarning = scheduledMinutes < settings.goalMinutes;
  const bedtimeStr = `${settings.bedtimeHour.toString().padStart(2, '0')}:${settings.bedtimeMinute.toString().padStart(2, '0')}`;
  const wakeStr = `${settings.wakeHour.toString().padStart(2, '0')}:${settings.wakeMinute.toString().padStart(2, '0')}`;

  const handleToggle = useCallback((value: boolean) => {
    scale.value = withSequence(
      withTiming(1.15, { duration: 80, easing: Easing.out(Easing.ease) }),
      withTiming(1, { duration: 150, easing: Easing.out(Easing.back(1.5)) })
    );
    setSettings({ notificationsEnabled: value });
  }, [scale, setSettings]);

  const animatedSwitchStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardHeaderRow}>
        <MaterialIcons name="schedule" size={20} color={COLORS.textSecondary} />
        <ThemedText style={[styles.cardTitle, { color: COLORS.textPrimary, marginLeft: 8 }]}>
          Расписание сна
        </ThemedText>
      </View>
      <View style={styles.scheduleRow}>
        <ThemedText style={[styles.scheduleLabel, { color: COLORS.textPrimary }]}>Цель сна</ThemedText>
        <View style={styles.pill}><ThemedText style={styles.pillText}>{Math.floor(settings.goalMinutes / 60)}ч</ThemedText></View>
      </View>
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleLabelRow}>
          <MaterialIcons name="nightlight-round" size={16} color={COLORS.textSecondary} />
          <ThemedText style={[styles.scheduleLabel, { color: COLORS.textPrimary, marginLeft: 6 }]}>Время сна</ThemedText>
        </View>
        <View style={styles.pill}>
          <ThemedText style={styles.pillText}>{bedtimeStr}</ThemedText>
          <MaterialIcons name="schedule" size={14} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
        </View>
      </View>
      <View style={styles.scheduleRow}>
        <View style={styles.scheduleLabelRow}>
          <MaterialIcons name="wb-sunny" size={16} color={COLORS.textSecondary} />
          <ThemedText style={[styles.scheduleLabel, { color: COLORS.textPrimary, marginLeft: 6 }]}>Время подъёма</ThemedText>
        </View>
        <View style={styles.pill}>
          <ThemedText style={styles.pillText}>{wakeStr}</ThemedText>
          <MaterialIcons name="schedule" size={14} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
        </View>
      </View>
      <View style={[styles.scheduleRow, { opacity: 0.8 }]}>
        <ThemedText style={[styles.scheduleLabel, { color: COLORS.textSecondary }]}>По расписанию</ThemedText>
        <ThemedText style={[styles.scheduleValue, { color: COLORS.textSecondary }]}>
          {formatSleepDuration(scheduledMinutes)}
        </ThemedText>
      </View>
      {scheduleWarning && (
        <View style={[styles.warningBanner, { borderColor: COLORS.warningBorder, backgroundColor: COLORS.warningBg }]}>
          <MaterialIcons name="warning" size={18} color={COLORS.accent} />
          <ThemedText style={[styles.warningText, { color: COLORS.textPrimary }]}>
            Расписание не соответствует цели сна
          </ThemedText>
        </View>
      )}
      <View style={[styles.scheduleRow, styles.toggleRow]}>
        <View style={styles.scheduleLabelRow}>
          <MaterialIcons name="notifications" size={18} color={COLORS.textSecondary} />
          <ThemedText style={[styles.scheduleLabel, { color: COLORS.textPrimary, marginLeft: 8 }]}>
            Уведомления о сне
          </ThemedText>
        </View>
        <Animated.View style={animatedSwitchStyle}>
          <Switch
            value={settings.notificationsEnabled}
            onValueChange={handleToggle}
            trackColor={{ false: COLORS.trackGray, true: COLORS.accent }}
            thumbColor="#fff"
          />
        </Animated.View>
      </View>
    </Pressable>
  );
}

// --- Water Intake Card ---
function WaterIntakeCard() {
  const [showPortionModal, setShowPortionModal] = useState(false);
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const todaySleepRating = useSleepStore(
    (s) => s.dayRecords[todayKey]?.rating ?? null
  );
  const intakeTodayMl = useWaterStore((s) => s.intakeTodayMl);
  const healthWaterTodayMl = useWaterStore((s) => s.healthWaterTodayMl);
  const addWater = useWaterStore((s) => s.addWater);
  const getTodayGoalMl = useWaterStore((s) => s.getTodayGoalMl);
  const ensureDateSync = useWaterStore((s) => s.ensureDateSync);

  useEffect(() => {
    ensureDateSync(todayKey);
  }, [todayKey, ensureDateSync]);

  const goalMl = getTodayGoalMl({
    heightCm,
    weightKg,
    stepsToday,
    sleepRating: todaySleepRating,
  });
  const totalIntakeMl = intakeTodayMl + (healthWaterTodayMl ?? 0);
  const progress = goalMl > 0 ? Math.min(totalIntakeMl / goalMl, 1) : 0;
  const percent = goalMl > 0 ? Math.round((totalIntakeMl / goalMl) * 100) : 0;

  const handleAddWater = useCallback(
    (ml: number) => {
      addWater(ml, todayKey);
      setShowPortionModal(false);
    },
    [addWater, todayKey]
  );

  const formatLiters = (ml: number) => {
    if (ml >= 1000) return `${(ml / 1000).toFixed(1)} л`;
    return `${ml} мл`;
  };

  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <MaterialIcons name="water-drop" size={24} color={COLORS.blueAccent} />
        <ThemedText style={[styles.cardTitle, { color: COLORS.textPrimary, marginLeft: 8 }]}>
          Потребление воды
        </ThemedText>
      </View>
      <View style={styles.waterRow}>
        <View style={styles.waterValueWrap}>
          <ThemedText style={[styles.waterValue, { color: COLORS.textPrimary }]}>
            {formatLiters(totalIntakeMl)}
          </ThemedText>
        </View>
        <ThemedText style={[styles.waterPercent, { color: COLORS.blueAccent }]}>
          {percent}%
        </ThemedText>
      </View>
      <ThemedText style={[styles.waterSubtext, { color: COLORS.textSecondary }]}>
        из цели {formatLiters(goalMl)} (рост, вес, шаги, сон)
      </ThemedText>
      <View style={[styles.progressTrack, { backgroundColor: COLORS.trackGray }]}>
        <View
          style={[
            styles.progressFill,
            {
              backgroundColor: COLORS.blueAccent,
              width: `${Math.min(progress * 100, 100)}%`,
            },
          ]}
        />
      </View>
      <Pressable
        style={[styles.addWaterBtn, { backgroundColor: '#00838F' }]}
        onPress={() => setShowPortionModal(true)}
      >
        <ThemedText style={styles.addWaterBtnText}>+ Добавить воду</ThemedText>
      </Pressable>

      <Modal
        visible={showPortionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPortionModal(false)}
      >
        <Pressable
          style={styles.waterModalOverlay}
          onPress={() => setShowPortionModal(false)}
        >
          <Pressable style={styles.waterModalContent} onPress={(e) => e.stopPropagation()}>
            <ThemedText style={[styles.waterModalTitle, { color: COLORS.textPrimary }]}>
              Добавить воду
            </ThemedText>
            <View style={styles.waterPortionGrid}>
              {WATER_PORTIONS.map((ml) => (
                <Pressable
                  key={ml}
                  onPress={() => handleAddWater(ml)}
                  style={[styles.waterPortionBtn, { backgroundColor: COLORS.trackGray }]}
                >
                  <ThemedText style={{ color: COLORS.textPrimary, fontSize: 15, fontWeight: '600' }}>
                    {ml >= 1000 ? `${ml / 1000} л` : `${ml} мл`}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
            <Pressable onPress={() => setShowPortionModal(false)} style={styles.waterModalClose}>
              <ThemedText style={{ color: COLORS.textSecondary }}>Отмена</ThemedText>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// --- Health Settings Card ---
function HealthSettingsCard({
  onStepsPress,
  onNotificationsPress,
}: {
  onStepsPress: () => void;
  onNotificationsPress: () => void;
}) {
  return (
    <View style={styles.card}>
      <View style={styles.cardHeaderRow}>
        <MaterialIcons name="settings" size={20} color={COLORS.textSecondary} />
        <ThemedText style={[styles.cardTitle, { color: COLORS.textPrimary, marginLeft: 8 }]}>
          Настройки здоровья
        </ThemedText>
      </View>
      <Pressable style={styles.settingsRow} onPress={onStepsPress} android_ripple={{ color: 'rgba(255,255,255,0.1)' }}>
        <MaterialIcons name="directions-walk" size={20} color={COLORS.textSecondary} />
        <ThemedText style={[styles.settingsLabel, { color: COLORS.textPrimary }]}>Шагомер</ThemedText>
        <ThemedText style={[styles.settingsValue, { color: COLORS.textSecondary }]}>Настройки</ThemedText>
        <MaterialIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
      </Pressable>
      <Pressable style={styles.settingsRow} onPress={onNotificationsPress} android_ripple={{ color: 'rgba(255,255,255,0.1)' }}>
        <MaterialIcons name="notifications" size={20} color={COLORS.textSecondary} />
        <ThemedText style={[styles.settingsLabel, { color: COLORS.textPrimary }]}>Уведомления</ThemedText>
        <ThemedText style={[styles.settingsValue, { color: COLORS.textSecondary }]}>Настройки</ThemedText>
        <MaterialIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
      </Pressable>
      <View style={styles.settingsRow}>
        <MaterialIcons name="apple" size={20} color={COLORS.textSecondary} />
        <ThemedText style={[styles.settingsLabel, { color: COLORS.textPrimary }]}>Apple Health</ThemedText>
        <ThemedText style={[styles.settingsValue, { color: COLORS.textSecondary }]}>Подключено</ThemedText>
        <MaterialIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
      </View>
      <View style={styles.settingsRow}>
        <MaterialIcons name="straighten" size={20} color={COLORS.textSecondary} />
        <ThemedText style={[styles.settingsLabel, { color: COLORS.textPrimary }]}>Единицы</ThemedText>
        <ThemedText style={[styles.settingsValue, { color: COLORS.textSecondary }]}>Метрические</ThemedText>
        <MaterialIcons name="chevron-right" size={20} color={COLORS.textSecondary} />
      </View>
    </View>
  );
}

export default function ClientHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps) ?? 10000;
  const todayFormatted = useMemo(() => formatHealthDate(new Date()), []);
  const [animateTrigger, setAnimateTrigger] = useState(0);
  const requestSurveyShow = useSleepStore((s) => s.requestSurveyShow);

  useFocusEffect(
    useCallback(() => {
      setAnimateTrigger((t) => t + 1);
    }, [])
  );

  const goToSleep = useCallback(() => router.push('/client/sleep-screen'), [router]);
  const goToNotifications = useCallback(() => router.push('/notification-settings'), [router]);

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: COLORS.background }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={24} color={COLORS.accent} />
          <ThemedText style={[styles.backLabel, { color: COLORS.accent }]}>Назад</ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.titleRow}>
          <View style={styles.titleBlock}>
            <ThemedText style={[styles.title, { color: COLORS.textPrimary }]}>Здоровье</ThemedText>
            <ThemedText style={[styles.subtitle, { color: COLORS.textSecondary }]}>{todayFormatted}</ThemedText>
          </View>
          <Pressable
            style={[styles.rateSleepBtn, { backgroundColor: COLORS.accent }]}
            onPress={requestSurveyShow}
          >
            <ThemedText style={styles.rateSleepText}>Оценить сон</ThemedText>
          </Pressable>
        </View>

        <StepsCard stepsToday={stepsToday} stepsGoal={stepsGoal} animateTrigger={animateTrigger} />
        <RecommendationCard onPress={goToSleep} />
        <LastNightSleepCard onPress={goToSleep} />
        <SleepScheduleCard onPress={goToSleep} />
        <WaterIntakeCard />
        <HealthSettingsCard
          onStepsPress={() => router.push('/steps')}
          onNotificationsPress={goToNotifications}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  backButton: { flexDirection: 'row', alignItems: 'center', minWidth: 44, minHeight: 44 },
  backLabel: { fontSize: 16, marginLeft: 4 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  titleBlock: { flex: 1 },
  title: { fontSize: 28, fontWeight: 'bold', lineHeight: 36 },
  subtitle: { fontSize: 15, marginTop: 4 },
  rateSleepBtn: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 24,
    justifyContent: 'center',
    marginTop: 8,
  },
  rateSleepText: { fontSize: 14, fontWeight: '600', color: '#fff' },

  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
    overflow: 'visible',
  },
  cardIcon: { marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  cardHeaderRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },

  circleWrap: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'visible',
  },
  circleCenter: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    width: CIRCLE_SIZE - 48,
    paddingVertical: 16,
    overflow: 'visible',
  },
  stepsIcon: { marginBottom: 8 },
  stepsValue: { fontSize: 38, fontWeight: 'bold', lineHeight: 46 },
  stepsGoal: { fontSize: 14, marginTop: 2 },
  stepsLabel: { fontSize: 14, marginTop: 16, textAlign: 'center' },

  recommendationHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  recommendationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationSleepIcon: { marginTop: 4 },
  recommendationTitle: { fontSize: 17, fontWeight: 'bold', marginBottom: 8 },
  recommendationBody: { fontSize: 15, lineHeight: 22 },
  detailBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 4,
  },
  detailBtnText: { fontSize: 15, fontWeight: '600' },
  adviceModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  adviceModalContent: {
    width: '100%',
    height: ADVICE_MODAL_HEIGHT,
    backgroundColor: COLORS.cardBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  adviceModalScroll: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  adviceModalScrollContent: {
    paddingBottom: 24,
  },
  adviceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.trackGray,
  },
  adviceModalTitle: { fontSize: 18, fontWeight: 'bold' },
  adviceModalBody: {
    fontSize: 15,
    lineHeight: 24,
  },

  sleepValueWrap: { minHeight: 40, justifyContent: 'center', marginBottom: 4 },
  sleepValue: { fontSize: 32, fontWeight: 'bold', lineHeight: 40 },
  sleepSubtext: { fontSize: 14, lineHeight: 20 },

  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.trackGray,
  },
  scheduleLabelRow: { flexDirection: 'row', alignItems: 'center' },
  scheduleLabel: { fontSize: 15 },
  scheduleValue: { fontSize: 15 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.trackGray,
    borderRadius: 8,
  },
  pillText: { fontSize: 14, color: COLORS.textPrimary },
  toggleRow: { borderBottomWidth: 0 },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: { fontSize: 14, flex: 1 },

  waterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  waterValueWrap: { minHeight: 36, justifyContent: 'center' },
  waterValue: { fontSize: 28, fontWeight: 'bold', lineHeight: 36 },
  waterPercent: { fontSize: 16, fontWeight: '600', lineHeight: 22 },
  waterSubtext: { fontSize: 14, marginBottom: 12, lineHeight: 20 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 16,
  },
  progressFill: { height: '100%', borderRadius: 4 },
  addWaterBtn: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  addWaterBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
  waterModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  waterModalContent: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
  },
  waterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  waterPortionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  waterPortionBtn: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    minWidth: 70,
    alignItems: 'center',
  },
  waterModalClose: {
    alignSelf: 'center',
    padding: 8,
  },

  settingsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.trackGray,
    gap: 12,
  },
  settingsLabel: { fontSize: 15, flex: 1 },
  settingsValue: { fontSize: 14 },
});
