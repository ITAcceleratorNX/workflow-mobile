import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { useTodayTasks } from '@/hooks/use-today-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';

interface TasksTodayCardProps {
  onPress: () => void;
}

export function TasksTodayCard({ onPress }: TasksTodayCardProps) {
  const { stats, loading } = useTodayTasks();
  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { todayCompleted, todayTotal } = stats;
  const percent = todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable
      onPress={handlePress}
      style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}
    >
      <View style={styles.header}>
        <View style={styles.left}>
          <View style={[styles.iconWrap, { backgroundColor: `${primary}20` }]}>
            <MaterialIcons name="insights" size={22} color={primary} />
          </View>
          <View style={styles.titleCol}>
            <ThemedText style={[styles.title, { color: text }]}>Продуктивность за сегодня</ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              {loading ? 'Загрузка…' : `Выполнено ${todayCompleted} из ${todayTotal}`}
            </ThemedText>
          </View>
        </View>

        <View style={[styles.pctBadge, { backgroundColor: `${primary}18`, borderColor: `${primary}35` }]}>
          <ThemedText style={[styles.pctText, { color: primary }]}>
            {loading ? '—' : `${percent}%`}
          </ThemedText>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: `${primary}25` }]}>
        <View
          style={[
            styles.progressBar,
            { backgroundColor: primary, width: `${percent}%` },
          ]}
        />
      </View>

      <ThemedText style={[styles.hint, { color: textMuted }]}>
        Нажмите, чтобы открыть задачи (Сегодня)
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleCol: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    marginTop: 2,
    fontSize: 13,
    fontWeight: '500',
  },
  pctBadge: {
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
  },
  pctText: {
    fontSize: 13,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 999,
  },
  hint: {
    fontSize: 12,
    marginTop: 10,
    fontWeight: '500',
  },
});
