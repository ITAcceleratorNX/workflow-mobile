import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Локальный Todo list заменён единым экраном задач (user-tasks).
 * Этот маршрут сохранён для старых ссылок и перенаправляет на `/client/tasks`.
 */
export default function TodoListRedirectScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const textMuted = useThemeColor({}, 'textMuted');

  useEffect(() => {
    const t = setTimeout(() => {
      router.replace({ pathname: '/client/tasks', params: { tab: 'inbox', view: 'list' } });
    }, 200);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <View style={styles.center}>
        <ActivityIndicator size="large" color={primary} />
        <ThemedText style={[styles.hint, { color: textMuted }]}>Переход к задачам…</ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  hint: { fontSize: 14 },
});
