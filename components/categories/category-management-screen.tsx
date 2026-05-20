import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EditableCatalogRow } from '@/components/categories/editable-catalog-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button, ScreenHeader, Select, TextInput } from '@/components/ui';
import { FontSizes, FontWeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  type Office,
  type ServiceCategory,
  getOffices,
  getServiceCategories,
  createServiceCategory,
  updateServiceCategory,
  deleteServiceCategory,
  createSubcategory,
  updateSubcategory,
  deleteSubcategory,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export type CategoryManagementVariant = 'department-head' | 'admin-worker';

type TabType = 'categories' | 'subcategories';

type EditingKey = `category-${number}` | `subcategory-${number}`;

function subcategoryCountLabel(count: number): string {
  if (count === 1) return '1 подкатегория';
  if (count > 1 && count < 5) return `${count} подкатегории`;
  return `${count} подкатегорий`;
}

function useCategories(officeId: number | null) {
  const [list, setList] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (officeId == null) {
      setList([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    const result = await getServiceCategories(officeId);
    if (result.ok) setList(result.data);
    else setError(result.error);
    setLoading(false);
  }, [officeId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { categories: list, loading, error, refetch: fetch };
}

export function CategoryManagementScreen({
  variant,
}: {
  variant: CategoryManagementVariant;
}) {
  const router = useRouter();
  const role = useAuthStore((s) => s.role);
  const userOfficeId = useAuthStore((s) => s.user?.office_id);
  const insets = useSafeAreaInsets();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { show: showToast } = useToast();

  const isAdmin = variant === 'admin-worker';

  useEffect(() => {
    const allowed =
      (variant === 'department-head' && role === 'department-head') ||
      (variant === 'admin-worker' && role === 'admin-worker');
    if (!allowed) router.back();
  }, [role, variant, router]);

  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(
    isAdmin ? '' : String(userOfficeId ?? '')
  );

  useEffect(() => {
    if (isAdmin) getOffices().then(setOffices);
  }, [isAdmin]);

  const manageOfficeId = isAdmin
    ? selectedOfficeId
      ? Number(selectedOfficeId)
      : null
    : userOfficeId ?? null;

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const surface = useThemeColor({}, 'surface');
  const danger = useThemeColor({}, 'danger');
  const dangerSoft = useThemeColor({}, 'dangerSoft');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const background = useThemeColor({}, 'background');

  const initialTab: TabType = tab === 'subcategories' ? 'subcategories' : 'categories';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const { categories, loading, error, refetch } = useCategories(manageOfficeId);

  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false);

  const [editingKey, setEditingKey] = useState<EditingKey | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [originalName, setOriginalName] = useState('');
  const [savingKey, setSavingKey] = useState<EditingKey | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((c) => String(c.id) === selectedCategoryId),
    [categories, selectedCategoryId]
  );

  const subcategories = selectedCategory?.subcategories ?? [];

  const officeOptions = useMemo(
    () => [
      { value: '', label: 'Выберите офис' },
      ...offices.map((o) => ({ value: String(o.id), label: o.name })),
    ],
    [offices]
  );

  const categoryOptions = useMemo(
    () => [
      { value: '', label: 'Выберите категорию' },
      ...categories.map((c) => ({ value: String(c.id), label: c.name })),
    ],
    [categories]
  );

  const cancelEdit = useCallback(() => {
    setEditingKey(null);
    setEditDraft('');
    setOriginalName('');
    setSavingKey(null);
  }, []);

  const startEdit = useCallback((key: EditingKey, name: string) => {
    setEditingKey(key);
    setEditDraft(name);
    setOriginalName(name);
    setSavingKey(null);
  }, []);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name || manageOfficeId == null) return;
    setIsCreatingCategory(true);
    const result = await createServiceCategory({ name }, manageOfficeId);
    setIsCreatingCategory(false);
    if (result.ok) {
      showToast({ title: 'Категория создана', variant: 'success' });
      setNewCategoryName('');
      refetch();
    } else {
      showToast({ title: result.error, variant: 'destructive' });
    }
  }, [newCategoryName, manageOfficeId, showToast, refetch]);

  const confirmDeleteCategory = useCallback(
    (cat: ServiceCategory) => {
      if (editingKey === `category-${cat.id}`) cancelEdit();
      Alert.alert(
        'Удалить категорию?',
        `${cat.name}\n\nКатегория будет снята у исполнителей и в существующих заявках (поле станет пустым). Заявки не удаляются.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              if (manageOfficeId == null) return;
              const result = await deleteServiceCategory(cat.id, manageOfficeId);
              if (result.ok) {
                showToast({ title: 'Категория удалена', variant: 'success' });
                if (selectedCategoryId === String(cat.id)) setSelectedCategoryId('');
                refetch();
              } else {
                showToast({ title: result.error, variant: 'destructive' });
              }
            },
          },
        ]
      );
    },
    [manageOfficeId, selectedCategoryId, showToast, refetch, editingKey, cancelEdit]
  );

  const handleCreateSubcategory = useCallback(async () => {
    const name = newSubcategoryName.trim();
    const catId = Number(selectedCategoryId);
    if (!name || !catId || manageOfficeId == null) return;
    setIsCreatingSubcategory(true);
    const result = await createSubcategory({ name, category_id: catId }, manageOfficeId);
    setIsCreatingSubcategory(false);
    if (result.ok) {
      showToast({ title: 'Подкатегория создана', variant: 'success' });
      setNewSubcategoryName('');
      refetch();
    } else {
      showToast({ title: result.error, variant: 'destructive' });
    }
  }, [newSubcategoryName, selectedCategoryId, manageOfficeId, showToast, refetch]);

  const handleSaveEdit = useCallback(async () => {
    if (!editingKey || manageOfficeId == null) return;
    const name = editDraft.trim();
    if (!name) return;
    if (name === originalName) {
      cancelEdit();
      return;
    }

    setSavingKey(editingKey);
    const isCategory = editingKey.startsWith('category-');
    const id = Number(editingKey.split('-')[1]);

    const result = isCategory
      ? await updateServiceCategory(id, { name }, manageOfficeId)
      : await updateSubcategory(id, { name }, manageOfficeId);

    setSavingKey(null);

    if (result.ok) {
      showToast({
        title: isCategory ? 'Категория обновлена' : 'Подкатегория обновлена',
        variant: 'success',
      });
      cancelEdit();
      refetch();
    } else {
      showToast({ title: result.error, variant: 'destructive' });
    }
  }, [editDraft, editingKey, originalName, manageOfficeId, showToast, refetch, cancelEdit]);

  const confirmDeleteSubcategory = useCallback(
    (name: string, id: number) => {
      if (editingKey === `subcategory-${id}`) cancelEdit();
      Alert.alert('Удалить подкатегорию?', name, [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            if (manageOfficeId == null) return;
            const result = await deleteSubcategory(id, manageOfficeId);
            if (result.ok) {
              showToast({ title: 'Подкатегория удалена', variant: 'success' });
              refetch();
            } else {
              showToast({ title: result.error, variant: 'destructive' });
            }
          },
        },
      ]);
    },
    [manageOfficeId, showToast, refetch, editingKey, cancelEdit]
  );

  const allowed =
    (variant === 'department-head' && role === 'department-head') ||
    (variant === 'admin-worker' && role === 'admin-worker');

  if (!allowed) return null;

  const needsOffice = isAdmin && manageOfficeId == null;

  const rowTheme = {
    cardBackgroundColor: cardBg,
    borderColor: border,
    textColor: text,
    textMutedColor: textMuted,
    primaryColor: primary,
    dangerColor: danger,
    surfaceColor: surface,
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScreenHeader title="Категории услуг" onBack={() => router.back()} />

      {isAdmin ? (
        <View style={styles.officeBar}>
          <Select
            value={selectedOfficeId}
            onValueChange={(v) => {
              cancelEdit();
              setSelectedOfficeId(v);
            }}
            options={officeOptions}
            placeholder="Выберите офис"
          />
        </View>
      ) : null}

      <View style={[styles.tabs, { backgroundColor: surfaceMuted, borderColor: border }]}>
        <Pressable
          style={[styles.tab, activeTab === 'categories' && { backgroundColor: primary }]}
          onPress={() => {
            cancelEdit();
            setActiveTab('categories');
          }}
        >
          <ThemedText
            style={[
              styles.tabLabel,
              { color: activeTab === 'categories' ? '#fff' : textMuted },
            ]}
          >
            Категории
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'subcategories' && { backgroundColor: primary }]}
          onPress={() => {
            cancelEdit();
            setActiveTab('subcategories');
          }}
        >
          <ThemedText
            style={[
              styles.tabLabel,
              { color: activeTab === 'subcategories' ? '#fff' : textMuted },
            ]}
          >
            Подкатегории
          </ThemedText>
        </Pressable>
      </View>

      {needsOffice ? (
        <View style={styles.centered}>
          <MaterialIcons name="business" size={48} color={textMuted} />
          <ThemedText style={[styles.emptyTitle, { color: text }]}>
            Выберите офис
          </ThemedText>
          <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
            Каталог категорий настраивается отдельно для каждого офиса
          </ThemedText>
        </View>
      ) : loading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : error ? (
        <View style={[styles.banner, { backgroundColor: dangerSoft, borderColor: danger }]}>
          <ThemedText style={{ color: danger }}>{error}</ThemedText>
          <Button title="Повторить" onPress={refetch} variant="outline" />
        </View>
      ) : (
        <ScrollView
          style={[styles.flex, { backgroundColor: background }]}
          contentContainerStyle={[
            styles.scroll,
            { paddingBottom: insets.bottom + Spacing.xxl },
          ]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
        >
            {activeTab === 'categories' && (
              <>
                <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <ThemedText style={[styles.formTitle, { color: text }]}>
                    Новая категория
                  </ThemedText>
                  <TextInput
                    label="Название"
                    placeholder="Например: КТО"
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    editable={!isCreatingCategory && editingKey == null}
                    returnKeyType="done"
                    onSubmitEditing={handleCreateCategory}
                  />
                  <Button
                    title={isCreatingCategory ? 'Сохранение...' : 'Добавить категорию'}
                    onPress={handleCreateCategory}
                    variant="primary"
                    loading={isCreatingCategory}
                    disabled={!newCategoryName.trim() || isCreatingCategory}
                  />
                </View>

                <View style={styles.listHeaderBlock}>
                  <View style={styles.listHeader}>
                    <ThemedText style={[styles.listTitle, { color: text }]}>
                      Список категорий
                    </ThemedText>
                    <View style={[styles.countBadge, { backgroundColor: accentSoft }]}>
                      <ThemedText style={[styles.countText, { color: primary }]}>
                        {categories.length}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.listHint, { color: textMuted }]}>
                    Нажмите на название, чтобы переименовать
                  </ThemedText>
                </View>

                {categories.length === 0 ? (
                  <View style={[styles.emptyCard, { borderColor: border }]}>
                    <MaterialIcons name="folder-open" size={40} color={textMuted} />
                    <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
                      Пока нет категорий — добавьте первую выше
                    </ThemedText>
                  </View>
                ) : (
                  categories.map((cat) => {
                    const key: EditingKey = `category-${cat.id}`;
                    const subCount = cat.subcategories?.length ?? 0;
                    return (
                      <EditableCatalogRow
                        key={cat.id}
                        icon="category"
                        iconBackgroundColor={accentSoft}
                        iconColor={primary}
                        name={cat.name}
                        subtitle={subcategoryCountLabel(subCount)}
                        isEditing={editingKey === key}
                        draft={editingKey === key ? editDraft : cat.name}
                        isSaving={savingKey === key}
                        {...rowTheme}
                        onStartEdit={() => startEdit(key, cat.name)}
                        onChangeDraft={setEditDraft}
                        onSave={handleSaveEdit}
                        onCancel={cancelEdit}
                        onDelete={() => confirmDeleteCategory(cat)}
                      />
                    );
                  })
                )}
              </>
            )}

            {activeTab === 'subcategories' && (
              <>
                <View style={[styles.formCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <ThemedText style={[styles.formTitle, { color: text }]}>
                    Категория
                  </ThemedText>
                  <Select
                    value={selectedCategoryId}
                    onValueChange={(v) => {
                      cancelEdit();
                      setSelectedCategoryId(v);
                    }}
                    options={categoryOptions}
                    placeholder="Выберите категорию"
                    disabled={categories.length === 0}
                  />
                </View>

                {!selectedCategory ? (
                  <View style={[styles.emptyCard, { borderColor: border }]}>
                    <MaterialIcons name="touch-app" size={40} color={textMuted} />
                    <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
                      {categories.length === 0
                        ? 'Сначала создайте категорию на вкладке «Категории»'
                        : 'Выберите категорию, чтобы управлять подкатегориями'}
                    </ThemedText>
                  </View>
                ) : (
                  <>
                    <View
                      style={[styles.formCard, { backgroundColor: cardBg, borderColor: border }]}
                    >
                      <ThemedText style={[styles.formTitle, { color: text }]}>
                        Новая подкатегория
                      </ThemedText>
                      <ThemedText style={[styles.formSubtitle, { color: textMuted }]}>
                        в «{selectedCategory.name}»
                      </ThemedText>
                      <TextInput
                        label="Название"
                        placeholder="Например: Замена ламп"
                        value={newSubcategoryName}
                        onChangeText={setNewSubcategoryName}
                        editable={!isCreatingSubcategory && editingKey == null}
                        returnKeyType="done"
                        onSubmitEditing={handleCreateSubcategory}
                      />
                      <Button
                        title={isCreatingSubcategory ? 'Сохранение...' : 'Добавить подкатегорию'}
                        onPress={handleCreateSubcategory}
                        variant="primary"
                        loading={isCreatingSubcategory}
                        disabled={!newSubcategoryName.trim() || isCreatingSubcategory}
                      />
                    </View>

                    <View style={styles.listHeaderBlock}>
                      <View style={styles.listHeader}>
                        <ThemedText style={[styles.listTitle, { color: text }]}>
                          Подкатегории
                        </ThemedText>
                        <View style={[styles.countBadge, { backgroundColor: accentSoft }]}>
                          <ThemedText style={[styles.countText, { color: primary }]}>
                            {subcategories.length}
                          </ThemedText>
                        </View>
                      </View>
                      <ThemedText style={[styles.listHint, { color: textMuted }]}>
                        Нажмите на название, чтобы переименовать
                      </ThemedText>
                    </View>

                    {subcategories.length === 0 ? (
                      <View style={[styles.emptyCard, { borderColor: border }]}>
                        <MaterialIcons name="list-alt" size={40} color={textMuted} />
                        <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
                          В этой категории пока нет подкатегорий
                        </ThemedText>
                      </View>
                    ) : (
                      subcategories.map((sub) => {
                        const key: EditingKey = `subcategory-${sub.id}`;
                        return (
                          <EditableCatalogRow
                            key={sub.id}
                            icon="subdirectory-arrow-right"
                            iconBackgroundColor={surfaceMuted}
                            iconColor={textMuted}
                            name={sub.name}
                            isEditing={editingKey === key}
                            draft={editingKey === key ? editDraft : sub.name}
                            isSaving={savingKey === key}
                            {...rowTheme}
                            onStartEdit={() => startEdit(key, sub.name)}
                            onChangeDraft={setEditDraft}
                            onSave={handleSaveEdit}
                            onCancel={cancelEdit}
                            onDelete={() => confirmDeleteSubcategory(sub.name, sub.id)}
                          />
                        );
                      })
                    )}
                  </>
                )}
              </>
            )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  officeBar: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    borderRadius: Radius.md,
    padding: 4,
    borderWidth: 1,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: Radius.sm,
    alignItems: 'center',
  },
  tabLabel: {
    fontSize: FontSizes.bodySmall,
    fontWeight: FontWeights.semibold,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  scroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.md,
  },
  formCard: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  formTitle: {
    fontSize: FontSizes.title,
    fontWeight: FontWeights.semibold,
  },
  formSubtitle: {
    fontSize: FontSizes.bodySmall,
    marginTop: -Spacing.sm,
  },
  listHeaderBlock: {
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
    gap: 4,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listHint: {
    fontSize: FontSizes.caption,
    lineHeight: 18,
  },
  listTitle: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
  },
  countText: {
    fontSize: FontSizes.caption,
    fontWeight: FontWeights.semibold,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontSize: FontSizes.title,
    fontWeight: FontWeights.semibold,
    textAlign: 'center',
  },
  emptyHint: {
    fontSize: FontSizes.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
  },
  banner: {
    margin: Spacing.lg,
    padding: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    gap: Spacing.md,
  },
});
