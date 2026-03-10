import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import type { MeetingRoomBooking } from '@/lib/api';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

    // Для не-демо пока просто ошибка, чтобы не ходить в бэк
    setError('Мобильный QR пока доступен только в демо-режиме');
    setLoading(false);
  }, [id, guestBookings]);

  if (loading) {
    return (
      <ThemedView style={[styles.centered, { paddingTop: insets.top + 16 }]}>
        <ActivityIndicator size="large" />
        <ThemedText style={[styles.loadingText, { color: mutedColor }]}>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  if (error || !booking) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
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
  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backRow} hitSlop={8}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
          <ThemedText style={[styles.backLabel, { color: textColor }]}>Назад</ThemedText>
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Бронирование переговорной
        </ThemedText>
      </View>

      <View style={styles.content}>
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
          </View>
        )}

        <View style={[styles.qrCard, { backgroundColor: cardBackground }]}>
          <View style={styles.qrStubOuter}>
            <View style={styles.qrStubInner}>
              <ThemedText style={styles.qrStubText}>DEMO QR</ThemedText>
            </View>
          </View>
          <ThemedText style={[styles.qrHint, { color: mutedColor }]}>
            Это демо‑QR (без камеры). Используется только для теста потока.
          </ThemedText>
        </View>
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

