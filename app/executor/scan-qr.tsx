import { useCallback, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { scanBookingQRCode } from '@/lib/api';

function normalizeBookingId(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value) && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const n = parseInt(value.trim(), 10);
    if (!Number.isNaN(n) && Number.isInteger(n)) return n;
  }
  return undefined;
}

/** Извлекает ID бронирования из JSON, URL или строки цифр (payload уже trim). */
function parseBookingIdFromQrPayload(trimmed: string): number | undefined {
  if (!trimmed) return undefined;

  try {
    const parsed = JSON.parse(trimmed) as { bookingId?: unknown; booking_id?: unknown };
    const id = normalizeBookingId(parsed?.bookingId ?? parsed?.booking_id);
    if (id !== undefined) return id;
  } catch {
    // не JSON
  }

  const slashMatch = trimmed.match(/\/booking\/(\d+)/i) ?? trimmed.match(/booking\/(\d+)/i);
  if (slashMatch) {
    const id = parseInt(slashMatch[1], 10);
    if (Number.isInteger(id)) return id;
  }

  const qpMatch = /(?:^|[?&#])(?:bookingId|booking_id|id)=(\d+)/i.exec(trimmed);
  if (qpMatch) {
    const id = parseInt(qpMatch[1], 10);
    if (Number.isInteger(id)) return id;
  }

  if (/^-?\d+$/.test(trimmed)) {
    const id = parseInt(trimmed, 10);
    if (Number.isInteger(id)) return id;
  }

  return undefined;
}

function getScanPayload(result: BarcodeScanningResult): string {
  const raw = (result.data ?? result.raw ?? '').trim();
  return raw;
}

export default function ExecutorScanQrScreen() {
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const processingRef = useRef(false);

  const screenBg = useThemeColor({}, 'background');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        container: {
          flex: 1,
          backgroundColor: screenBg,
        },
        card: {
          marginHorizontal: 16,
          marginTop: 16,
          padding: 20,
          borderRadius: 16,
          backgroundColor: surfaceElevated,
          borderWidth: 1,
          borderColor: border,
        },
        cardTitle: {
          fontSize: 18,
          fontWeight: '600',
          marginBottom: 8,
        },
        cardDescription: {
          fontSize: 14,
          lineHeight: 20,
          marginBottom: 12,
        },
        primaryBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: primary,
          gap: 8,
        },
        outlineBtn: {
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderRadius: 999,
          backgroundColor: surfaceElevated,
          borderWidth: 1,
          borderColor: border,
          gap: 8,
        },
        btnLabel: {
          fontSize: 14,
          fontWeight: '600',
        },
        scannerContainer: {
          marginTop: 12,
          borderRadius: 16,
          overflow: 'hidden',
          height: 260,
          backgroundColor: '#000',
        },
      }),
    [screenBg, surfaceElevated, border, primary],
  );

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
    async (result: BarcodeScanningResult) => {
      const payload = getScanPayload(result);
      if (!payload || processingRef.current) return;

      processingRef.current = true;
      setScanned(true);

      try {
        const bookingId = parseBookingIdFromQrPayload(payload);
        if (bookingId === undefined) {
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
        setTimeout(() => {
          processingRef.current = false;
          setScanned(false);
        }, 2000);
      }
    },
    [show],
  );

  if (!permission) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <ScreenHeader title="QR сканер" />
        <View style={styles.card}>
          <ThemedText style={[styles.cardDescription, { color: textMuted }]}>Запрос доступа к камере…</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (!permission.granted) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
        <ScreenHeader title="QR сканер" />
        <View style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: text }]}>Нет доступа к камере</ThemedText>
          <Pressable style={styles.primaryBtn} onPress={handleRequestPermission}>
            <MaterialIcons name="camera-alt" size={18} color={onPrimary} />
            <ThemedText style={[styles.btnLabel, { color: onPrimary }]}>Выдать доступ</ThemedText>
          </Pressable>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScreenHeader title="QR сканер" />

      <View style={styles.card}>
        <ThemedText style={[styles.cardTitle, { color: text }]}>Сканирование QR кода</ThemedText>
        <ThemedText style={[styles.cardDescription, { color: textMuted }]}>
          Наведите камеру на QR код бронирования, чтобы уменьшить количество столов.
        </ThemedText>

        <View style={styles.scannerContainer}>
          <CameraView
            facing="back"
            onBarcodeScanned={scanned ? undefined : handleBarcodeScanned}
            barcodeScannerSettings={{
              barcodeTypes: ['qr'],
            }}
            style={StyleSheet.absoluteFillObject}
          />
        </View>

        {scanned ? (
          <Pressable
            style={[styles.outlineBtn, { marginTop: 12 }]}
            onPress={() => {
              processingRef.current = false;
              setScanned(false);
            }}
          >
            <ThemedText style={[styles.btnLabel, { color: text }]}>Сканировать ещё раз</ThemedText>
          </Pressable>
        ) : null}
      </View>
    </ThemedView>
  );
}
