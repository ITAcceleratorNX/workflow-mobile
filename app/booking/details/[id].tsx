import { useAsyncResource } from '@/hooks/use-async-resource';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getBooking, type MeetingRoomBooking } from '@/lib/api';
import { formatBookingDurationRu, formatDisplayDateFromIso, formatTimeOnly } from '@/lib/dateTimeUtils';
import { bookingCardErrorMessage, getBookingStatusText } from '@/lib/office-bookings';

/**
 * Карточка брони, которую открывает push персонала о новом бронировании. Доступ по роли и офису
 * сервер проверяет при каждом открытии: после выхода или смены прав чужие данные не приходят.
 */
export default function BookingDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const loadBooking = useCallback(async (): Promise<MeetingRoomBooking> => {
    const bookingId = Number(id);
    if (!Number.isSafeInteger(bookingId) || bookingId <= 0) throw new Error(bookingCardErrorMessage(404, ''));
    const response = await getBooking(bookingId);
    if (!response.ok) throw new Error(bookingCardErrorMessage(response.status, response.error));
    return response.data;
  }, [id]);
  const { data: booking, loading, error } = useAsyncResource<MeetingRoomBooking | null>(loadBooking, null);

  const goBack = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)');
  }, [router]);

  const header = (
    <View style={styles.header}>
      <Pressable onPress={goBack} style={styles.backRow} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
        <MaterialIcons name="arrow-back" size={24} color={textColor} />
        <ThemedText style={[styles.backLabel, { color: textColor }]}>Назад</ThemedText>
      </Pressable>
      <ThemedText style={[styles.headerTitle, { color: textColor }]}>Бронирование переговорной</ThemedText>
    </View>
  );

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
        {header}
        <View style={styles.centeredInner}>
          <MaterialIcons name="lock-outline" size={40} color={mutedColor} />
          <ThemedText style={[styles.errorText, { color: mutedColor }]}>
            {error || bookingCardErrorMessage(404, '')}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const room = booking.meetingRoom ?? booking.meeting_room;
  const office = booking.office ?? room?.office;
  const durationLabel = formatBookingDurationRu(booking.start_time, booking.end_time);
  const client = booking.client;
  const phone = client?.phone?.trim();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 12 }]}>
      {header}
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 28 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>Статус</ThemedText>
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>{getBookingStatusText(booking.status)}</ThemedText>
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>Переговорная</ThemedText>
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>
            {room?.name ?? `Комната #${booking.meeting_room_id}`}
          </ThemedText>
          {room?.floor != null && (
            <ThemedText style={[styles.cardSubtitle, { color: mutedColor }]}>Этаж {room.floor}</ThemedText>
          )}
          {office?.name ? (
            <ThemedText style={[styles.cardSubtitle, { color: mutedColor }]}>
              {office.address ? `${office.name}, ${office.address}` : office.name}
            </ThemedText>
          ) : null}
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>Дата и время</ThemedText>
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
        </View>

        <View style={[styles.card, { backgroundColor: cardBackground }]}>
          <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>Клиент</ThemedText>
          <ThemedText style={[styles.cardTitle, { color: textColor }]}>{client?.full_name || '—'}</ThemedText>
          {booking.company_name ? (
            <ThemedText style={[styles.cardSubtitle, { color: mutedColor }]}>{booking.company_name}</ThemedText>
          ) : null}
          {phone ? (
            <Pressable onPress={() => void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)} style={styles.phoneRow}>
              <MaterialIcons name="phone" size={16} color={textColor} />
              <ThemedText style={[styles.cardSubtitle, styles.phoneText, { color: textColor }]}>{phone}</ThemedText>
            </Pressable>
          ) : null}
        </View>

        {booking.comment ? (
          <View style={[styles.card, { backgroundColor: cardBackground }]}>
            <ThemedText style={[styles.cardLabel, { color: mutedColor }]}>Пожелания к подготовке</ThemedText>
            <ThemedText style={[styles.cardSubtitle, { color: textColor }]}>{booking.comment}</ThemedText>
          </View>
        ) : null}
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
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
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    minHeight: 44,
    gap: 6,
  },
  phoneText: {
    marginTop: 0,
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
    gap: 12,
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
