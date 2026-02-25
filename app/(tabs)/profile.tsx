import { StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore, type AuthState } from '@/stores/auth-store';

export default function ProfileScreen() {
  const role = useAuthStore((state: AuthState) => state.role);
  const textMuted = useThemeColor({}, 'textMuted');

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Профиль
      </ThemedText>
      <ThemedText style={[styles.subtitle, { opacity: 0.8 }]}>
        Это страница Профиль
      </ThemedText>
      <ThemedText style={[styles.role, { color: textMuted }]}>
        Роль: {role ?? '—'}
      </ThemedText>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 48,
    gap: 16,
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    marginBottom: 8,
  },
  role: {
    fontSize: 14,
  },
});
