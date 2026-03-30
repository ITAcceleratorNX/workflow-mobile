import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Share, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { getPublicBooking, type MeetingRoomBooking } from '@/lib/api';
import {
  formatBookingDurationRu,
  formatDisplayDateFromIso,
  formatTimeOnly,
} from '@/lib/dateTimeUtils';

export default function BookingQrScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const guestBookings = useGuestDemoStore((s) => s.bookings);

  const [booking, setBooking] = useState<MeetingRoomBooking | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const numId = id ? parseInt(id, 10) : NaN;
    if (!id || Number.isNaN(numId)) {
      setError('Неверный id бронирования');
      setLoading(false);
      return;
    }

    if (numId < 0) {
      const guest = guestBookings.find((b) => b.id === numId);
      if (!guest) {
        setError('Бронирование не найдено (демо)');
      } else {
        const room = guest.meetingRoom;
        setBooking({
          id: guest.id,
          meeting_room_id: guest.meeting_room_id,
          start_time: guest.start_time,
          end_time: guest.end_time,
          status: guest.status,
          company_name: guest.company_name ?? null,
          meetingRoom: room,
          meeting_room: room,
          office: room?.office,
        } as MeetingRoomBooking);
      }
      setLoading(false);
      return;
    }

    const load = async () => {
      try {
        const res = await getPublicBooking(numId);
        if (res.ok) {
          setBooking(res.data);
        } else {
          setError(res.error || 'Не удалось загрузить бронирование');
        }
      } catch (e) {
        console.error('[BookingQR] load error', e);
        setError('Ошибка загрузки бронирования');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [id, guestBookings]);

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top + 16 }]}>
        <PageLoader size={80} />
        <ThemedText style={[styles.loadingText, { color: mutedColor }]}>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  if (error || !booking) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
          <ThemedText style={[styles.backLabel, { color: textColor }]}>Назад</ThemedText>
        </Pressable>
        <View style={styles.centeredInner}>
          <ThemedText style={[styles.errorText, { color: mutedColor }]}>
            {error || 'Бронирование не найдено'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const office = booking.office || booking.meetingRoom?.office || booking.meeting_room?.office;
  const room = booking.meetingRoom || booking.meeting_room;
  const durationLabel = formatBookingDurationRu(booking.start_time, booking.end_time);
  const appUrl = `https://app.tmk-workflow.kz/booking/${booking.id}`;
  const qrPayload = JSON.stringify({
    bookingId: booking.id,
    roomId: booking.meeting_room_id,
    tablesRemaining: (booking as any).tables_remaining ?? room?.capacity ?? 0,
  });

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
          <ThemedText style={[styles.backLabel, { color: textColor }]}>Назад</ThemedText>
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Бронирование переговорной
        </ThemedText>
      </View>

      <View style={[styles.content, { paddingBottom: insets.bottom + 88 }]}>
        {office && (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>
              {office.name}
            </ThemedText>
            {office.address && (
              <ThemedText style={[styles.cardSubtitle, { color: mutedColor }]}>
                {office.address}
              </ThemedText>
            )}
          </View>
        )}

        {room && (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>
              Комната
            </ThemedText>
            <ThemedText style={[styles.cardTitle, { color: textColor }]}>
              {room.name}
            </ThemedText>
            {room.floor != null && (
              <ThemedText style={[styles.cardSubtitle, { color: mutedColor }]}>
                Этаж {room.floor}
              </ThemedText>
            )}
          </View>
        )}

        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>
            Дата и время
          </ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: textColor }]}>
            {formatDisplayDateFromIso(booking.start_time)}
          </ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: textColor }]}>
            {formatTimeOnly(booking.start_time)} – {formatTimeOnly(booking.end_time)}
          </ThemedText>
          {durationLabel != null && (
            <ThemedText style={[styles.cardSubtitle, { color: mutedColor }]}>
              Продолжительность: {durationLabel}
            </ThemedText>
          )}
          {'tables_remaining' in booking && (booking as any).tables_remaining != null && (
            <ThemedText style={[styles.tablesRemaining, { color: textColor }]}>
              Столов осталось: {(booking as any).tables_remaining}
            </ThemedText>
          )}
        </View>

        <View style={[styles.qrCard, { backgroundColor: cardBackground }]}>
          <View style={styles.qrStubOuter}>
            <View style={styles.qrStubInner}>
              <QRCode
                value={qrPayload}
                size={180}
                backgroundColor="#FFFFFF"
                color="#000000"
              />
            </View>
          </View>
          <ThemedText style={[styles.qrHint, { color: mutedColor }]}>
            Покажите этот QR исполнителю для сканирования.
          </ThemedText>
        </View>
        <Pressable
          style={[styles.shareButtonFloating, { bottom: insets.bottom + 16 }]}
          onPress={() =>
            Share.share({
              title: 'Бронирование переговорной',
              message: appUrl,
              url: appUrl,
            })
          }
        >
          <MaterialIcons name="share" size={18} color="#FFFFFF" />
          <ThemedText style={styles.shareButtonText}>Поделиться ссылкой</ThemedText>
        </Pressable>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    marginBottom: 8,
  },
  backLabel: {
    fontSize: 16,
    marginLeft: 4,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    padding: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  cardSubtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  cardLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  tablesRemaining: {
    marginTop: 8,
    fontSize: 14,
    fontWeight: '600',
  },
  qrCard: {
    marginTop: 12,
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
  },
  qrStubOuter: {
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  qrStubInner: {
    width: 180,
    height: 180,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  qrStubText: {
    fontSize: 24,
    fontWeight: '700',
    letterSpacing: 4,
    color: '#111827',
  },
  qrHint: {
    marginTop: 12,
    fontSize: 13,
    textAlign: 'center',
  },
  shareButton: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: '#111827',
    gap: 8,
  },
  shareButtonFloating: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: '#111827',
    gap: 8,
  },
  shareButtonText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  centeredInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    fontSize: 14,
    marginTop: 8,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});

