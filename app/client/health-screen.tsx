import { StyleSheet, View, ScrollView, Pressable, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useStepsStore } from '@/stores/steps-store';
import { stepLengthMetersFromHeight, stepsToKm } from '@/lib/steps-utils';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';

export default function ClientHealthScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const background = useThemeColor({}, 'background');

  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps);
  const stepsHeightCm = useStepsStore((s) => s.settings.heightCm);
  const stepLengthM = stepsHeightCm && stepsHeightCm > 0 ? stepLengthMetersFromHeight(stepsHeightCm) : 0.7;
  const stepsKmToday = stepsToKm(stepsToday, stepLengthM);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Health" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <ThemedText style={styles.sectionTitle}>Шаги</ThemedText>
        <View style={styles.statsGrid}>
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
        </View>

        <ThemedText style={[styles.sectionTitle, { marginTop: 24 }]}>Настройки</ThemedText>
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
  statCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  statCardTitle: { fontSize: 14, fontWeight: '500', color: '#FFFFFF' },
  statCardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  statCardValue: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
  settingsCard: { borderRadius: 16, padding: 16, marginTop: 12 },
  settingsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  settingsTextContainer: { flex: 1, marginRight: 16 },
  settingsCardTitle: { fontSize: 16, fontWeight: '500', color: '#FFFFFF' },
  settingsCardSubtitle: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
});
