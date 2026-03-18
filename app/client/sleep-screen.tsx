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

const COLORS = {
  background: '#1a1a1a',
  cardBg: '#2a2a2a',
  accent: '#FF5722',
  textPrimary: '#ffffff',
  textSecondary: '#888888',
  trackGray: '#3a3a3a',
  warningBorder: 'rgba(255, 87, 34, 0.5)',
  warningBg: 'rgba(255, 87, 34, 0.15)',
};

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


  const goalHours = Math.floor(settings.goalMinutes / 60);
  const scheduledMinutes = getScheduledSleepMinutes(settings);
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
        { paddingTop: insets.top, paddingBottom: insets.bottom + 24 },
      ]}
    >
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={styles.backButton}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
        >
          <MaterialIcons name="chevron-left" size={24} color={COLORS.accent} />
          <ThemedText style={[styles.backLabel, { color: COLORS.accent }]}>
            Назад
          </ThemedText>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.title, { color: COLORS.textPrimary }]}>
          Сон
        </ThemedText>

        {/* Рекомендации */}
        {recommendations.length > 0 && (
          <View style={styles.card}>
            <View style={styles.recommendationHeader}>
              <View
                style={[
                  styles.recommendationIconWrap,
                  { backgroundColor: COLORS.accent },
                ]}
              >
                <MaterialIcons
                  name="lightbulb-outline"
                  size={24}
                  color="#fff"
                />
              </View>
              <ThemedText
                style={[styles.recommendationTitle, { color: COLORS.textPrimary }]}
              >
                Рекомендации на сегодня
              </ThemedText>
            </View>
            {recommendations.map((rec, i) => (
              <ThemedText
                key={i}
                style={[
                  styles.recommendationBody,
                  { color: COLORS.textSecondary },
                ]}
              >
                • {rec}
              </ThemedText>
            ))}
            <Pressable
              style={styles.detailBtn}
              onPress={() => setShowDetailModal(true)}
            >
              <ThemedText style={[styles.detailBtnText, { color: COLORS.accent }]}>
                Подробнее
              </ThemedText>
              <MaterialIcons name="arrow-forward" size={16} color={COLORS.accent} />
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
                  {rating ? FULL_SLEEP_ADVICE[rating as SleepRating] : recommendations[0] ?? ''}
                </ThemedText>
              </ScrollView>
          </View>
        </Pressable>
        </Modal>

        {/* Сон прошлой ночи */}
        <View style={styles.card}>
          <MaterialIcons
            name="nightlight-round"
            size={24}
            color={COLORS.accent}
            style={styles.cardIcon}
          />
          <ThemedText
            style={[styles.cardTitle, { color: COLORS.textPrimary }]}
          >
            Сон прошлой ночи
          </ThemedText>
          {lastNightMinutes != null ? (
            <>
              <View style={styles.sleepValueWrap}>
                <ThemedText
                  style={[styles.sleepValue, { color: COLORS.textPrimary }]}
                >
                  {formatSleepDuration(lastNightMinutes)}
                </ThemedText>
              </View>
              {avg7DaysMinutes != null && (
                <ThemedText
                  style={[styles.sleepSubtext, { color: COLORS.textSecondary }]}
                >
                  Среднее за 7 дней: {formatSleepDuration(avg7DaysMinutes)}
                </ThemedText>
              )}
            </>
          ) : (
            <View style={styles.emptyState}>
              <ThemedText
                style={[styles.emptyText, { color: COLORS.textSecondary }]}
              >
                Нет данных сна из Apple Health
              </ThemedText>
              <Pressable style={styles.connectBtn}>
                <ThemedText style={styles.connectBtnText}>
                  Подключить Apple Health
                </ThemedText>
              </Pressable>
            </View>
          )}
        </View>

        {/* Настройки расписания */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}>
            <MaterialIcons
              name="schedule"
              size={20}
              color={COLORS.textSecondary}
            />
            <ThemedText
              style={[styles.cardTitle, { color: COLORS.textPrimary, marginLeft: 8 }]}
            >
              Расписание сна
            </ThemedText>
          </View>

          <View style={styles.scheduleRow}>
            <ThemedText
              style={[styles.scheduleLabel, { color: COLORS.textPrimary }]}
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
                    goalHours === h && styles.pillActive,
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.pillText,
                      goalHours === h && { color: '#fff' },
                    ]}
                  >
                    {h}ч
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.scheduleRow}>
            <View style={styles.scheduleLabelRow}>
              <MaterialIcons
                name="nightlight-round"
                size={16}
                color={COLORS.textSecondary}
              />
              <ThemedText
                style={[
                  styles.scheduleLabel,
                  { color: COLORS.textPrimary, marginLeft: 6 },
                ]}
              >
                Время сна
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setTimePickerMode('bed')}
              style={styles.pill}
            >
              <ThemedText style={styles.pillText}>{bedtimeStr}</ThemedText>
              <MaterialIcons name="chevron-right" size={14} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
            </Pressable>
          </View>

          <View style={styles.scheduleRow}>
            <View style={styles.scheduleLabelRow}>
              <MaterialIcons
                name="wb-sunny"
                size={16}
                color={COLORS.textSecondary}
              />
              <ThemedText
                style={[
                  styles.scheduleLabel,
                  { color: COLORS.textPrimary, marginLeft: 6 },
                ]}
              >
                Время подъёма
              </ThemedText>
            </View>
            <Pressable
              onPress={() => setTimePickerMode('wake')}
              style={styles.pill}
            >
              <ThemedText style={styles.pillText}>{wakeStr}</ThemedText>
              <MaterialIcons name="chevron-right" size={14} color={COLORS.textSecondary} style={{ marginLeft: 4 }} />
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
              <Pressable style={styles.modalContent} onPress={(e) => e.stopPropagation()}>
                <ThemedText style={[styles.modalTitle, { color: COLORS.textPrimary }]}>
                  {timePickerMode === 'bed' ? 'Время отхода ко сну' : 'Время пробуждения'}
                </ThemedText>
                <ScrollView style={styles.timeList}>
                  {options.map(([h, m]) => (
                    <Pressable
                      key={`${h}-${m}`}
                      onPress={() => handleTimeSelect(h, m)}
                      style={styles.timeOption}
                    >
                      <ThemedText style={{ color: COLORS.textPrimary, fontSize: 16 }}>
                        {pad2(h)}:{pad2(m)}
                      </ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
                <Pressable onPress={() => setTimePickerMode(null)} style={styles.modalClose}>
                  <ThemedText style={{ color: COLORS.textSecondary }}>Отмена</ThemedText>
                </Pressable>
              </Pressable>
            </Pressable>
          </Modal>

          <View style={[styles.scheduleRow, { opacity: 0.8 }]}>
            <ThemedText
              style={[styles.scheduleLabel, { color: COLORS.textSecondary }]}
            >
              По расписанию
            </ThemedText>
            <ThemedText
              style={[styles.scheduleValue, { color: COLORS.textSecondary }]}
            >
              {formatSleepDuration(scheduledMinutes)}
            </ThemedText>
          </View>

          {scheduleWarning && (
            <View
              style={[
                styles.warningBanner,
                {
                  borderColor: COLORS.warningBorder,
                  backgroundColor: COLORS.warningBg,
                },
              ]}
            >
              <MaterialIcons
                name="warning"
                size={18}
                color={COLORS.accent}
              />
              <ThemedText
                style={[styles.warningText, { color: COLORS.textPrimary }]}
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
                color={COLORS.textSecondary}
              />
              <ThemedText
                style={[
                  styles.scheduleLabel,
                  { color: COLORS.textPrimary, marginLeft: 8 },
                ]}
              >
                Уведомления о сне
              </ThemedText>
            </View>
            <Switch
              value={settings.notificationsEnabled}
              onValueChange={handleNotificationsChange}
              trackColor={{
                false: COLORS.trackGray,
                true: COLORS.accent,
              }}
              thumbColor="#fff"
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
    backgroundColor: COLORS.background,
  },
  header: {
    paddingHorizontal: 16,
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
    marginBottom: 24,
  },
  card: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
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
  emptyState: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  emptyText: { fontSize: 15, marginBottom: 12 },
  connectBtn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: COLORS.accent,
    borderRadius: 12,
  },
  connectBtnText: { fontSize: 15, fontWeight: '600', color: '#fff' },
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
  pillRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.trackGray,
    borderRadius: 8,
  },
  pillActive: {
    backgroundColor: COLORS.accent,
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: COLORS.cardBg,
    borderRadius: 16,
    padding: 20,
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
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.trackGray,
  },
  modalClose: {
    alignSelf: 'center',
    marginTop: 16,
    padding: 8,
  },
});
