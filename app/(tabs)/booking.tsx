import { useAsyncResource } from '@/hooks/use-async-resource';
import { useScopedState } from '@/hooks/use-scoped-state';
import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Location from 'expo-location';
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentProps } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Linking,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { OfficeBookingsTab } from '@/components/booking/office-bookings-tab';
import { RoomBookingScreen } from '@/components/booking/flow/room-booking-screen';
import { EquipmentChips } from '@/components/booking/flow/equipment-chips';
import { BookingDetailsScreen } from '@/components/booking/flow/booking-details-screen';
import { ThemedText } from '@/components/themed-text';
import { PullToRefresh } from '@/components/ui';
import { useToast } from '@/context/toast-context';
import {
    type MeetingRoom,
    type MeetingRoomBooking,
    type MyBookingsStatusFilter,
    type Office,
    cancelMeetingRoomBooking,
    getMeetingRooms,
    getMyBookings,
    getOffices,
} from '@/lib/api';
import { formatDisplayDateFromIso, formatTimeOnly } from '@/lib/dateTimeUtils';
import { getImageUri, getPrimaryPhotoUri } from '@/lib/image-uri';
import { findNearestOffice, nearestOfficeNotice } from '@/lib/nearest-office';
import { canSeeOfficeBookings, getBookingStatusText, officeBookingsTabLabel } from '@/lib/office-bookings';
import { almatyDay, almatyMinutes, formatBookingDay, formatDuration, formatTime, officeHours } from '@/lib/booking-flow';
import { useAuthStore } from '@/stores/auth-store';
import { useBookingTabUiStore } from '@/stores/booking-tab-ui-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const ORANGE_GRADIENT = ['#F35713', '#281504'] as const;
/** Нижний стоп градиента — тот же цвет, что `BOOKING_TAB_SCENE_UNDERLAY` в `app/(tabs)/_layout.tsx` (зона под навбаром). */

/**
 * URL первого фото комнаты — как в браузере: используем photos[0] или photo как есть.
 * Если URL относительный — дополняем базой API.
 */
function getRoomPhotoUri(room: MeetingRoom | null | undefined): string | null {
  return getPrimaryPhotoUri(room);
}

type Step = 'offices' | 'rooms' | 'form';
type BookingTab = 'book' | 'my-bookings' | 'office-bookings';
type MyBookingsFilter = 'active' | 'completed' | 'cancelled';

function enrichCreatedBooking(
  booking: MeetingRoomBooking,
  room: MeetingRoom | null
): MeetingRoomBooking {
  if (!room) return booking;
  const meetingRoom = (booking.meeting_room ?? booking.meetingRoom ?? room) as MeetingRoom;
  return {
    ...booking,
    meeting_room: meetingRoom,
    meetingRoom: (booking.meetingRoom ?? booking.meeting_room ?? room) as MeetingRoom,
  };
}

/** Текст экрана «Бронь»: всегда белый на градиенте в любой теме приложения. */
function BookingText(props: ComponentProps<typeof ThemedText>) {
  return <ThemedText {...props} lightColor="#FFFFFF" darkColor="#FFFFFF" />;
}

function pluralRooms(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'переговорная';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'переговорные';
  return 'переговорных';
}

export default function BookingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const gradientColors = ORANGE_GRADIENT;

  const [activeTab, setActiveTab] = useState<BookingTab>('book');
  const [step, setStep] = useState<Step>('offices');
  const [selectedOffice, setSelectedOffice] = useState<any>(null);
  const [selectedRoom, setSelectedRoom] = useState<MeetingRoom | null>(null);

  const { data: offices, loading: loadingOffices, refresh: loadOffices } = useAsyncResource<Office[]>(getOffices, []);

  const [serverBookings, setMyBookings] = useState<MeetingRoomBooking[]>([]);
  const [myBookingsPage, setMyBookingsPage] = useState(1);
  const [myBookingsHasMore, setMyBookingsHasMore] = useState(false);
  const [loadingMoreBookings, setLoadingMoreBookings] = useState(false);
  const [myBookingsFilter, setMyBookingsFilter] = useState<MyBookingsFilter>('active');

  const [loadingBookings, setLoadingBookings] = useState(activeTab === 'my-bookings');
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [detailsBooking, setDetailsBooking] = useState<MeetingRoomBooking | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /** Защита от гонок при смене фильтра / параллельных запросов «мои бронирования». */
  const myBookingsLoadSeqRef = useRef(0);
  const myBookingsListRef = useRef<FlatList<MeetingRoomBooking>>(null);
  const [highlightBookingId, setHighlightBookingId] = useState<number | null>(null);

  const isGuest = useAuthStore((s) => s.isGuest);
  const role = useAuthStore((s) => s.user?.role ?? s.role);
  const ownOfficeName = useAuthStore((s) => s.user?.office?.name);
  const showOfficeBookings = !isGuest && canSeeOfficeBookings(role);
  const {
    bookings: guestBookings,
    removeBooking: removeGuestBooking,
  } = useGuestDemoStore();

  const myBookings = useMemo(() => isGuest
    ? [...guestBookings].sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime()) as MeetingRoomBooking[]
    : serverBookings, [isGuest, guestBookings, serverBookings]);

  const [roomImageFailedIds, setRoomImageFailedIds] = useScopedState<Set<number>>(selectedOffice?.id, () => new Set());

  const setHideBottomNavForBookingForm = useBookingTabUiStore(
    (s) => s.setHideBottomNavForBookingForm
  );

  useFocusEffect(
    useCallback(() => {
      setHideBottomNavForBookingForm(step === 'form' || detailsBooking !== null);
      return () => {
        setHideBottomNavForBookingForm(false);
      };
    }, [step, detailsBooking, setHideBottomNavForBookingForm])
  );

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
            variant: 'error',
              duration: 4000,
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
      if (nearest.kind === 'nearby') setSelectedOffice(nearest.office);
      showToast({ ...nearestOfficeNotice(nearest), duration: 3500 });
    } catch (e) {
      console.error('[Booking] detect nearest office error', e);
      showToast({
        title: 'Ошибка геолокации',
        description: 'Не удалось определить ближайший офис.',
        variant: 'error',
          duration: 4000,
      });
    }
  }, [offices, showToast]);

  const selectedOfficeId = selectedOffice?.id as number | undefined;
  const fetchRooms = useCallback(async () => {
    if (selectedOfficeId == null) return [];
    const officeId = selectedOfficeId;
    const res = await getMeetingRooms(officeId);
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
      return list;
    }
    return [];
  }, [selectedOfficeId]);
  const { data: rooms, loading: loadingRooms, refresh: loadRooms } = useAsyncResource<MeetingRoom[]>(fetchRooms, [], selectedOfficeId != null);

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

      const loadSeq = ++myBookingsLoadSeqRef.current;

      if (append) {
        setLoadingMoreBookings(true);
      } else {
        setLoadingBookings(true);
        setMyBookings([]);
      }

      const res = await getMyBookings({ status: statusFilter, page, pageSize: PAGE_SIZE });

      if (loadSeq !== myBookingsLoadSeqRef.current) {
        return;
      }

      if (append) {
        setLoadingMoreBookings(false);
      } else {
        setLoadingBookings(false);
      }

      if (res.ok) {
        if (append) {
          setMyBookings((prev) => [...prev, ...res.data]);
        } else {
          setMyBookings(res.data);
        }
        setMyBookingsPage(res.page);
        setMyBookingsHasMore(res.hasMore);
      } else {
        if (!append) {
          setMyBookingsHasMore(false);
        }
        showToast({
          title: append ? 'Не удалось загрузить ещё' : 'Не удалось загрузить бронирования',
          description: res.error,
          variant: 'error',
          duration: 4500,
        });
      }
    },
    [isGuest, guestBookings, showToast]
  );

  const loadMyBookingsForCurrentFilter = useCallback(
    (page: number, append: boolean) => loadMyBookings(myBookingsFilter, page, append),
    [loadMyBookings, myBookingsFilter]
  );

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (activeTab === 'my-bookings') {
        await loadMyBookingsForCurrentFilter(1, false);
        return;
      }

      // activeTab === 'book'
      if (selectedOffice?.id) {
        await loadRooms();
      } else {
        await loadOffices();
      }
    } finally {
      setRefreshing(false);
    }
  }, [
    refreshing,
    activeTab,
    loadMyBookingsForCurrentFilter,
    selectedOffice?.id,
    loadRooms,
    loadOffices,
  ]);

  const bookingsScope = JSON.stringify([activeTab, myBookingsFilter, isGuest, guestBookings]);
  const [previousBookingsScope, setPreviousBookingsScope] = useState(bookingsScope);
  if (previousBookingsScope !== bookingsScope) {
    setPreviousBookingsScope(bookingsScope);
    setLoadingBookings(activeTab === 'my-bookings' && !isGuest);
    setLoadingMoreBookings(false); setMyBookings([]); setMyBookingsPage(1); setMyBookingsHasMore(false);
  }
  useEffect(() => {
    const sequence = ++myBookingsLoadSeqRef.current;
    if (activeTab !== 'my-bookings' || isGuest) return;
    let cancelled = false;
    void getMyBookings({ status: myBookingsFilter, page: 1, pageSize: PAGE_SIZE }).then((res) => {
      if (cancelled || sequence !== myBookingsLoadSeqRef.current) return;
      setLoadingBookings(false);
      if (res.ok) {
        setMyBookings(res.data); setMyBookingsPage(res.page); setMyBookingsHasMore(res.hasMore);
      } else {
        showToast({ title: 'Не удалось загрузить бронирования', description: res.error, variant: 'error', duration: 4500 });
      }
    });
    return () => { cancelled = true; myBookingsLoadSeqRef.current += 1; };
  }, [activeTab, myBookingsFilter, isGuest, showToast]);

  useEffect(() => {
    if (highlightBookingId == null) return;
    const timer = setTimeout(() => setHighlightBookingId(null), 3200);
    return () => clearTimeout(timer);
  }, [highlightBookingId]);

  const goBack = useCallback(() => {
    if (step === 'form') {
      setSelectedRoom(null);
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
    setStep('form');
  }, []);

  const resetBookingForm = useCallback(() => {
    setStep('offices');
    setSelectedOffice(null);
    setSelectedRoom(null);
  }, []);

  const afterBookingCreated = useCallback(
    async (created: MeetingRoomBooking) => {
      const enriched = enrichCreatedBooking(created, selectedRoom);

      showToast({
        title: 'Бронь создана',
        description: `${formatBookingDay(almatyDay(new Date(created.start_time)))} · ${formatTime(almatyMinutes(created.start_time))}–${formatTime(almatyMinutes(created.end_time))}`,
        variant: 'success',
        duration: 3500,
      });

      resetBookingForm();
      setMyBookingsFilter('active');
      setActiveTab('my-bookings');
      setHighlightBookingId(enriched.id);

      if (isGuest) {
        const guestList = useGuestDemoStore.getState().bookings as MeetingRoomBooking[];
        setMyBookings(guestList);
        setMyBookingsHasMore(false);
        setMyBookingsPage(1);
        return;
      }

      setMyBookings((prev) => {
        const rest = prev.filter((b) => b.id !== enriched.id);
        return [enriched, ...rest];
      });
      setMyBookingsPage(1);

      await loadMyBookings('active', 1, false);
      setMyBookings((prev) => {
        if (prev.some((b) => b.id === enriched.id)) return prev;
        return [enriched, ...prev];
      });
    },
    [selectedRoom, showToast, resetBookingForm, isGuest, loadMyBookings]
  );

  const handleCancelBooking = useCallback(
    (item: MeetingRoomBooking, onCancelled?: () => void) => {
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
                onCancelled?.();
                showToast({
                  title: 'Демо',
                  description: 'Бронирование отменено локально',
                  variant: 'success',
                });
                loadMyBookings(myBookingsFilter, 1, false);
                return;
              }
              const res = await cancelMeetingRoomBooking(item.id);
              setCancellingId(null);
              if (res.ok) {
                onCancelled?.();
                showToast({
                  title: 'Бронирование отменено',
                  description: 'Бронирование успешно отменено',
                  variant: 'success',
                });
                loadMyBookings(myBookingsFilter, 1, false);
              } else {
                showToast({
                  title: 'Ошибка',
                  description: res.error,
                  variant: 'error',
                  duration: 4000,
                });
              }
            },
          },
        ]
      );
    },
    [showToast, loadMyBookings, myBookingsFilter, isGuest, removeGuestBooking]
  );

  const visibleRooms = useMemo(
    () =>
      rooms.filter(
        (r) =>
          r.isActive !== false &&
          (r.room_type === 'meeting' || r.room_type === undefined)
      ),
    [rooms]
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

  const myBookingsListData = isGuest ? filteredMyBookings : myBookings;

  useEffect(() => {
    if (activeTab !== 'my-bookings' || highlightBookingId == null || myBookingsListData.length === 0) {
      return;
    }
    const index = myBookingsListData.findIndex((b) => b.id === highlightBookingId);
    const scrollIndex = index >= 0 ? index : 0;
    const frame = requestAnimationFrame(() => {
      try {
        myBookingsListRef.current?.scrollToIndex({
          index: scrollIndex,
          animated: true,
          viewPosition: 0,
        });
      } catch {
        myBookingsListRef.current?.scrollToOffset({ offset: 0, animated: true });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [activeTab, highlightBookingId, myBookingsListData]);

  if (detailsBooking) {
    return (
      <BookingDetailsScreen
        booking={detailsBooking}
        onClose={() => setDetailsBooking(null)}
        onShowQr={() => router.push(`/booking/${detailsBooking.id}`)}
        onCancel={() => handleCancelBooking(detailsBooking, () => setDetailsBooking(null))}
        cancelling={cancellingId === detailsBooking.id}
      />
    );
  }

  if (step === 'form' && selectedRoom) {
    return (
      <RoomBookingScreen
        room={selectedRoom}
        office={selectedOffice}
        onClose={goBack}
        onBooked={(booking) => void afterBookingCreated(booking)}
      />
    );
  }

  return (
    <LinearGradient colors={gradientColors} style={styles.gradientFill}>
      <View style={[styles.container, { paddingTop: insets.top + 16 }]}>
        <BookingText type="title" style={styles.titleWhite}>
          Переговорные
        </BookingText>
        <View style={styles.tabsRowWhite}>
          <Pressable
            onPress={() => setActiveTab('book')}
            style={[styles.tabWhite, showOfficeBookings && styles.tabWhiteCompact, activeTab === 'book' && styles.tabWhiteActive]}
          >
            <BookingText style={[styles.tabTextWhite, activeTab === 'book' && styles.tabTextWhiteActive]}>
              Бронировать
            </BookingText>
          </Pressable>
          <Pressable
            onPress={() => setActiveTab('my-bookings')}
            style={[styles.tabWhite, showOfficeBookings && styles.tabWhiteCompact, activeTab === 'my-bookings' && styles.tabWhiteActive]}
          >
            <BookingText style={[styles.tabTextWhite, activeTab === 'my-bookings' && styles.tabTextWhiteActive]}>
              {showOfficeBookings ? 'Мои брони' : 'Мои бронирования'}
            </BookingText>
          </Pressable>
          {showOfficeBookings && (
            <Pressable
              onPress={() => setActiveTab('office-bookings')}
              style={[styles.tabWhite, showOfficeBookings && styles.tabWhiteCompact, activeTab === 'office-bookings' && styles.tabWhiteActive]}
            >
              <BookingText
                style={[styles.tabTextWhite, activeTab === 'office-bookings' && styles.tabTextWhiteActive]}
              >
                {officeBookingsTabLabel(role)}
              </BookingText>
            </Pressable>
          )}
        </View>

        {activeTab === 'book' && (
          <>
            {!selectedOffice && (
              <>
                <BookingText style={styles.stepHintWhite}>
                  Выберите офис для просмотра переговорных комнат
                </BookingText>
                <Pressable
                  onPress={handleDetectNearestOffice}
                  style={styles.geoButtonWhite}
                >
                  <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
                  <BookingText style={styles.geoButtonTextWhite}>
                    Определить ближайший офис
                  </BookingText>
                </Pressable>
                {loadingOffices ? (
                  <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                ) : offices.length === 0 ? (
                  <View style={styles.emptyState}>
                    <BookingText type="defaultSemiBold" style={styles.emptyStateTitleWhite}>
                      Нет офисов
                    </BookingText>
                    <BookingText style={styles.emptyStateSubWhite}>
                      Обратитесь к администратору
                    </BookingText>
                  </View>
                ) : (
                  <PullToRefresh
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    loaderSize={96}
                    topOffset={16}
                  >
                    <ScrollView showsVerticalScrollIndicator={false}>
                      <View style={styles.officeGrid}>
                        {offices.map((item) => {
                          const photoUri = getImageUri(item.photo);
                          const isSelected = selectedOffice?.id === item.id;

                          return (
                            <Pressable
                              key={item.id}
                              style={[
                                styles.officeCard,
                                isSelected && {
                                  borderColor: '#F35713',
                                  backgroundColor: 'rgba(226, 91, 33, 0.05)',
                                },
                              ]}
                              onPress={() => handleSelectOffice(item)}
                            >
                              {/* Контейнер для изображения */}
                              <View style={styles.officeCardImageWrap}>
                                {photoUri ? (
                                  <Image
                                    source={{ uri: photoUri }}
                                    style={styles.officeCardImage}
                                    contentFit="cover"
                                  />
                                ) : (
                                  <View style={styles.officeCardImagePlaceholder}>
                                    <MaterialIcons
                                      name="business"
                                      size={32}
                                      color="rgba(255,255,255,0.5)"
                                    />
                                  </View>
                                )}

                                {/* Плашка с городом поверх фото (опционально, для красоты) */}
                                {item.city && (
                                  <View style={styles.cityBadge}>
                                    <BookingText style={styles.cityBadgeText}>
                                      {item.city}
                                    </BookingText>
                                  </View>
                                )}
                              </View>

                              <View style={styles.officeCardContent}>
                                <BookingText style={styles.officeCardName} numberOfLines={2}>
                                  {item.name}
                                </BookingText>

                                {item.address ? (
                                  <View style={styles.addressRow}>
                                    <MaterialIcons
                                      name="location-on"
                                      size={12}
                                      color="#FFFFFF"
                                      style={styles.addressIcon}
                                    />
                                    <BookingText style={styles.officeCardMeta} numberOfLines={2}>
                                      {item.address}
                                    </BookingText>
                                  </View>
                                ) : null}

                                {(item.block != null && String(item.block).trim() !== '') ||
                                item.floor != null ? (
                                  <View style={styles.specRow}>
                                    {item.block != null && String(item.block).trim() !== '' ? (
                                      <View style={styles.miniBadge}>
                                        <BookingText style={styles.miniBadgeText}>
                                          Блок {String(item.block).trim()}
                                        </BookingText>
                                      </View>
                                    ) : null}
                                    {item.floor != null ? (
                                      <View style={styles.miniBadge}>
                                        <BookingText style={styles.miniBadgeText}>
                                          {item.floor} этаж
                                        </BookingText>
                                      </View>
                                    ) : null}
                                  </View>
                                ) : null}
                              </View>
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </PullToRefresh>
                )}
              </>
            )}

            {selectedOffice && (
              <>
                <Pressable style={styles.backRowWhite} onPress={() => setSelectedOffice(null)}>
                  <MaterialIcons name="arrow-back" size={24} color="#fff" />
                  <BookingText style={styles.backTextWhite}>Назад к выбору офисов</BookingText>
                </Pressable>
                <BookingText style={styles.officeNameWhite}>{selectedOffice.name}</BookingText>
                <BookingText style={styles.officeAddressWhite}>
                  {[
                    [selectedOffice.city, selectedOffice.address].filter(Boolean).join(', '),
                    `работает ${formatTime(officeHours(selectedOffice).start)}–${formatTime(officeHours(selectedOffice).end)}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </BookingText>
                <BookingText style={styles.badgesLabelWhite}>
                  {visibleRooms.length} {pluralRooms(visibleRooms.length)}
                </BookingText>
                {loadingRooms ? (
                  <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                ) : visibleRooms.length === 0 ? (
                  <View style={styles.emptyState}>
                    <BookingText type="defaultSemiBold" style={styles.emptyStateTitleWhite}>
                      Нет переговорных по заданным параметрам
                    </BookingText>
                    <BookingText style={styles.emptyStateSubWhite}>
                      Попробуйте изменить фильтры или сбросить их.
                    </BookingText>
                  </View>
                ) : (
                  <PullToRefresh
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                    loaderSize={96}
                    topOffset={16}
                  >
                    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.roomsList}>
                      <View style={{ gap: 14 }}>
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
                                      setRoomImageFailedIds((prev) =>
                                        new Set(prev).add(item.id)
                                      );
                                    }}
                                  />
                                ) : (
                                  <View style={styles.roomCardImagePlaceholder}>
                                    <MaterialIcons
                                      name="image"
                                      size={32}
                                      color="rgba(255,255,255,0.4)"
                                    />
                                  </View>
                                )}
                                {photoCount > 1 && (
                                  <View style={styles.roomCardImageBadge}>
                                    <BookingText style={styles.roomCardImageBadgeText}>
                                      +{photoCount - 1}
                                    </BookingText>
                                  </View>
                                )}
                              </View>
                              <BookingText style={styles.roomCardNameWhite} numberOfLines={2}>
                                {item.name}
                              </BookingText>
                              <View style={styles.roomCardMetaRow}>
                                {item.floor != null && (
                                  <BookingText style={styles.roomCardMetaWhite}>
                                    {item.floor} этаж
                                  </BookingText>
                                )}
                                {item.capacity != null && (
                                  <BookingText style={styles.roomCardMetaWhite}>
                                    до {item.capacity} чел.
                                  </BookingText>
                                )}
                              </View>
                              {item.equipment?.length ? (
                                <View style={styles.roomCardEquipment}>
                                  <EquipmentChips items={item.equipment} max={3} />
                                </View>
                              ) : null}
                            </Pressable>
                          );
                        })}
                      </View>
                    </ScrollView>
                  </PullToRefresh>
                )}
              </>
            )}

          </>
        )}

      {activeTab === 'office-bookings' && showOfficeBookings && (
        <OfficeBookingsTab role={role} ownOfficeName={ownOfficeName} offices={offices} />
      )}

      {activeTab === 'my-bookings' && (
        <View style={styles.myBookingsTab}>
          <BookingText style={styles.myBookingsSubtitleWhite}>
            Управляйте своими бронированиями переговорных комнат
          </BookingText>
          <View style={styles.myBookingsFilterRow}>
            {(['active', 'completed', 'cancelled'] as const).map((filter) => (
              <Pressable
                key={filter}
                onPress={() => setMyBookingsFilter(filter)}
                style={[styles.myBookingsFilterTab, myBookingsFilter === filter && styles.myBookingsFilterTabActive]}
              >
                <BookingText
                  style={[
                    styles.myBookingsFilterText,
                    myBookingsFilter === filter && styles.myBookingsFilterTextActive,
                  ]}
                >
                  {filter === 'active' ? 'Активные' : filter === 'completed' ? 'Завершенные' : 'Отменённые'}
                </BookingText>
                {myBookingsFilter === filter && (
                  <View style={styles.myBookingsFilterUnderline} />
                )}
              </Pressable>
            ))}
          </View>
          <PullToRefresh
            refreshing={refreshing}
            onRefresh={onRefresh}
            loaderSize={96}
            topOffset={16}
            style={styles.myBookingsPullRefresh}
          >
            <FlatList
              ref={myBookingsListRef}
              style={styles.myBookingsFlatList}
              contentContainerStyle={styles.myBookingsListContent}
              data={myBookingsListData}
              keyExtractor={(b) => String(b.id)}
              onScrollToIndexFailed={() => {
                myBookingsListRef.current?.scrollToOffset({ offset: 0, animated: true });
              }}
              onEndReached={
                !isGuest && myBookingsHasMore && !loadingMoreBookings && !loadingBookings
                  ? () => loadMyBookings(myBookingsFilter, myBookingsPage + 1, true)
                  : undefined
              }
              onEndReachedThreshold={0.4}
              ListEmptyComponent={
                loadingBookings && !isGuest ? (
                  <ActivityIndicator size="large" color="#fff" style={styles.loader} />
                ) : (
                  <BookingText style={styles.emptyWhite}>
                    {myBookingsFilter === 'active'
                      ? 'Нет активных бронирований'
                      : myBookingsFilter === 'completed'
                        ? 'Нет завершённых бронирований'
                        : 'Нет отменённых бронирований'}
                  </BookingText>
                )
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
                const startStr =
                  typeof item.start_time === 'string' ? item.start_time : '';
                const endStr = typeof item.end_time === 'string' ? item.end_time : '';
                const isCancelling = cancellingId === item.id;
                const statusText = getBookingStatusText(item.status);
                const isCancelled = isBookingCancelled(item);
                const isCompleted = item.status === 'completed' || isBookingCompleted(item);
                const canCancel = !isCancelled && !isCompleted;
                const isHighlighted = highlightBookingId === item.id;
                return (
                  <Pressable
                    onPress={() => setDetailsBooking(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Бронь «${room?.name ?? 'Комната'}», подробнее`}
                    style={[
                      styles.bookingCardOrange,
                      isHighlighted && styles.bookingCardHighlighted,
                    ]}
                  >
                    <View style={styles.bookingCardHeader}>
                      <BookingText
                        type="defaultSemiBold"
                        style={styles.bookingCardTitleWhite}
                      >
                        {room?.name ?? 'Комната'}
                      </BookingText>
                      <View style={styles.bookingStatusBadgeOrange}>
                        <BookingText style={styles.bookingStatusTextOrange}>
                          {statusText}
                        </BookingText>
                      </View>
                    </View>
                    <View style={styles.bookingRow}>
                      <MaterialIcons name="calendar-today" size={16} color="rgba(255,255,255,0.75)" />
                      <BookingText style={styles.bookingRowText}>
                        {startStr
                          ? `${formatBookingDay(almatyDay(new Date(startStr)))} · ${formatTime(almatyMinutes(startStr))}–${formatTime(almatyMinutes(endStr))}`
                          : `${formatDisplayDateFromIso(startStr)} • ${formatTimeOnly(startStr)}–${formatTimeOnly(endStr)}`}
                        {startStr && endStr
                          ? ` · ${formatDuration(Math.round((new Date(endStr).getTime() - new Date(startStr).getTime()) / 60000))}`
                          : ''}
                      </BookingText>
                    </View>
                    {item.company_name ? (
                      <View style={styles.bookingRow}>
                        <MaterialIcons name="business" size={16} color="rgba(255,255,255,0.75)" />
                        <BookingText style={styles.bookingRowText}>
                          <BookingText style={styles.bookingRowLabel}>Компания: </BookingText>
                          {item.company_name}
                        </BookingText>
                      </View>
                    ) : null}
                    {item.comment ? (
                      <View style={styles.bookingRow}>
                        <MaterialIcons name="chat-bubble-outline" size={16} color="rgba(255,255,255,0.75)" />
                        <BookingText style={styles.bookingRowText}>
                          <BookingText style={styles.bookingRowLabel}>Комментарий: </BookingText>
                          {item.comment}
                        </BookingText>
                      </View>
                    ) : null}
                    <View style={styles.bookingCardActions}>
                      <Pressable
                        onPress={() => router.push(`/booking/${item.id}`)}
                        style={styles.viewBookingBtnOrange}
                      >
                        <MaterialIcons name="qr-code-2" size={18} color="#fff" />
                        <BookingText style={styles.viewBookingBtnText}>QR-код</BookingText>
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
                            <BookingText style={styles.cancelBtnTextWhite}>
                              Отменить
                            </BookingText>
                          )}
                        </Pressable>
                      )}
                    </View>
                  </Pressable>
                );
              }}
            />
          </PullToRefresh>
        </View>
      )}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
    bookingRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        marginTop: 6,
    },
    bookingRowText: {
        flex: 1,
        fontSize: 14,
        color: '#fff',
    },
    bookingRowLabel: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.65)',
    },
    roomsList: {
        paddingBottom: 120,
    },
    roomCardEquipment: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        marginTop: -2,
    },
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
        paddingHorizontal: 14,
        alignItems: 'center',
    },
    /** Три вкладки в ряд у персонала — меньше боковых отступов, чтобы подписи не переносились. */
    tabWhiteCompact: {
        paddingHorizontal: 4,
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
    // --- ОБНОВЛЕННЫЙ officeGrid ДЛЯ СЕТКИ ---
    officeGrid: {
        padding: 16,
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        paddingBottom: 90,
    },
    officeCard: {
        width: '48%',
        backgroundColor: '#702A14', // Глубокий терракотовый фон
        borderRadius: 20,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: 'rgba(197, 160, 89, 0.3)', // Золотистая рамка
        overflow: 'hidden',
        // Тень для объема
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 4,
    },
    officeCardImageWrap: {
        width: '100%',
        height: 200, // Высота фото (прямоугольник)
        backgroundColor: 'rgba(0,0,0,0.3)', // Фон, если здание узкое
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(197, 160, 89, 0.2)',
    },
    officeCardImage: {
        width: '100%',
        height: '100%',
    },
    officeCardImagePlaceholder: {
        width: '100%',
        height: '100%',
        backgroundColor: '#444',
        justifyContent: 'center',
        alignItems: 'center',
    },
    cityBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(0,0,0,0.6)',
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 4,
    },
    cityBadgeText: {
        fontSize: 10,
        color: '#fff',
        fontWeight: '600',
    },
    officeCardContent: {
        paddingHorizontal: 10,
        paddingTop: 10,
        paddingBottom: 12,
        alignItems: 'stretch',
    },
    officeCardName: {
        fontSize: 15,
        fontWeight: '700',
        marginBottom: 6,
        textAlign: 'left',
    },
    addressRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 4,
        marginBottom: 8,
    },
    addressIcon: {
        marginTop: 1,
    },
    officeCardMeta: {
        flex: 1,
        fontSize: 11,
        lineHeight: 15,
        opacity: 0.75,
        textAlign: 'left',
    },
    specRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        justifyContent: 'flex-start',
        marginTop: 2,
    },
    miniBadge: {
        backgroundColor: 'rgba(124, 124, 124, 0.22)',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        alignSelf: 'flex-start',
    },
    miniBadgeText: {
        fontSize: 9,
        fontWeight: '800',
        textTransform: 'uppercase',
        color: 'rgba(255, 255, 255, 0.55)',
        textAlign: 'left',
    },

    // ------------------------------------
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
        borderRadius: 18,
        overflow: 'hidden',
        backgroundColor: 'rgba(255,255,255,0.15)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.28)',
    },
    roomCardImageWrap: {
        width: '100%',
        height: 150,
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
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
        marginTop: 12,
        paddingHorizontal: 14,
    },
    roomCardMetaRow: {
        flexDirection: 'row',
        gap: 14,
        marginTop: 4,
        marginBottom: 12,
        paddingHorizontal: 14,
    },
    roomCardMetaWhite: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.85)',
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
        backgroundColor: '#F35713',
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
    myBookingsTab: {
        flex: 1,
        minHeight: 0,
    },
    myBookingsPullRefresh: {
        flex: 1,
        minHeight: 0,
    },
    myBookingsFlatList: {
        flex: 1,
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
        paddingHorizontal: 10,
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
    myBookingsListContent: {
        flexGrow: 1,
        paddingBottom: 90,
    },
    geoButtonWhite: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        marginTop: 8,
        marginBottom: 8,
        paddingHorizontal: 14,
        paddingVertical: 8,
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
        paddingVertical: 10,
        paddingHorizontal: 14,
        minHeight: 44,
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
    bookingCardHighlighted: {
        backgroundColor: 'rgba(255,255,255,0.22)',
        borderColor: 'rgba(255,255,255,0.75)',
        borderWidth: 2,
        shadowColor: '#FFFFFF',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
        elevation: 6,
    },
    cancelBtnOrange: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        minHeight: 44,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.5)',
    },
    cancelBtnTextWhite: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
        textAlign: 'center',
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
    // --- Дополнительные стили для заголовков в Header деталей офиса ---
    officeHeaderDetails: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        marginTop: 4,
    },
    officeSpecsRow: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 8,
        marginBottom: 4,
    },
    specBadge: {
        backgroundColor: 'rgba(255, 255, 255, 0.15)',
        paddingVertical: 4,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    specBadgeText: {
        color: '#fff',
        fontSize: 11,
        fontWeight: '600',
        textTransform: 'uppercase',
    },
    // -------------------------------------------------------------
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