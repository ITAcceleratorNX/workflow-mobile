import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OfficeLocationCatalogFormModal,
  type OfficeLocationCatalogFormValues,
} from '@/components/office-location-catalog-form-modal';
import { ScreenHeader, Select } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  createOfficeLocationCatalogRow,
  deleteOfficeLocationCatalogRow,
  getOfficeLocationCatalog,
  getOffices,
  updateOfficeLocationCatalogRow,
  type Office,
} from '@/lib/api';
import {
  buildLocationCatalogSections,
  countLocationCatalogStats,
  getBlockFilterOptions,
  getFloorFilterOptions,
  type LocationCatalogSort,
  type LocationCatalogSection,
  type OfficeLocationCatalogRow,
  type LocationVisibilityFilter,
} from '@/lib/office-location-catalog-utils';
import { useAuthStore } from '@/stores/auth-store';

function normalizeSearch(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

const VISIBILITY_FILTERS: { value: LocationVisibilityFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'hidden', label: 'Скрытые' },
];

const SORT_OPTIONS: { value: LocationCatalogSort; label: string }[] = [
  { value: 'order', label: 'По порядку' },
  { value: 'room', label: 'По помещению' },
  { value: 'block', label: 'По блоку' },
];

export type OfficeLocationCatalogVariant = 'department-head' | 'admin-worker';

/** Шаблоны локаций: department-head — свой офис; admin-worker — выбор офиса в селекторе. */
export function OfficeLocationCatalogManagementScreen({
  variant,
}: {
  variant: OfficeLocationCatalogVariant;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);

  const isAdmin = variant === 'admin-worker';

  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'cardBackground');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const danger = useThemeColor({}, 'danger');

  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(
    isAdmin ? '' : String(user?.office_id ?? '')
  );

  useEffect(() => {
    if (isAdmin) getOffices().then(setOffices);
  }, [isAdmin]);

  const manageOfficeId = isAdmin
    ? selectedOfficeId
      ? Number(selectedOfficeId)
      : null
    : user?.office_id != null && user.office_id > 0
      ? user.office_id
      : null;

  const officeOptions = useMemo(
    () => [
      { value: '', label: 'Выберите офис' },
      ...offices.map((o) => ({ value: String(o.id), label: o.name })),
    ],
    [offices]
  );

  const [rows, setRows] = useState<OfficeLocationCatalogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [visibilityFilter, setVisibilityFilter] = useState<LocationVisibilityFilter>('all');
  const [blockFilterKey, setBlockFilterKey] = useState<string | null>(null);
  const [floorFilterKey, setFloorFilterKey] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<LocationCatalogSort>('order');
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formDefaults, setFormDefaults] = useState({
    block: '',
    floor_zone: '',
    room: '',
    sort_order: 0,
  });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [draftVisibility, setDraftVisibility] = useState<LocationVisibilityFilter>('all');
  const [draftBlockKey, setDraftBlockKey] = useState<string | null>(null);
  const [draftFloorKey, setDraftFloorKey] = useState<string | null>(null);
  const [draftSortBy, setDraftSortBy] = useState<LocationCatalogSort>('order');
  const autoOpenedCreateRef = useRef(false);

  const stats = useMemo(() => countLocationCatalogStats(rows), [rows]);

  const blockOptions = useMemo(() => getBlockFilterOptions(rows), [rows]);

  const draftFloorOptions = useMemo(
    () => getFloorFilterOptions(rows, draftBlockKey),
    [rows, draftBlockKey]
  );

  const filterPanelCount = useMemo(() => {
    let count = 0;
    if (visibilityFilter !== 'all') count += 1;
    if (blockFilterKey != null) count += 1;
    if (floorFilterKey != null) count += 1;
    if (sortBy !== 'order') count += 1;
    return count;
  }, [visibilityFilter, blockFilterKey, floorFilterKey, sortBy]);

  const sections = useMemo(
    () =>
      buildLocationCatalogSections(rows, {
        searchQuery,
        visibility: visibilityFilter,
        blockKey: blockFilterKey,
        floorKey: blockFilterKey != null ? floorFilterKey : null,
        sortBy,
      }),
    [rows, searchQuery, visibilityFilter, blockFilterKey, floorFilterKey, sortBy]
  );

  const hasActiveFilters =
    normalizeSearch(searchQuery).length > 0 || filterPanelCount > 0;

  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setVisibilityFilter('all');
    setBlockFilterKey(null);
    setFloorFilterKey(null);
    setSortBy('order');
  }, []);

  const openFilterSheet = useCallback(() => {
    setDraftVisibility(visibilityFilter);
    setDraftBlockKey(blockFilterKey);
    setDraftFloorKey(floorFilterKey);
    setDraftSortBy(sortBy);
    setFilterSheetOpen(true);
  }, [visibilityFilter, blockFilterKey, floorFilterKey, sortBy]);

  const closeFilterSheet = useCallback(() => setFilterSheetOpen(false), []);

  const applyFilterSheet = useCallback(() => {
    setVisibilityFilter(draftVisibility);
    setBlockFilterKey(draftBlockKey);
    setFloorFilterKey(draftFloorKey);
    setSortBy(draftSortBy);
    setFilterSheetOpen(false);
  }, [draftVisibility, draftBlockKey, draftFloorKey, draftSortBy]);

  const resetFilterPanelDraft = useCallback(() => {
    setDraftVisibility('all');
    setDraftBlockKey(null);
    setDraftFloorKey(null);
    setDraftSortBy('order');
  }, []);

  const filteredCount = useMemo(
    () => sections.reduce((sum, s) => sum + s.data.length, 0),
    [sections]
  );

  const load = useCallback(
    async (opts?: { fromPull?: boolean }) => {
      if (manageOfficeId == null) {
        setRows([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.fromPull) {
        setLoading(true);
      }
      const res = await getOfficeLocationCatalog(manageOfficeId, { includeInactive: true });
      if (res.ok) {
        setRows(res.data);
      } else {
        setRows([]);
        showToast({ title: res.error, variant: 'destructive' });
      }
      setLoading(false);
      setRefreshing(false);
    },
    [manageOfficeId, showToast]
  );

  useEffect(() => {
    if (role == null) return;
    const allowed =
      (variant === 'department-head' && role === 'department-head') ||
      (variant === 'admin-worker' && role === 'admin-worker');
    if (!allowed) {
      router.back();
      return;
    }
    load();
  }, [role, variant, load, router]);

  useEffect(() => {
    if (isAdmin) return;
    if (loading || manageOfficeId == null || rows.length > 0 || autoOpenedCreateRef.current) return;
    autoOpenedCreateRef.current = true;
    setEditingId(null);
    setModalMode('create');
    setSaveError(null);
    setFormDefaults({ block: '', floor_zone: '', room: '', sort_order: 0 });
    setModalOpen(true);
  }, [loading, manageOfficeId, rows.length, isAdmin]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ fromPull: true });
  }, [load]);

  const openAdd = useCallback(() => {
    setEditingId(null);
    setModalMode('create');
    setSaveError(null);
    setFormDefaults({
      block: '',
      floor_zone: '',
      room: '',
      sort_order: rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 0,
    });
    setModalOpen(true);
  }, [rows]);

  const openEdit = (item: OfficeLocationCatalogRow) => {
    setEditingId(item.id);
    setModalMode('edit');
    setSaveError(null);
    setFormDefaults({
      block: item.block,
      floor_zone: item.floor_zone,
      room: item.room,
      sort_order: item.sort_order ?? 0,
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setSaveError(null);
  };

  const handleModalSubmit = async (values: OfficeLocationCatalogFormValues) => {
    if (manageOfficeId == null) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editingId == null) {
        const res = await createOfficeLocationCatalogRow(manageOfficeId, {
          ...values,
          is_active: true,
        });
        if (!res.ok) {
          setSaveError(res.error);
          return;
        }
        showToast({ title: 'Шаблон добавлен', variant: 'success' });
      } else {
        const res = await updateOfficeLocationCatalogRow(manageOfficeId, editingId, values);
        if (!res.ok) {
          setSaveError(res.error);
          return;
        }
        showToast({ title: 'Сохранено', variant: 'success' });
      }
      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (id: number) => {
    if (manageOfficeId == null) return;
    Alert.alert('Удалить шаблон?', 'Действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteOfficeLocationCatalogRow(manageOfficeId, id);
          if (!res.ok) {
            showToast({ title: res.error, variant: 'destructive' });
            return;
          }
          showToast({ title: 'Удалено', variant: 'success' });
          await load();
        },
      },
    ]);
  };

  const toggleActive = async (item: OfficeLocationCatalogRow) => {
    if (manageOfficeId == null) return;
    const res = await updateOfficeLocationCatalogRow(manageOfficeId, item.id, {
      is_active: !item.is_active,
    });
    if (!res.ok) {
      showToast({ title: res.error, variant: 'destructive' });
      return;
    }
    await load();
  };

  const renderItem = ({ item }: { item: OfficeLocationCatalogRow }) => (
    <View
      style={[
        styles.rowCard,
        {
          borderColor: border,
          backgroundColor: card,
          opacity: item.is_active ? 1 : 0.72,
        },
      ]}
    >
      <Pressable
        onPress={() => openEdit(item)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel="Редактировать шаблон"
      >
        <View style={[styles.rowIconWrap, { backgroundColor: accentSoft }]}>
          <MaterialIcons name="place" size={22} color={primary} />
        </View>

        <View style={styles.rowBody}>
          <View style={styles.rowTitleRow}>
            <ThemedText style={[styles.rowTitle, { color: text }]} numberOfLines={1}>
              {item.room?.trim() || item.floor_zone?.trim() || 'Помещение не указано'}
            </ThemedText>
            {!item.is_active ? (
              <View style={[styles.hiddenBadge, { borderColor: border }]}>
                <ThemedText style={[styles.hiddenBadgeText, { color: muted }]}>Скрыт</ThemedText>
              </View>
            ) : null}
          </View>

          {item.floor_zone?.trim() ? (
            <ThemedText style={[styles.rowSub, { color: muted }]} numberOfLines={1}>
              {item.floor_zone.trim()}
            </ThemedText>
          ) : null}

          <ThemedText style={[styles.rowMeta, { color: muted }]}>
            Порядок: {item.sort_order ?? 0}
          </ThemedText>
        </View>
      </Pressable>

      <View style={styles.rowActions}>
        <Pressable
          onPress={() => toggleActive(item)}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel={item.is_active ? 'Скрыть шаблон' : 'Показать шаблон'}
        >
          <MaterialIcons
            name={item.is_active ? 'visibility-off' : 'visibility'}
            size={20}
            color={muted}
          />
        </Pressable>
        <Pressable
          onPress={() => confirmDelete(item.id)}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Удалить шаблон"
        >
          <MaterialIcons name="delete-outline" size={20} color={danger} />
        </Pressable>
        <MaterialIcons name="chevron-right" size={22} color={muted} />
      </View>
    </View>
  );

  const listHeader = (
    <View style={styles.listHeader}>
      <View style={[styles.statsRow, { backgroundColor: surfaceMuted, borderColor: border }]}>
        <ThemedText style={[styles.statsText, { color: muted }]}>
          {stats.total} {stats.total === 1 ? 'шаблон' : stats.total < 5 ? 'шаблона' : 'шаблонов'}
          {' · '}
          {stats.blocks} {stats.blocks === 1 ? 'блок' : stats.blocks < 5 ? 'блока' : 'блоков'}
          {' · '}
          {stats.active} активн.
          {stats.hidden > 0 ? ` · ${stats.hidden} скрыт.` : ''}
        </ThemedText>
      </View>

      <View style={[styles.searchWrap, { borderColor: border, backgroundColor: card }]}>
        <MaterialIcons name="search" size={22} color={muted} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Поиск по блоку, этажу, помещению…"
          placeholderTextColor={muted}
          style={[styles.searchInput, { color: text }]}
          autoCorrect={false}
          clearButtonMode="while-editing"
          returnKeyType="search"
        />
        {searchQuery.length > 0 ? (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={muted} />
          </Pressable>
        ) : null}
      </View>

      {hasActiveFilters ? (
        <View style={styles.resultsRow}>
          <ThemedText style={[styles.resultsBar, { color: muted }]}>
            Найдено: {filteredCount}
            {filterPanelCount > 0 ? ` · фильтров: ${filterPanelCount}` : ''}
          </ThemedText>
          <Pressable onPress={resetFilters} hitSlop={8}>
            <ThemedText style={{ color: primary, fontWeight: '600', fontSize: 13 }}>
              Сбросить
            </ThemedText>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const headerRight = (
    <Pressable
      onPress={openFilterSheet}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Фильтры"
      style={({ pressed }) => [styles.filterHeaderBtn, pressed && { opacity: 0.65 }]}
    >
      <MaterialIcons name="tune" size={26} color={primary} />
      {filterPanelCount > 0 ? (
        <View style={[styles.filterBadge, { backgroundColor: primary }]}>
          <ThemedText style={styles.filterBadgeText}>{filterPanelCount}</ThemedText>
        </View>
      ) : null}
    </Pressable>
  );

  const listEmpty = (
    <View style={styles.emptyWrap}>
      {rows.length === 0 ? (
        <Pressable
          onPress={openAdd}
          style={[styles.emptyCta, { borderColor: border, backgroundColor: card }]}
        >
          <MaterialIcons name="add-location-alt" size={32} color={primary} />
          <ThemedText style={[styles.emptyCtaTitle, { color: text }]}>Добавить первый шаблон</ThemedText>
          <ThemedText style={[styles.emptyCtaSub, { color: muted }]}>
            Укажите блок, этаж и помещение — клиенты выберут их при создании заявки
          </ThemedText>
        </Pressable>
      ) : (
        <>
          <MaterialIcons name="search-off" size={40} color={muted} />
          <ThemedText style={[styles.emptyTitle, { color: text }]}>Ничего не найдено</ThemedText>
          <ThemedText style={[styles.emptySub, { color: muted }]}>
            Измените поиск или фильтр
          </ThemedText>
          <Pressable
            onPress={resetFilters}
            style={[styles.emptyResetBtn, { borderColor: border }]}
          >
            <ThemedText style={{ color: text, fontWeight: '600' }}>Сбросить фильтры</ThemedText>
          </Pressable>
        </>
      )}
    </View>
  );

  const allowedRender =
    role != null &&
    ((variant === 'department-head' && role === 'department-head') ||
      (variant === 'admin-worker' && role === 'admin-worker'));

  if (!allowedRender) {
    return null;
  }

  const needsPickOffice = isAdmin && manageOfficeId == null;
  const noOfficeAccount = !isAdmin && manageOfficeId == null;

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <ScreenHeader
        title="Шаблоны локаций"
        onBack={() => router.back()}
        rightSlot={headerRight}
      />

      {isAdmin ? (
        <View style={styles.officeBar}>
          <Select
            value={selectedOfficeId}
            onValueChange={setSelectedOfficeId}
            options={officeOptions}
            placeholder="Выберите офис"
          />
        </View>
      ) : null}

      <Modal
        visible={filterSheetOpen}
        transparent
        animationType="fade"
        onRequestClose={closeFilterSheet}
      >
        <View style={styles.filterModalRoot}>
          <Pressable style={styles.filterModalBackdrop} onPress={closeFilterSheet} />
          <View
            style={[
              styles.filterSheet,
              {
                backgroundColor: card,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={[styles.filterSheetHeader, { borderBottomColor: border }]}>
              <View style={styles.filterSheetHeaderSide}>
                <Pressable
                  onPress={closeFilterSheet}
                  hitSlop={12}
                  style={[styles.filterSheetIconBtn, { backgroundColor: surfaceMuted }]}
                >
                  <MaterialIcons name="close" size={22} color={text} />
                </Pressable>
              </View>
              <ThemedText style={[styles.filterSheetTitle, { color: text }]}>Фильтры</ThemedText>
              <View style={[styles.filterSheetHeaderSide, { justifyContent: 'flex-end' }]}>
                <Pressable
                  onPress={applyFilterSheet}
                  hitSlop={12}
                  style={[styles.filterSheetIconBtn, { backgroundColor: primary }]}
                >
                  <MaterialIcons name="check" size={22} color="#fff" />
                </Pressable>
              </View>
            </View>

            <ScrollView
              style={styles.filterSheetScroll}
              contentContainerStyle={styles.filterSheetContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <ThemedText style={[styles.filterSectionLabel, { color: muted }]}>Статус</ThemedText>
              <View style={styles.pillsRow}>
                {VISIBILITY_FILTERS.map((opt) => {
                  const active = draftVisibility === opt.value;
                  const count =
                    opt.value === 'all'
                      ? stats.total
                      : opt.value === 'active'
                        ? stats.active
                        : stats.hidden;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDraftVisibility(opt.value)}
                      style={[
                        styles.pill,
                        { borderColor: border },
                        active && { backgroundColor: `${primary}22`, borderColor: primary },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: active ? primary : text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        {opt.label} ({count})
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              {blockOptions.length > 0 ? (
                <>
                  <ThemedText style={[styles.filterSectionLabel, { color: muted }]}>Блок</ThemedText>
                  <View style={styles.pillsRow}>
                    <Pressable
                      onPress={() => {
                        setDraftBlockKey(null);
                        setDraftFloorKey(null);
                      }}
                      style={[
                        styles.pill,
                        { borderColor: border },
                        draftBlockKey === null && {
                          backgroundColor: `${primary}22`,
                          borderColor: primary,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: draftBlockKey === null ? primary : text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        Все
                      </ThemedText>
                    </Pressable>
                    {blockOptions.map((opt) => {
                      const active = draftBlockKey === opt.key;
                      return (
                        <Pressable
                          key={opt.key || '__empty__'}
                          onPress={() => {
                            setDraftBlockKey(opt.key);
                            setDraftFloorKey(null);
                          }}
                          style={[
                            styles.pill,
                            { borderColor: border },
                            active && { backgroundColor: `${primary}22`, borderColor: primary },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color: active ? primary : text,
                              fontSize: 13,
                              fontWeight: '600',
                            }}
                          >
                            {opt.label} ({opt.count})
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              {draftBlockKey != null && draftFloorOptions.length > 0 ? (
                <>
                  <ThemedText style={[styles.filterSectionLabel, { color: muted }]}>
                    Этаж / зона
                  </ThemedText>
                  <View style={styles.pillsRow}>
                    <Pressable
                      onPress={() => setDraftFloorKey(null)}
                      style={[
                        styles.pill,
                        { borderColor: border },
                        draftFloorKey === null && {
                          backgroundColor: `${primary}22`,
                          borderColor: primary,
                        },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: draftFloorKey === null ? primary : text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        Все
                      </ThemedText>
                    </Pressable>
                    {draftFloorOptions.map((opt) => {
                      const active = draftFloorKey === opt.key;
                      return (
                        <Pressable
                          key={opt.key || '__empty_floor__'}
                          onPress={() => setDraftFloorKey(opt.key)}
                          style={[
                            styles.pill,
                            { borderColor: border },
                            active && { backgroundColor: `${primary}22`, borderColor: primary },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color: active ? primary : text,
                              fontSize: 13,
                              fontWeight: '600',
                            }}
                          >
                            {opt.label} ({opt.count})
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <ThemedText style={[styles.filterSectionLabel, { color: muted }]}>Сортировка</ThemedText>
              <View style={styles.pillsRow}>
                {SORT_OPTIONS.map((opt) => {
                  const active = draftSortBy === opt.value;
                  return (
                    <Pressable
                      key={opt.value}
                      onPress={() => setDraftSortBy(opt.value)}
                      style={[
                        styles.pill,
                        { borderColor: border },
                        active && { backgroundColor: `${primary}22`, borderColor: primary },
                      ]}
                    >
                      <ThemedText
                        style={{
                          color: active ? primary : text,
                          fontSize: 13,
                          fontWeight: '600',
                        }}
                      >
                        {opt.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={resetFilterPanelDraft} style={styles.filterResetLink}>
                <ThemedText style={{ color: primary, fontWeight: '600', fontSize: 14 }}>
                  Сбросить фильтры
                </ThemedText>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      <OfficeLocationCatalogFormModal
        visible={modalOpen}
        mode={modalMode}
        loading={saving}
        error={saveError}
        defaultBlock={formDefaults.block}
        defaultFloorZone={formDefaults.floor_zone}
        defaultRoom={formDefaults.room}
        defaultSortOrder={formDefaults.sort_order}
        onClose={closeModal}
        onSubmit={handleModalSubmit}
      />

      {needsPickOffice ? (
        <View style={styles.center}>
          <MaterialIcons name="business" size={48} color={muted} />
          <ThemedText style={{ color: text, textAlign: 'center', fontWeight: '600', marginTop: 12 }}>
            Выберите офис
          </ThemedText>
          <ThemedText style={{ color: muted, textAlign: 'center', marginTop: 8, paddingHorizontal: 24 }}>
            Шаблоны локаций настраиваются отдельно для каждого офиса
          </ThemedText>
        </View>
      ) : noOfficeAccount ? (
        <View style={styles.center}>
          <ThemedText style={{ color: muted, textAlign: 'center' }}>
            У вашей учётной записи не указан офис. Обратитесь к администратору.
          </ThemedText>
        </View>
      ) : loading && !refreshing ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <>
          <SectionList<OfficeLocationCatalogRow, LocationCatalogSection>
            sections={sections}
            keyExtractor={(item) => String(item.id)}
            renderItem={renderItem}
            renderSectionHeader={({ section }) => (
              <View style={[styles.sectionHeader, { backgroundColor: bg }]}>
                <ThemedText style={[styles.sectionTitle, { color: text }]}>
                  {section.blockLabel}
                </ThemedText>
                <View style={[styles.sectionCount, { backgroundColor: accentSoft }]}>
                  <ThemedText style={[styles.sectionCountText, { color: primary }]}>
                    {section.data.length}
                  </ThemedText>
                </View>
              </View>
            )}
            stickySectionHeadersEnabled
            ListHeaderComponent={listHeader}
            ListEmptyComponent={listEmpty}
            contentContainerStyle={[
              styles.listContent,
              { paddingBottom: insets.bottom + 88 },
              sections.length === 0 && styles.listContentEmpty,
            ]}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
            }
            initialNumToRender={16}
            maxToRenderPerBatch={24}
            windowSize={8}
            ItemSeparatorComponent={() => <View style={styles.itemGap} />}
          />

          <Pressable
            onPress={openAdd}
            style={[styles.fab, { backgroundColor: primary, bottom: insets.bottom + 20 }]}
            accessibilityRole="button"
            accessibilityLabel="Добавить шаблон"
          >
            <MaterialIcons name="add" size={28} color="#fff" />
          </Pressable>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  officeBar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  listContent: { paddingHorizontal: 16 },
  listContentEmpty: { flexGrow: 1 },
  listHeader: { gap: 10, paddingTop: 4, paddingBottom: 4 },
  filterHeaderBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterBadge: {
    position: 'absolute',
    top: 4,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  filterBadgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  filterModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  filterModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  filterSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    maxHeight: '78%',
  },
  filterSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterSheetHeaderSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  filterSheetIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filterSheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 2,
    textAlign: 'center',
  },
  filterSheetScroll: { flexGrow: 0 },
  filterSheetContent: { paddingBottom: 16, gap: 4 },
  filterResetLink: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 8,
  },
  statsRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  statsText: { fontSize: 13, lineHeight: 18 },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    gap: 8,
    minHeight: 44,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  pillsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  filterSectionLabel: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 4,
  },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  resultsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  resultsBar: { fontSize: 13 },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    paddingBottom: 8,
    gap: 8,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', flex: 1 },
  sectionCount: {
    minWidth: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  sectionCountText: { fontSize: 13, fontWeight: '700' },
  itemGap: { height: 8 },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    overflow: 'hidden',
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
    minWidth: 0,
  },
  rowPressed: { opacity: 0.92 },
  rowIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1, minWidth: 0, gap: 2 },
  rowTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rowTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
  hiddenBadge: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  hiddenBadgeText: { fontSize: 11, fontWeight: '600' },
  rowSub: { fontSize: 14 },
  rowMeta: { fontSize: 12, marginTop: 2 },
  rowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingRight: 8,
  },
  iconBtn: { padding: 6 },
  emptyWrap: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyCta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  emptyCtaTitle: { fontSize: 17, fontWeight: '700', marginTop: 12 },
  emptyCtaSub: { fontSize: 14, textAlign: 'center', lineHeight: 20, marginTop: 8 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptySub: { fontSize: 14, textAlign: 'center' },
  emptyResetBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
});
