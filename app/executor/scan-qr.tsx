import { useCallback, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { scanBookingQRCode } from '@/lib/api';

const PRIMARY_ORANGE = '#E25B21';
const CARD_ORANGE = '#D94F15';

export default function ExecutorScanQrScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const text = useThemeColor({}, 'text');

  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);

  const handleRequestPermission = useCallback(async () => {
    const result = await requestPermission();

    if (!result.granted && !result.canAskAgain) {
      Alert.alert(
        'Нет доступа к камере',
        'Разрешите доступ к камере в настройках устройства.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Открыть настройки',
            onPress: () => {
              Linking.openSettings();
            },
          },
        ],
      );
    }
  }, [requestPermission]);

  const handleBarcodeScanned = useCallback(
    async (event: { nativeEvent?: { data?: string }; data?: string }) => {
      const data = event?.nativeEvent?.data ?? event?.data;
      if (!data || scanned) return;
      setScanned(true);

      try {
        let bookingId: number | undefined;

        // QR из приложения: JSON { bookingId, roomId, tablesRemaining }
        try {
          const parsed = JSON.parse(data);
          bookingId = parsed?.bookingId ?? parsed?.booking_id;
        } catch {
          // QR может быть URL вида https://app.tmk-workflow.kz/booking/123
          const match = data.match(/\/booking\/(\d+)/);
          if (match) bookingId = parseInt(match[1], 10);
        }

        if (typeof bookingId !== 'number' || !Number.isInteger(bookingId)) {
          throw new Error('В QR нет ID бронирования. Покажите QR с экрана бронирования.');
        }

        const res = await scanBookingQRCode(bookingId);
        if (!res.ok) throw new Error(res.error);

        show({
          title: 'QR обработан',
          description: `Столов осталось: ${res.data.tables_remaining}`,
          variant: 'success',
          duration: 3000,
        });
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка при обработке QR';
        show({
          title: 'Ошибка',
          description: message,
          variant: 'destructive',
          duration: 3000,
        });
      } finally {
        // даём небольшую паузу, потом можно сканировать снова
        setTimeout(() => setScanned(false), 2000);
      }
    },
    [scanned, show],
  );

  if (!permission) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <ThemedText type="title" style={[styles.title, { color: text }]}>
            QR сканер
          </ThemedText>
        </View>
        <View style={styles.card}>
          <ThemedText style={styles.cardDescription}>Запрос доступа к камере…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <View style={styles.header}>
          <ThemedText type="title" style={[styles.title, { color: text }]}>
            QR сканер
          </ThemedText>
        </View>
        <View style={styles.card}>
          <ThemedText style={styles.cardDescription}>Нет доступа к камере</ThemedText>
          <Pressable style={styles.actionButton} onPress={handleRequestPermission}>
            <MaterialIcons name="camera-alt" size={18} color="#FFFFFF" />
            <ThemedText style={styles.actionButtonText}>Выдать доступ</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={8}>
          <MaterialIcons name="chevron-left" size={24} color={PRIMARY_ORANGE} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={[styles.title, { color: text }]}>
          QR сканер
        </ThemedText>
      </View>

      <View style={styles.card}>
        <ThemedText style={styles.cardTitle}>Сканирование QR кода</ThemedText>
        <ThemedText style={styles.cardDescription}>
          Наведите камеру на QR код бронирования, чтобы уменьшить количество столов.
        </ThemedText>

        <View style={styles.scannerContainer}>
          <CameraView
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        {scanned && (
          <Pressable style={[styles.actionButton, { marginTop: 12 }]} onPress={() => setScanned(false)}>
            <ThemedText style={styles.actionButtonText}>Сканировать ещё раз</ThemedText>
          </Pressable>
        )}
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
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: '#1C1C1E',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
    gap: 6,
  },
  actionButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  scannerContainer: {
    marginTop: 12,
    borderRadius: 16,
    overflow: 'hidden',
    height: 260,
    backgroundColor: '#000',
  },
});