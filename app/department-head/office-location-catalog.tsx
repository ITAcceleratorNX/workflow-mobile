import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  OfficeLocationCatalogFormModal,
  type OfficeLocationCatalogFormValues,
} from '@/components/office-location-catalog-form-modal';
import { ScreenHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  createOfficeLocationCatalogRow,
  deleteOfficeLocationCatalogRow,
  getOfficeLocationCatalog,
  updateOfficeLocationCatalogRow,
  type OfficeLocationCatalogItem,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

/** Шаблоны локаций офиса — настраивает офис-менеджер (роль department-head) для своего офиса. */
export default function DepartmentHeadOfficeLocationCatalogScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const role = useAuthStore((s) => s.role);
  const user = useAuthStore((s) => s.user);

  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'cardBackground');

  const officeId = user?.office_id != null && user.office_id > 0 ? user.office_id : null;

  const [rows, setRows] = useState<OfficeLocationCatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
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
  const autoOpenedCreateRef = useRef(false);

  const load = useCallback(async () => {
    if (officeId == null) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const res = await getOfficeLocationCatalog(officeId, { includeInactive: true });
    if (res.ok) {
      setRows(res.data);
    } else {
      setRows([]);
      showToast({ title: res.error, variant: 'destructive' });
    }
    setLoading(false);
  }, [officeId, showToast]);

  useEffect(() => {
    if (role == null) return;
    if (role !== 'department-head') {
      router.back();
      return;
    }
    load();
  }, [role, load, router]);

  /** При первом заходе с пустым списком — сразу открыть шторку создания (как при «создании»). */
  useEffect(() => {
    if (loading || officeId == null || rows.length > 0 || autoOpenedCreateRef.current) return;
    autoOpenedCreateRef.current = true;
    setEditingId(null);
    setModalMode('create');
    setSaveError(null);
    setFormDefaults({ block: '', floor_zone: '', room: '', sort_order: 0 });
    setModalOpen(true);
  }, [loading, officeId, rows.length]);

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

  const openEdit = (item: OfficeLocationCatalogItem) => {
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
    if (officeId == null) return;
    setSaving(true);
    setSaveError(null);
    try {
      if (editingId == null) {
        const res = await createOfficeLocationCatalogRow(officeId, {
          ...values,
          is_active: true,
        });
        if (!res.ok) {
          setSaveError(res.error);
          return;
        }
        showToast({ title: 'Шаблон добавлен', variant: 'success' });
      } else {
        const res = await updateOfficeLocationCatalogRow(officeId, editingId, values);
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
    if (officeId == null) return;
    Alert.alert('Удалить шаблон?', 'Действие нельзя отменить.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          const res = await deleteOfficeLocationCatalogRow(officeId, id);
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

  const toggleActive = async (item: OfficeLocationCatalogItem) => {
    if (officeId == null) return;
    const res = await updateOfficeLocationCatalogRow(officeId, item.id, {
      is_active: !item.is_active,
    });
    if (!res.ok) {
      showToast({ title: res.error, variant: 'destructive' });
      return;
    }
    await load();
  };

  if (role !== 'department-head') {
    return null;
  }

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <ScreenHeader title="Шаблоны локаций" onBack={() => router.back()} />

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

      {officeId == null ? (
        <View style={styles.center}>
          <ThemedText style={{ color: muted, textAlign: 'center' }}>
            У вашей учётной записи не указан офис. Обратитесь к администратору.
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <ThemedText style={[styles.hint, { color: muted }]}>
              Блок, этаж и помещение — клиенты увидят эти варианты при создании заявки в вашем офисе.
            </ThemedText>
            {rows.length === 0 ? (
              <Pressable
                onPress={openAdd}
                style={[styles.emptyCta, { borderColor: border, backgroundColor: card }]}
              >
                <MaterialIcons name="add-circle-outline" size={28} color={primary} />
                <ThemedText style={[styles.emptyCtaTitle, { color: text }]}>Добавить шаблон</ThemedText>
                <ThemedText style={[styles.emptyCtaSub, { color: muted }]}>
                  Откроется форма в том же виде, что и при редактировании заявки
                </ThemedText>
              </Pressable>
            ) : (
              rows.map((item) => (
                <View
                  key={item.id}
                  style={[
                    styles.card,
                    { borderColor: border, backgroundColor: card, opacity: item.is_active ? 1 : 0.55 },
                  ]}
                >
                  <View style={styles.cardText}>
                    <ThemedText style={[styles.cardTitle, { color: text }]} numberOfLines={2}>
                      {item.block ? `Блок ${item.block}` : '—'}
                      {item.floor_zone ? ` · ${item.floor_zone}` : ''}
                      {item.room ? ` · ${item.room}` : ''}
                    </ThemedText>
                    <ThemedText style={[styles.cardMeta, { color: muted }]}>
                      Порядок: {item.sort_order ?? 0}
                      {!item.is_active ? ' · скрыт' : ''}
                    </ThemedText>
                  </View>
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => openEdit(item)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons name="edit" size={22} color={primary} />
                    </Pressable>
                    <Pressable onPress={() => toggleActive(item)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons
                        name={item.is_active ? 'visibility-off' : 'visibility'}
                        size={22}
                        color={muted}
                      />
                    </Pressable>
                    <Pressable onPress={() => confirmDelete(item.id)} hitSlop={8} style={styles.iconBtn}>
                      <MaterialIcons name="delete-outline" size={22} color="#c62828" />
                    </Pressable>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <Pressable
            onPress={openAdd}
            style={[styles.fab, { backgroundColor: primary }]}
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
  scroll: { padding: 16, paddingBottom: 100 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
  emptyCta: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginTop: 12,
  },
  emptyCtaTitle: { fontSize: 17, fontWeight: '700', marginTop: 10 },
  emptyCtaSub: { fontSize: 13, textAlign: 'center', lineHeight: 18, marginTop: 6 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
  },
  cardText: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 15, fontWeight: '600' },
  cardMeta: { fontSize: 12, marginTop: 4 },
  cardActions: { flexDirection: 'row', alignItems: 'center' },
  iconBtn: { padding: 4, marginLeft: 4 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 28,
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
