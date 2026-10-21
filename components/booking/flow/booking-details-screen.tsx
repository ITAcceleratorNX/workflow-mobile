import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MeetingRoomBooking } from '@/lib/api';
import { almatyDay, almatyMinutes, formatBookingDay, formatDuration, formatTime } from '@/lib/booking-flow';
import { getRoomPhotoUris } from '@/lib/image-uri';
import { getBookingStatusText } from '@/lib/office-bookings';

import { EquipmentChips } from './equipment-chips';

const ORANGE_GRADIENT = ['#F35713', '#281504'] as const;

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function Row({ icon, label, children }: { icon: IconName; label: string; children: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowIcon}>
        <MaterialIcons name={icon} size={18} color="#fff" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowValue}>{children}</Text>
      </View>
    </View>
  );
}

function isActive(booking: MeetingRoomBooking) {
  return !['completed', 'cancelled', 'auto_cancelled'].includes(booking.status ?? '');
}

/** Детали брони (по макету): фото, время, место, компания, пожелания, оснащение; QR и отмена. */
export function BookingDetailsScreen({
  booking,
  onClose,
  onShowQr,
  onCancel,
  cancelling,
}: {
  booking: MeetingRoomBooking;
  onClose: () => void;
  onShowQr: () => void;
  onCancel: () => void;
  cancelling: boolean;
}) {
  const insets = useSafeAreaInsets();
  const room = booking.meeting_room ?? booking.meetingRoom;
  const office = booking.office ?? room?.office;
  const photo = getRoomPhotoUris(room)[0];
  const start = new Date(booking.start_time);
  const end = new Date(booking.end_time);
  const duration = Math.round((end.getTime() - start.getTime()) / 60000);
  const when = `${formatBookingDay(almatyDay(start))} · ${formatTime(almatyMinutes(start))}–${formatTime(almatyMinutes(end))}${duration > 0 ? ` (${formatDuration(duration)})` : ''}`;
  const place = [office?.name, room?.floor != null ? `${room.floor} этаж` : null].filter(Boolean).join(' · ');
  const created = booking.created_at ? new Date(booking.created_at) : null;

  return (
    <LinearGradient colors={ORANGE_GRADIENT} style={{ flex: 1 }}>
      <View style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }}>
        <View style={styles.header}>
          <Pressable onPress={onClose} style={styles.round} accessibilityRole="button" accessibilityLabel="Назад" hitSlop={8}>
            <MaterialIcons name="chevron-left" size={24} color="#fff" />
          </Pressable>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>Бронь</Text>
            {created ? (
              <Text style={styles.subtitle}>
                Создана {formatBookingDay(almatyDay(created)).split(', ')[1]}, {formatTime(almatyMinutes(created))}
              </Text>
            ) : null}
          </View>
          <View style={styles.status}>
            <Text style={styles.statusText}>{getBookingStatusText(booking.status)}</Text>
          </View>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20, gap: 18 }}>
          {photo ? (
            <Image source={{ uri: photo }} style={styles.hero} contentFit="cover" />
          ) : null}
          <Text style={styles.roomName}>{room?.name ?? `Комната #${booking.meeting_room_id}`}</Text>
          <View style={{ gap: 14 }}>
            <Row icon="calendar-today" label="Дата и время">
              {when}
            </Row>
            {place ? (
              <Row icon="place" label="Где">
                {place}
              </Row>
            ) : null}
            {booking.company_name ? (
              <Row icon="business" label="Компания">
                {booking.company_name}
              </Row>
            ) : null}
            {booking.comment ? (
              <Row icon="chat-bubble-outline" label="Комментарий">
                {booking.comment}
              </Row>
            ) : null}
          </View>
          {room?.equipment?.length ? (
            <View style={{ gap: 8 }}>
              <Text style={styles.caps}>Оснащение</Text>
              <EquipmentChips items={room.equipment} />
            </View>
          ) : null}
        </ScrollView>

        {isActive(booking) ? (
          <View style={{ paddingHorizontal: 20, gap: 10, paddingTop: 8 }}>
            <Pressable onPress={onShowQr} style={styles.primary} accessibilityRole="button">
              <Text style={styles.primaryText}>Показать QR-код</Text>
            </Pressable>
            <Pressable onPress={onCancel} disabled={cancelling} style={styles.danger} accessibilityRole="button">
              {cancelling ? <ActivityIndicator color="#FF8A7A" /> : <Text style={styles.dangerText}>Отменить бронь</Text>}
            </Pressable>
          </View>
        ) : null}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  status: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.22)' },
  statusText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  hero: { width: '100%', aspectRatio: 16 / 10, borderRadius: 18 },
  roomName: { color: '#fff', fontSize: 20, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowIcon: { width: 32, height: 32, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  rowLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  rowValue: { color: '#fff', fontSize: 16, marginTop: 2 },
  caps: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  primary: { height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#E85D2B', fontSize: 17, fontWeight: '600' },
  danger: { height: 52, borderRadius: 16, backgroundColor: 'rgba(60,20,15,0.55)', alignItems: 'center', justifyContent: 'center' },
  dangerText: { color: '#FF8A7A', fontSize: 17, fontWeight: '600' },
});
