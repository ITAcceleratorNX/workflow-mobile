import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { TasksTodayCard } from './TasksTodayCard';
import { useThemeColor } from '@/hooks/use-theme-color';

export function TasksSection() {
  const router = useRouter();

  const text = useThemeColor({}, 'text');

  return (
    <View style={styles.section}>
      <ThemedText style={[styles.sectionTitle, { color: text }]}>Задачи</ThemedText>

      <TasksTodayCard
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/client/tasks', params: { view: 'list' } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
});
