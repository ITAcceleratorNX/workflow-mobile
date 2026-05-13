import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

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

export default function ManagerOfficeLocationCatalogScreen() {
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formBlock, setFormBlock] = useState('');
  const [formFloor, setFormFloor] = useState('');
  const [formRoom, setFormRoom] = useState('');
  const [formSort, setFormSort] = useState('0');
  const [saving, setSaving] = useState(false);

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
    if (role !== 'manager') {
      router.back();
      return;
    }
    load();
  }, [role, load, router]);

  const openAdd = () => {
    setEditingId(null);
    setFormBlock('');
    setFormFloor('');
    setFormRoom('');
    setFormSort(String(rows.length > 0 ? Math.max(...rows.map((r) => r.sort_order ?? 0)) + 1 : 0));
    setModalOpen(true);
  };

  const openEdit = (item: OfficeLocationCatalogItem) => {
    setEditingId(item.id);
    setFormBlock(item.block);
    setFormFloor(item.floor_zone);
    setFormRoom(item.room);
    setFormSort(String(item.sort_order ?? 0));
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
  };

  const saveForm = async () => {
    if (officeId == null) return;
    const sortNum = Number(formSort);
    if (Number.isNaN(sortNum)) {
      showToast({ title: 'Некорректный порядок', variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      if (editingId == null) {
        const res = await createOfficeLocationCatalogRow(officeId, {
          block: formBlock.trim(),
          floor_zone: formFloor.trim(),
          room: formRoom.trim(),
          sort_order: sortNum,
          is_active: true,
        });
        if (!res.ok) {
          showToast({ title: res.error, variant: 'destructive' });
          return;
        }
        showToast({ title: 'Шаблон добавлен', variant: 'success' });
      } else {
        const res = await updateOfficeLocationCatalogRow(officeId, editingId, {
          block: formBlock.trim(),
          floor_zone: formFloor.trim(),
          room: formRoom.trim(),
          sort_order: sortNum,
        });
        if (!res.ok) {
          showToast({ title: res.error, variant: 'destructive' });
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

  if (role !== 'manager') {
    return null;
  }

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <ScreenHeader title="Шаблоны локаций" onBack={() => router.back()} />

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
              <ThemedText style={{ color: muted, marginTop: 16 }}>Пока нет шаблонов. Добавьте первый.</ThemedText>
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

      <Modal visible={modalOpen} animationType="slide" transparent onRequestClose={closeModal}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.modalBackdrop}
        >
          <Pressable style={StyleSheet.absoluteFill} onPress={closeModal} />
          <View style={[styles.modalCard, { backgroundColor: card, borderColor: border }]}>
            <ThemedText type="subtitle" style={{ color: text, marginBottom: 12 }}>
              {editingId == null ? 'Новый шаблон' : 'Редактирование'}
            </ThemedText>
            <ThemedText style={[styles.label, { color: muted }]}>Блок</ThemedText>
            <TextInput
              value={formBlock}
              onChangeText={setFormBlock}
              placeholder="Например: А"
              placeholderTextColor={muted}
              style={[styles.input, { color: text, borderColor: border, backgroundColor: bg }]}
            />
            <ThemedText style={[styles.label, { color: muted }]}>Этаж / зона</ThemedText>
            <TextInput
              value={formFloor}
              onChangeText={setFormFloor}
              placeholder="Например: 2 этаж"
              placeholderTextColor={muted}
              style={[styles.input, { color: text, borderColor: border, backgroundColor: bg }]}
            />
            <ThemedText style={[styles.label, { color: muted }]}>Помещение</ThemedText>
            <TextInput
              value={formRoom}
              onChangeText={setFormRoom}
              placeholder="Название помещения"
              placeholderTextColor={muted}
              style={[styles.input, { color: text, borderColor: border, backgroundColor: bg }]}
            />
            <ThemedText style={[styles.label, { color: muted }]}>Порядок сортировки</ThemedText>
            <TextInput
              value={formSort}
              onChangeText={setFormSort}
              keyboardType="number-pad"
              style={[styles.input, { color: text, borderColor: border, backgroundColor: bg }]}
            />
            <View style={styles.modalButtons}>
              <Pressable onPress={closeModal} style={[styles.btn, styles.btnFirst, { borderColor: border }]}>
                <ThemedText style={{ color: text }}>Отмена</ThemedText>
              </Pressable>
              <Pressable
                onPress={saveForm}
                disabled={saving}
                style={[styles.btn, { backgroundColor: primary, opacity: saving ? 0.6 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={{ color: '#fff' }}>Сохранить</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  scroll: { padding: 16, paddingBottom: 100 },
  hint: { fontSize: 14, lineHeight: 20, marginBottom: 8 },
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
  modalBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  modalCard: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 20,
    paddingBottom: 32,
  },
  label: { fontSize: 12, marginTop: 10, marginBottom: 4 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 20,
  },
  btn: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 100,
    alignItems: 'center',
    marginLeft: 12,
  },
  btnFirst: { marginLeft: 0 },
});
