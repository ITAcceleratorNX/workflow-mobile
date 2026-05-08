import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    Image,
    Pressable,
    StyleSheet,
    View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageLoader, PullToRefresh, Select } from '@/components/ui';
import {
    formatServiceCategoryDisplayName,
    getStatusLabel,
    getTypeLabel,
} from '@/constants/requests';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
    getOffices,
    getRequestGroups,
    type Office,
    type RequestGroup,
    type RequestGroupsRole,
    type RequestGroupsSegments,
} from '@/lib/api';
import { useAuthStore, type AuthState } from '@/stores/auth-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';

// Размеры карточки заявки.
const CARD_PHOTO_WIDTH = 140;
const CARD_PHOTO_HEIGHT = 100;
const CARD_GAP = Spacing.lg;
const PAGE_SIZE = 20;

const TYPE_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'normal', label: 'Обычная' },
  { value: 'urgent', label: 'Экстренная' },
  { value: 'planned', label: 'Плановая' },
];

/** Опции статуса по ролям (kcell-service-front). client: без просрочено; admin-worker: + назначен, долгосрочные, отклонено; department-head: + отклонено, долгосрочные; executor: статус + тип для вкладки «Мои заявки»; manager: базовые + долгосрочные (без назначен/отклонено). */
function getStatusOptionsForRole(
  role: RequestGroupsRole | null
): { value: string; label: string }[] {
  const base = [
    { value: 'all', label: 'Все' },
    { value: 'in_progress', label: 'В обработке' },
    { value: 'awaiting_assignment', label: 'Ожидает назначения' },
    { value: 'execution', label: 'Исполнение' },
    { value: 'completed', label: 'Завершено' },
    { value: 'overdue', label: 'Просроченные' },
  ];
  if (!role) return base;
  switch (role) {
    case 'client':
      return [
        ...base.filter((o) => o.value !== 'overdue'),
        { value: 'rejected', label: 'Отклонено' },
      ];
    case 'admin-worker':
      return [
        ...base,
        { value: 'assigned', label: 'Назначен' },
        { value: 'long_term', label: 'Долгосрочные' },
        { value: 'rejected', label: 'Отклонено' },
      ];
    case 'department-head':
      return [
        ...base,
        { value: 'rejected', label: 'Отклонено' },
        { value: 'long_term', label: 'Долгосрочные' },
      ];
    case 'executor':
      return [
        ...base,
        { value: 'long_term', label: 'Долгосрочные' },
        { value: 'rejected', label: 'Отклонено' },
      ];
    case 'manager':
      return [
        ...base,
        { value: 'long_term', label: 'Долгосрочные' },
        { value: 'rejected', label: 'Отклонено' },
      ];
    default:
      return base;
  }
}

const PERIOD_OPTIONS = [
  { value: 'all', label: 'Весь период' },
  { value: 'week', label: 'Неделя' },
  { value: 'month', label: 'Месяц' },
  { value: 'year', label: 'Год' },
];

/** Вкладки по ролям. admin-worker и department-head: только Входящие и Мои (без Повторяющиеся). */
const TABS_BY_ROLE: Record<string, { key: string; label: string }[]> = {
  executor: [
    { key: 'tasks', label: 'Мои задачи' },
    { key: 'myTasks', label: 'Мои заявки' },
    { key: 'completed', label: 'Завершённые' },
  ],
  'admin-worker': [
    { key: 'incoming', label: 'Входящие' },
    { key: 'my', label: 'Мои' },
  ],
  'department-head': [
    { key: 'incoming', label: 'Входящие' },
    { key: 'my', label: 'Мои' },
  ],
};

/** Первое фото заявки: с группы (как в kcell compact — request.photos[0]) или с первой подзаявки */
function getFirstPhotoUrl(request: RequestGroup): string | null {
  const fromGroup = request.photos?.[0]?.photo_url;
  if (fromGroup) return fromGroup;
  const sub = request.requests?.[0];
  return sub?.photos?.[0]?.photo_url ?? null;
}

function getPrimarySubRequest(request: RequestGroup) {
  return request.requests?.[0];
}

/** Тип услуги для карточки клиента / администратора / офис-менеджера: Клининг, КТО, Административная (см. formatServiceCategoryDisplayName). */
function getServiceTypeLabel(request: RequestGroup): string {
  return formatServiceCategoryDisplayName(getPrimarySubRequest(request)?.category?.name);
}

/** Блок / локация для карточки исполнителя (КТО, клининг): корпус, этаж. */
function getExecutorBlockLine(request: RequestGroup): string {
  const sub = getPrimarySubRequest(request);
  return (
    sub?.location?.trim() ||
    request.location_detail?.trim() ||
    request.location?.trim() ||
    'Не указано'
  );
}

/** Название работы для исполнителя — только title / описание (не тип услуги из категории). */
function getExecutorRequestTitle(request: RequestGroup): string {
  const sub = getPrimarySubRequest(request);
  const t = sub?.title?.trim();
  if (t) return t;
  const d = sub?.description?.trim();
  if (d) return d.length > 80 ? `${d.slice(0, 80)}…` : d;
  return 'Не указано';
}

/**
 * Карточка списка: исполнитель — блок + название работы;
 * клиент, администратор офиса (admin-worker), офис-менеджер (department-head), manager — тип услуги + адрес.
 */
function usesExecutorRequestCard(role: RequestGroupsRole | string | null | undefined): boolean {
  return role === 'executor';
}

/** Карточка заявки — kcell compact; для executor отдельная вёрстка (блок + название). */
function RequestCard({
  request,
  role,
  onPress,
}: {
  request: RequestGroup;
  role: RequestGroupsRole | null;
  onPress: () => void;
}) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const successSoft = useThemeColor({}, 'successSoft');
  const success = useThemeColor({}, 'success');
  const textSecondary = useThemeColor({}, 'textSecondary');

  const isExecutor = usesExecutorRequestCard(role);
  const typeLabel = getTypeLabel(request.request_type ?? 'normal');
  const serviceTypeBadgeText = `Тип: ${getServiceTypeLabel(request)}`;
  const statusLabel = getStatusLabel(request.status);
  const formattedDateLong = request.created_date
    ? new Date(request.created_date).toLocaleDateString('ru-RU', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }) +
      ' г. в ' +
      new Date(request.created_date).toLocaleTimeString('ru-RU', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';
  const photoUrl = getFirstPhotoUrl(request);
  const locationText =
    request.location_detail?.trim() ||
    request.location?.trim() ||
    'Местоположение не указано';

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Заявка ${request.id}, ${statusLabel}`}
      style={({ pressed }) => [styles.card, { opacity: pressed ? 0.85 : 1 }]}
    >
      <View style={[styles.photoWrap, { backgroundColor: surfaceMuted }]}>
        {photoUrl ? (
          <Image
            source={{ uri: photoUrl }}
            style={styles.photoImage}
            resizeMode="cover"
          />
        ) : (
          <View
            style={[styles.photoPlaceholder, { backgroundColor: surfaceElevated }]}
          >
            <MaterialIcons name="image" size={32} color={textMuted} />
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        {isExecutor ? (
          <>
            <ThemedText
              style={[styles.executorBlockLine, { color: textMuted }]}
              numberOfLines={2}
            >
              Блок: {getExecutorBlockLine(request)}
            </ThemedText>
            <ThemedText
              style={[styles.executorRequestTitle, { color: text }]}
              numberOfLines={2}
            >
              {getExecutorRequestTitle(request)}
            </ThemedText>
            <View style={styles.badges}>
              <View
                style={[
                  styles.badgeStatus,
                  styles.badgeStatusWide,
                  { backgroundColor: surfaceMuted },
                ]}
              >
                <ThemedText
                  style={[styles.badgeStatusText, { color: textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {statusLabel}
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <>
            <ThemedText
              style={[styles.cardTitle, { color: text }]}
              numberOfLines={1}
            >
              Заявка #{request.id}
            </ThemedText>
            <View style={styles.badges}>
              <View style={[styles.badgeType, { backgroundColor: successSoft }]}>
                <ThemedText
                  style={[styles.badgeText, { color: success }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {typeLabel}
                </ThemedText>
              </View>
              <View style={[styles.badgeStatus, { backgroundColor: surfaceMuted }]}>
                <ThemedText
                  style={[styles.badgeStatusText, { color: textSecondary }]}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {statusLabel}
                </ThemedText>
              </View>
            </View>
          </>
        )}
        {!isExecutor && (
          <ThemedText
            style={[styles.cardMetaMuted, { color: textMuted }]}
            numberOfLines={1}
          >
            {serviceTypeBadgeText}
          </ThemedText>
        )}
        {!isExecutor && (
          <ThemedText
            style={[styles.cardLocation, { color: textMuted }]}
            numberOfLines={2}
          >
            {locationText}
          </ThemedText>
        )}
        <View style={styles.cardDateRow}>
          <MaterialIcons name="schedule" size={15} color={textMuted} />
          <ThemedText
            style={[styles.cardDate, { color: textMuted }]}
            numberOfLines={1}
          >
            {formattedDateLong}
          </ThemedText>
        </View>
      </View>

      <MaterialIcons
        name="chevron-right"
        size={24}
        color={textMuted}
        style={styles.chevron}
      />
    </Pressable>
  );
}

export default function RequestsListScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s: AuthState) => s.token);
  const role = useAuthStore((s: AuthState) => s.role) as RequestGroupsRole | null;
  const isGuest = useAuthStore((s) => s.isGuest);
  const guestRequests = useGuestDemoStore((s) => s.requests);
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const primaryColor = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const borderColor = useThemeColor({}, 'border');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [list, setList] = useState<RequestGroup[]>([]);
  const [segments, setSegments] = useState<RequestGroupsSegments | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);

  const [filterStatus, setFilterStatus] = useState('all');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterOffice, setFilterOffice] = useState('all');
  const [filterPeriod, setFilterPeriod] = useState('all');
  const [offices, setOffices] = useState<Office[]>([]);
  const tabsConfig = role ? TABS_BY_ROLE[role] ?? null : null;
  const firstTabKey = tabsConfig?.[0]?.key ?? 'all';
  const [activeTab, setActiveTab] = useState(firstTabKey);

  const statusOptions = useMemo(
    () => getStatusOptionsForRole(role),
    [role]
  );
  const showStatusFilter = statusOptions.length > 0;
  const officeOptions = useMemo(
    () => [
      { value: 'all', label: 'Все офисы' },
      ...offices.map((o) => ({ value: String(o.id), label: o.name })),
    ],
    [offices]
  );

  const load = useCallback(
    async (pageNum: number = 1) => {
      // После logout стор уже очищен: не отправляем защищенный запрос без токена.
      if (!isGuest && (!token || !role)) {
        setError(null);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        setList([]);
        setSegments(null);
        setHasMore(false);
        setPage(1);
        return;
      }

      // Для демо-гостя работаем только с мок-данными, без запросов к API
      if (isGuest) {
        setError(null);
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
        // В демо-режиме список берём из стора целиком
        setList(guestRequests as RequestGroup[]);
        setSegments(null);
        setHasMore(false);
        setPage(1);
        return;
      }

      setError(null);
      if (pageNum === 1) setLoading(true);
      let params: { status?: string; priority?: string; office_id?: string; from?: string } | undefined;
      if (role === 'client') {
        params = undefined;
      } else {
        const statusForApi =
          filterStatus === 'all' || filterStatus === 'long_term' ? 'all' : filterStatus;
        params = { status: statusForApi, priority: filterPriority };
        if (role === 'manager') {
          if (filterOffice && filterOffice !== 'all') params.office_id = filterOffice;
          if (filterPeriod && filterPeriod !== 'all') {
            const now = new Date();
            let from: Date;
            if (filterPeriod === 'week') {
              from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
            } else if (filterPeriod === 'month') {
              from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
            } else if (filterPeriod === 'year') {
              from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
            } else {
              from = new Date(0);
            }
            params.from = from.toISOString();
          }
        }
      }
      const res = await getRequestGroups(
        pageNum,
        PAGE_SIZE,
        role,
        params
      );
      if (!res.ok) {
        setError(res.error);
        setLoading(false);
        return;
      }
      if (pageNum === 1) {
        setList(res.data);
        setSegments(res.segments ?? null);
        setPage(1);
      } else {
        setList((prev) => [...prev, ...res.data]);
      }
      setHasMore(res.hasMore);
      setPage(pageNum);
      setLoading(false);
    },
    [token, role, filterStatus, filterPriority, filterOffice, filterPeriod, isGuest, guestRequests]
  );

  useEffect(() => {
    setActiveTab(tabsConfig?.[0]?.key ?? 'all');
  }, [role]);

  useEffect(() => {
    if (role === 'manager') {
      getOffices().then(setOffices);
    }
  }, [role]);

  useEffect(() => {
    load(1);
  }, [load]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setHasMore(true);
    await load(1);
    setRefreshing(false);
  }, [load]);

  const onEndReached = useCallback(() => {
    const hasSegments = segments && Object.keys(segments).length > 0;
    if (hasSegments) return;
    if (!hasMore || loading || loadingMore) return;
    setLoadingMore(true);
    load(page + 1).finally(() => setLoadingMore(false));
  }, [segments, hasMore, loading, loadingMore, page, load]);

  const rawListForDisplay = useMemo(() => {
    if (segments && activeTab && segments[activeTab]) {
      return segments[activeTab];
    }
    return list;
  }, [segments, activeTab, list]);

  const sortedList = useMemo(() => {
    let base = rawListForDisplay;
    if (role === 'client') {
      base = base.filter((r) => {
        const statusOk =
          filterStatus === 'all' || r.status === filterStatus;
        const typeOk =
          filterPriority === 'all' || (r.request_type ?? 'normal') === filterPriority;
        return statusOk && typeOk;
      });
    } else {
      const statusOk = (r: RequestGroup) => {
        if (filterStatus === 'all') return true;
        if (filterStatus === 'long_term') {
          return (r.requests ?? []).some((req) => req.is_long_term) && r.request_type !== 'recurring';
        }
        return r.status === filterStatus;
      };
      const typeOk = (r: RequestGroup) =>
        filterPriority === 'all' || (r.request_type ?? 'normal') === filterPriority;
      base = base.filter((r) => statusOk(r) && typeOk(r));
    }
    if (role === 'manager') {
      if (filterOffice && filterOffice !== 'all') {
        const officeId = parseInt(filterOffice, 10);
        base = base.filter((r) => r.office_id === officeId);
      }
      if (filterPeriod && filterPeriod !== 'all') {
        const now = new Date();
        let from: Date;
        if (filterPeriod === 'week') {
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        } else if (filterPeriod === 'month') {
          from = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
        } else if (filterPeriod === 'year') {
          from = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        } else {
          from = new Date(0);
        }
        const fromTime = from.getTime();
        base = base.filter((r) => new Date(r.created_date).getTime() >= fromTime);
      }
    }
    return [...base].sort((a, b) => {
      const da = new Date(a.created_date).getTime();
      const db = new Date(b.created_date).getTime();
      return Number.isNaN(db) ? 0 : Number.isNaN(da) ? 1 : db - da;
    });
  }, [rawListForDisplay, role, filterStatus, filterPriority, filterOffice, filterPeriod]);

  const openDetail = useCallback(
    (request: RequestGroup) => {
      if (!request?.id) return;
      router.push(`/requests/${request.id}` as const);
    },
    [router]
  );

  const openCreate = useCallback(() => {
    router.push('/requests/create' as const);
  }, [router]);

  const listHeader = useMemo(
    () => (
      <View style={styles.header}>
        <View style={styles.headerRow}>
          <ThemedText type="title" style={[styles.title, { color: textColor }]}>
            Заявки
          </ThemedText>
        </View>

        {tabsConfig && tabsConfig.length > 0 && (
          <View style={[styles.tabsRow, { borderColor }]}>
            {tabsConfig.map((tab) => {
              const isActive = activeTab === tab.key;
              return (
                <Pressable
                  key={tab.key}
                  onPress={() => setActiveTab(tab.key)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: isActive }}
                  accessibilityLabel={tab.label}
                  style={[
                    styles.tab,
                    isActive && { backgroundColor: accentSoft },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.tabLabel,
                      { color: isActive ? primaryColor : mutedColor },
                    ]}
                  >
                    {tab.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        )}

        <View style={styles.filtersRow}>
          {showStatusFilter && (
            <View style={styles.filterItem}>
              <Select
                value={filterStatus}
                onValueChange={setFilterStatus}
                options={statusOptions}
                placeholder="Статус"
              />
            </View>
          )}
          <View style={styles.filterItem}>
            <Select
              value={filterPriority}
              onValueChange={setFilterPriority}
              options={TYPE_OPTIONS}
              placeholder="Тип"
            />
          </View>
        </View>
        {role === 'manager' && (
          <View style={styles.filtersRow}>
            <View style={styles.filterItem}>
              <Select
                value={filterOffice}
                onValueChange={setFilterOffice}
                options={officeOptions}
                placeholder="Офис"
              />
            </View>
            <View style={styles.filterItem}>
              <Select
                value={filterPeriod}
                onValueChange={setFilterPeriod}
                options={PERIOD_OPTIONS}
                placeholder="Период"
              />
            </View>
          </View>
        )}

        <Pressable
          onPress={openCreate}
          accessibilityRole="button"
          accessibilityLabel="Создать заявку"
          style={({ pressed }) => [
            styles.createBtn,
            styles.createBtnFullWidth,
            { backgroundColor: primaryColor, opacity: pressed ? 0.85 : 1 },
          ]}
        >
          <MaterialIcons name="add" size={20} color={onPrimary} />
          <ThemedText style={[styles.createBtnText, { color: onPrimary }]}>
            Создать
          </ThemedText>
        </Pressable>
      </View>
    ),
    [
      role,
      textColor,
      mutedColor,
      borderColor,
      primaryColor,
      onPrimary,
      accentSoft,
      openCreate,
      tabsConfig,
      activeTab,
      filterStatus,
      filterPriority,
      filterOffice,
      filterPeriod,
      showStatusFilter,
      statusOptions,
      officeOptions,
    ]
  );

  if (loading && sortedList.length === 0) {
    return (
      <ThemedView style={styles.centered}>
        <View
          style={[
            styles.initialLoaderPill,
            { backgroundColor: surfaceElevated },
          ]}
        >
          <PageLoader size={56} variant="overlay" />
        </View>
        <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
          Загрузка заявок...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <PullToRefresh
        refreshing={refreshing}
        onRefresh={onRefresh}
        loaderSize={96}
        topOffset={insets.top + Spacing.lg}
      >
        <FlatList
          data={sortedList}
          keyExtractor={(item) => `req-${item.id}`}
          ListHeaderComponent={listHeader}
          contentContainerStyle={[
            styles.listContent,
            {
              paddingTop: insets.top + Spacing.md,
              paddingBottom: insets.bottom + Spacing.giant + Spacing.md,
            },
          ]}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.4}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={primaryColor} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <MaterialIcons name="inbox" size={48} color={mutedColor} />
              <ThemedText style={[styles.emptyText, { color: mutedColor }]}>
                {error || 'Нет заявок'}
              </ThemedText>
            </View>
          }
          renderItem={({ item }) => (
            <RequestCard
              request={item}
              role={role}
              onPress={() => openDetail(item)}
            />
          )}
        />
      </PullToRefresh>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.lg,
  },
  initialLoaderPill: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  listContent: {
    paddingHorizontal: Spacing.xxl,
  },
  header: {
    marginBottom: Spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 28,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    minHeight: 44,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
  },
  createBtnFullWidth: {
    width: '100%',
    justifyContent: 'center',
    marginTop: Spacing.xs,
  },
  createBtnText: {
    fontSize: FontSizes.body,
    fontWeight: '600',
  },
  tabsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
  },
  tab: {
    minHeight: 44,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    borderRadius: Radius.sm,
    justifyContent: 'center',
  },
  tabLabel: {
    fontSize: FontSizes.bodySmall,
    fontWeight: '500',
  },
  filtersRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    marginBottom: Spacing.lg,
  },
  filterItem: {
    flex: 1,
    minWidth: 140,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: CARD_GAP,
    marginBottom: Spacing.lg,
    backgroundColor: 'transparent',
  },
  photoWrap: {
    width: CARD_PHOTO_WIDTH,
    height: CARD_PHOTO_HEIGHT,
    flexShrink: 0,
    borderRadius: Radius.md,
    overflow: 'hidden',
  },
  photoImage: {
    width: '100%',
    height: '100%',
  },
  photoPlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardContent: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    fontSize: FontSizes.title,
    lineHeight: LineHeights.title,
    fontWeight: '600',
    marginBottom: Spacing.xs + 2,
  },
  executorBlockLine: {
    fontSize: 13,
    fontWeight: '500',
    marginBottom: Spacing.xs,
    letterSpacing: 0.2,
  },
  executorRequestTitle: {
    fontSize: FontSizes.title,
    fontWeight: '700',
    marginBottom: Spacing.xs + 2,
    lineHeight: LineHeights.title,
  },
  cardMetaMuted: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: Spacing.xs + 2,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs + 2,
    maxWidth: '100%',
  },
  badgeType: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    maxWidth: '48%',
    flexShrink: 1,
    minWidth: 0,
  },
  badgeStatus: {
    paddingHorizontal: Spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    maxWidth: '48%',
    flexShrink: 1,
    minWidth: 0,
  },
  badgeStatusWide: {
    maxWidth: '100%',
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  badgeStatusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  cardLocation: {
    fontSize: FontSizes.bodySmall,
    lineHeight: 19,
    marginBottom: Spacing.xs + 2,
  },
  cardDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs + 2,
    marginTop: 2,
  },
  cardDate: {
    fontSize: 13,
    flex: 1,
  },
  chevron: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  footerLoader: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  empty: {
    alignItems: 'center',
    paddingVertical: Spacing.giant + Spacing.lg,
    gap: Spacing.md,
  },
  emptyText: {
    fontSize: FontSizes.bodySmall,
    textAlign: 'center',
  },
});
