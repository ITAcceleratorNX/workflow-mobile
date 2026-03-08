import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextInput } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useStepsReminders } from '@/hooks/use-steps-reminders';
import {
  calculateStepGoal,
  stepLengthMetersFromHeight,
  stepsToKm,
  toDateKey,
} from '@/lib/steps-utils';
import { useStepsStore } from '@/stores/steps-store';

type StepsTab = 'today' | 'history' | 'settings';

export default function StepsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<StepsTab>('today');

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');

  const {
    stepsToday,
    history,
    settings,
    setSettings,
    recalculateAndSaveGoal,
    pedometerAvailable: isAvailable,
    pedometerLoading: isLoading,
  } = useStepsStore();

  useStepsReminders();

  const goal = settings.goalSteps ?? 0;
  const heightCm = settings.heightCm ?? 0;
  const stepLengthM = heightCm > 0 ? stepLengthMetersFromHeight(heightCm) : 0.7;
  const kmToday = stepsToKm(stepsToday, stepLengthM);
  const todayKey = toDateKey(new Date());

  const handleRecalculateGoal = useCallback(() => {
    if (settings.heightCm == null || settings.weightKg == null) return;
    recalculateAndSaveGoal();
  }, [settings.heightCm, settings.weightKg, recalculateAndSaveGoal]);

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr + 'T12:00:00');
    const today = new Date();
    if (dateStr === toDateKey(today)) return 'Сегодня';
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    if (dateStr === toDateKey(yesterday)) return 'Вчера';
    return d.toLocaleDateString('ru-RU', {
      day: 'numeric',
      month: 'short',
      weekday: 'short',
    });
  };

  if (isLoading) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </Pressable>
          <ThemedText style={styles.title}>Шаги</ThemedText>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </ThemedView>
    );
  }

  if (isAvailable === false) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
        <View style={styles.backRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </Pressable>
          <ThemedText style={styles.title}>Шаги</ThemedText>
        </View>
        <View style={styles.centered}>
          <MaterialIcons name="directions-walk" size={64} color={textMuted} />
          <ThemedText style={[styles.unavailableTitle, { color: text }]}>
            Шагомер недоступен
          </ThemedText>
          <ThemedText style={[styles.unavailableSubtitle, { color: textMuted }]}>
            На этом устройстве нет датчика шагов или доступ запрещён.
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 24 }]}>
      <View style={[styles.backRow, { borderColor: border }]}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={text} />
        </Pressable>
        <ThemedText style={styles.title}>Шаги</ThemedText>
      </View>

      <View style={[styles.tabsRow, { borderColor: border }]}>
        {(['today', 'history', 'settings'] as const).map((tab) => (
          <Pressable
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[
              styles.tab,
              activeTab === tab && { backgroundColor: border },
            ]}
          >
            <ThemedText
              style={[styles.tabLabel, { color: activeTab === tab ? text : textMuted }]}
            >
              {tab === 'today' ? 'Сегодня' : tab === 'history' ? 'История' : 'Настройки'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {activeTab === 'today' && (
          <View style={[styles.section, styles.sectionToday]}>
            <View style={styles.stepsNumberWrap}>
              <ThemedText
                style={[styles.stepsBig, { color: text }]}
                numberOfLines={1}
                adjustsFontSizeToFit
                minimumFontScale={0.35}
              >
                {stepsToday.toLocaleString('ru-RU')}
              </ThemedText>
            </View>
            <ThemedText style={[styles.stepsLabel, { color: textMuted }]}>
              шагов за сегодня
            </ThemedText>
            {goal > 0 && (
              <ThemedText style={[styles.goalLine, { color: text }]}>
                Цель: {goal.toLocaleString('ru-RU')}
              </ThemedText>
            )}
            <ThemedText style={[styles.kmLine, { color: textMuted }]}>
              Километры — приблизительно: {kmToday.toFixed(2)} км
            </ThemedText>
          </View>
        )}

        {activeTab === 'history' && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: text }]}>
              История (неделя)
            </ThemedText>
            <View style={[styles.historyCard, { borderColor: border }]}>
              {[
                { date: todayKey, steps: stepsToday },
                ...history,
              ]
                .slice(0, 7)
                .map(({ date, steps }) => (
                  <View
                    key={date}
                    style={[styles.historyRow, { borderColor: border }]}
                  >
                    <ThemedText style={[styles.historyDate, { color: text }]}>
                      {formatDate(date)}
                    </ThemedText>
                    <ThemedText style={[styles.historySteps, { color: text }]}>
                      {steps.toLocaleString('ru-RU')} шагов
                    </ThemedText>
                    <ThemedText style={[styles.historyKm, { color: textMuted }]}>
                      {stepsToKm(steps, stepLengthM).toFixed(2)} км
                    </ThemedText>
                  </View>
                ))}
            </View>
          </View>
        )}

        {activeTab === 'settings' && (
          <View style={styles.section}>
            <ThemedText style={[styles.sectionTitle, { color: text }]}>
              Настройки
            </ThemedText>
            <View style={[styles.settingsCard, { borderColor: border }]}>
              <TextInput
                label="Рост (см)"
                placeholder="170"
                value={
                  settings.heightCm != null ? String(settings.heightCm) : ''
                }
                onChangeText={(t) => {
                  const raw = t.replace(/\D/g, '');
                  if (raw === '') {
                    setSettings({ heightCm: null });
                    return;
                  }
                  const n = parseInt(raw, 10);
                  setSettings({
                    heightCm: Number.isNaN(n) ? null : n,
                  });
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
              <TextInput
                label="Вес (кг)"
                placeholder="70"
                value={
                  settings.weightKg != null ? String(settings.weightKg) : ''
                }
                onChangeText={(t) => {
                  const raw = t.replace(/\D/g, '');
                  if (raw === '') {
                    setSettings({ weightKg: null });
                    return;
                  }
                  const n = parseInt(raw, 10);
                  setSettings({
                    weightKg: Number.isNaN(n) ? null : n,
                  });
                }}
                keyboardType="number-pad"
                maxLength={3}
              />
              {goal > 0 && (
                <ThemedText style={[styles.recommendedGoal, { color: textMuted }]}>
                  Рекомендованная цель: {goal.toLocaleString('ru-RU')} шагов/день
                </ThemedText>
              )}
              <Button
                title="Пересчитать и сохранить"
                onPress={handleRecalculateGoal}
                disabled={
                  settings.heightCm == null ||
                  settings.weightKg == null
                }
              />
            </View>

            <ThemedText style={[styles.sectionTitle, { color: text, marginTop: 24 }]}>
              Уведомления (Healthy)
            </ThemedText>
            <View style={[styles.settingsCard, { borderColor: border }]}>
              <View style={[styles.switchRow, { borderColor: border }]}>
                <ThemedText style={[styles.switchLabel, { color: text }]}>
                  Уведомления шагомера
                </ThemedText>
                <Switch
                  value={settings.stepsNotificationsEnabled}
                  onValueChange={(v) =>
                    setSettings({ stepsNotificationsEnabled: v })
                  }
                  trackColor={{ false: border, true: primary }}
                  thumbColor="#fff"
                />
              </View>
              <ThemedText style={[styles.intervalLabel, { color: text }]}>
                Интервал «нет активности»: {settings.noActivityIntervalHours} ч
              </ThemedText>
              <View style={styles.intervalRow}>
                {[1, 2, 3].map((h) => (
                  <Pressable
                    key={h}
                    onPress={() =>
                      setSettings({ noActivityIntervalHours: h })
                    }
                    style={[
                      styles.intervalButton,
                      { borderColor: border },
                      settings.noActivityIntervalHours === h && {
                        backgroundColor: primary,
                        borderColor: primary,
                      },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.intervalButtonText,
                        {
                          color:
                            settings.noActivityIntervalHours === h
                              ? '#fff'
                              : text,
                        },
                      ]}
                    >
                      {h} ч
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
              <ThemedText style={[styles.hint, { color: textMuted }]}>
                Напоминания только в активные часы (по умолчанию — рабочее время).
              </ThemedText>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    padding: 4,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  section: {},
  sectionToday: {
    paddingTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  stepsNumberWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    minHeight: 80,
    overflow: 'visible',
  },
  stepsBig: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 52,
  },
  stepsLabel: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 4,
  },
  goalLine: {
    fontSize: 18,
    textAlign: 'center',
    marginTop: 16,
  },
  kmLine: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
  historyCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  historyDate: {
    fontSize: 15,
    flex: 1,
  },
  historySteps: {
    fontSize: 15,
    fontWeight: '600',
    marginRight: 12,
  },
  historyKm: {
    fontSize: 14,
  },
  settingsCard: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  recommendedGoal: {
    fontSize: 15,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  intervalLabel: {
    fontSize: 15,
    marginTop: 8,
  },
  intervalRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  intervalButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  intervalButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  hint: {
    fontSize: 13,
    marginTop: 4,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  unavailableTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  unavailableSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
  },
});
