import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  type ServiceCategory,
  type ServiceSubcategory,
  type ExecutorInCategory,
  getServiceCategories,
  createServiceCategory,
  deleteServiceCategory,
  getExecutorsByCategory,
  getAllExecutorsForAdmin,
  assignExecutorToCategory,
  createSubcategory,
  deleteSubcategory,
} from '@/lib/api';


type TabType = 'categories' | 'subcategories' | 'executors';

function useCategories() {
  const [list, setList] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await getServiceCategories();
    if (result.ok) setList(result.data);
    else setError(result.error);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { categories: list, loading, error, refetch: fetch };
}

function useCategoriesWithExecutors(categoryIds: number[]) {
  const [idsWithExecutors, setIdsWithExecutors] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (categoryIds.length === 0) {
      setIdsWithExecutors(new Set());
      return;
    }
    let cancelled = false;
    const next = new Set<number>();
    (async () => {
      for (const id of categoryIds) {
        if (cancelled) return;
        const res = await getExecutorsByCategory(id);
        if (res.ok && res.data.length > 0) next.add(id);
      }
      if (!cancelled) setIdsWithExecutors(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [categoryIds.join(',')]);

  return idsWithExecutors;
}

export default function AdminWorkerCategoriesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { show } = useToast();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');

  const initialTab: TabType =
    tab === 'subcategories' ? 'subcategories' : tab === 'executors' ? 'executors' : 'categories';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  const { categories, loading, error, refetch } = useCategories();
  const categoryIds = useMemo(() => categories.map((c) => c.id), [categories]);
  const categoriesWithExecutors = useCategoriesWithExecutors(categoryIds);

  // Categories tab
  const [newCategoryName, setNewCategoryName] = useState('');
  const [isCreatingCategory, setIsCreatingCategory] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState<number | null>(null);
  const [isDeletingCategory, setIsDeletingCategory] = useState(false);
  const [categoryError, setCategoryError] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);

  // Subcategories tab
  const [selectedCategoryForSub, setSelectedCategoryForSub] = useState<number | null>(null);
  const [newSubcategoryName, setNewSubcategoryName] = useState('');
  const [isCreatingSubcategory, setIsCreatingSubcategory] = useState(false);
  const [subcategoryToDelete, setSubcategoryToDelete] = useState<number | null>(null);
  const [isDeletingSubcategory, setIsDeletingSubcategory] = useState(false);
  const [subcategoryError, setSubcategoryError] = useState<string | null>(null);
  const [showSubcategoryDropdown, setShowSubcategoryDropdown] = useState(false);
  const [showCategorySelectDropdown, setShowCategorySelectDropdown] = useState(false);

  // Исполнители: привязать сотрудника к категории (как в браузере)
  const [allExecutors, setAllExecutors] = useState<ExecutorInCategory[]>([]);
  const [loadingAllExecutors, setLoadingAllExecutors] = useState(false);
  const [selectedCategoryForAssign, setSelectedCategoryForAssign] = useState<number | null>(null);
  const [selectedExecutorForAssign, setSelectedExecutorForAssign] = useState<number | null>(null);
  const [isAssigningExecutor, setIsAssigningExecutor] = useState(false);
  const [executorManagementError, setExecutorManagementError] = useState<string | null>(null);
  const [showCategoryAssignDropdown, setShowCategoryAssignDropdown] = useState(false);
  const [showExecutorAssignDropdown, setShowExecutorAssignDropdown] = useState(false);

  useEffect(() => {
    if (activeTab === 'executors') {
      setLoadingAllExecutors(true);
      getAllExecutorsForAdmin().then((res) => {
        if (res.ok) setAllExecutors(res.data);
        else setAllExecutors([]);
        setLoadingAllExecutors(false);
      });
    }
  }, [activeTab]);

  const handleAssignExecutorToCategory = useCallback(async () => {
    if (selectedCategoryForAssign == null || selectedExecutorForAssign == null) return;
    setExecutorManagementError(null);
    setIsAssigningExecutor(true);
    const result = await assignExecutorToCategory(selectedCategoryForAssign, selectedExecutorForAssign);
    if (result.ok) {
      show({
        title: 'Исполнитель назначен',
        description: 'Исполнитель успешно привязан к категории',
        variant: 'success',
      });
      setSelectedCategoryForAssign(null);
      setSelectedExecutorForAssign(null);
      setShowCategoryAssignDropdown(false);
      setShowExecutorAssignDropdown(false);
    } else {
      setExecutorManagementError(result.error);
    }
    setIsAssigningExecutor(false);
  }, [selectedCategoryForAssign, selectedExecutorForAssign, show]);

  const allSubcategories = useMemo(() => {
    return categories.flatMap((cat) =>
      (cat.subcategories || []).map((sub) => ({ ...sub, categoryName: cat.name }))
    );
  }, [categories]);

  const handleCreateCategory = useCallback(async () => {
    const name = newCategoryName.trim();
    if (!name) return;
    setIsCreatingCategory(true);
    setCategoryError(null);
    const result = await createServiceCategory({ name });
    if (result.ok) {
      show({ title: 'Категория создана', description: `Категория "${name}" успешно создана`, variant: 'success' });
      setNewCategoryName('');
      refetch();
    } else {
      setCategoryError(result.error);
    }
    setIsCreatingCategory(false);
  }, [newCategoryName, show, refetch]);

  const handleDeleteCategory = useCallback(async () => {
    if (categoryToDelete == null) return;
    if (categoriesWithExecutors.has(categoryToDelete)) return;
    setIsDeletingCategory(true);
    setCategoryError(null);
    const result = await deleteServiceCategory(categoryToDelete);
    if (result.ok) {
      show({ title: 'Категория удалена', description: 'Категория успешно удалена', variant: 'success' });
      setCategoryToDelete(null);
      setShowCategoryDropdown(false);
      refetch();
    } else {
      setCategoryError(result.error);
    }
    setIsDeletingCategory(false);
  }, [categoryToDelete, categoriesWithExecutors, show, refetch]);

  const handleCreateSubcategory = useCallback(async () => {
    const name = newSubcategoryName.trim();
    if (!selectedCategoryForSub || !name) return;
    setIsCreatingSubcategory(true);
    setSubcategoryError(null);
    const result = await createSubcategory({ name, category_id: selectedCategoryForSub });
    if (result.ok) {
      show({ title: 'Подкатегория создана', description: `Подкатегория "${name}" успешно создана`, variant: 'success' });
      setSelectedCategoryForSub(null);
      setNewSubcategoryName('');
      refetch();
    } else {
      setSubcategoryError(result.error);
    }
    setIsCreatingSubcategory(false);
  }, [newSubcategoryName, selectedCategoryForSub, show, refetch]);

  const handleDeleteSubcategory = useCallback(async () => {
    if (subcategoryToDelete == null) return;
    setIsDeletingSubcategory(true);
    setSubcategoryError(null);
    const result = await deleteSubcategory(subcategoryToDelete);
    if (result.ok) {
      show({ title: 'Подкатегория удалена', description: 'Подкатегория успешно удалена', variant: 'success' });
      setSubcategoryToDelete(null);
      setShowSubcategoryDropdown(false);
      refetch();
    } else {
      setSubcategoryError(result.error);
    }
    setIsDeletingSubcategory(false);
  }, [subcategoryToDelete, show, refetch]);

  const categoryForDeleteLabel = useMemo(() => {
    if (categoryToDelete == null) return null;
    const c = categories.find((x) => x.id === categoryToDelete);
    return c ? c.name : null;
  }, [categoryToDelete, categories]);

  const subcategoryForDeleteLabel = useMemo(() => {
    if (subcategoryToDelete == null) return null;
    const s = allSubcategories.find((x) => x.id === subcategoryToDelete);
    return s ? `${s.categoryName} → ${s.name}` : null;
  }, [subcategoryToDelete, allSubcategories]);

  const selectedCategoryName = useMemo(() => {
    if (selectedCategoryForSub == null) return null;
    return categories.find((c) => c.id === selectedCategoryForSub)?.name ?? null;
  }, [selectedCategoryForSub, categories]);

  const selectedCategoryForAssignName = useMemo(() => {
    if (selectedCategoryForAssign == null) return null;
    return categories.find((c) => c.id === selectedCategoryForAssign)?.name ?? null;
  }, [selectedCategoryForAssign, categories]);

  const selectedExecutorForAssignName = useMemo(() => {
    if (selectedExecutorForAssign == null) return null;
    const ex = allExecutors.find((e) => e.id === selectedExecutorForAssign);
    return ex?.user?.full_name ?? null;
  }, [selectedExecutorForAssign, allExecutors]);

  const canDeleteCategory = categoryToDelete != null && !categoriesWithExecutors.has(categoryToDelete);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={24} color={primary} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Категории и подкатегории
        </ThemedText>
      </View>

      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'categories' && styles.tabActive]}
          onPress={() => setActiveTab('categories')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'categories' && styles.tabTextActive]}>
            Категории
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'subcategories' && styles.tabActive]}
          onPress={() => setActiveTab('subcategories')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'subcategories' && styles.tabTextActive]}>
            Подкатегории
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'executors' && styles.tabActive]}
          onPress={() => setActiveTab('executors')}
        >
          <ThemedText style={[styles.tabText, activeTab === 'executors' && styles.tabTextActive]}>
            Исполнители
          </ThemedText>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primary} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={styles.retryButton} onPress={refetch}>
            <ThemedText style={styles.retryText}>Повторить</ThemedText>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {activeTab === 'categories' && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: text }]}>
                Управление категориями
              </ThemedText>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: textMuted }]}>
                  Создать новую категорию
                </ThemedText>
                <View style={styles.row}>
                  <TextInput
                    style={[styles.input, { color: text }]}
                    placeholder="Название категории"
                    placeholderTextColor={textMuted}
                    value={newCategoryName}
                    onChangeText={setNewCategoryName}
                    editable={!isCreatingCategory}
                  />
                  <Pressable
                    style={[styles.primaryButton, (!newCategoryName.trim() || isCreatingCategory) && styles.buttonDisabled]}
                    onPress={handleCreateCategory}
                    disabled={!newCategoryName.trim() || isCreatingCategory}
                  >
                    {isCreatingCategory ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <ThemedText style={styles.primaryButtonText}>Создать</ThemedText>
                    )}
                  </Pressable>
                </View>
              </View>

              <View style={styles.warnBox}>
                <MaterialIcons name="warning-amber" size={20} color="#F59E0B" />
                <ThemedText style={styles.warnText}>
                  Категорию можно удалить только если в ней нет исполнителей.
                </ThemedText>
              </View>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: textMuted }]}>
                  Удалить категорию
                </ThemedText>
                <Pressable
                  style={styles.selectTrigger}
                  onPress={() => setShowCategoryDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: categoryForDeleteLabel ? text : textMuted }]}>
                    {categoryForDeleteLabel ?? 'Выберите категорию для удаления'}
                  </ThemedText>
                  <MaterialIcons
                    name={showCategoryDropdown ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={textMuted}
                  />
                </Pressable>
                {showCategoryDropdown && (
                  <View style={styles.dropdown}>
                    {categories.map((cat) => {
                      const hasExec = categoriesWithExecutors.has(cat.id);
                      return (
                        <Pressable
                          key={cat.id}
                          style={[styles.dropdownItem, cat.id === categoryToDelete && styles.dropdownItemActive]}
                          onPress={() => {
                            if (!hasExec) setCategoryToDelete(cat.id);
                          }}
                          disabled={hasExec}
                        >
                          <ThemedText style={[styles.dropdownItemText, hasExec && styles.dropdownItemDisabled]}>
                            {cat.name} {hasExec ? '(есть исполнители)' : ''}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
                <Pressable
                  style={[styles.dangerButton, (!canDeleteCategory || isDeletingCategory) && styles.buttonDisabled]}
                  onPress={handleDeleteCategory}
                  disabled={!canDeleteCategory || isDeletingCategory}
                >
                  {isDeletingCategory ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.dangerButtonText}>Удалить</ThemedText>
                  )}
                </Pressable>
              </View>
              {categoryError ? (
                <View style={styles.errorInline}>
                  <ThemedText style={styles.errorInlineText}>{categoryError}</ThemedText>
                </View>
              ) : null}
            </View>
          )}

          {activeTab === 'subcategories' && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: text }]}>
                Управление подкатегориями
              </ThemedText>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: textMuted }]}>
                  Создать новую подкатегорию
                </ThemedText>
                <Pressable
                  style={styles.selectTrigger}
                  onPress={() => setShowCategorySelectDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: selectedCategoryName ? text : textMuted }]}>
                    {selectedCategoryName ?? 'Выберите категорию'}
                  </ThemedText>
                  <MaterialIcons
                    name={showCategorySelectDropdown ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={textMuted}
                  />
                </Pressable>
                {showCategorySelectDropdown && (
                  <View style={styles.dropdown}>
                    {categories.map((cat) => (
                      <Pressable
                        key={cat.id}
                        style={[styles.dropdownItem, cat.id === selectedCategoryForSub && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedCategoryForSub(cat.id);
                          setShowCategorySelectDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>{cat.name}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  style={[styles.input, styles.inputFull, { color: text }]}
                  placeholder="Название подкатегории"
                  placeholderTextColor={textMuted}
                  value={newSubcategoryName}
                  onChangeText={setNewSubcategoryName}
                  editable={!isCreatingSubcategory}
                />
                <Pressable
                  style={[
                    styles.primaryButton,
                    styles.primaryButtonFull,
                    (!selectedCategoryForSub || !newSubcategoryName.trim() || isCreatingSubcategory) && styles.buttonDisabled,
                  ]}
                  onPress={handleCreateSubcategory}
                  disabled={!selectedCategoryForSub || !newSubcategoryName.trim() || isCreatingSubcategory}
                >
                  {isCreatingSubcategory ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Создать подкатегорию</ThemedText>
                  )}
                </Pressable>
              </View>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: textMuted }]}>
                  Удалить подкатегорию
                </ThemedText>
                <Pressable
                  style={styles.selectTrigger}
                  onPress={() => setShowSubcategoryDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: subcategoryForDeleteLabel ? text : textMuted }]}>
                    {subcategoryForDeleteLabel ?? 'Выберите подкатегорию для удаления'}
                  </ThemedText>
                  <MaterialIcons
                    name={showSubcategoryDropdown ? 'expand-less' : 'expand-more'}
                    size={22}
                    color={textMuted}
                  />
                </Pressable>
                {showSubcategoryDropdown && (
                  <View style={styles.dropdown}>
                    {allSubcategories.map((sub) => (
                      <Pressable
                        key={sub.id}
                        style={[styles.dropdownItem, sub.id === subcategoryToDelete && styles.dropdownItemActive]}
                        onPress={() => setSubcategoryToDelete(sub.id)}
                      >
                        <ThemedText style={styles.dropdownItemText}>
                          {sub.categoryName} → {sub.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Pressable
                  style={[styles.dangerButton, (!subcategoryToDelete || isDeletingSubcategory) && styles.buttonDisabled]}
                  onPress={handleDeleteSubcategory}
                  disabled={!subcategoryToDelete || isDeletingSubcategory}
                >
                  {isDeletingSubcategory ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.dangerButtonText}>Удалить</ThemedText>
                  )}
                </Pressable>
              </View>
              {subcategoryError ? (
                <View style={styles.errorInline}>
                  <ThemedText style={styles.errorInlineText}>{subcategoryError}</ThemedText>
                </View>
              ) : null}
            </View>
          )}

          {activeTab === 'executors' && (
            <View style={styles.section}>
              <ThemedText style={[styles.sectionTitle, { color: text }]}>
                Управление исполнителями
              </ThemedText>
              <ThemedText style={[styles.label, { color: textMuted }]}>
                Назначить исполнителя к категории
              </ThemedText>

              <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={20} color="#3B82F6" />
                <ThemedText style={styles.infoBoxText}>
                  Если в категории нет исполнителей, первый назначенный станет руководителем. Остальные — обычные исполнители.
                </ThemedText>
              </View>

              <ThemedText style={[styles.label, { color: textMuted }]}>Категория</ThemedText>
              <Pressable
                style={styles.selectTrigger}
                onPress={() => setShowCategoryAssignDropdown((v) => !v)}
              >
                <ThemedText style={[styles.selectTriggerText, { color: selectedCategoryForAssignName ? text : textMuted }]}>
                  {selectedCategoryForAssignName ?? 'Выберите категорию'}
                </ThemedText>
                <MaterialIcons
                  name={showCategoryAssignDropdown ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={textMuted}
                />
              </Pressable>
              {showCategoryAssignDropdown && (
                <View style={styles.dropdown}>
                  {categories.map((cat) => (
                    <Pressable
                      key={cat.id}
                      style={[styles.dropdownItem, cat.id === selectedCategoryForAssign && styles.dropdownItemActive]}
                      onPress={() => {
                        setSelectedCategoryForAssign(cat.id);
                        setShowCategoryAssignDropdown(false);
                      }}
                    >
                      <ThemedText style={styles.dropdownItemText}>{cat.name}</ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}

              <ThemedText style={[styles.label, { color: textMuted }]}>Исполнитель</ThemedText>
              <Pressable
                style={styles.selectTrigger}
                onPress={() => setShowExecutorAssignDropdown((v) => !v)}
              >
                <ThemedText style={[styles.selectTriggerText, { color: selectedExecutorForAssignName ? text : textMuted }]}>
                  {loadingAllExecutors ? 'Загрузка...' : selectedExecutorForAssignName ?? 'Выберите исполнителя'}
                </ThemedText>
                <MaterialIcons
                  name={showExecutorAssignDropdown ? 'expand-less' : 'expand-more'}
                  size={22}
                  color={textMuted}
                />
              </Pressable>
              {showExecutorAssignDropdown && (
                <View style={styles.dropdown}>
                  {allExecutors.length === 0 && !loadingAllExecutors ? (
                    <ThemedText style={[styles.dropdownItemText, styles.dropdownItemDisabled]}>
                      Нет доступных исполнителей
                    </ThemedText>
                  ) : (
                    allExecutors.map((ex) => (
                      <Pressable
                        key={ex.id}
                        style={[styles.dropdownItem, ex.id === selectedExecutorForAssign && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedExecutorForAssign(ex.id);
                          setShowExecutorAssignDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText} numberOfLines={1}>
                          {ex.user?.full_name ?? ''} {ex.specialty ? ` · ${ex.specialty}` : ''}
                        </ThemedText>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              <Pressable
                style={[
                  styles.primaryButton,
                  styles.primaryButtonFull,
                  (!selectedCategoryForAssign || !selectedExecutorForAssign || isAssigningExecutor) && styles.buttonDisabled,
                ]}
                onPress={handleAssignExecutorToCategory}
                disabled={!selectedCategoryForAssign || !selectedExecutorForAssign || isAssigningExecutor}
              >
                {isAssigningExecutor ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Назначить исполнителя</ThemedText>
                )}
              </Pressable>

              {executorManagementError ? (
                <View style={styles.errorInline}>
                  <ThemedText style={styles.errorInlineText}>{executorManagementError}</ThemedText>
                </View>
              ) : null}
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    marginBottom: 8,
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 16,
    color: '#E25B21',
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 8,
  },
  tabActive: {
    backgroundColor: '#E25B21',
  },
  tabText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  errorText: {
    color: '#FCA5A5',
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: '#E25B21',
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#3A3A3C',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  inputFull: {
    marginTop: 12,
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectTriggerText: {
    fontSize: 16,
  },
  dropdown: {
    backgroundColor: '#3A3A3C',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(226,91,33,0.3)',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#fff',
  },
  dropdownItemDisabled: {
    color: 'rgba(255,255,255,0.5)',
  },
  primaryButton: {
    backgroundColor: '#E25B21',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  primaryButtonFull: {
    marginTop: 12,
    minWidth: undefined,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  warnText: {
    fontSize: 13,
    color: '#FCD34D',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.4)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  infoBoxText: {
    fontSize: 13,
    color: '#93C5FD',
    flex: 1,
  },
  errorInline: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
    borderRadius: 10,
    padding: 12,
  },
  errorInlineText: {
    color: '#FCA5A5',
    fontSize: 14,
  },
});
