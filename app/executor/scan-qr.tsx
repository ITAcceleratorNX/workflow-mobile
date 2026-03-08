import { StyleSheet, View, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';

const PRIMARY_ORANGE = '#E25B21';
const CARD_ORANGE = '#D94F15';

export default function ExecutorScanQrScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={PRIMARY_ORANGE} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          QR сканер
        </ThemedText>
      </View>

      <View style={styles.card}>
        <View style={styles.cardIconRow}>
          <MaterialIcons name="qr-code-2" size={32} color={PRIMARY_ORANGE} />
        </View>
        <ThemedText style={styles.cardTitle}>Сканирование QR кода</ThemedText>
        <ThemedText style={styles.cardDescription}>
          Отсканируйте QR код бронирования для уменьшения количества столов в переговорной.
        </ThemedText>
        <ThemedText style={styles.cardNote}>
          Сканер камеры будет добавлен в следующей версии приложения.
        </ThemedText>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
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
    color: PRIMARY_ORANGE,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    padding: 20,
    borderRadius: 16,
    backgroundColor: CARD_ORANGE,
  },
  cardIconRow: {
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 20,
    marginBottom: 12,
  },
  cardNote: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    fontStyle: 'italic',
  },
});
