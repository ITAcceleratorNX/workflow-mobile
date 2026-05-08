import { useCallback, useMemo, useState } from 'react';
import {
  Dimensions,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  formatSleepDuration,
  FULL_SLEEP_ADVICE,
  getScheduledSleepMinutes,
  type SleepRating,
  useSleepStore,
} from '@/stores/sleep-store';
import { formatDateForApi } from '@/lib/dateTimeUtils';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const ADVICE_MODAL_HEIGHT = Math.floor(SCREEN_HEIGHT * 0.85);

function useSleepScreenColors() {
  const background = useThemeColor({}, 'background');
  const cardBg = useThemeColor({}, 'surfaceElevated');
  const track = useThemeColor({}, 'surfaceMuted');
  const textPrimary = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const accent = useThemeColor({}, 'primary');
  const onAccent = useThemeColor({}, 'onPrimary');
  const divider = useThemeColor({}, 'divider');
  const warningBg = useThemeColor({}, 'accentSoft');
  const warningBorder = useThemeColor({}, 'primary');

  return useMemo(
    () => ({
      background,
      cardBg,
      track,
      textPrimary,
      textSecondary,
      accent,
      onAccent,
      divider,
      warningBg,
      warningBorder,
    }),
    [
      background,
      cardBg,
      track,
      textPrimary,
      textSecondary,
      accent,
      onAccent,
      divider,
      warningBg,
      warningBorder,
    ]
  );
}

function pad2(n: number) {
  return n.toString().padStart(2, '0');
}

const BEDTIME_OPTIONS = [
  [20, 0], [20, 30], [21, 0], [21, 30], [22, 0], [22, 30], [23, 0], [23, 30], [0, 0],
];
const WAKE_OPTIONS = [
  [5, 0], [5, 30], [6, 0], [6, 30], [7, 0], [7, 30], [8, 0], [8, 30], [9, 0],
];

export default function SleepScreen() {
  const colors = useSleepScreenColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const settings = useSleepStore((s) => s.settings);
  const setSettings = useSleepStore((s) => s.setSettings);
  const todayKey = useMemo(() => formatDateForApi(new Date()), []);
  const dayRecord = useSleepStore((s) => s.dayRecords[todayKey]);
  const recommendations = dayRecord?.recommendations ?? [];
  const rating = dayRecord?.rating ?? null;
  const [showDetailModal, setShowDetailModal] = useState(false);
  const lastNightMinutes = useSleepStore((s) => s.lastNightSleepMinutes);
  const avg7DaysMinutes = useSleepStore((s) => s.avgSleep7DaysMinutes);
  const requestSurveyShow = useSleepStore((s) => s.requestSurveyShow);
  const todayRating = useSleepStore((s) => s.dayRecords[todayKey]?.rating ?? null);
  const scheduledMinutes = getScheduledSleepMinutes(settings);


  const goalHours = Math.floor(settings.goalMinutes / 60);
  const scheduleWarning = scheduledMinutes < settings.goalMinutes;

  const [timePickerMode, setTimePickerMode] = useState<'bed' | 'wake' | null>(null);
  const bedtimeStr = `${pad2(settings.bedtimeHour)}:${pad2(settings.bedtimeMinute)}`;
  const wakeStr = `${pad2(settings.wakeHour)}:${pad2(settings.wakeMinute)}`;

  const options = timePickerMode === 'bed' ? BEDTIME_OPTIONS : WAKE_OPTIONS;
  const handleTimeSelect = useCallback(
    (hour: number, minute: number) => {
      if (timePickerMode === 'bed') {
        setSettings({ bedtimeHour: hour, bedtimeMinute: minute });
      } else {
        setSettings({ wakeHour: hour, wakeMinute: minute });
      }
      setTimePickerMode(null);
    },
    [timePickerMode, setSettings]
  );

  const handleGoalChange = useCallback(
    (hours: number) => {
      setSettings({ goalMinutes: hours * 60 });
    },
    [setSettings]
  );

  const handleNotificationsChange = useCallback(
    (value: boolean) => {
      setSettings({ notificationsEnabled: value });
    },
    [setSettings]
  );

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: colors.background,
          paddingTop: insets.top,
          paddingBottom: insets.bottom + Spacing.xl,
        },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Назад"
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="chevron-left" size={24} color={colors.accent} />
          <ThemedText style={[styles.backLabel, { color: colors.accent }]}>
            Назад
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.title, { color: colors.textPrimary }]}>
          Сон
        </ThemedText>

        {/* Рекомендации */}
        {recommendations.length > 0 && (
          <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
            <View style={styles.recommendationHeader}>
              <View
                style={[
                  styles.recommendationIconWrap,
                  { backgroundColor: colors.accent },
                ]}
              >
                <MaterialIcons
                  name="lightbulb-outline"
                  size={24}
                  color={colors.onAccent}
                />
              </View>
              <ThemedText
                style={[styles.recommendationTitle, { color: colors.textPrimary }]}
              >
                Рекомендации на сегодня
              </ThemedText>
            </View>
            {recommendations.map((rec, i) => (
              <ThemedText
                key={i}
                style={[
                  styles.recommendationBody,
                  { color: colors.textSecondary },
                ]}
              >
                • {rec}
              </ThemedText>
            ))}
            <Pressable
              style={styles.detailBtn}
              onPress={() => setShowDetailModal(true)}
              accessibilityRole="button"
              accessibilityLabel="Подробнее про рекомендации"
            >
              <ThemedText style={[styles.detailBtnText, { color: colors.accent }]}>
                Подробнее
              </ThemedText>
              <MaterialIcons name="arrow-forward" size={16} color={colors.accent} />
            </Pressable>
          </View>
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
            <View style={[styles.adviceModalContent, { backgroundColor: colors.cardBg }]}>
              <View style={[styles.adviceModalHeader, { borderBottomColor: colors.divider }]}>
                <ThemedText style={[styles.adviceModalTitle, { color: colors.textPrimary }]}>
                  Как улучшить сон
                </ThemedText>
                <Pressable onPress={() => setShowDetailModal(false)} hitSlop={12}>
                  <MaterialIcons name="close" size={24} color={colors.textSecondary} />
                </Pressable>
              </View>
              <ScrollView
                style={styles.adviceModalScroll}
                contentContainerStyle={styles.adviceModalScrollContent}
                showsVerticalScrollIndicator={true}
              >
                <ThemedText style={[styles.adviceModalBody, { color: colors.textSecondary }]}>
                  {rating ? FULL_SLEEP_ADVICE[rating as SleepRating] : recommendations[0] ?? ''}
                </ThemedText>
              </ScrollView>
          </View>
        </Pressable>
        </Modal>

        {/* Сон прошлой ночи */}
        <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
          <MaterialIcons
            name="nightlight-round"
            size={24}
            color={colors.accent}
            style={styles.cardIcon}
          />
          <ThemedText
            style={[styles.cardTitle, { color: colors.textPrimary }]}
          >
            Сон прошлой ночи
          </ThemedText>
          {lastNightMinutes != null ? (
            <>
              <View style={styles.sleepValueWrap}>
                <ThemedText style={[styles.sleepValue, { color: colors.textPrimary }]}>
                  {formatSleepDuration(lastNightMinutes)}
                </ThemedText>
                {todayRating != null && (
                  <ThemedText style={[styles.sleepEstimateHint, { color: colors.textSecondary }]}>
                    Оценка по расписанию
                  </ThemedText>
                )}
              </View>
              {avg7DaysMinutes != null && (
                <ThemedText style={[styles.sleepSubtext, { color: colors.textSecondary }]}>
                  Среднее за 7 дней: {formatSleepDuration(avg7DaysMinutes)}
                </ThemedText>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText style={[styles.emptyText, { color: colors.textSecondary }]}>
                Оцените сон, чтобы увидеть длительность
              </ThemedText>
              <Pressable
                style={[styles.connectBtn, { backgroundColor: colors.accent }]}
                onPress={requestSurveyShow}
                accessibilityRole="button"
                accessibilityLabel="Оценить сон"
              >
                <ThemedText style={[styles.connectBtnText, { color: colors.onAccent }]}>
                  Оценить сон
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Настройки расписания */}
        <View style={[styles.card, { backgroundColor: colors.cardBg }]}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons
              name="schedule"
              size={20}
              color={colors.textSecondary}
            />
            <ThemedText
              style={[styles.cardTitle, { color: colors.textPrimary, marginLeft: Spacing.sm }]}
            >
              Расписание сна
            </ThemedText>
          </View>

          <View style={[styles.scheduleRow, { borderBottomColor: colors.divider }]}>
            <ThemedText
              style={[styles.scheduleLabel, { color: colors.textPrimary }]}
            >
              Цель сна
            </ThemedText>
            <View style={styles.pillRow}>
              {[6, 7, 8, 9].map((h) => (
                <Pressable
                  key={h}
                  onPress={() => handleGoalChange(h)}
                  style={[
                    styles.pill,
                    { backgroundColor: colors.track },
                    goalHours === h && { backgroundColor: colors.accent },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.pillText,
                      { color: colors.textPrimary },
                      goalHours === h && { color: colors.onAccent },
                    ]}
                  >
                    {h}ч
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={[styles.scheduleRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.scheduleLabelRow}>
              <MaterialIcons
                name="nightlight-round"
                size={16}
                color={colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.scheduleLabel,
                  { color: colors.textPrimary, marginLeft: 6 },
                ]}
              >
                Время сна
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setTimePickerMode('bed')}
              style={[styles.pill, { backgroundColor: colors.track }]}
            >
              <ThemedText style={[styles.pillText, { color: colors.textPrimary }]}>{bedtimeStr}</ThemedText>
              <MaterialIcons name="chevron-right" size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          <View style={[styles.scheduleRow, { borderBottomColor: colors.divider }]}>
            <View style={styles.scheduleLabelRow}>
              <MaterialIcons
                name="wb-sunny"
                size={16}
                color={colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.scheduleLabel,
                  { color: colors.textPrimary, marginLeft: 6 },
                ]}
              >
                Время подъёма
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setTimePickerMode('wake')}
              style={[styles.pill, { backgroundColor: colors.track }]}
            >
              <ThemedText style={[styles.pillText, { color: colors.textPrimary }]}>{wakeStr}</ThemedText>
              <MaterialIcons name="chevron-right" size={14} color={colors.textSecondary} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          <Modal
            visible={timePickerMode !== null}
            transparent
            animationType="fade"
            onRequestClose={() => setTimePickerMode(null)}
          >
            <Pressable
              style={styles.modalOverlay}
              onPress={() => setTimePickerMode(null)}
            >
              <Pressable
                style={[styles.modalContent, { backgroundColor: colors.cardBg }]}
                onPress={(e) => e.stopPropagation()}
              >
                <ThemedText style={[styles.modalTitle, { color: colors.textPrimary }]}>
                  {timePickerMode === 'bed' ? 'Время отхода ко сну' : 'Время пробуждения'}
                </ThemedText>
                <ScrollView style={styles.timeList}>
                  {options.map(([h, m]) => (
                    <Pressable
                      key={`${h}-${m}`}
                      onPress={() => handleTimeSelect(h, m)}
                      style={[styles.timeOption, { borderBottomColor: colors.divider }]}
                    >
                      <ThemedText style={{ color: colors.textPrimary, fontSize: 16 }}>
                        {pad2(h)}:{pad2(m)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable onPress={() => setTimePickerMode(null)} style={styles.modalClose}>
                  <ThemedText style={{ color: colors.textSecondary }}>Отмена</ThemedText>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={[styles.scheduleRow, { opacity: 0.8, borderBottomColor: colors.divider }]}>
            <ThemedText
              style={[styles.scheduleLabel, { color: colors.textSecondary }]}
            >
              По расписанию
            </ThemedText>
            <ThemedText
              style={[styles.scheduleValue, { color: colors.textSecondary }]}
            >
              {formatSleepDuration(scheduledMinutes)}
            </ThemedText>
          </View>

          {scheduleWarning && (
            <View
              style={[
                styles.warningBanner,
                {
                  borderColor: colors.warningBorder,
                  backgroundColor: colors.warningBg,
                },
              ]}
            >
              <MaterialIcons
                name="warning"
                size={18}
                color={colors.accent}
              />
              <ThemedText
                style={[styles.warningText, { color: colors.textPrimary }]}
              >
                Расписание не соответствует цели сна
              </ThemedText>
            </View>
          )}

          <View style={[styles.scheduleRow, styles.toggleRow]}>
            <View style={styles.scheduleLabelRow}>
              <MaterialIcons
                name="notifications"
                size={18}
                color={colors.textSecondary}
              />
              <ThemedText
                style={[
                  styles.scheduleLabel,
                  { color: colors.textPrimary, marginLeft: Spacing.sm },
                ]}
              >
                Уведомления о сне
              </ThemedText>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleNotificationsChange}
              trackColor={{
                false: colors.track,
                true: colors.accent,
              }}
              thumbColor={colors.onAccent}
            />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: 4,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  backLabel: { fontSize: 16, marginLeft: 4 },
  content: { paddingHorizontal: 16, paddingTop: 12 },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    lineHeight: 36,
    marginBottom: Spacing.xl,
  },
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.xl - 4,
    marginBottom: Spacing.lg,
  },
  cardIcon: { marginBottom: 8 },
  cardTitle: { fontSize: 17, fontWeight: '600', marginBottom: 8 },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recommendationIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recommendationTitle: { fontSize: 17, fontWeight: 'bold', marginLeft: 12 },
  recommendationBody: {
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 8,
  },
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
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
  },
  adviceModalScroll: {
    flex: 1,
    paddingHorizontal: Spacing.xl - 4,
    paddingTop: Spacing.lg,
  },
  adviceModalScrollContent: {
    paddingBottom: 24,
  },
  adviceModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.xl - 4,
    paddingBottom: Spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  adviceModalTitle: { fontSize: 18, fontWeight: 'bold' },
  adviceModalBody: {
    fontSize: 15,
    lineHeight: 24,
  },
  sleepValueWrap: { minHeight: 40, justifyContent: 'center', marginBottom: 4 },
  sleepValue: { fontSize: 32, fontWeight: 'bold', lineHeight: 40 },
  sleepEstimateHint: { fontSize: 12, lineHeight: 16, marginTop: 2 },
  sleepSubtext: { fontSize: 14, lineHeight: 20 },
  emptyState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 15, marginBottom: 12 },
  connectBtn: {
    paddingVertical: 10,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
  },
  connectBtnText: { fontSize: 15, fontWeight: '600' },
  scheduleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  scheduleLabelRow: { flexDirection: 'row', alignItems: 'center' },
  scheduleLabel: { fontSize: 15 },
  scheduleValue: { fontSize: 15 },
  pillRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 6,
    borderRadius: Radius.sm,
  },
  pillText: { fontSize: 14 },
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: Spacing.xl,
  },
  modalContent: {
    borderRadius: Radius.lg,
    padding: Spacing.xl - 4,
    maxHeight: 400,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  timeList: { maxHeight: 280 },
  timeOption: {
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalClose: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
});
