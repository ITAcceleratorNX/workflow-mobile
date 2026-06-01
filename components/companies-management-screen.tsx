import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader, Select } from '@/components/ui';
import {
  FormBottomSheet,
  FormBottomSheetFieldLabel,
  formBottomSheetFieldStyles,
} from '@/components/ui/form-bottom-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/context/toast-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  createOfficeCompany,
  deleteOfficeCompany,
  getOfficeCompanies,
  getOffices,
  updateOfficeCompany,
  type Company,
  type Office,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export type CompaniesManagementVariant = 'department-head' | 'admin-worker';

/**
 * Управление компаниями офиса:
 * - admin-worker — выбирает офис в селекторе, видит и редактирует компании любого офиса;
 * - department-head — работает только со своим офисом.
 */
export function CompaniesManagementScreen({
  variant,
}: {
  variant: CompaniesManagementVariant;
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
  const accentSoft = useThemeColor({}, 'accentSoft');
  const danger = useThemeColor({}, 'danger');
  const inputBg = useThemeColor({}, 'background');
  const dangerColor = useThemeColor({}, 'danger');

  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(
    isAdmin ? '' : String(user?.office_id ?? ''),
  );
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) {
      getOffices().then(setOffices);
    }
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
    [offices],
  );

  const load = useCallback(
    async (opts?: { fromPull?: boolean }) => {
      if (manageOfficeId == null) {
        setCompanies([]);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.fromPull) {
        setLoading(true);
      }
      const res = await getOfficeCompanies(manageOfficeId);
      if (res.ok) {
        setCompanies(res.data);
      } else {
        setCompanies([]);
        showToast({ title: res.error, variant: 'destructive' });
      }
      setLoading(false);
      setRefreshing(false);
    },
    [manageOfficeId, showToast],
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
    void load();
  }, [role, variant, load, router]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load({ fromPull: true });
  }, [load]);

  const openCreate = () => {
    setEditingId(null);
    setFormName('');
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (company: Company) => {
    setEditingId(company.id);
    setFormName(company.name);
    setSaveError(null);
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingId(null);
    setSaveError(null);
  };

  const handleSubmit = async () => {
    if (manageOfficeId == null) return;
    const name = formName.trim();
    if (!name) {
      setSaveError('Введите название компании');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res =
        editingId == null
          ? await createOfficeCompany(manageOfficeId, { name })
          : await updateOfficeCompany(manageOfficeId, editingId, { name });
      if (!res.ok) {
        setSaveError(res.error);
        return;
      }
      showToast({
        title: editingId == null ? 'Компания добавлена' : 'Сохранено',
        variant: 'success',
      });
      closeModal();
      await load();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (company: Company) => {
    if (manageOfficeId == null) return;
    Alert.alert(
      'Удалить компанию?',
      `Все клиенты, привязанные к «${company.name}», увидят значение «Не указана».`,
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteOfficeCompany(manageOfficeId, company.id);
            if (!res.ok) {
              showToast({ title: res.error, variant: 'destructive' });
              return;
            }
            showToast({ title: 'Удалено', variant: 'success' });
            await load();
          },
        },
      ],
    );
  };

  const renderItem = ({ item }: { item: Company }) => (
    <View style={[styles.row, { borderColor: border, backgroundColor: card }]}>
      <Pressable
        onPress={() => openEdit(item)}
        style={({ pressed }) => [styles.rowMain, pressed && styles.rowPressed]}
        accessibilityRole="button"
        accessibilityLabel="Редактировать компанию"
      >
        <View style={[styles.rowIcon, { backgroundColor: accentSoft }]}>
          <MaterialIcons name="apartment" size={22} color={primary} />
        </View>
        <View style={styles.rowBody}>
          <ThemedText style={[styles.rowTitle, { color: text }]} numberOfLines={1}>
            {item.name}
          </ThemedText>
        </View>
      </Pressable>
      <View style={styles.rowActions}>
        <Pressable
          onPress={() => confirmDelete(item)}
          hitSlop={8}
          style={styles.iconBtn}
          accessibilityLabel="Удалить компанию"
        >
          <MaterialIcons name="delete-outline" size={20} color={danger} />
        </Pressable>
        <MaterialIcons name="chevron-right" size={22} color={muted} />
      </View>
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

  const headerRight = manageOfficeId != null ? (
    <Pressable
      onPress={openCreate}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Добавить компанию"
      style={({ pressed }) => [styles.headerAddBtn, pressed && { opacity: 0.6 }]}
    >
      <MaterialIcons name="add" size={26} color={primary} />
    </Pressable>
  ) : null;

  return (
    <ThemedView style={[styles.screen, { paddingTop: insets.top, backgroundColor: bg }]}>
      <ScreenHeader
        title="Компании"
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

      {noOfficeAccount ? (
        <View style={styles.emptyWrap}>
          <ThemedText style={[styles.emptyTitle, { color: text }]}>Нет офиса</ThemedText>
          <ThemedText style={[styles.emptySub, { color: muted }]}>
            Свяжитесь с администратором, чтобы получить офис.
          </ThemedText>
        </View>
      ) : needsPickOffice ? (
        <View style={styles.emptyWrap}>
          <MaterialIcons name="business" size={36} color={muted} />
          <ThemedText style={[styles.emptyTitle, { color: text }]}>Выберите офис</ThemedText>
          <ThemedText style={[styles.emptySub, { color: muted }]}>
            Чтобы увидеть и редактировать компании, выберите офис из списка выше.
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={styles.emptyWrap}>
          <ActivityIndicator color={primary} />
        </View>
      ) : (
        <FlatList
          data={companies}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={primary}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <Pressable
                onPress={openCreate}
                style={[styles.emptyCta, { borderColor: border, backgroundColor: card }]}
              >
                <MaterialIcons name="apartment" size={32} color={primary} />
                <ThemedText style={[styles.emptyCtaTitle, { color: text }]}>
                  Добавить первую компанию
                </ThemedText>
                <ThemedText style={[styles.emptyCtaSub, { color: muted }]}>
                  Клиенты выберут компанию при регистрации.
                </ThemedText>
              </Pressable>
            </View>
          }
        />
      )}

      <FormBottomSheet
        visible={modalOpen}
        onClose={closeModal}
        title={editingId == null ? 'Новая компания' : 'Редактировать компанию'}
        loading={saving}
        primaryLabel={editingId == null ? 'Создать' : 'Сохранить'}
        onPrimaryPress={handleSubmit}
        primaryDisabled={formName.trim().length === 0}
      >
        <FormBottomSheetFieldLabel>Название</FormBottomSheetFieldLabel>
        <TextInput
          style={[
            formBottomSheetFieldStyles.input,
            { color: text, borderColor: border, backgroundColor: inputBg },
          ]}
          placeholder="Например, TOO TMK Limited"
          placeholderTextColor={muted}
          value={formName}
          onChangeText={setFormName}
          maxLength={255}
          returnKeyType="done"
          blurOnSubmit
        />
        {saveError ? (
          <ThemedText style={[styles.formError, { color: dangerColor }]}>{saveError}</ThemedText>
        ) : null}
      </FormBottomSheet>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  officeBar: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 32,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    paddingRight: 12,
  },
  rowMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingLeft: 12,
    gap: 12,
  },
  rowPressed: { opacity: 0.7 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowBody: { flex: 1 },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  iconBtn: { padding: 6 },
  headerAddBtn: { padding: 6 },
  emptyWrap: {
    flex: 1,
    paddingHorizontal: 24,
    paddingVertical: 48,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600' },
  emptySub: { fontSize: 14, textAlign: 'center' },
  emptyCta: {
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 8,
    width: '100%',
  },
  emptyCtaTitle: { fontSize: 16, fontWeight: '600' },
  emptyCtaSub: { fontSize: 13, textAlign: 'center' },
  formError: { fontSize: 13, marginTop: 4 },
});
