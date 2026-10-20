import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { PullToRefresh } from '@/components/ui';
import { ROLE_TRANSLATIONS } from '@/constants/profile';
import { getOfficeBookings, type MeetingRoomBooking, type MyBookingsStatusFilter, type Office } from '@/lib/api';
import { formatDisplayDateFromIso, formatTimeOnly } from '@/lib/dateTimeUtils';
import { getBookingStatusText, isOfficeScopedBookings } from '@/lib/office-bookings';

const PAGE_SIZE = 20;

const FILTERS: { value: MyBookingsStatusFilter; label: string }[] = [
  { value: 'active', label: 'Активные' },
  { value: 'completed', label: 'Завершенные' },
  { value: 'cancelled', label: 'Отменённые' },
];

const EMPTY_MESSAGES: Record<MyBookingsStatusFilter, string> = {
  active: 'Нет активных бронирований',
  completed: 'Нет завершённых бронирований',
  cancelled: 'Нет отменённых бронирований',
};

/** Текст на оранжевом градиенте экрана «Бронь» — всегда белый. */
function WhiteText(props: ComponentProps<typeof ThemedText>) {
  return <ThemedText {...props} lightColor="#FFFFFF" darkColor="#FFFFFF" />;
}

interface OfficeBookingsTabProps {
  role: string | null | undefined;
  /** Название своего офиса — подпись для Офис-менеджера. */
  ownOfficeName?: string | null;
  /** Офисы для фильтра Администратора (уже загружены экраном «Бронь»). */
  offices: Office[];
}

/**
 * Бронирования переговорных для персонала, включая созданные Клиентами.
 * Администратор видит все офисы (с фильтром по офису), Офис-менеджер — только свой офис:
 * область видимости задаёт бэкенд по роли.
 */
export function OfficeBookingsTab({ role, ownOfficeName, offices }: OfficeBookingsTabProps) {
  const isOfficeManager = isOfficeScopedBookings(role);
  const [status, setStatus] = useState<MyBookingsStatusFilter>('active');
  const [officeId, setOfficeId] = useState<number | null>(null);
  const [list, setList] = useState<MeetingRoomBooking[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scopedOfficeId = isOfficeManager ? null : officeId;
  // Первая страница загружается для каждого сочетания фильтров; пока ответа нет — показываем загрузку.
  const filterKey = `${status}|${scopedOfficeId ?? 'all'}`;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const loading = loadedKey !== filterKey;
  // Ответ на устаревший фильтр (быстрое переключение) не должен перезаписать список.
  const loadSeqRef = useRef(0);

  const applyPage = useCallback(
    (res: Awaited<ReturnType<typeof getOfficeBookings>>, append: boolean, key: string) => {
      if (res.ok) {
        setList((prev) => (append ? [...prev, ...res.data] : res.data));
        setPage(res.page);
        setTotal(res.total);
        setHasMore(res.hasMore);
        setError(null);
      } else if (!append) {
        setList([]);
        setTotal(0);
        setHasMore(false);
        setError(res.error);
      }
      if (!append) setLoadedKey(key);
    },
    []
  );

  const fetchPage = useCallback(
    async (nextPage: number, append: boolean) => {
      const seq = ++loadSeqRef.current;
      const res = await getOfficeBookings({ status, officeId: scopedOfficeId, page: nextPage, pageSize: PAGE_SIZE });
      if (seq === loadSeqRef.current) applyPage(res, append, filterKey);
    },
    [applyPage, filterKey, scopedOfficeId, status]
  );

  useEffect(() => {
    let cancelled = false;
    const seq = ++loadSeqRef.current;
    getOfficeBookings({ status, officeId: scopedOfficeId, page: 1, pageSize: PAGE_SIZE }).then((res) => {
      if (cancelled || seq !== loadSeqRef.current) return;
      applyPage(res, false, filterKey);
    });
    return () => {
      cancelled = true;
    };
  }, [applyPage, filterKey, scopedOfficeId, status]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    try {
      await fetchPage(page + 1, true);
    } finally {
      setLoadingMore(false);
    }
  }, [fetchPage, page]);

  const retry = useCallback(() => {
    setLoadedKey(null);
    void fetchPage(1, false);
  }, [fetchPage]);

  const onRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      await fetchPage(1, false);
    } finally {
      setRefreshing(false);
    }
  }, [fetchPage, refreshing]);

  return (
    <View style={styles.container}>
      <WhiteText style={styles.subtitle}>
        {isOfficeManager
          ? `Все бронирования вашего офиса${ownOfficeName ? ` «${ownOfficeName}»` : ''}, включая брони клиентов`
          : 'Бронирования всех офисов, включая брони клиентов'}
      </WhiteText>

      {!isOfficeManager && offices.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.officeChipsScroll}
          contentContainerStyle={styles.officeChips}
        >
          {[{ id: null, name: 'Все офисы' } as { id: number | null; name: string }, ...offices].map((office) => {
            const selected = officeId === office.id;
            return (
              <Pressable
                key={office.id ?? 'all'}
                onPress={() => setOfficeId(office.id)}
                style={[styles.officeChip, selected && styles.officeChipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected }}
              >
                <WhiteText style={[styles.officeChipText, selected && styles.officeChipTextActive]}>
                  {office.name}
                </WhiteText>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <Pressable
            key={f.value}
            onPress={() => setStatus(f.value)}
            style={[styles.filterTab, status === f.value && styles.filterTabActive]}
          >
            <WhiteText style={[styles.filterText, status === f.value && styles.filterTextActive]}>
              {f.label}
            </WhiteText>
            {status === f.value && <View style={styles.filterUnderline} />}
          </Pressable>
        ))}
      </View>

      <PullToRefresh refreshing={refreshing} onRefresh={onRefresh} loaderSize={96} topOffset={16} style={styles.fill}>
        <FlatList
          style={styles.fill}
          contentContainerStyle={styles.listContent}
          data={loading ? [] : list}
          keyExtractor={(b) => String(b.id)}
          onEndReached={hasMore && !loading && !loadingMore ? () => void loadMore() : undefined}
          onEndReachedThreshold={0.4}
          ListHeaderComponent={!loading && list.length > 0 ? <WhiteText style={styles.total}>Всего: {total}</WhiteText> : null}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator size="large" color="#fff" style={styles.loader} />
            ) : error ? (
              <View style={styles.errorBox}>
                <WhiteText style={styles.empty}>Не удалось загрузить бронирования</WhiteText>
                <Pressable onPress={retry} style={styles.retryBtn}>
                  <WhiteText style={styles.retryText}>Повторить</WhiteText>
                </Pressable>
              </View>
            ) : (
              <WhiteText style={styles.empty}>{EMPTY_MESSAGES[status]}</WhiteText>
            )
          }
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loaderFooter}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            ) : null
          }
          renderItem={({ item }) => <OfficeBookingCard booking={item} />}
        />
      </PullToRefresh>
    </View>
  );
}

function OfficeBookingCard({ booking }: { booking: MeetingRoomBooking }) {
  const room = booking.meeting_room ?? booking.meetingRoom;
  const office = booking.office ?? room?.office;
  const start = typeof booking.start_time === 'string' ? booking.start_time : '';
  const end = typeof booking.end_time === 'string' ? booking.end_time : '';
  const booker = booking.client;
  const phone = booker?.phone?.trim();

  return (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <WhiteText type="defaultSemiBold" style={styles.cardTitle} numberOfLines={2}>
          {room?.name ?? `Комната #${booking.meeting_room_id}`}
        </WhiteText>
        <View style={styles.statusBadge}>
          <WhiteText style={styles.statusText}>{getBookingStatusText(booking.status)}</WhiteText>
        </View>
      </View>
      <WhiteText style={styles.meta}>
        {formatDisplayDateFromIso(start)} • {formatTimeOnly(start)}–{formatTimeOnly(end)}
      </WhiteText>
      {office?.name ? (
        <View style={styles.metaRow}>
          <MaterialIcons name="place" size={14} color="rgba(255,255,255,0.8)" />
          <WhiteText style={styles.metaInline}>{office.name}</WhiteText>
        </View>
      ) : null}
      {booker ? (
        <View style={styles.bookerBlock}>
          <View style={styles.metaRow}>
            <MaterialIcons name="person-outline" size={14} color="rgba(255,255,255,0.8)" />
            <WhiteText style={styles.bookerName} numberOfLines={1}>
              {booker.full_name || `Пользователь #${booker.id}`}
            </WhiteText>
            {booker.role ? (
              <View style={styles.roleBadge}>
                <WhiteText style={styles.roleText}>{ROLE_TRANSLATIONS[booker.role] ?? booker.role}</WhiteText>
              </View>
            ) : null}
          </View>
          {phone ? (
            <Pressable onPress={() => void Linking.openURL(`tel:${phone.replace(/\s/g, '')}`)} style={styles.metaRow}>
              <MaterialIcons name="phone" size={14} color="rgba(255,255,255,0.8)" />
              <WhiteText style={styles.metaInline}>{phone}</WhiteText>
            </Pressable>
          ) : null}
          {booking.company_name ? (
            <View style={styles.metaRow}>
              <MaterialIcons name="business" size={14} color="rgba(255,255,255,0.8)" />
              <WhiteText style={styles.metaInline} numberOfLines={1}>
                {booking.company_name}
              </WhiteText>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, minHeight: 0 },
  fill: { flex: 1, minHeight: 0 },
  subtitle: { fontSize: 14, marginBottom: 12, color: 'rgba(255,255,255,0.9)' },
  officeChipsScroll: { flexGrow: 0, marginBottom: 12 },
  officeChips: { gap: 8, paddingRight: 8 },
  officeChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  officeChipActive: { backgroundColor: 'rgba(255,255,255,0.25)', borderColor: 'rgba(255,255,255,0.6)' },
  officeChipText: { fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  officeChipTextActive: { color: '#fff', fontWeight: '600' },
  filterRow: {
    flexDirection: 'row',
    marginBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.2)',
    borderRadius: 10,
    overflow: 'hidden',
  },
  filterTab: { flex: 1, position: 'relative', paddingVertical: 10, paddingHorizontal: 10, alignItems: 'center' },
  filterTabActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  filterText: { fontSize: 12, color: 'rgba(255,255,255,0.7)' },
  filterTextActive: { color: '#fff', fontWeight: '600' },
  filterUnderline: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, backgroundColor: '#F35713' },
  listContent: { flexGrow: 1, paddingBottom: 90 },
  total: { fontSize: 12, marginBottom: 8, color: 'rgba(255,255,255,0.7)' },
  empty: { textAlign: 'center', paddingVertical: 32, fontSize: 15, color: 'rgba(255,255,255,0.8)' },
  errorBox: { alignItems: 'center' },
  retryBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.5)',
  },
  retryText: { fontSize: 14, color: '#fff' },
  loader: { marginVertical: 20 },
  loaderFooter: { paddingVertical: 16, alignItems: 'center' },
  card: {
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  cardTitle: { flex: 1, color: '#fff' },
  statusBadge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  statusText: { fontSize: 12, color: 'rgba(255,255,255,0.9)' },
  meta: { fontSize: 13, marginTop: 4, color: 'rgba(255,255,255,0.8)' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 },
  metaInline: { flexShrink: 1, fontSize: 13, color: 'rgba(255,255,255,0.8)' },
  bookerBlock: {
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.25)',
  },
  bookerName: { flexShrink: 1, fontSize: 14, color: '#fff' },
  roleBadge: { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 6, backgroundColor: 'rgba(0,0,0,0.2)' },
  roleText: { fontSize: 11, color: 'rgba(255,255,255,0.85)' },
});
