import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  KeyboardFormOverlay,
  PageLoader,
  keyboardDismissInputProps,
} from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  changeCategoryHead,
  changeUserPassword,
  getExecutorByUserId,
  getExecutors,
  getExecutorsByCategory,
  getUsersForManagement,
  updateExecutor,
  updateUserProfile,
  updateUserRole,
  type ExecutorInCategory,
  type Office,
  type OfficeUser,
  type ServiceCategory,
} from '@/lib/api';
import { formatPhone } from '@/lib';
import { useAuthStore } from '@/stores/auth-store';

const ROLE_LABELS: Record<string, string> = {
  client: 'Клиент',
  'admin-worker': 'Администратор офиса',
  'department-head': 'Офис-менеджер',
  executor: 'Исполнитель',
  manager: 'Руководитель',
};

const ROLE_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'Все роли' },
  ...Object.entries(ROLE_LABELS).map(([value, label]) => ({ value, label })),
];

type SortOption = 'name-asc' | 'name-desc' | 'role';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name-asc', label: 'А–Я' },
  { value: 'name-desc', label: 'Я–А' },
  { value: 'role', label: 'По роли' },
];

function normalizeSearchText(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

function userMatchesSearch(user: OfficeUser, query: string) {
  if (!query) return true;
  const haystack = [user.full_name, user.phone, ROLE_LABELS[user.role], user.office?.name]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

type Props = {
  offices: Office[];
  categories: ServiceCategory[];
  isActive: boolean;
};

function applyExecutorToForm(
  executor: ExecutorInCategory,
  setters: {
    setSpecialty: (v: string) => void;
    setSelectedCategoryIds: (v: number[]) => void;
    setFullName?: (v: string) => void;
    setPhone?: (v: string) => void;
  }
) {
  setters.setSpecialty(executor.specialty?.trim() ?? '');
  setters.setSelectedCategoryIds(executor.serviceCategories?.map((c) => c.id) ?? []);
  if (setters.setFullName && executor.user?.full_name) {
    setters.setFullName(executor.user.full_name);
  }
  if (setters.setPhone && executor.user?.phone) {
    setters.setPhone(formatPhone(executor.user.phone));
  }
}

export function AdminUserManagementTab({ offices, categories, isActive }: Props) {
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const authOfficeId = useAuthStore((s) => s.user?.office_id);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const screenBg = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'border');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const danger = useThemeColor({}, 'danger');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [officeFilterId, setOfficeFilterId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortBy, setSortBy] = useState<SortOption>('name-asc');

  const [executorByUserId, setExecutorByUserId] = useState<Record<number, ExecutorInCategory>>({});
  const [editUser, setEditUser] = useState<OfficeUser | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [newRole, setNewRole] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [specialty, setSpecialty] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [executors, setExecutors] = useState<ExecutorInCategory[]>([]);
  const [selectedExecutorId, setSelectedExecutorId] = useState<number | null>(null);
  const [isLoadingExecutors, setIsLoadingExecutors] = useState(false);
  const [isChangingHead, setIsChangingHead] = useState(false);
  const [changeHeadError, setChangeHeadError] = useState<string | null>(null);
  const [showCategoryHeadPanel, setShowCategoryHeadPanel] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    const officeIdNum = officeFilterId
      ? Number(officeFilterId)
      : authOfficeId
        ? Number(authOfficeId)
        : undefined;
    const [usersRes, execRes] = await Promise.all([
      getUsersForManagement({ officeId: officeFilterId || undefined }),
      getExecutors(undefined, officeIdNum),
    ]);

    if (execRes.ok) {
      const map: Record<number, ExecutorInCategory> = {};
      for (const exec of execRes.data) {
        const uid = exec.user?.id;
        if (uid) map[uid] = exec;
      }
      setExecutorByUserId(map);
    } else {
      setExecutorByUserId({});
    }

    if (usersRes.ok) setOfficeUsers(usersRes.data);
    else {
      setOfficeUsers([]);
      showToast({ title: 'Ошибка', description: usersRes.error, variant: 'destructive', duration: 4000 });
    }
    setLoading(false);
    setRefreshing(false);
  }, [officeFilterId, authOfficeId, showToast]);

  useEffect(() => {
    if (!editUser || newRole !== 'executor') return;

    const cached = executorByUserId[editUser.id];
    if (cached) {
      applyExecutorToForm(cached, { setSpecialty, setSelectedCategoryIds, setFullName, setPhone });
      return;
    }

    // Клиент ещё не исполнитель в БД — не запрашиваем /executors/:id/user (вернёт 404)
    if (editUser.role !== 'executor') {
      setSpecialty('');
      setSelectedCategoryIds([]);
      return;
    }

    let cancelled = false;
    void getExecutorByUserId(editUser.id).then((res) => {
      if (cancelled || !res.ok) return;
      setExecutorByUserId((prev) => ({ ...prev, [editUser.id]: res.data }));
      applyExecutorToForm(res.data, { setSpecialty, setSelectedCategoryIds, setFullName, setPhone });
    });

    return () => {
      cancelled = true;
    };
  }, [editUser?.id, editUser?.role, newRole]);

  useEffect(() => {
    if (!isActive) return;
    loadUsers();
  }, [isActive, loadUsers]);

  useEffect(() => {
    if (!selectedCategoryId) {
      setExecutors([]);
      setSelectedExecutorId(null);
      return;
    }
    setIsLoadingExecutors(true);
    setChangeHeadError(null);
    getExecutorsByCategory(selectedCategoryId).then((res) => {
      if (res.ok) {
        setExecutors(res.data.filter((e) => e.user?.role === 'executor'));
      } else {
        setExecutors([]);
        setChangeHeadError('Не удалось загрузить исполнителей');
      }
      setIsLoadingExecutors(false);
    });
  }, [selectedCategoryId]);

  const stats = useMemo(() => {
    const byRole: Record<string, number> = {};
    for (const u of officeUsers) {
      byRole[u.role] = (byRole[u.role] ?? 0) + 1;
    }
    return { total: officeUsers.length, byRole };
  }, [officeUsers]);

  const hasActiveFilters =
    searchQuery.trim().length > 0 || roleFilter !== 'all' || officeFilterId !== '';

  const filteredUsers = useMemo(() => {
    const q = normalizeSearchText(searchQuery);
    let list = officeUsers.filter((u) => {
      if (roleFilter !== 'all' && u.role !== roleFilter) return false;
      return userMatchesSearch(u, q);
    });

    list = [...list].sort((a, b) => {
      if (sortBy === 'role') {
        const cmpRole = (ROLE_LABELS[a.role] ?? a.role).localeCompare(
          ROLE_LABELS[b.role] ?? b.role,
          'ru'
        );
        if (cmpRole !== 0) return cmpRole;
      }
      const cmp = (a.full_name ?? '').localeCompare(b.full_name ?? '', 'ru', {
        sensitivity: 'base',
      });
      return sortBy === 'name-desc' ? -cmp : cmp;
    });

    return list;
  }, [officeUsers, searchQuery, roleFilter, sortBy]);

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setOfficeFilterId('');
    setSortBy('name-asc');
  };

  const modalCategories = useMemo(() => {
    if (!editUser?.office_id) return categories;
    return categories.filter(
      (c) => !c.office_id || Number(c.office_id) === Number(editUser.office_id)
    );
  }, [categories, editUser]);

  const isExecutorForm = newRole === 'executor';
  const editingExecutor = editUser ? executorByUserId[editUser.id] : undefined;

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectRole = (roleId: string) => {
    setNewRole(roleId);
    if (roleId === 'executor' && editUser) {
      const executor = executorByUserId[editUser.id];
      if (executor) {
        applyExecutorToForm(executor, { setSpecialty, setSelectedCategoryIds, setFullName, setPhone });
      } else if (editUser.role !== 'executor') {
        setSpecialty('');
        setSelectedCategoryIds([]);
      }
    }
  };

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(formatPhone(text));
  }, []);

  const openEdit = (user: OfficeUser) => {
    const executor = executorByUserId[user.id];
    setEditUser(user);
    setNewRole(user.role);
    setFullName(user.full_name ?? '');
    setPhone(formatPhone(user.phone ?? ''));
    setSpecialty(executor?.specialty?.trim() ?? '');
    setSelectedCategoryIds(executor?.serviceCategories?.map((c) => c.id) ?? []);
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setRoleError(null);
  };

  const closeEdit = () => {
    setEditUser(null);
    setNewPassword('');
    setConfirmPassword('');
    setFullName('');
    setPhone('+7 ');
    setSpecialty('');
    setSelectedCategoryIds([]);
    setPasswordError(null);
    setRoleError(null);
  };

  const handleSaveUser = async () => {
    if (!editUser) return;
    setPasswordError(null);
    setRoleError(null);

    const passwordFilled = newPassword.trim().length > 0;
    if (passwordFilled) {
      if (newPassword !== confirmPassword) {
        setPasswordError('Пароли не совпадают');
        return;
      }
      if (newPassword.length < 6) {
        setPasswordError('Минимум 6 символов');
        return;
      }
    }

    const basicProfileChanged =
      fullName.trim() !== (editUser.full_name ?? '').trim() ||
      phone !== formatPhone(editUser.phone ?? '');

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

    const initialRole = editUser.role;
    const roleChanged = newRole && newRole !== initialRole;
    const promotingToExecutor = roleChanged && newRole === 'executor';
    const demotingFromExecutor = roleChanged && initialRole === 'executor' && newRole !== 'executor';

    const useExecutorApiForProfile =
      isExecutorForm && !demotingFromExecutor && (!!editingExecutor || promotingToExecutor);

    const executorFieldsChanged =
      useExecutorApiForProfile &&
      editingExecutor &&
      (specialty.trim() !== (editingExecutor.specialty ?? '').trim() ||
        JSON.stringify([...selectedCategoryIds].sort()) !==
          JSON.stringify(
            (editingExecutor.serviceCategories?.map((c) => c.id) ?? []).sort()
          ) ||
        basicProfileChanged);

    const needsUserProfileUpdate = basicProfileChanged && !useExecutorApiForProfile;

    if (!passwordFilled && !roleChanged && !needsUserProfileUpdate && !executorFieldsChanged && !promotingToExecutor) {
      showToast({ title: 'Нет изменений', variant: 'default' });
      return;
    }

    setSaving(true);

    if (passwordFilled) {
      const pwdRes = await changeUserPassword(editUser.id, newPassword);
      if (!pwdRes.ok) {
        setSaving(false);
        setPasswordError(pwdRes.error);
        return;
      }
    }

    if (roleChanged) {
      const roleRes = await updateUserRole(editUser.id, newRole, {
        category_ids: promotingToExecutor ? selectedCategoryIds : undefined,
        specialty: promotingToExecutor ? specialty.trim() : undefined,
      });
      if (!roleRes.ok) {
        setSaving(false);
        setRoleError(roleRes.error);
        return;
      }
      setOfficeUsers((prev) =>
        prev.map((u) => (u.id === editUser.id ? { ...u, role: newRole } : u))
      );
    }

    if (needsUserProfileUpdate) {
      const profileRes = await updateUserProfile(editUser.id, {
        full_name: fullName.trim(),
        phone,
      });
      if (!profileRes.ok) {
        setSaving(false);
        setRoleError(profileRes.error);
        return;
      }
      setOfficeUsers((prev) =>
        prev.map((u) =>
          u.id === editUser.id ? { ...u, full_name: fullName.trim(), phone } : u
        )
      );
    }

    let executorRecord = editingExecutor;
    if (promotingToExecutor && !executorRecord) {
      const execRes = await getExecutors(undefined, editUser.office_id);
      if (execRes.ok) {
        executorRecord = execRes.data.find((e) => e.user?.id === editUser.id);
      }
    }

    if (useExecutorApiForProfile && executorRecord) {
      const execRes = await updateExecutor(executorRecord.id, {
        full_name: fullName.trim(),
        phone,
        specialty: specialty.trim(),
        category_ids: selectedCategoryIds,
      });
      if (!execRes.ok) {
        setSaving(false);
        setRoleError(execRes.error);
        return;
      }
    }

    setSaving(false);
    showToast({ title: 'Сохранено', variant: 'success' });
    closeEdit();
    loadUsers();
  };

  const handleChangeCategoryHead = async () => {
    if (!selectedCategoryId || !selectedExecutorId) return;
    setChangeHeadError(null);
    setIsChangingHead(true);
    const result = await changeCategoryHead(selectedCategoryId, selectedExecutorId);
    if (result.ok) {
      const msg = result.data?.newHead?.name
        ? `Новый руководитель: ${result.data.newHead.name}`
        : 'Руководитель изменён';
      showToast({ title: 'Готово', description: msg, variant: 'success' });
      setSelectedCategoryId(null);
      setSelectedExecutorId(null);
      setExecutors([]);
    } else {
      setChangeHeadError(result.error);
    }
    setIsChangingHead(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadUsers();
  };

  return (
    <>
      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={primary} />
        }
      >
        <View style={[styles.statsRow, { backgroundColor: surfaceMuted, borderColor: border }]}>
          <ThemedText style={[styles.statsText, { color: textMuted }]}>
            {stats.total}{' '}
            {stats.total === 1 ? 'пользователь' : stats.total < 5 ? 'пользователя' : 'пользователей'}
            {officeFilterId
              ? ` · ${offices.find((o) => String(o.id) === officeFilterId)?.name ?? 'офис'}`
              : ' · все офисы'}
          </ThemedText>
        </View>

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Офис</ThemedText>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          <Pressable
            onPress={() => setOfficeFilterId('')}
            style={[
              styles.pill,
              { borderColor: border },
              !officeFilterId && { backgroundColor: `${primary}22`, borderColor: primary },
            ]}
          >
            <ThemedText
              style={{ color: !officeFilterId ? primary : text, fontSize: 13, fontWeight: '600' }}
            >
              Все офисы
            </ThemedText>
          </Pressable>
          {offices.map((o) => {
            const active = officeFilterId === String(o.id);
            return (
              <Pressable
                key={o.id}
                onPress={() => setOfficeFilterId(active ? '' : String(o.id))}
                style={[
                  styles.pill,
                  { borderColor: border },
                  active && { backgroundColor: `${primary}22`, borderColor: primary },
                ]}
              >
                <ThemedText
                  style={{ color: active ? primary : text, fontSize: 13, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {o.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={[styles.searchWrap, { borderColor: border, backgroundColor: surfaceElevated }]}>
          <MaterialIcons name="search" size={22} color={textMuted} />
          <TextInput
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Поиск по имени, телефону, роли…"
            placeholderTextColor={textMuted}
            style={[styles.searchInput, { color: text }]}
            autoCorrect={false}
            clearButtonMode="while-editing"
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.pillsScroll}
          contentContainerStyle={styles.pillsContent}
        >
          {ROLE_FILTER_OPTIONS.map((opt) => {
            const active = roleFilter === opt.value;
            const count =
              opt.value === 'all' ? stats.total : stats.byRole[opt.value] ?? 0;
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
                  style={{ color: active ? primary : text, fontSize: 13, fontWeight: '600' }}
                >
                  {opt.label}
                  {count > 0 ? ` (${count})` : ''}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>

        <View style={styles.sortRow}>
          <ThemedText style={[styles.sectionLabel, { color: textMuted, marginBottom: 0 }]}>
            Сортировка
          </ThemedText>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortPills}>
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
                  <ThemedText style={{ color: active ? '#fff' : text, fontSize: 12, fontWeight: '600' }}>
                    {opt.label}
                  </ThemedText>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {hasActiveFilters ? (
          <View style={styles.resultsBar}>
            <ThemedText style={{ color: textMuted, fontSize: 13, flex: 1 }}>
              Найдено: {filteredUsers.length}
              {filteredUsers.length !== officeUsers.length ? ` из ${officeUsers.length}` : ''}
            </ThemedText>
            <Pressable onPress={clearFilters} hitSlop={8}>
              <ThemedText style={{ color: primary, fontSize: 13, fontWeight: '600' }}>Сбросить</ThemedText>
            </Pressable>
          </View>
        ) : null}

        {loading && !refreshing ? (
          <View style={styles.loadingBox}>
            <PageLoader size={64} />
            <ThemedText style={{ color: textMuted }}>Загрузка…</ThemedText>
          </View>
        ) : officeUsers.length === 0 ? (
          <View style={styles.emptyBlock}>
            <MaterialIcons name="people-outline" size={48} color={textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: text }]}>Пользователей нет</ThemedText>
          </View>
        ) : filteredUsers.length === 0 ? (
          <View style={styles.emptyBlock}>
            <MaterialIcons name="filter-list-off" size={48} color={textMuted} />
            <ThemedText style={[styles.emptyTitle, { color: text }]}>Никого не найдено</ThemedText>
            <Pressable onPress={clearFilters} style={[styles.emptyBtn, { borderColor: primary }]}>
              <ThemedText style={{ color: primary, fontWeight: '600' }}>Сбросить фильтры</ThemedText>
            </Pressable>
          </View>
        ) : (
          <View style={styles.userList}>
            {filteredUsers.map((user) => (
              <Pressable
                key={user.id}
                onPress={() => openEdit(user)}
                style={({ pressed }) => [
                  styles.userCard,
                  { backgroundColor: surfaceElevated, borderColor: border },
                  pressed && { opacity: 0.92 },
                ]}
              >
                <View style={styles.userCardTop}>
                  <View style={styles.userCardMain}>
                    <ThemedText style={[styles.userName, { color: text }]} numberOfLines={2}>
                      {user.full_name}
                    </ThemedText>
                    <View style={[styles.roleBadge, { borderColor: border, backgroundColor: accentSoft }]}>
                      <ThemedText style={{ color: primary, fontSize: 11, fontWeight: '600' }}>
                        {ROLE_LABELS[user.role] ?? user.role}
                      </ThemedText>
                    </View>
                  </View>
                  <MaterialIcons name="chevron-right" size={24} color={textMuted} />
                </View>
                {user.phone ? (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="phone" size={15} color={textMuted} />
                    <ThemedText style={{ color: textMuted, fontSize: 14 }}>{user.phone}</ThemedText>
                  </View>
                ) : null}
                {!officeFilterId && user.office?.name ? (
                  <View style={styles.metaRow}>
                    <MaterialIcons name="business" size={15} color={textMuted} />
                    <ThemedText style={{ color: textMuted, fontSize: 14 }}>{user.office.name}</ThemedText>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>
        )}

        <Pressable
          onPress={() => setShowCategoryHeadPanel((v) => !v)}
          style={[styles.collapsibleHeader, { borderColor: border, backgroundColor: surfaceElevated }]}
        >
          <View style={styles.collapsibleTitleRow}>
            <MaterialIcons name="star-outline" size={22} color={primary} />
            <View style={styles.collapsibleTextWrap}>
              <ThemedText style={[styles.collapsibleTitle, { color: text }]}>
                Руководитель категории
              </ThemedText>
              <ThemedText style={{ color: textMuted, fontSize: 12 }}>
                Назначить исполнителя руководителем категории услуг
              </ThemedText>
            </View>
          </View>
          <MaterialIcons
            name={showCategoryHeadPanel ? 'expand-less' : 'expand-more'}
            size={24}
            color={textMuted}
          />
        </Pressable>

        {showCategoryHeadPanel ? (
          <View style={[styles.categoryHeadCard, { borderColor: border, backgroundColor: surfaceElevated }]}>
            <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Категория</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.pillsContent}
              style={styles.pillsScroll}
            >
              {categories.map((c) => {
                const active = selectedCategoryId === c.id;
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setSelectedCategoryId(active ? null : c.id);
                      setSelectedExecutorId(null);
                    }}
                    style={[
                      styles.pill,
                      { borderColor: border },
                      active && { backgroundColor: `${primary}22`, borderColor: primary },
                    ]}
                  >
                    <ThemedText
                      style={{ color: active ? primary : text, fontSize: 13, fontWeight: '600' }}
                    >
                      {c.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </ScrollView>

            {selectedCategoryId ? (
              <>
                <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Исполнитель</ThemedText>
                {isLoadingExecutors ? (
                  <ActivityIndicator color={primary} style={{ marginVertical: 12 }} />
                ) : executors.length === 0 ? (
                  <ThemedText style={{ color: textMuted, fontSize: 14, marginBottom: 8 }}>
                    Нет исполнителей в этой категории
                  </ThemedText>
                ) : (
                  <View style={styles.executorChips}>
                    {executors.map((e) => {
                      const active = selectedExecutorId === e.id;
                      return (
                        <Pressable
                          key={e.id}
                          onPress={() => setSelectedExecutorId(active ? null : e.id)}
                          style={[
                            styles.pill,
                            { borderColor: border },
                            active && { backgroundColor: primary, borderColor: primary },
                          ]}
                        >
                          <ThemedText
                            style={{
                              color: active ? '#fff' : text,
                              fontSize: 13,
                              fontWeight: '600',
                            }}
                          >
                            {e.user?.full_name ?? `Исполнитель #${e.id}`}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                )}
              </>
            ) : null}

            {changeHeadError ? (
              <ThemedText style={{ color: danger, fontSize: 13, marginTop: 4 }}>{changeHeadError}</ThemedText>
            ) : null}

            <Pressable
              style={[
                styles.primaryButton,
                { backgroundColor: primary },
                (!selectedCategoryId || !selectedExecutorId || isChangingHead) && styles.buttonDisabled,
              ]}
              onPress={handleChangeCategoryHead}
              disabled={!selectedCategoryId || !selectedExecutorId || isChangingHead}
            >
              {isChangingHead ? (
                <ActivityIndicator color={onPrimary} />
              ) : (
                <ThemedText style={{ color: onPrimary, fontWeight: '600' }}>Назначить руководителя</ThemedText>
              )}
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <KeyboardFormOverlay visible={!!editUser} backgroundColor="rgba(0,0,0,0.5)">
        {editUser ? (
            <View style={[styles.modalCard, { backgroundColor: surfaceElevated }]}>
              <View style={styles.modalHeader}>
                <ThemedText type="subtitle" style={{ color: text, flex: 1 }} numberOfLines={2}>
                  {editUser.full_name}
                </ThemedText>
                <Pressable onPress={closeEdit} hitSlop={12}>
                  <MaterialIcons name="close" size={26} color={textMuted} />
                </Pressable>
              </View>

              <ThemedText style={[styles.modalHint, { color: textMuted }]}>
                {ROLE_LABELS[editUser.role]} · {editUser.phone}
                {editUser.office?.name ? ` · ${editUser.office.name}` : ''}
              </ThemedText>

              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Новый пароль</ThemedText>
              <TextInput
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Оставьте пустым, если не меняете"
                placeholderTextColor={textMuted}
                secureTextEntry
                style={[styles.input, { color: text, borderColor: border, backgroundColor: screenBg }]}
                {...keyboardDismissInputProps()}
              />
              <TextInput
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Подтверждение пароля"
                placeholderTextColor={textMuted}
                secureTextEntry
                style={[styles.input, { color: text, borderColor: border, backgroundColor: screenBg }]}
                {...keyboardDismissInputProps()}
              />
              {passwordError ? (
                <ThemedText style={{ color: danger, fontSize: 13 }}>{passwordError}</ThemedText>
              ) : null}

              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Роль</ThemedText>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.modalPillsScroll}
                contentContainerStyle={styles.pillsContent}
                keyboardShouldPersistTaps="handled"
              >
                {Object.entries(ROLE_LABELS).map(([id, label]) => {
                  const active = newRole === id;
                  return (
                    <Pressable
                      key={id}
                      onPress={() => selectRole(id)}
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
                        {label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </ScrollView>
              {roleError ? (
                <ThemedText style={{ color: danger, fontSize: 13 }}>{roleError}</ThemedText>
              ) : null}

              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>ФИО</ThemedText>
              <TextInput
                value={fullName}
                onChangeText={setFullName}
                style={[styles.input, { color: text, borderColor: border, backgroundColor: screenBg }]}
                placeholder="Иванов Иван"
                placeholderTextColor={textMuted}
                {...keyboardDismissInputProps()}
              />
              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Телефон</ThemedText>
              <TextInput
                value={phone}
                onChangeText={handlePhoneChange}
                style={[styles.input, { color: text, borderColor: border, backgroundColor: screenBg }]}
                placeholder="+7 XXX XXX XX XX"
                placeholderTextColor={textMuted}
                keyboardType="phone-pad"
                maxLength={19}
                {...keyboardDismissInputProps({ numericKeyboard: true })}
              />

              {isExecutorForm ? (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Специальность</ThemedText>
                  <TextInput
                    value={specialty}
                    onChangeText={setSpecialty}
                    style={[styles.input, { color: text, borderColor: border, backgroundColor: screenBg }]}
                    placeholder="Например: электрик"
                    placeholderTextColor={textMuted}
                    {...keyboardDismissInputProps()}
                  />
                  <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Категории услуг</ThemedText>
                  {modalCategories.length === 0 ? (
                    <ThemedText style={{ color: textMuted, fontSize: 13, marginBottom: 8 }}>
                      Нет категорий для офиса пользователя
                    </ThemedText>
                  ) : (
                    <View style={styles.categoryChips}>
                      {modalCategories.map((c) => {
                        const active = selectedCategoryIds.includes(c.id);
                        return (
                          <Pressable
                            key={c.id}
                            onPress={() => toggleCategory(c.id)}
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
                              {c.name}
                            </ThemedText>
                          </Pressable>
                        );
                      })}
                    </View>
                  )}
                </>
              ) : null}

              <View style={styles.modalActions}>
                <Pressable
                  onPress={closeEdit}
                  style={[styles.modalBtn, { borderColor: border }]}
                  disabled={saving}
                >
                  <ThemedText style={{ color: text }}>Отмена</ThemedText>
                </Pressable>
                <Pressable
                  onPress={handleSaveUser}
                  style={[styles.modalBtn, { backgroundColor: primary, borderColor: primary }]}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color={onPrimary} />
                  ) : (
                    <ThemedText style={{ color: onPrimary, fontWeight: '600' }}>Сохранить</ThemedText>
                  )}
                </Pressable>
              </View>
            </View>
        ) : null}
      </KeyboardFormOverlay>
    </>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  statsRow: { borderWidth: 1, borderRadius: 10, padding: 12 },
  statsText: { fontSize: 13, lineHeight: 18 },
  sectionLabel: { fontSize: 12, fontWeight: '600', textTransform: 'uppercase', marginBottom: -4 },
  pillsScroll: { marginHorizontal: -16, flexGrow: 0 },
  pillsContent: { paddingHorizontal: 16, gap: 8, flexDirection: 'row' },
  pill: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
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
  sortRow: { gap: 8 },
  sortPills: { gap: 8, flexDirection: 'row' },
  sortPill: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  resultsBar: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4 },
  loadingBox: { alignItems: 'center', paddingVertical: 40, gap: 12 },
  emptyBlock: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '600' },
  emptyBtn: { marginTop: 8, borderWidth: 1, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 10 },
  userList: { gap: 10 },
  userCard: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  userCardTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  userCardMain: { flex: 1, gap: 6, paddingRight: 8 },
  userName: { fontSize: 16, fontWeight: '600' },
  roleBadge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  collapsibleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    marginTop: 8,
  },
  collapsibleTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  collapsibleTextWrap: { flex: 1, gap: 2 },
  collapsibleTitle: { fontSize: 15, fontWeight: '600' },
  categoryHeadCard: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    gap: 10,
    marginTop: -4,
  },
  fieldLabel: { fontSize: 12, fontWeight: '600', marginBottom: 4 },
  executorChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  modalCard: { borderRadius: 16, padding: 20, gap: 4 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 4 },
  modalHint: { fontSize: 13, marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  modalPillsScroll: { marginHorizontal: -4, flexGrow: 0, marginBottom: 8 },
  categoryChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  modalBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
});
