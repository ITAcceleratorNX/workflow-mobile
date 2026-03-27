import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useWindowDimensions } from 'react-native';
import { config } from '@/lib/config';
import {
  formatDateForApi,
  formatDisplayDateFromIso,
  formatTimeOnly,
  getAlmatySlotKey,
} from '@/lib/dateTimeUtils';
import { getImageUri, getPrimaryPhotoUri, getRoomPhotoUris } from '@/lib/image-uri';
import {
  type MeetingRoom,
  type MeetingRoomBooking,
  type MyBookingsStatusFilter,
  type Office,
  cancelMeetingRoomBooking,
  createMeetingRoomBooking,
  getMeetingRooms,
  getMyBookings,
  getOffices,
  getRoomDailyAvailability,
} from '@/lib/api';
import { findNearestOffice } from '@/lib/nearest-office';
import { useAuthStore } from '@/stores/auth-store';
import { useBookingTabUiStore } from '@/stores/booking-tab-ui-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { useFocusEffect, useRouter } from 'expo-router';

const ORANGE_GRADIENT = ['#F35713', '#281504'] as const;
const CARD_ORANGE = '#E25B21';

/**
 * URL первого фото комнаты — как в браузере: используем photos[0] или photo как есть.
 * Если URL относительный — дополняем базой API.
 */
function getRoomPhotoUri(room: MeetingRoom | null | undefined): string | null {
  return getPrimaryPhotoUri(room);
}

/** URL страницы бронирования в веб-версии (для кнопки «Просмотреть») */
function getBookingPageUrl(bookingId: number): string {
  const base =
    (typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BOOKING_WEB_URL) ||
    config.apiBaseUrl.replace(/\/api\/?$/, '');
  return `${base}/booking/${bookingId}`;
}

const TIME_SLOTS: { label: string; start: string; end: string }[] = [];
for (let hour = 9; hour < 24; hour++) {
  const startHour = hour.toString().padStart(2, '0');
  const endHour = (hour + 1).toString().padStart(2, '0');
  TIME_SLOTS.push({
    label: `${startHour}:00-${endHour}:00`,
    start: `${startHour}:00`,
    end: `${endHour}:00`,
  });
}

type Step = 'offices' | 'rooms' | 'form';
type BookingTab = 'book' | 'my-bookings';
type MyBookingsFilter = 'active' | 'completed' | 'cancelled';

function getBookingStatusText(status?: string): string {
  switch (status) {
    case 'scheduled':
      return 'Запланировано';
    case 'in_progress':
      return 'В процессе';
    case 'completed':
      return 'Завершено';
    case 'cancelled':
    case 'auto_cancelled':
      return 'Отменено';
    case 'confirmed':
      return 'Подтверждено';
    default:
      return 'Активно';
  }
}

export default function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const { show: showToast } = useToast();
  const borderColor = useThemeColor({}, 'border');
  const textMuted = useThemeColor({}, 'textMuted');
  const tintColor = useThemeColor({}, 'tint');
  const textColor = useThemeColor({}, 'text');
  const gradientColors = ORANGE_GRADIENT;

  const [activeTab, setActiveTab] = useState<BookingTab>('book');
  const [step, setStep] = useState<Step>('offices');
  const [selectedOffice, setSelectedOffice] = useState<Office | null>(null);
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);

  const [offices, setOffices] = useState<Office[]>([]);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [myBookings, setMyBookings] = useState<MeetingRoomBooking[]>([]);
  const [myBookingsPage, setMyBookingsPage] = useState(1);
  const [myBookingsHasMore, setMyBookingsHasMore] = useState(false);
  const [loadingMoreBookings, setLoadingMoreBookings] = useState(false);
  const [myBookingsFilter, setMyBookingsFilter] = useState<MyBookingsFilter>('active');

  const [loadingOffices, setLoadingOffices] = useState(false);
  const [loadingRooms, setLoadingRooms] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingAvailability, setLoadingAvailability] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const isGuest = useAuthStore((s) => s.isGuest);
  const {
    bookings: guestBookings,
    addBooking: addGuestBooking,
    removeBooking: removeGuestBooking,
  } = useGuestDemoStore();

  // Form state
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string | null>(null);
  const [companyName, setCompanyName] = useState('');
  const [bookedSlots, setBookedSlots] = useState<Set<string>>(new Set());
  const [roomImageFailedIds, setRoomImageFailedIds] = useState<Set<number>>(new Set());
  const [formRoomImageFailed, setFormRoomImageFailed] = useState(false);

  const setHideBottomNavForBookingForm = useBookingTabUiStore(
    (s) => s.setHideBottomNavForBookingForm
  );

  useFocusEffect(
    useCallback(() => {
      setHideBottomNavForBookingForm(step === 'form');
      return () => {
        setHideBottomNavForBookingForm(false);
      };
    }, [step, setHideBottomNavForBookingForm])
  );

  const loadOffices = useCallback(async () => {
    setLoadingOffices(true);
    const list = await getOffices();
    setOffices(list);
    setLoadingOffices(false);
  }, []);

  const handleDetectNearestOffice = useCallback(async () => {
    if (!offices.length) return;

    try {
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        canAskAgain = req.canAskAgain;
      }

      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Геолокация выключена',
            'Разрешите доступ к геолокации в настройках устройства, чтобы рекомендовать ближайший офис.',
            [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Открыть настройки',
                onPress: () => {
                  try {
                    Linking.openSettings();
                  } catch {
                    // ignore
                  }
                },
              },
            ]
          );
        } else {
          showToast({
            title: 'Геолокация недоступна',
            description: 'Разрешите доступ к геолокации, чтобы рекомендовать офис.',
            variant: 'destructive',
            duration: 3000,
          });
        }
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearest = findNearestOffice(offices, {
        lat: current.coords.latitude,
        lon: current.coords.longitude,
      });
      if (!nearest) {
        showToast({
          title: 'Офисы не найдены',
          description: 'Нет офисов с координатами для определения ближайшего.',
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      setSelectedOffice(nearest);
      showToast({
        title: 'Ближайший офис',
        description: `Рекомендуемый офис: ${nearest.name}`,
        variant: 'success',
        duration: 2500,
      });
    } catch (e) {
      console.error('[Booking] detect nearest office error', e);
      showToast({
        title: 'Ошибка геолокации',
        description: 'Не удалось определить ближайший офис.',
        variant: 'destructive',
        duration: 3000,
      });
    }
  }, [offices, showToast]);

  const loadRooms = useCallback(async (officeId: number) => {
    setLoadingRooms(true);
    setRoomImageFailedIds(new Set());
    const res = await getMeetingRooms(officeId);
    setLoadingRooms(false);
    if (res.ok) {
      const list = res.data.map((r: MeetingRoom & { photos?: string[] | string | { url?: string; src?: string }[] }) => {
        let photos: string[] = [];
        if (Array.isArray(r.photos)) {
          for (const p of r.photos) {
            if (typeof p === 'string' && p.trim()) photos.push(p.trim());
            else if (p && typeof p === 'object') {
              const url = (p as { url?: string }).url ?? (p as { src?: string }).src;
              if (typeof url === 'string' && url.trim()) photos.push(url.trim());
            }
          }
        } else if (typeof r.photos === 'string') {
          const s = (r.photos as string).trim();
          if (s) photos = [s];
        } else {
          const rawPhoto = (r as unknown as { photo?: string }).photo;
          if (rawPhoto && typeof rawPhoto === 'string') {
            const s = rawPhoto.trim();
            if (s) photos = [s];
          }
        }
        return { ...r, photos };
      });
      setRooms(list);
    } else setRooms([]);
  }, []);

  const PAGE_SIZE = 20;

  const loadMyBookings = useCallback(
    async (statusFilter: MyBookingsStatusFilter, page: number, append: boolean) => {
      if (isGuest) {
        const sorted = [...guestBookings].sort((a, b) => {
          const sa = typeof a.start_time === 'string' ? a.start_time : '';
          const sb = typeof b.start_time === 'string' ? b.start_time : '';
          return new Date(sa).getTime() - new Date(sb).getTime();
        });
        setMyBookings(sorted as MeetingRoomBooking[]);
        setMyBookingsHasMore(false);
        return;
      }
      if (append) setLoadingMoreBookings(true);
      else setLoadingBookings(true);
      const res = await getMyBookings({ status: statusFilter, page, pageSize: PAGE_SIZE });
      if (append) setLoadingMoreBookings(false);
      else setLoadingBookings(false);
      if (res.ok) {
        if (append) {
          setMyBookings((prev) => [...prev, ...res.data]);
        } else {
          setMyBookings(res.data);
        }
        setMyBookingsPage(res.page);
        setMyBookingsHasMore(res.hasMore);
      } else if (!append) {
        setMyBookings([]);
        setMyBookingsHasMore(false);
      }
    },
    [isGuest, guestBookings]
  );

  const loadMyBookingsForCurrentFilter = useCallback(
    (page: number, append: boolean) => loadMyBookings(myBookingsFilter, page, append),
    [loadMyBookings, myBookingsFilter]
  );

  useEffect(() => {
    loadOffices();
  }, [loadOffices]);

  useEffect(() => {
    if (activeTab === 'my-bookings') loadMyBookings(myBookingsFilter, 1, false);
  }, [activeTab, myBookingsFilter, loadMyBookings]);

  useEffect(() => {
    if (selectedOffice) loadRooms(selectedOffice.id);
  }, [selectedOffice?.id, loadRooms]);

  useEffect(() => {
    if (step === 'form' && selectedRoom && selectedDate && !isGuest) {
      const dateStr = formatDateForApi(selectedDate);
      setLoadingAvailability(true);
      getRoomDailyAvailability(selectedRoom.id, dateStr, 60)
        .then((res) => {
          const booked = new Set<string>();
          if (res.ok && res.data.slots) {
            res.data.slots.forEach((slot) => {
              if (!slot.is_available && slot.start_time) {
                const key = getAlmatySlotKey(slot.start_time);
                if (key) booked.add(key);
              }
            });
          }
          if (res.ok && res.data.bookings) {
            res.data.bookings.forEach((b) => {
              const startStr = typeof b.start_time === 'string' ? b.start_time : (b.start_time as Date).toISOString?.() ?? '';
              const key = getAlmatySlotKey(startStr);
              if (key) booked.add(key);
            });
          }
          setBookedSlots(booked);
        })
        .catch(() => setBookedSlots(new Set()))
        .finally(() => setLoadingAvailability(false));
    } else {
      setBookedSlots(new Set());
    }
  }, [step, selectedRoom?.id, selectedDate, isGuest]);

  const goBack = useCallback(() => {
    if (step === 'form') {
      setSelectedRoom(null);
      setSelectedDate(null);
      setFormRoomImageFailed(false);
      setSelectedTimeSlot(null);
      setCompanyName('');
      setStep('rooms');
    } else if (step === 'rooms') {
      setSelectedOffice(null);
      setStep('offices');
    }
  }, [step]);

  const handleSelectOffice = useCallback((office: Office) => {
    setSelectedOffice(office);
  }, []);

  const handleSelectRoom = useCallback((room: MeetingRoom) => {
    setSelectedRoom(room);
    setSelectedDate(null);
    setSelectedTimeSlot(null);
    setCompanyName('');
    setStep('form');
  }, []);

  const handleSubmitBooking = useCallback(async () => {
    if (!selectedRoom || !selectedDate || !selectedTimeSlot) {
      showToast({ title: 'Ошибка', description: 'Выберите дату и время', variant: 'destructive' });
      return;
    }
    const slot = TIME_SLOTS.find((s) => s.label === selectedTimeSlot);
    if (!slot) return;
    const startFormatted = slot.start.includes(':00:00') ? slot.start : `${slot.start}:00`;
    const endFormatted = slot.end.includes(':00:00') ? slot.end : `${slot.end}:00`;
    const now = new Date();
    const isToday = formatDateForApi(selectedDate) === formatDateForApi(now);
    const [h] = slot.start.split(':');
    const slotDate = new Date(selectedDate);
    slotDate.setHours(parseInt(h, 10), 0, 0, 0);
    if (isToday && slotDate < now) {
      showToast({ title: 'Ошибка', description: 'Нельзя бронировать прошедшее время', variant: 'destructive' });
      return;
    }
    if (!isGuest && bookedSlots.has(slot.start)) {
      showToast({ title: 'Время занято', description: 'Выберите другое время', variant: 'destructive' });
      return;
    }
    setSubmitting(true);

    if (isGuest) {
      const start_time = `${formatDateForApi(selectedDate)}T${startFormatted}`;
      const end_time = `${formatDateForApi(selectedDate)}T${endFormatted}`;

      const newId = addGuestBooking({
        meeting_room_id: selectedRoom.id,
        start_time,
        end_time,
        status: 'scheduled',
        company_name: companyName.trim() || null,
        meetingRoom: {
          id: selectedRoom.id,
          name: selectedRoom.name,
          floor: selectedRoom.floor,
          capacity: selectedRoom.capacity,
          office_id: selectedRoom.office_id,
          office: selectedRoom.office,
          status: selectedRoom.status,
          room_type: selectedRoom.room_type,
          description: selectedRoom.description,
          photos: selectedRoom.photos,
          photo: selectedRoom.photo,
          isActive: selectedRoom.isActive,
        },
      } as any);

      setSubmitting(false);
      showToast({ title: 'Демо', description: 'Бронирование создано локально', variant: 'success' });
      setStep('rooms');
      setSelectedRoom(null);
      setSelectedDate(null);
      setSelectedTimeSlot(null);
      setCompanyName('');
      loadMyBookings(myBookingsFilter, 1, false);
      // Переходим на экран демо-QR
      router.push(`/booking/${newId}`);
      return;
    }

    const res = await createMeetingRoomBooking({
      meeting_room_id: selectedRoom.id,
      booking_date: formatDateForApi(selectedDate),
      start_time: startFormatted,
      end_time: endFormatted,
      company_name: companyName.trim() || null,
    });
    setSubmitting(false);
    if (res.ok) {
      showToast({ title: 'Готово', description: 'Бронирование создано', variant: 'success' });
      setStep('rooms');
      setSelectedRoom(null);
      setSelectedDate(null);
      setSelectedTimeSlot(null);
      setCompanyName('');
      loadMyBookings(myBookingsFilter, 1, false);
    } else {
      showToast({ title: 'Ошибка', description: res.error, variant: 'destructive' });
    }
  }, [
    selectedRoom,
    selectedDate,
    selectedTimeSlot,
    companyName,
    bookedSlots,
    showToast,
    loadMyBookings,
    myBookingsFilter,
    isGuest,
    addGuestBooking,
    selectedOffice,
  ]);

  const handleCancelBooking = useCallback(
    (item: MeetingRoomBooking) => {
      const room = item.meeting_room ?? item.meetingRoom;
      Alert.alert(
        'Отменить бронирование?',
        `Бронирование «${room?.name ?? 'Комната'}» будет отменено.`,
        [
          { text: 'Нет', style: 'cancel' },
          {
            text: 'Да, отменить',
            style: 'destructive',
            onPress: async () => {
              setCancellingId(item.id);
              if (isGuest) {
                removeGuestBooking(item.id);
                setCancellingId(null);
                showToast({
                  title: 'Демо',
                  description: 'Бронирование отменено локально',
                  variant: 'default',
                });
                loadMyBookings(myBookingsFilter, 1, false);
                return;
              }
              const res = await cancelMeetingRoomBooking(item.id);
              setCancellingId(null);
              if (res.ok) {
                showToast({
                  title: 'Бронирование отменено',
                  description: 'Бронирование успешно отменено',
                  variant: 'default',
                });
                loadMyBookings(myBookingsFilter, 1, false);
              } else {
                showToast({ title: 'Ошибка', description: res.error, variant: 'destructive' });
              }
            },
          },
        ]
      );
    },
    [showToast, loadMyBookings, myBookingsFilter, isGuest, removeGuestBooking]
  );

  const datesForPicker = useMemo(() => {
    const arr: Date[] = [];
    const today = new Date();
    for (let i = 0; i < 31; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      arr.push(d);
    }
    return arr;
  }, []);

  const visibleRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.isActive !== false &&
          (r.room_type === 'meeting' || r.room_type === undefined)
      ),
    [rooms]
  );
  const totalAvailable = useMemo(
    () => visibleRooms.filter((r) => r.status === 'available').length,
    [visibleRooms]
  );
  const totalBooked = useMemo(
    () => visibleRooms.filter((r) => r.status === 'booked').length,
    [visibleRooms]
  );

  const sortedMyBookings = useMemo(
    () =>
      [...myBookings].sort((a, b) => {
        const sa = typeof a.start_time === 'string' ? a.start_time : '';
        const sb = typeof b.start_time === 'string' ? b.start_time : '';
        return new Date(sa).getTime() - new Date(sb).getTime();
      }),
    [myBookings]
  );

  const isBookingCancelled = useCallback((b: MeetingRoomBooking) => {
    return b.status === 'cancelled' || b.status === 'auto_cancelled';
  }, []);
  const isBookingCompleted = useCallback(
    (b: MeetingRoomBooking) => b.status === 'completed',
    []
  );
  const isBookingActive = useCallback(
    (b: MeetingRoomBooking) =>
      !isBookingCancelled(b) && !isBookingCompleted(b),
    [isBookingCancelled, isBookingCompleted]
  );

  const filteredMyBookings = useMemo(() => {
    switch (myBookingsFilter) {
      case 'active':
        return sortedMyBookings.filter((b) => isBookingActive(b));
      case 'completed':
        return sortedMyBookings.filter((b) => isBookingCompleted(b) && !isBookingCancelled(b));
      case 'cancelled':
        return sortedMyBookings.filter(isBookingCancelled);
      default:
        return sortedMyBookings;
    }
  }, [sortedMyBookings, myBookingsFilter, isBookingActive, isBookingCompleted, isBookingCancelled]);

  const isSlotDisabled = useCallback(
    (slot: { start: string }) => {
      if (bookedSlots.has(slot.start)) return true;

      if (!selectedDate) return false;

      const now = new Date();
      const selected = new Date(selectedDate);
      if (
        selected.getFullYear() !== now.getFullYear() ||
        selected.getMonth() !== now.getMonth() ||
        selected.getDate() !== now.getDate()
      ) {
        // Для будущих и прошлых дат не блокируем слоты по времени, только по бронированиям
        return false;
      }

      // Собираем дату-время начала слота в локальной TZ
      const [hourStr, minuteStr] = slot.start.split(':');
      const slotDateTime = new Date(
        selected.getFullYear(),
        selected.getMonth(),
        selected.getDate(),
        Number(hourStr),
        Number(minuteStr),
        0,
        0
      );

      return slotDateTime.getTime() <= now.getTime();
    },
    [bookedSlots, selectedDate]
  );

  if (step === 'form' && selectedRoom) {
    const roomPhotoUris = getRoomPhotoUris(selectedRoom);
    const roomPhotoCount = roomPhotoUris.length;
    const showFormImages = roomPhotoCount > 0 && !formRoomImageFailed;
    const formImageWidth = windowWidth - 40;
    return (
      <LinearGradient colors={gradientColors} style={styles.gradientFill}>
        <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
          <Pressable style={styles.backRowWhite} onPress={goBack}>
            <MaterialIcons name="arrow-back" size={24} color="#fff" />
            <ThemedText style={styles.backTextWhite}>Назад</ThemedText>
          </Pressable>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.formContent}>
            <View style={styles.roomImageContainer}>
              {showFormImages ? (
                <>
                  <ScrollView
                    horizontal
                    pagingEnabled
                    showsHorizontalScrollIndicator={false}
                    style={StyleSheet.absoluteFill}
                    contentContainerStyle={[styles.roomFormPhotoScrollContent, { width: formImageWidth * roomPhotoCount }]}
                  >
                    {roomPhotoUris.map((uri, i) => (
                      <View key={i} style={[styles.roomFormPhotoSlide, { width: formImageWidth }]}>
                        <Image
                          source={{ uri }}
                          style={styles.roomImage}
                          contentFit="cover"
                          cachePolicy="disk"
                          onError={() => setFormRoomImageFailed(true)}
                        />
                      </View>
                    ))}
                  </ScrollView>
                  {roomPhotoCount > 1 && (
                    <View style={styles.roomImageBadge}>
                      <ThemedText style={styles.roomImageBadgeText}>+{roomPhotoCount - 1} фото</ThemedText>
                    </View>
                  )}
                </>
              ) : (
                <View style={styles.roomImagePlaceholder}>
                  <MaterialIcons name="image" size={48} color="rgba(255,255,255,0.4)" />
                  <ThemedText style={styles.roomImagePlaceholderText}>Фото не загружено</ThemedText>
                </View>
              )}
            </View>
            <ThemedText type="title" style={styles.formTitleWhite}>
              Бронирование
            </ThemedText>
            <ThemedText style={styles.formSubtitleWhite}>
              {selectedRoom.name}
              {selectedRoom.floor != null && ` • ${selectedRoom.floor} этаж`}
              {selectedRoom.capacity != null && ` • до ${selectedRoom.capacity} чел.`}
            </ThemedText>
            <ThemedText style={styles.labelWhite}>Дата</ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.datesRow}>
            {datesForPicker.map((d) => {
              const key = formatDateForApi(d);
              const isSelected = selectedDate ? formatDateForApi(selectedDate) === key : false;
              return (
                <Pressable
                  key={key}
                  onPress={() => setSelectedDate(d)}
                  style={[
                    styles.dateChip,
                    styles.dateChipForm,
                    isSelected && styles.dateChipFormSelected,
                  ]}
                >
                  <ThemedText style={[styles.dateChipText, isSelected && styles.dateChipTextSelected]}>
                    {d.getDate()}
                  </ThemedText>
                  <ThemedText style={[styles.dateChipSub, isSelected && styles.dateChipTextSelected]}>
                    {['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'][d.getDay()]}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
          <ThemedText style={styles.labelWhite}>Время</ThemedText>
          {loadingAvailability ? (
            <ActivityIndicator size="small" color="#fff" style={styles.loader} />
          ) : (
            <View style={styles.slotsGrid}>
              {TIME_SLOTS.map((slot) => {
                const disabled = isSlotDisabled(slot);
                const isSelected = selectedTimeSlot === slot.label;
                return (
                  <Pressable
                    key={slot.label}
                    onPress={() => !disabled && setSelectedTimeSlot(slot.label)}
                    disabled={disabled}
                    style={[
                      styles.slotChip,
                      styles.slotChipForm,
                      disabled && styles.slotChipDisabled,
                      isSelected && styles.slotChipFormSelected,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.slotChipText,
                        disabled && styles.slotChipTextFormDisabled,
                        isSelected && styles.dateChipTextSelected,
                      ]}
                    >
                      {slot.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          )}
          <ThemedText style={styles.labelWhite}>Компания (необязательно)</ThemedText>
          <TextInput
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Название компании"
            placeholderTextColor="rgba(255,255,255,0.6)"
            style={styles.inputForm}
          />
          <Pressable
            onPress={handleSubmitBooking}
            disabled={submitting}
            style={[styles.submitBtn, styles.submitBtnForm]}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.submitBtnText}>Забронировать</ThemedText>
            )}
          </Pressable>
        </ScrollView>
        </View>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient colors={gradientColors} style={styles.gradientFill}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <ThemedText type="title" style={styles.titleWhite}>
          Переговорные
        </ThemedText>
        <View style={styles.tabsRowWhite}>
          <Pressable
            onPress={() => setActiveTab('book')}
            style={[styles.tabWhite, activeTab === 'book' && styles.tabWhiteActive]}
          >
            <ThemedText style={[styles.tabTextWhite, activeTab === 'book' && styles.tabTextWhiteActive]}>
              Бронировать
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('my-bookings')}
            style={[styles.tabWhite, activeTab === 'my-bookings' && styles.tabWhiteActive]}
          >
            <ThemedText style={[styles.tabTextWhite, activeTab === 'my-bookings' && styles.tabTextWhiteActive]}>
              Мои бронирования
            </ThemedText>
          </Pressable>
        </View>

        {activeTab === 'book' && (
          <>
            {!selectedOffice && (
              <>
                <ThemedText style={styles.stepHintWhite}>
                  Выберите офис для просмотра переговорных комнат
                </ThemedText>
                <Pressable
                  onPress={handleDetectNearestOffice}
                  style={styles.geoButtonWhite}
                >
                  <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
                  <ThemedText style={styles.geoButtonTextWhite}>
                    Определить ближайший офис
                  </ThemedText>
                </Pressable>
                {loadingOffices ? (
                  <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                ) : offices.length === 0 ? (
                  <View style={styles.emptyState}>
                    <ThemedText type="defaultSemiBold" style={styles.emptyStateTitleWhite}>
                      Нет офисов
                    </ThemedText>
                    <ThemedText style={styles.emptyStateSubWhite}>
                      Обратитесь к администратору
                    </ThemedText>
                  </View>
                ) : (
                  <ScrollView
                    showsVerticalScrollIndicator={false}
                  >
                    <View style={styles.officeGrid}>
                      {offices.map((item) => {
                        const photoUri = getImageUri(item.photo);
                        return (
                          <Pressable
                            key={item.id}
                            style={styles.officeCard}
                            onPress={() => handleSelectOffice(item)}
                          >
                            <View style={styles.officeCardImageWrap}>
                              {photoUri ? (
                                <Image source={{ uri: photoUri }} style={styles.officeCardImage} contentFit="cover" />
                              ) : (
                                <View style={styles.officeCardImagePlaceholder}>
                                  <MaterialIcons name="location-on" size={32} color="rgba(255,255,255,0.4)" />
                                </View>
                              )}
                            </View>
                            <ThemedText style={styles.officeCardName} numberOfLines={2}>
                              {item.name}
                            </ThemedText>
                            {(item.address || item.city) && (
                              <ThemedText style={styles.officeCardMeta} numberOfLines={2}>
                                {[item.address, item.city].filter(Boolean).join(', ')}
                              </ThemedText>
                            )}
                          </Pressable>
                        );
                      })}
                    </View>
                  </ScrollView>
                )}
              </>
            )}

            {selectedOffice && (
              <>
                <Pressable style={styles.backRowWhite} onPress={() => setSelectedOffice(null)}>
                  <MaterialIcons name="arrow-back" size={24} color="#fff" />
                  <ThemedText style={styles.backTextWhite}>Назад к выбору офисов</ThemedText>
                </Pressable>
                <ThemedText style={styles.officeNameWhite}>{selectedOffice.name}</ThemedText>
                {(selectedOffice.city || selectedOffice.address) && (
                  <ThemedText style={styles.officeAddressWhite}>
                    {[selectedOffice.city, selectedOffice.address].filter(Boolean).join(', ')}
                  </ThemedText>
                )}
                <ThemedText style={styles.badgesLabelWhite}>
                  Доступно: {totalAvailable} · Забронировано: {totalBooked}
                </ThemedText>
                {loadingRooms ? (
                  <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                ) : visibleRooms.length === 0 ? (
                  <View style={styles.emptyState}>
                    <ThemedText type="defaultSemiBold" style={styles.emptyStateTitleWhite}>
                      Нет переговорных по заданным параметрам
                    </ThemedText>
                    <ThemedText style={styles.emptyStateSubWhite}>
                      Попробуйте изменить фильтры или сбросить их.
                    </ThemedText>
                  </View>
                ) : (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roomsScroll}>
                    {visibleRooms.map((item) => {
                      const photoUri = getRoomPhotoUri(item);
                      const photoCount = item.photos?.length ?? (item.photo ? 1 : 0);
                      const imageFailed = roomImageFailedIds.has(item.id);
                      const showImage = !!photoUri && photoUri.length > 0 && !imageFailed;
                      return (
                        <Pressable
                          key={item.id}
                          style={styles.roomCardOrange}
                          onPress={() => handleSelectRoom(item)}
                        >
                          <View style={styles.roomCardImageWrap}>
                            {showImage ? (
                              <Image
                                source={{ uri: photoUri }}
                                style={styles.roomCardImage}
                                contentFit="cover"
                                cachePolicy="disk"
                                recyclingKey={String(item.id)}
                                onError={() => {
                                  setRoomImageFailedIds((prev) => new Set(prev).add(item.id));
                                }}
                              />
                            ) : (
                              <View style={styles.roomCardImagePlaceholder}>
                                <MaterialIcons name="image" size={32} color="rgba(255,255,255,0.4)" />
                              </View>
                            )}
                            {photoCount > 1 && (
                              <View style={styles.roomCardImageBadge}>
                                <ThemedText style={styles.roomCardImageBadgeText}>+{photoCount - 1}</ThemedText>
                              </View>
                            )}
                          </View>
                          <ThemedText style={styles.roomCardNameWhite} numberOfLines={2}>
                            {item.name}
                          </ThemedText>
                          <View style={styles.roomCardMetaRow}>
                            {item.floor != null && (
                              <ThemedText style={styles.roomCardMetaWhite}>{item.floor} этаж</ThemedText>
                            )}
                            {item.capacity != null && (
                              <ThemedText style={styles.roomCardMetaWhite}>до {item.capacity} чел.</ThemedText>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                )}
              </>
            )}

          </>
        )}

      {activeTab === 'my-bookings' && (
        <>
          {loadingBookings ? (
            <ActivityIndicator size="large" color="#fff" style={styles.loader} />
          ) : myBookings.length === 0 ? (
            <ThemedText style={styles.emptyWhite}>
              Нет бронирований
            </ThemedText>
          ) : (
            <>
              <ThemedText style={styles.myBookingsSubtitleWhite}>
                Управляйте своими бронированиями переговорных комнат
              </ThemedText>
              <View style={styles.myBookingsFilterRow}>
                {(['active', 'completed', 'cancelled'] as const).map((filter) => (
                  <Pressable
                    key={filter}
                    onPress={() => setMyBookingsFilter(filter)}
                    style={[styles.myBookingsFilterTab, myBookingsFilter === filter && styles.myBookingsFilterTabActive]}
                  >
                    <ThemedText
                      style={[
                        styles.myBookingsFilterText,
                        myBookingsFilter === filter && styles.myBookingsFilterTextActive,
                      ]}
                    >
                      {filter === 'active' ? 'Активные' : filter === 'completed' ? 'Завершенные' : 'Отменённые'}
                    </ThemedText>
                    {myBookingsFilter === filter && (
                      <View style={styles.myBookingsFilterUnderline} />
                    )}
                  </Pressable>
                ))}
              </View>
              <FlatList
                data={isGuest ? filteredMyBookings : myBookings}
                keyExtractor={(b) => String(b.id)}
                onEndReached={
                  !isGuest && myBookingsHasMore && !loadingMoreBookings
                    ? () => loadMyBookings(myBookingsFilter, myBookingsPage + 1, true)
                    : undefined
                }
                onEndReachedThreshold={0.4}
                ListEmptyComponent={
                  <ThemedText style={styles.emptyWhite}>
                    {myBookingsFilter === 'active'
                      ? 'Нет активных бронирований'
                      : myBookingsFilter === 'completed'
                        ? 'Нет завершённых бронирований'
                        : 'Нет отменённых бронирований'}
                  </ThemedText>
                }
                ListFooterComponent={
                  loadingMoreBookings ? (
                    <View style={styles.loaderFooter}>
                      <ActivityIndicator size="small" color="#fff" />
                    </View>
                  ) : null
                }
                renderItem={({ item }) => {
                  const room = item.meeting_room ?? item.meetingRoom;
                  const startStr = typeof item.start_time === 'string' ? item.start_time : '';
                  const endStr = typeof item.end_time === 'string' ? item.end_time : '';
                  const dateStr = startStr.slice(0, 10);
                  const isCancelling = cancellingId === item.id;
                  const statusText = getBookingStatusText(item.status);
                  const isCancelled = isBookingCancelled(item);
                  const isCompleted = item.status === 'completed' || isBookingCompleted(item);
                  const canCancel = !isCancelled && !isCompleted;
                  return (
                    <View style={styles.bookingCardOrange}>
                      <View style={styles.bookingCardHeader}>
                        <ThemedText type="defaultSemiBold" style={styles.bookingCardTitleWhite}>
                          {room?.name ?? 'Комната'}
                        </ThemedText>
                        <View style={styles.bookingStatusBadgeOrange}>
                          <ThemedText style={styles.bookingStatusTextOrange}>{statusText}</ThemedText>
                        </View>
                      </View>
                      <ThemedText style={styles.bookingMetaWhite}>
                        {formatDisplayDateFromIso(startStr)} • {formatTimeOnly(startStr)}–{formatTimeOnly(endStr)}
                      </ThemedText>
                      {item.company_name && (
                        <ThemedText style={styles.bookingMetaWhite}>{item.company_name}</ThemedText>
                      )}
                      <View style={styles.bookingCardActions}>
                        <Pressable
                          onPress={() => router.push(`/booking/${item.id}`)}
                          style={styles.viewBookingBtnOrange}
                        >
                          <MaterialIcons name="qr-code-2" size={18} color="#fff" />
                          <ThemedText style={styles.viewBookingBtnText}>QR код</ThemedText>
                        </Pressable>
                        {canCancel && (
                          <Pressable
                            onPress={() => handleCancelBooking(item)}
                            disabled={isCancelling}
                            style={styles.cancelBtnOrange}
                          >
                            {isCancelling ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <ThemedText style={styles.cancelBtnTextWhite}>Отменить бронирование</ThemedText>
                            )}
                          </Pressable>
                        )}
                      </View>
                    </View>
                  );
                }}
              />
            </>
          )}
        </>
      )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradientFill: {
    flex: 1,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 12,
  },
  titleWhite: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
    marginBottom: 12,
    color: '#fff',
  },
  tabsRowWhite: {
    flexDirection: 'row',
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tabWhite: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 12,
    alignItems: 'center',
  },
  tabWhiteActive: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  tabTextWhite: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
  },
  tabTextWhiteActive: {
    color: '#fff',
    fontWeight: '600',
  },
  stepHint: {
    fontSize: 14,
    marginBottom: 12,
  },
  emptyState: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyStateTitle: {
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateSub: {
    fontSize: 14,
    textAlign: 'center',
  },
  stepHintWhite: {
    fontSize: 14,
    marginBottom: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  emptyStateTitleWhite: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#fff',
  },
  emptyStateSubWhite: {
    fontSize: 14,
    textAlign: 'center',
    color: 'rgba(255,255,255,0.7)',
  },
  officeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  officeCard: {
    width: '30%',
    minWidth: 100,
    maxWidth: 140,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  officeCardImageWrap: {
    width: '100%',
    aspectRatio: 112 / 145,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  officeCardImage: {
    width: '100%',
    height: '100%',
  },
  officeCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  officeCardName: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    marginTop: 6,
  },
  officeCardMeta: {
    fontSize: 9,
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
  },
  backRowWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    marginBottom: 8,
  },
  backTextWhite: {
    fontSize: 16,
    color: '#fff',
  },
  officeNameWhite: {
    fontSize: 16,
    marginBottom: 4,
    color: '#fff',
  },
  officeAddressWhite: {
    fontSize: 14,
    marginBottom: 8,
    color: 'rgba(255,255,255,0.8)',
  },
  badgesLabelWhite: {
    fontSize: 13,
    marginBottom: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  roomsScroll: {
    marginBottom: 16,
    maxHeight: 200,
  },
  roomCardOrange: {
    width: 112,
    marginRight: 12,
  },
  roomCardImageWrap: {
    width: 112,
    height: 145,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  roomCardImage: {
    width: '100%',
    height: '100%',
  },
  roomCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomCardImageBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  roomCardImageBadgeText: {
    fontSize: 10,
    color: '#fff',
  },
  roomCardNameWhite: {
    fontSize: 11,
    fontWeight: '600',
    color: '#fff',
    marginTop: 6,
  },
  roomCardMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  roomCardMetaWhite: {
    fontSize: 10,
    color: 'rgba(255,255,255,0.7)',
  },
  formTitleWhite: {
    marginBottom: 8,
    color: '#fff',
    fontSize: 20,
  },
  formSubtitleWhite: {
    fontSize: 15,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  labelWhite: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
    color: 'rgba(255,255,255,0.9)',
  },
  roomImageContainer: {
    width: '100%',
    height: 185,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.1)',
    marginBottom: 16,
  },
  roomFormPhotoScrollContent: {
    flexDirection: 'row',
  },
  roomFormPhotoSlide: {
    height: '100%',
    overflow: 'hidden',
  },
  roomImage: {
    width: '100%',
    height: '100%',
  },
  roomImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  roomImagePlaceholderText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.5)',
    marginTop: 8,
  },
  roomImageBadge: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  roomImageBadgeText: {
    fontSize: 12,
    color: '#fff',
  },
  dateChipForm: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  dateChipFormSelected: {
    backgroundColor: '#F35713',
    borderColor: '#F35713',
  },
  slotChipForm: {
    borderColor: 'rgba(255,255,255,0.4)',
  },
  slotChipFormSelected: {
    backgroundColor: '#F35713',
    borderColor: '#F35713',
  },
  slotChipTextFormDisabled: {
    color: 'rgba(255,255,255,0.4)',
  },
  inputForm: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: '#fff',
    marginBottom: 16,
  },
  submitBtnForm: {
    backgroundColor: CARD_ORANGE,
  },
  emptyWhite: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 15,
    color: 'rgba(255,255,255,0.8)',
  },
  myBookingsSubtitleWhite: {
    fontSize: 14,
    marginBottom: 16,
    color: 'rgba(255,255,255,0.9)',
  },
  myBookingsFilterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  myBookingsFilterTab: {
    flex: 1,
    position: 'relative',
    paddingVertical: 10,
    alignItems: 'center',
  },
  myBookingsFilterTabActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  myBookingsFilterText: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.7)',
  },
  myBookingsFilterTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  myBookingsFilterUnderline: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#F35713',
  },
  geoButtonWhite: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.7)',
    backgroundColor: 'rgba(0,0,0,0.25)',
    gap: 6,
  },
  geoButtonTextWhite: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  bookingCardActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    alignItems: 'center',
  },
  viewBookingBtnOrange: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  viewBookingBtnText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '500',
  },
  bookingCardOrange: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cancelBtnOrange: {
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  cancelBtnTextWhite: {
    color: '#fff',
  },
  bookingCardTitleWhite: {
    color: '#fff',
  },
  bookingStatusBadgeOrange: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  bookingStatusTextOrange: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.9)',
  },
  bookingMetaWhite: {
    fontSize: 13,
    marginTop: 4,
    color: 'rgba(255,255,255,0.8)',
  },
  tabsRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabText: {
    fontSize: 15,
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 12,
    borderBottomWidth: 1,
    marginBottom: 12,
  },
  backText: {
    fontSize: 16,
  },
  officeName: {
    fontSize: 16,
    marginBottom: 4,
  },
  officeAddress: {
    fontSize: 14,
    marginBottom: 12,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  badge: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: 13,
  },
  card: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 10,
  },
  cardSub: {
    fontSize: 13,
    marginTop: 4,
  },
  roomCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  roomCardHeader: {
    marginBottom: 8,
  },
  roomStatusBadge: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 999,
  },
  roomStatusAvailable: {
    backgroundColor: 'rgba(17, 74, 101, 0.9)',
  },
  roomStatusBooked: {
    backgroundColor: 'rgba(184, 64, 14, 0.9)',
  },
  roomStatusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  roomCardTitle: {
    marginBottom: 4,
  },
  roomCardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  scroll: {
    flex: 1,
  },
  formContent: {
    paddingBottom: 24,
  },
  formTitle: {
    marginBottom: 8,
  },
  formSubtitle: {
    fontSize: 15,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginTop: 12,
    marginBottom: 6,
  },
  datesRow: {
    marginBottom: 8,
    maxHeight: 80,
  },
  dateChip: {
    width: 56,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    marginRight: 10,
    alignItems: 'center',
  },
  dateChipText: {
    fontSize: 18,
    fontWeight: '600',
  },
  dateChipSub: {
    fontSize: 11,
    marginTop: 2,
  },
  dateChipTextSelected: {
    color: '#fff',
  },
  loader: {
    marginVertical: 20,
  },
  loaderFooter: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  slotsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  slotChip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    minWidth: '30%',
  },
  slotChipDisabled: {
    opacity: 0.5,
  },
  slotChipText: {
    fontSize: 13,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 15,
  },
  myBookingsSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  bookingCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  bookingCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 4,
  },
  bookingStatusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  bookingStatusText: {
    fontSize: 12,
  },
  bookingMeta: {
    fontSize: 13,
    marginTop: 4,
  },
  cancelBtn: {
    marginTop: 12,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
  },
});
