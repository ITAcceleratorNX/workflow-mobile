import { View, Pressable, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { useTodayTasks } from '@/hooks/use-today-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';

interface OverdueBadgeProps {
  onPress: () => void;
}

export function OverdueBadge({ onPress }: OverdueBadgeProps) {
  const { stats } = useTodayTasks();
  const primary = useThemeColor({}, 'primary');
  const textMuted = useThemeColor({}, 'textMuted');

  const { overdueCount } = stats;

  if (overdueCount === 0) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress();
  };

  return (
    <Pressable onPress={handlePress} style={styles.wrapper}>
      <ThemedText style={[styles.text, { color: textMuted }]}>
        Просроченные: <ThemedText style={{ color: primary, fontWeight: '600' }}>{overdueCount}</ThemedText>
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginBottom: 8,
  },
  text: {
    fontSize: 14,
  },
});
