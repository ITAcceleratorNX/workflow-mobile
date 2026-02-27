import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { ThemedText } from '@/components/themed-text';

export default function AdminWorkerStatisticsScreen() {
  const insets = useSafeAreaInsets();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 16 }]}>
      <ScrollView contentContainerStyle={styles.content}>
        <ThemedText type="title" style={styles.title}>
          Статистика
        </ThemedText>
        <View style={styles.placeholder}>
          <ThemedText style={styles.placeholderText}>
            Здесь будут отчёты и аналитика по заявкам, как в веб-версии.
          </ThemedText>
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  title: {
    marginBottom: 16,
  },
  placeholder: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    opacity: 0.7,
  },
  placeholderText: {
    textAlign: 'center',
  },
});

