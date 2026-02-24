import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');

  const handleLogout = () => {
    clearAuth();
    router.replace('/login');
  };

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="title" style={styles.title}>
        Главная
      </ThemedText>
      <ThemedText style={[styles.subtitle, { opacity: 0.8 }]}>
        Вы успешно вошли в мобильное приложение.
      </ThemedText>
      <View style={[styles.card, { borderColor: border }]}>
        <ThemedText style={styles.infoTitle}>Текущий пользователь</ThemedText>
        <ThemedText style={[styles.infoText, { color: textMuted }]}>
          Имя: {user?.full_name ?? '—'}
        </ThemedText>
        <ThemedText style={[styles.infoText, { color: textMuted }]}>
          Роль: {role ?? '—'}
        </ThemedText>
        <ThemedText style={[styles.infoText, { color: textMuted }]}>
          Телефон: {user?.phone ?? '—'}
        </ThemedText>
      </View>
      <Button title="Выйти" onPress={handleLogout} />
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
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 6,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
  },
});
