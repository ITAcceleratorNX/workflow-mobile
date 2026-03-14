import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ScreenHeaderProps {
  title: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
}

export function ScreenHeader({ title, onBack, rightSlot }: ScreenHeaderProps) {
  const router = useRouter();
  const primary = useThemeColor({}, 'primary');

  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.header}>
      <Pressable onPress={handleBack} style={styles.backButton} hitSlop={8}>
        <MaterialIcons name="chevron-left" size={24} color={primary} />
        <ThemedText style={[styles.backLabel, { color: primary }]}>Назад</ThemedText>
      </Pressable>
      <ThemedText type="title" style={styles.title}>
        {title}
      </ThemedText>
      {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  backLabel: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  rightSlot: {
    position: 'absolute',
    right: 16,
    top: 0,
  },
});
