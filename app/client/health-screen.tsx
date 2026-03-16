import { useEffect, useState, useCallback } from 'react';
import { StyleSheet, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import { useActivityTrackerStore } from '@/stores/activity-tracker-store';
import { useStepsStore } from '@/stores/steps-store';
import { useToast } from '@/context/toast-context';
import { useActivityTracker } from '@/hooks/use-activity-tracker';
import { useHealthReminders } from '@/hooks/use-health-reminders';
import { stepLengthMetersFromHeight, stepsToKm } from '@/lib/steps-utils';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';
const TRACKER_ACTIVE_TEAL = '#1CC7A5';

export default function ClientHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const background = useThemeColor({}, 'background');

  const { statistics, healthReminders, autoStartInWorkingHours, setHealthReminders, setAutoStartInWorkingHours } =
    useActivityTrackerStore();
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps);
  const stepsHeightCm = useStepsStore((s) => s.settings.heightCm);
  const stepLengthM = stepsHeightCm && stepsHeightCm > 0 ? stepLengthMetersFromHeight(stepsHeightCm) : 0.7;
  const stepsKmToday = stepsToKm(stepsToday, stepLengthM);

  const { isTracking, startTracking, stopTracking, requestPermission, isAvailable } = useActivityTracker();
  useHealthReminders();

  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hours > 0) return `${hours}ч ${minutes}м ${secs.toString().padStart(2, '0')}с`;
    if (minutes > 0) return `${minutes}м ${secs.toString().padStart(2, '0')}с`;
    return `${secs}с`;
  }, []);

  const handleToggleTracker = useCallback(async () => {
    if (isTracking) {
      stopTracking(true);
      show({ title: 'Трекер остановлен', variant: 'default', duration: 2000 });
    } else {
      if (isAvailable === false) {
        show({
          title: 'Датчики недоступны',
          description: 'Акселерометр не доступен на этом устройстве',
          variant: 'destructive',
          duration: 4000,
        });
        return;
      }
      const granted = await requestPermission();
      if (!granted) {
        show({
          title: 'Доступ к датчикам',
          description: 'Разрешите доступ к датчикам движения для работы трекера.',
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }
      startTracking(true);
      show({ title: 'Трекер запущен', description: 'Отслеживание активности начато', variant: 'success', duration: 2000 });
    }
  }, [isTracking, isAvailable, startTracking, stopTracking, requestPermission, show]);

  const Toggle = ({ value, onToggle }: { value: boolean; onToggle: () => void }) => (
    <Pressable onPress={onToggle} style={styles.toggleContainer}>
      <View style={[styles.toggleTrack, { backgroundColor: value ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' }]}>
        <View style={[styles.toggleThumb, { backgroundColor: value ? '#FFFFFF' : 'rgba(255,255,255,0.4)', transform: [{ translateX: value ? 20 : 0 }] }]} />
      </View>
    </Pressable>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Health трекер" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <ThemedText style={styles.sectionTitle}>Общая статистика</ThemedText>
        <View style={styles.statsGrid}>
          <Pressable onPress={handleToggleTracker} style={[styles.statCard, { backgroundColor: isTracking ? TRACKER_ACTIVE_TEAL : CARD_ORANGE }]}>
            <View style={styles.statCardContent}>
              <View>
                <ThemedText style={styles.statCardTitle}>Трекер</ThemedText>
                <ThemedText style={styles.statCardSubtitle}>{isTracking ? 'Вкл.' : 'Выкл.'}</ThemedText>
              </View>
              <View style={styles.statIconContainer}>
                <MaterialIcons name={isTracking ? 'pause' : 'play-arrow'} size={24} color="#FFFFFF" />
              </View>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push('/steps')} style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
            <View style={styles.statCardContent}>
              <View>
                <ThemedText style={styles.statCardTitle}>Шаги</ThemedText>
                <ThemedText style={[styles.statCardSubtitle, { opacity: 0.9 }]}>{stepsGoal ? `Цель ${stepsGoal.toLocaleString('ru-RU')}` : 'Датчик шагов'}</ThemedText>
              </View>
              <MaterialIcons name="directions-walk" size={24} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statCardValue}>{stepsToday.toLocaleString('ru-RU')}</ThemedText>
            <ThemedText style={[styles.statCardSubtitle, { marginTop: 2, opacity: 0.85, fontSize: 11 }]}>~{stepsKmToday.toFixed(2)} км</ThemedText>
          </Pressable>
          <View style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
            <View style={styles.statCardContent}>
              <View>
                <ThemedText style={styles.statCardTitle}>Время сидя</ThemedText>
              </View>
              <MaterialIcons name="access-time" size={24} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statCardValue}>{formatTime(statistics.totalSittingTime)}</ThemedText>
          </View>
          <View style={[styles.statCard, styles.statCardLarge, { backgroundColor: CARD_ORANGE }]}>
            <ThemedText style={styles.statCardTitle}>Общее время отслеживания</ThemedText>
            <ThemedText style={styles.statCardValueLarge}>{formatTime(statistics.totalSittingTime + statistics.totalStandingTime)}</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
            <View style={styles.statCardContent}>
              <View>
                <ThemedText style={styles.statCardTitle}>Время стоя</ThemedText>
              </View>
              <MaterialIcons name="trending-up" size={24} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statCardValue}>{formatTime(statistics.totalStandingTime)}</ThemedText>
          </View>
          <View style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
            <View style={styles.statCardContent}>
              <View style={{ flex: 1 }}>
                <ThemedText style={[styles.statCardTitle, { fontSize: 13 }]}>Количество вставаний</ThemedText>
              </View>
              <MaterialIcons name="bar-chart" size={24} color="#FFFFFF" />
            </View>
            <ThemedText style={styles.statCardValue}>{statistics.standUpCount}</ThemedText>
          </View>
        </View>

        <ThemedText style={[styles.sectionTitle, { marginTop: 24 }]}>Настройки</ThemedText>
        <Pressable onPress={() => setHealthReminders({ enabled: !healthReminders.enabled })} style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsTextContainer}>
              <ThemedText style={styles.settingsCardTitle}>Напоминания</ThemedText>
              <ThemedText style={styles.settingsCardSubtitle}>Напоминать вставать каждые {healthReminders.sittingIntervalMinutes} мин</ThemedText>
            </View>
            <Toggle value={healthReminders.enabled} onToggle={() => setHealthReminders({ enabled: !healthReminders.enabled })} />
          </View>
          <View style={{ marginTop: 16 }}>
            <ThemedText style={styles.settingsCardTitle}>Интервал напоминаний</ThemedText>
            <View style={styles.intervalButtons}>
              {[2, 30, 45, 60, 90, 120].map((mins) => {
                const isActive = healthReminders.sittingIntervalMinutes === mins;
                return (
                  <Pressable
                    key={mins}
                    onPress={() => setHealthReminders({ sittingIntervalMinutes: mins })}
                    style={[styles.intervalButton, { backgroundColor: isActive ? TRACKER_ACTIVE_TEAL : 'rgba(255,255,255,0.2)' }]}
                  >
                    <ThemedText style={[styles.intervalButtonText, { color: '#FFFFFF' }]}>{mins} мин</ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </Pressable>
        <Pressable onPress={() => setAutoStartInWorkingHours(!autoStartInWorkingHours)} style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsTextContainer}>
              <ThemedText style={styles.settingsCardTitle}>Автозапуск трекера</ThemedText>
              <ThemedText style={styles.settingsCardSubtitle}>Запускать в рабочее время</ThemedText>
            </View>
            <Toggle value={autoStartInWorkingHours} onToggle={() => setAutoStartInWorkingHours(!autoStartInWorkingHours)} />
          </View>
        </Pressable>
        <Pressable
          onPress={() => setHealthReminders({ disableDuringMeetings: !healthReminders.disableDuringMeetings })}
          style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}
        >
          <View style={styles.settingsRow}>
            <View style={styles.settingsTextContainer}>
              <ThemedText style={styles.settingsCardTitle}>Тихий режим на встречах</ThemedText>
              <ThemedText style={styles.settingsCardSubtitle}>Отключать напоминания во время встреч</ThemedText>
            </View>
            <Toggle value={healthReminders.disableDuringMeetings} onToggle={() => setHealthReminders({ disableDuringMeetings: !healthReminders.disableDuringMeetings })} />
          </View>
        </Pressable>
        <Pressable onPress={() => router.push('/steps')} style={[styles.settingsCard, { backgroundColor: CARD_GREEN }]}>
          <View style={styles.settingsRow}>
            <View style={styles.settingsTextContainer}>
              <ThemedText style={styles.settingsCardTitle}>Шагомер</ThemedText>
              <ThemedText style={styles.settingsCardSubtitle}>Цель, история, уведомления</ThemedText>
            </View>
            <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
          </View>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  sectionTitle: { fontSize: 14, color: 'rgba(255,255,255,0.8)' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
  statCard: { width: CARD_WIDTH, borderRadius: 16, padding: 16, minHeight: 100 },
  statCardLarge: { height: 140 },
  statCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statCardTitle: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  statCardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statCardValue: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
  statCardValueLarge: { fontSize: 24, fontWeight: 'bold', color: '#FFFFFF', marginTop: 16 },
  statIconContainer: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  settingsCard: { borderRadius: 16, padding: 16, marginTop: 12 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsTextContainer: { flex: 1, marginRight: 16 },
  settingsCardTitle: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  settingsCardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  toggleContainer: { padding: 4 },
  toggleTrack: { width: 52, height: 28, borderRadius: 14, padding: 2, justifyContent: 'center' },
  toggleThumb: { width: 24, height: 24, borderRadius: 12 },
  intervalButtons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  intervalButton: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 12 },
  intervalButtonText: { fontSize: 13, fontWeight: '500' },
});
