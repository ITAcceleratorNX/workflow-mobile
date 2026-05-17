import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  KeyboardFormOverlay,
  ScreenHeader,
  keyboardDismissInputProps,
} from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  changeUserPassword,
  deleteExecutor,
  getExecutorByUserId,
  getExecutors,
  getServiceCategories,
  getUsersForManagement,
  updateExecutor,
  updateUserProfile,
  updateUserRole,
  type ExecutorInCategory,
  type OfficeUser,
  type ServiceCategory,
} from '@/lib/api';
import { formatPhone } from '@/lib';
import { useAuthStore } from '@/stores/auth-store';

const ROLE_LABELS: Record<string, string> = {
  client: 'Клиент',
  executor: 'Исполнитель',
};

const OFFICE_STAFF_ROLES = ['client', 'executor'] as const;
type OfficeStaffRole = (typeof OFFICE_STAFF_ROLES)[number];

type RoleFilter = 'all' | OfficeStaffRole;
type SortOption = 'name-asc' | 'name-desc' | 'role';

const ROLE_FILTER_OPTIONS: { value: RoleFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'client', label: 'Клиенты' },
  { value: 'executor', label: 'Исполнители' },
];

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'А–Я' },
  { value: 'name-desc', label: 'Я–А' },
  { value: 'role', label: 'По роли' },
];

type OfficeUserRow = OfficeUser & { executor?: ExecutorInCategory };

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function userMatchesSearch(row: OfficeUserRow, query: string) {
  if (!query) return true;
  const haystack = [row.full_name, row.phone, row.executor?.specialty]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  const categoryNames = (row.executor?.serviceCategories ?? [])
    .map((c) => c.name)
    .join(' ')
    .toLowerCase();
  return `${haystack} ${categoryNames}`.includes(query);
}

export default function DepartmentHeadUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const role = useAuthStore((s) => s.role);
  const officeId = useAuthStore((s) => s.user?.office_id);

  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'cardBackground');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  const [users, setUsers] = useState<OfficeUserRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [categoryFilterId, setCategoryFilterId] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<OfficeUserRow | null>(null);

  const [selectedRole, setSelectedRole] = useState<OfficeStaffRole>('client');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [specialty, setSpecialty] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!officeId) {
      setUsers([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const [usersRes, execRes, catRes] = await Promise.all([
      getUsersForManagement({ officeId: String(officeId) }),
      getExecutors(),
      getServiceCategories(),
    ]);

    if (catRes.ok && catRes.data) setCategories(catRes.data);

    const executorByUserId = new Map<number, ExecutorInCategory>();
    if (execRes.ok) {
      for (const exec of execRes.data) {
        const uid = exec.user?.id;
        if (uid) executorByUserId.set(uid, exec);
      }
    }

    if (usersRes.ok) {
      const rows: OfficeUserRow[] = usersRes.data
        .filter((u) => OFFICE_STAFF_ROLES.includes(u.role as OfficeStaffRole))
        .map((u) => ({
          ...u,
          executor: executorByUserId.get(u.id),
        }));
      setUsers(rows);
    } else {
      setUsers([]);
      showToast({ title: usersRes.error, variant: 'destructive' });
    }
    setLoading(false);
    setRefreshing(false);
  }, [officeId, showToast]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
  }, [load]);

  useEffect(() => {
    if (role !== 'department-head') {
      router.back();
      return;
    }
    load();
  }, [role, load, router]);

  const stats = useMemo(() => {
    const clients = users.filter((u) => u.role === 'client').length;
    const executors = users.filter((u) => u.role === 'executor').length;
    return { total: users.length, clients, executors };
  }, [users]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 ||
    roleFilter !== 'all' ||
    categoryFilterId !== null;

  const filteredUsers = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    let list = users.filter((row) => {
      if (roleFilter !== 'all' && row.role !== roleFilter) return false;
      if (categoryFilterId != null) {
        if (row.role !== 'executor' || !row.executor) return false;
        const ids = row.executor.serviceCategories?.map((c) => c.id) ?? [];
        if (!ids.includes(categoryFilterId)) return false;
      }
      return userMatchesSearch(row, q);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'role') {
        const roleOrder = a.role === b.role ? 0 : a.role === 'client' ? -1 : 1;
        if (roleOrder !== 0) return roleOrder;
      }
      const cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'ru', {
        sensitivity: 'base',
      });
      return sortBy === 'name-desc' ? -cmp : cmp;
    });

    return list;
  }, [users, searchQuery, roleFilter, categoryFilterId, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setCategoryFilterId(null);
    setSortBy('name-asc');
  };

  const resetForm = () => {
    setEditingUser(null);
    setSelectedRole('client');
    setFullName('');
    setPhone('+7 ');
    setSpecialty('');
    setSelectedCategoryIds([]);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setFormOpen(false);
  };

  const applyExecutorFields = useCallback((executor: ExecutorInCategory) => {
    setSpecialty(executor.specialty?.trim() ?? '');
    setSelectedCategoryIds(executor.serviceCategories?.map((c) => c.id) ?? []);
    if (executor.user?.full_name) setFullName(executor.user.full_name);
    if (executor.user?.phone) setPhone(formatPhone(executor.user.phone));
  }, []);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(formatPhone(text));
  }, []);

  const openEdit = (row: OfficeUserRow) => {
    setEditingUser(row);
    setSelectedRole(
      row.role === 'executor' ? 'executor' : 'client'
    );
    setFullName(row.full_name ?? '');
    setPhone(formatPhone(row.phone ?? ''));
    setSpecialty(row.executor?.specialty?.trim() ?? '');
    setSelectedCategoryIds(
      row.executor?.serviceCategories?.map((c) => c.id) ?? []
    );
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setFormOpen(true);
  };

  useEffect(() => {
    if (!editingUser || selectedRole !== 'executor' || !formOpen) return;
    if (editingUser.executor) {
      applyExecutorFields(editingUser.executor);
      return;
    }
    if (editingUser.role !== 'executor') {
      setSpecialty('');
      setSelectedCategoryIds([]);
      return;
    }
    let cancelled = false;
    void getExecutorByUserId(editingUser.id).then((res) => {
      if (cancelled || !res.ok) return;
      applyExecutorFields(res.data);
      setUsers((prev) =>
        prev.map((u) =>
          u.id === editingUser.id ? { ...u, executor: res.data } : u
        )
      );
      setEditingUser((prev) => (prev ? { ...prev, executor: res.data } : prev));
    });
    return () => {
      cancelled = true;
    };
  }, [editingUser?.id, editingUser?.role, selectedRole, formOpen, applyExecutorFields]);

  const selectRole = (r: OfficeStaffRole) => {
    setSelectedRole(r);
    if (r === 'executor' && editingUser) {
      if (editingUser.executor) {
        applyExecutorFields(editingUser.executor);
      } else if (editingUser.role !== 'executor') {
        setSpecialty('');
        setSelectedCategoryIds([]);
      }
    }
  };

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const isExecutorForm = selectedRole === 'executor';

  const initialRole = editingUser?.role as OfficeStaffRole | undefined;

  const handleSave = async () => {
    if (!editingUser) return;

    setPasswordError(null);

    const passwordFilled = newPassword.trim().length > 0;
    if (passwordFilled) {
      if (newPassword !== confirmPassword) {
        setPasswordError('Пароли не совпадают');
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError('Пароль должен содержать минимум 6 символов');
        return;
      }
    }

    const basicProfileChanged =
      fullName.trim() !== (editingUser.full_name ?? '').trim() ||
      phone !== formatPhone(editingUser.phone ?? '');

    if (!fullName.trim()) {
      showToast({ title: 'Укажите ФИО', variant: 'destructive' });
      return;
    }

    if (isExecutorForm) {
      if (!specialty.trim() || selectedCategoryIds.length === 0) {
        showToast({
          title: 'Укажите специальность и хотя бы одну категорию',
          variant: 'destructive',
        });
        return;
      }
    }

    const roleChanged = initialRole !== selectedRole;
    const promotingToExecutor = roleChanged && selectedRole === 'executor';
    const demotingToClient = roleChanged && selectedRole === 'client';
    const needsUserProfileUpdate = basicProfileChanged && !isExecutorForm;

    if (
      !passwordFilled &&
      !roleChanged &&
      !needsUserProfileUpdate &&
      !(isExecutorForm && editingUser.executor && !demotingToClient)
    ) {
      const executorOnlyProfileChange =
        isExecutorForm &&
        editingUser.executor &&
        !demotingToClient &&
        basicProfileChanged;
      if (!executorOnlyProfileChange) {
        showToast({ title: 'Нет изменений', variant: 'default' });
        return;
      }
    }

    setSaving(true);

    if (passwordFilled) {
      const pwdRes = await changeUserPassword(editingUser.id, newPassword);
      if (!pwdRes.ok) {
        setSaving(false);
        setPasswordError(pwdRes.error);
        return;
      }
    }

    if (roleChanged) {
      const roleRes = await updateUserRole(editingUser.id, selectedRole, {
        category_ids: promotingToExecutor ? selectedCategoryIds : undefined,
        specialty: promotingToExecutor ? specialty.trim() : undefined,
      });
      if (!roleRes.ok) {
        setSaving(false);
        showToast({ title: roleRes.error, variant: 'destructive' });
        return;
      }
    }

    if (needsUserProfileUpdate) {
      const profileRes = await updateUserProfile(editingUser.id, {
        full_name: fullName.trim(),
        phone,
      });
      if (!profileRes.ok) {
        setSaving(false);
        showToast({ title: profileRes.error, variant: 'destructive' });
        return;
      }
    }

    if (isExecutorForm && !demotingToClient) {
      let executorId = editingUser.executor?.id;
      if (!executorId && promotingToExecutor) {
        const execListRes = await getExecutors();
        if (execListRes.ok) {
          executorId = execListRes.data.find((e) => e.user?.id === editingUser.id)?.id;
        }
      }
      if (executorId) {
        const execRes = await updateExecutor(executorId, {
          full_name: fullName.trim(),
          phone,
          specialty: specialty.trim(),
          category_ids: selectedCategoryIds,
        });
        if (!execRes.ok) {
          setSaving(false);
          showToast({ title: execRes.error, variant: 'destructive' });
          return;
        }
      }
    }

    setSaving(false);
    showToast({ title: 'Изменения сохранены', variant: 'success' });
    resetForm();
    load();
  };

  const handleDelete = (row: OfficeUserRow) => {
    if (!row.executor) return;
    Alert.alert(
      'Удалить исполнителя?',
      row.full_name ?? '',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteExecutor(row.executor!.id);
            if (res.ok) {
              showToast({ title: 'Исполнитель удалён', variant: 'success' });
              load();
            } else {
              showToast({ title: res.error, variant: 'destructive' });
            }
          },
        },
      ]
    );
  };

  const roleBadgeColor = useMemo(
    () => ({
      client: muted,
      executor: primary,
    }),
    [muted, primary]
  );

  if (role !== 'department-head') {
    return null;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Пользователи" onBack={() => router.back()} />

      {loading && !refreshing ? (
        <ActivityIndicator style={styles.loader} color={primary} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
          }
        >
          <View style={[styles.statsRow, { backgroundColor: surfaceMuted, borderColor: border }]}>
            <ThemedText style={[styles.statsText, { color: muted }]}>
              {stats.total} {stats.total === 1 ? 'пользователь' : stats.total < 5 ? 'пользователя' : 'пользователей'}
              {' · '}
              {stats.clients} {stats.clients === 1 ? 'клиент' : stats.clients < 5 ? 'клиента' : 'клиентов'}
              {' · '}
              {stats.executors}{' '}
              {stats.executors === 1 ? 'исполнитель' : stats.executors < 5 ? 'исполнителя' : 'исполнителей'}
            </ThemedText>
          </View>

          <View style={[styles.searchWrap, { borderColor: border, backgroundColor: card }]}>
            <MaterialIcons name="search" size={22} color={muted} style={styles.searchIcon} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Поиск по имени, телефону, специальности…"
              placeholderTextColor={muted}
              style={[styles.searchInput, { color: text }]}
              autoCorrect={false}
              clearButtonMode="while-editing"
            />
            {searchQuery.length > 0 ? (
              <Pressable onPress={() => setSearchQuery('')} hitSlop={8} style={styles.searchClear}>
                <MaterialIcons name="close" size={20} color={muted} />
              </Pressable>
            ) : null}
          </View>

          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterPillsScroll}
            contentContainerStyle={styles.filterPillsContent}
            keyboardShouldPersistTaps="handled"
          >
            {ROLE_FILTER_OPTIONS.map((opt) => {
              const active = roleFilter === opt.value;
              const count =
                opt.value === 'all'
                  ? stats.total
                  : opt.value === 'client'
                    ? stats.clients
                    : stats.executors;
              return (
                <Pressable
                  key={opt.value}
                  onPress={() => setRoleFilter(opt.value)}
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
          </ScrollView>

          {categories.length > 0 ? (
            <>
              <ThemedText style={[styles.filterSectionLabel, { color: muted }]}>
                Категория услуг
              </ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.filterPillsScroll}
                contentContainerStyle={styles.filterPillsContent}
                keyboardShouldPersistTaps="handled"
              >
                <Pressable
                  onPress={() => setCategoryFilterId(null)}
                  style={[
                    styles.pill,
                    { borderColor: border },
                    categoryFilterId === null && {
                      backgroundColor: `${primary}22`,
                      borderColor: primary,
                    },
                  ]}
                >
                  <ThemedText
                    style={{
                      color: categoryFilterId === null ? primary : text,
                      fontSize: 13,
                      fontWeight: '600',
                    }}
                  >
                    Все категории
                  </ThemedText>
                </Pressable>
                {categories.map((c) => {
                  const active = categoryFilterId === c.id;
                  return (
                    <Pressable
                      key={c.id}
                      onPress={() => setCategoryFilterId(active ? null : c.id)}
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
                        numberOfLines={1}
                      >
                        {c.name}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </>
          ) : null}

          <View style={styles.sortRow}>
            <ThemedText style={[styles.filterSectionLabel, { color: muted, marginBottom: 0 }]}>
              Сортировка
            </ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.sortPillsContent}
            >
              {SORT_OPTIONS.map((opt) => {
                const active = sortBy === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => setSortBy(opt.value)}
                    style={[
                      styles.sortPill,
                      { borderColor: border },
                      active && { backgroundColor: primary, borderColor: primary },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: active ? '#fff' : text,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {opt.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          {hasActiveFilters ? (
            <View style={styles.resultsBar}>
              <ThemedText style={{ color: muted, fontSize: 13, flex: 1 }}>
                Найдено: {filteredUsers.length}
                {filteredUsers.length !== users.length ? ` из ${users.length}` : ''}
              </ThemedText>
              <Pressable onPress={clearFilters} hitSlop={8}>
                <ThemedText style={{ color: primary, fontSize: 13, fontWeight: '600' }}>
                  Сбросить
                </ThemedText>
              </Pressable>
            </View>
          ) : null}

          {users.length === 0 ? (
            <View style={styles.emptyBlock}>
              <MaterialIcons name="people-outline" size={48} color={muted} />
              <ThemedText style={[styles.emptyTitle, { color: text }]}>
                Пользователей пока нет
              </ThemedText>
              <ThemedText style={[styles.emptyHint, { color: muted }]}>
                Клиенты и исполнители вашего офиса появятся здесь после регистрации
              </ThemedText>
            </View>
          ) : filteredUsers.length === 0 ? (
            <View style={styles.emptyBlock}>
              <MaterialIcons name="filter-list-off" size={48} color={muted} />
              <ThemedText style={[styles.emptyTitle, { color: text }]}>
                Никого не найдено
              </ThemedText>
              <ThemedText style={[styles.emptyHint, { color: muted }]}>
                Измените поиск или сбросьте фильтры
              </ThemedText>
              <Pressable
                onPress={clearFilters}
                style={[styles.emptyResetBtn, { borderColor: primary }]}
              >
                <ThemedText style={{ color: primary, fontWeight: '600' }}>Сбросить фильтры</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {filteredUsers.map((row) => (
            <Pressable
              key={row.id}
              onPress={() => openEdit(row)}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: card, borderColor: border },
                pressed && { opacity: 0.92 },
              ]}
            >
              <View style={styles.cardHeader}>
                <View style={styles.cardTitleWrap}>
                  <ThemedText style={[styles.name, { color: text }]}>
                    {row.full_name || `Пользователь #${row.id}`}
                  </ThemedText>
                  <View
                    style={[
                      styles.roleBadge,
                      {
                        borderColor: row.role === 'executor' ? primary : border,
                        backgroundColor:
                          row.role === 'executor' ? `${primary}14` : 'transparent',
                      },
                    ]}
                  >
                    <ThemedText
                      style={{
                        color: roleBadgeColor[row.role as OfficeStaffRole] ?? muted,
                        fontSize: 12,
                        fontWeight: '600',
                      }}
                    >
                      {ROLE_LABELS[row.role] ?? row.role}
                    </ThemedText>
                  </View>
                </View>
                <View style={styles.cardActions}>
                  <MaterialIcons name="chevron-right" size={24} color={muted} />
                  {row.executor ? (
                    <Pressable
                      onPress={() => handleDelete(row)}
                      hitSlop={8}
                      style={styles.deleteBtn}
                    >
                      <MaterialIcons name="delete-outline" size={22} color="#c62828" />
                    </Pressable>
                  ) : null}
                </View>
              </View>
              {row.phone ? (
                <View style={styles.metaRow}>
                  <MaterialIcons name="phone" size={16} color={muted} />
                  <ThemedText style={{ color: muted, fontSize: 14 }}>{row.phone}</ThemedText>
                </View>
              ) : null}
              {row.executor?.specialty ? (
                <View style={styles.metaRow}>
                  <MaterialIcons name="work-outline" size={16} color={muted} />
                  <ThemedText style={[styles.specialty, { color: text }]}>
                    {row.executor.specialty}
                  </ThemedText>
                </View>
              ) : null}
              {(row.executor?.serviceCategories ?? []).length > 0 ? (
                <View style={styles.categoryTags}>
                  {(row.executor?.serviceCategories ?? []).map((c) => (
                    <View
                      key={c.id}
                      style={[styles.categoryTag, { borderColor: border, backgroundColor: surfaceMuted }]}
                    >
                      <ThemedText style={{ color: muted, fontSize: 12 }}>{c.name}</ThemedText>
                    </View>
                  ))}
                </View>
              ) : null}
            </Pressable>
          ))}
        </ScrollView>
      )}

      <KeyboardFormOverlay
        visible={formOpen && !!editingUser}
        backgroundColor="rgba(0,0,0,0.45)"
      >
        {editingUser ? (
            <View style={[styles.formCard, { backgroundColor: card }]}>
              <ThemedText type="subtitle" style={{ color: text, marginBottom: 12 }}>
                Редактировать
              </ThemedText>

              <ThemedText style={[styles.label, { color: muted }]}>Роль</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.modalPillsScroll}
                contentContainerStyle={styles.filterPillsContent}
                keyboardShouldPersistTaps="handled"
              >
                {OFFICE_STAFF_ROLES.map((r) => {
                  const active = selectedRole === r;
                  return (
                    <Pressable
                      key={r}
                      onPress={() => selectRole(r)}
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
                        {ROLE_LABELS[r]}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <ThemedText style={[styles.label, { color: muted }]}>Новый пароль</ThemedText>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                style={[styles.input, { color: text, borderColor: border }]}
                placeholder="Оставьте пустым, если не меняете"
                placeholderTextColor={muted}
                secureTextEntry
                {...keyboardDismissInputProps()}
              />
              <ThemedText style={[styles.label, { color: muted }]}>
                Подтверждение пароля
              </ThemedText>
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                style={[styles.input, { color: text, borderColor: border }]}
                placeholder="Повторите пароль"
                placeholderTextColor={muted}
                secureTextEntry
                {...keyboardDismissInputProps()}
              />
              {passwordError ? (
                <ThemedText style={styles.errorText}>{passwordError}</ThemedText>
              ) : null}

              <ThemedText style={[styles.label, { color: muted }]}>ФИО</ThemedText>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={[styles.input, { color: text, borderColor: border }]}
                placeholder="Иванов Иван"
                placeholderTextColor={muted}
                {...keyboardDismissInputProps()}
              />
              <ThemedText style={[styles.label, { color: muted }]}>Телефон</ThemedText>
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                style={[styles.input, { color: text, borderColor: border }]}
                placeholder="+7 XXX XXX XX XX"
                placeholderTextColor={muted}
                keyboardType="phone-pad"
                maxLength={19}
                {...keyboardDismissInputProps({ numericKeyboard: true })}
              />

              {isExecutorForm ? (
                <>
                  <ThemedText style={[styles.label, { color: muted }]}>Специальность</ThemedText>
                  <TextInput
                    value={specialty}
                    onChangeText={setSpecialty}
                    style={[styles.input, { color: text, borderColor: border }]}
                    placeholder="Например: электрик"
                    placeholderTextColor={muted}
                    {...keyboardDismissInputProps()}
                  />
                  <ThemedText style={[styles.label, { color: muted }]}>
                    Категории услуг
                  </ThemedText>
                  <View style={styles.chips}>
                    {categories.map((c) => {
                      const active = selectedCategoryIds.includes(c.id);
                      return (
                        <Pressable
                          key={c.id}
                          onPress={() => toggleCategory(c.id)}
                          style={[
                            styles.chip,
                            { borderColor: border },
                            active && { backgroundColor: primary, borderColor: primary },
                          ]}
                        >
                          <ThemedText style={{ color: active ? '#fff' : text, fontSize: 13 }}>
                            {c.name}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}

              <View style={styles.formActions}>
                <Pressable onPress={resetForm} style={[styles.formBtn, { borderColor: border }]}>
                  <ThemedText style={{ color: text }}>Отмена</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSave}
                  disabled={saving}
                  style={[styles.formBtn, { backgroundColor: primary, borderColor: primary }]}
                >
                  {saving ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Сохранить</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
        ) : null}
      </KeyboardFormOverlay>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 12 },
  statsRow: {
    borderWidth: 1,
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
    paddingHorizontal: 10,
    minHeight: 44,
  },
  searchIcon: { marginRight: 4 },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 8 },
  searchClear: { padding: 4 },
  filterPillsScroll: { marginHorizontal: -16, flexGrow: 0 },
  filterPillsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  filterSectionLabel: { fontSize: 12, fontWeight: '600', marginBottom: -4, textTransform: 'uppercase' },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  sortRow: { gap: 8 },
  sortPillsContent: { gap: 8, flexDirection: 'row' },
  sortPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resultsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  emptyBlock: { alignItems: 'center', paddingVertical: 32, gap: 8, paddingHorizontal: 16 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 8 },
  emptyHint: { fontSize: 14, textAlign: 'center', lineHeight: 20 },
  emptyResetBtn: {
    marginTop: 12,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 8 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  cardTitleWrap: { flex: 1, gap: 6, paddingRight: 8 },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  deleteBtn: { marginRight: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  categoryTags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 2 },
  categoryTag: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  name: { fontSize: 16, fontWeight: '600' },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  specialty: { fontSize: 14 },
  categories: { fontSize: 13 },
  formCard: { borderRadius: 16, padding: 20 },
  label: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  errorText: { color: '#c62828', fontSize: 13, marginTop: 4 },
  modalPillsScroll: { marginHorizontal: -4, flexGrow: 0, marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  formBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
});
