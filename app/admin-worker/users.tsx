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

import { PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { useAuthStore } from '@/stores/auth-store';
import {
  type RegistrationRequestItem,
  type Office,
  type OfficeUser,
  type ServiceCategory,
  type ExecutorInCategory,
  getOffices,
  getRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  getOfficeUsers,
  changeUserPassword,
  updateUserRole,
  getServiceCategories,
  getExecutorsByCategory,
  changeCategoryHead,
} from '@/lib/api';
import { formatRequestDate } from '@/lib/dateTimeUtils';

type TabType = 'requests' | 'management';

const ROLE_LABELS: Record<string, string> = {
  client: 'Клиент',
  'admin-worker': 'Администратор офиса',
  'department-head': 'Офис менеджер',
  executor: 'Исполнитель',
  manager: 'Руководитель',
};

/** Статусы запросов на регистрацию (отдельно от статусов заявок) */
const REGISTRATION_STATUS_LABELS: Record<string, string> = {
  pending: 'Ожидает',
  approved: 'Одобрено',
  rejected: 'Отклонено',
};

export default function AdminWorkerUsersScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  const { show: showToast } = useToast();
  const user = useAuthStore((s) => s.user);
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');
  const border = useThemeColor({}, 'border');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const success = useThemeColor({}, 'success');
  const successSoft = useThemeColor({}, 'successSoft');
  const danger = useThemeColor({}, 'danger');
  const dangerSoft = useThemeColor({}, 'dangerSoft');
  const accentSoft = useThemeColor({}, 'accentSoft');

  const initialTab: TabType = tab === 'management' ? 'management' : 'requests';
  const [activeTab, setActiveTab] = useState<TabType>(initialTab);

  // ——— Запросы на регистрацию ———
  const [requests, setRequests] = useState<RegistrationRequestItem[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: '',
    date_from: '',
    date_to: '',
  });
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);
  const [actionRequestId, setActionRequestId] = useState<number | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  const [filterOfficeId, setFilterOfficeId] = useState('');
  const [requestPage, setRequestPage] = useState(1);
  const [requestMeta, setRequestMeta] = useState({
    total: 0,
    page: 1,
    pageSize: 20,
    totalPages: 1,
  });

  useEffect(() => {
    getOffices().then(setOffices);
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    const params: {
      status?: string;
      date_from?: string;
      date_to?: string;
      office_id?: string;
      page?: string;
      page_size?: string;
    } = {
      page: String(requestPage),
      page_size: '20',
    };
    if (filters.status) params.status = filters.status;
    if (filters.date_from) params.date_from = filters.date_from;
    if (filters.date_to) params.date_to = filters.date_to;
    if (filterOfficeId) params.office_id = filterOfficeId;
    const result = await getRegistrationRequests(params);
    if (result.ok) {
      setRequests(result.data);
      setRequestMeta(result.meta);
    } else {
      setRequests([]);
      setRequestMeta({ total: 0, page: 1, pageSize: 20, totalPages: 1 });
    }
    setRequestsLoading(false);
  }, [filters.status, filters.date_from, filters.date_to, filterOfficeId, requestPage]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleApprove = useCallback(
    async (requestId: number) => {
      setActionRequestId(requestId);
      const result = await approveRegistrationRequest(requestId);
      if (result.ok) {
        showToast({ title: 'Успешно', description: 'Запрос одобрен, пользователь создан', variant: 'success' });
        loadRequests();
      } else {
        showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
      }
      setActionRequestId(null);
    },
    [showToast, loadRequests]
  );

  const handleReject = useCallback(
    async (requestId: number) => {
      setActionRequestId(requestId);
      const result = await rejectRegistrationRequest(requestId);
      if (result.ok) {
        showToast({ title: 'Успешно', description: 'Запрос отклонён', variant: 'success' });
        loadRequests();
      } else {
        showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
      }
      setActionRequestId(null);
    },
    [showToast, loadRequests]
  );

  // ——— Управление (офисные пользователи) ———
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [officeUsersLoading, setOfficeUsersLoading] = useState(false);

  useEffect(() => {
    if (user?.office_id) {
      setOfficeUsersLoading(true);
      getOfficeUsers(user.office_id).then((res) => {
        if (res.ok) setOfficeUsers(res.data);
        else setOfficeUsers([]);
        setOfficeUsersLoading(false);
      });
    } else {
      setOfficeUsers([]);
    }
  }, [user?.office_id]);

  useEffect(() => {
    getServiceCategories().then((res) => {
      if (res.ok) setCategories(res.data);
      else setCategories([]);
    });
  }, []);

  // Смена пароля
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showUserDropdown, setShowUserDropdown] = useState(false);

  const handleChangePassword = useCallback(async () => {
    if (!selectedUserId || !newPassword.trim()) return;
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Пароль должен содержать минимум 6 символов');
      return;
    }
    setPasswordError(null);
    setIsChangingPassword(true);
    const result = await changeUserPassword(selectedUserId, newPassword);
    if (result.ok) {
      showToast({ title: 'Пароль изменён', description: 'Пароль пользователя успешно изменён', variant: 'success' });
      setSelectedUserId(null);
      setNewPassword('');
      setConfirmPassword('');
      setShowUserDropdown(false);
    } else {
      setPasswordError(result.error);
    }
    setIsChangingPassword(false);
  }, [selectedUserId, newPassword, confirmPassword, showToast]);

  // Смена роли
  const [selectedRoleUserId, setSelectedRoleUserId] = useState<number | null>(null);
  const [newRole, setNewRole] = useState('');
  const [isChangingRole, setIsChangingRole] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  const [showRoleUserDropdown, setShowRoleUserDropdown] = useState(false);
  const [showRoleDropdown, setShowRoleDropdown] = useState(false);

  const handleChangeRole = useCallback(async () => {
    if (!selectedRoleUserId || !newRole) return;
    setRoleError(null);
    setIsChangingRole(true);
    const result = await updateUserRole(selectedRoleUserId, newRole);
    if (result.ok) {
      showToast({ title: 'Роль изменена', description: 'Роль пользователя успешно изменена', variant: 'success' });
      setOfficeUsers((prev) =>
        prev.map((u) => (u.id === selectedRoleUserId ? { ...u, role: newRole } : u))
      );
      setSelectedRoleUserId(null);
      setNewRole('');
      setShowRoleUserDropdown(false);
      setShowRoleDropdown(false);
    } else {
      setRoleError(result.error);
    }
    setIsChangingRole(false);
  }, [selectedRoleUserId, newRole, showToast]);

  // Смена руководителя категории
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null);
  const [executors, setExecutors] = useState<ExecutorInCategory[]>([]);
  const [selectedExecutorId, setSelectedExecutorId] = useState<number | null>(null);
  const [isLoadingExecutors, setIsLoadingExecutors] = useState(false);
  const [isChangingHead, setIsChangingHead] = useState(false);
  const [changeHeadError, setChangeHeadError] = useState<string | null>(null);
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [showExecutorDropdown, setShowExecutorDropdown] = useState(false);

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
        const onlyExecutors = res.data.filter((e) => e.user?.role === 'executor');
        setExecutors(onlyExecutors);
      } else {
        setExecutors([]);
        setChangeHeadError('Не удалось загрузить исполнителей');
      }
      setIsLoadingExecutors(false);
    });
  }, [selectedCategoryId]);

  const handleChangeCategoryHead = useCallback(async () => {
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
      setShowCategoryDropdown(false);
      setShowExecutorDropdown(false);
    } else {
      setChangeHeadError(result.error);
    }
    setIsChangingHead(false);
  }, [selectedCategoryId, selectedExecutorId, showToast]);

  const selectedUserName = useMemo(
    () => officeUsers.find((u) => u.id === selectedUserId)?.full_name ?? null,
    [officeUsers, selectedUserId]
  );
  const selectedRoleUserName = useMemo(
    () => officeUsers.find((u) => u.id === selectedRoleUserId)?.full_name ?? null,
    [officeUsers, selectedRoleUserId]
  );
  const selectedCategoryName = useMemo(
    () => categories.find((c) => c.id === selectedCategoryId)?.name ?? null,
    [categories, selectedCategoryId]
  );
  const selectedExecutorName = useMemo(
    () => executors.find((e) => e.id === selectedExecutorId)?.user?.full_name ?? null,
    [executors, selectedExecutorId]
  );

  const registrationOfficeLabel = useMemo(() => {
    if (!filterOfficeId) return 'Все офисы';
    return offices.find((o) => String(o.id) === filterOfficeId)?.name ?? 'Офис';
  }, [filterOfficeId, offices]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: screenBg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={24} color={primary} />
          <ThemedText style={[styles.backLabel, { color: primary }]}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Пользователи
        </ThemedText>
      </View>

      <View style={[styles.tabs, { backgroundColor: gray600 }]}>
        <Pressable
          style={[styles.tab, activeTab === 'requests' && { backgroundColor: primary }]}
          onPress={() => setActiveTab('requests')}
        >
          <MaterialIcons
            name="person-add"
            size={18}
            color={activeTab === 'requests' ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
          <ThemedText style={[styles.tabText, activeTab === 'requests' && styles.tabTextActive]}>
            Запросы
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'management' && { backgroundColor: primary }]}
          onPress={() => setActiveTab('management')}
        >
          <MaterialIcons
            name="groups"
            size={18}
            color={activeTab === 'management' ? '#fff' : 'rgba(255,255,255,0.7)'}
          />
          <ThemedText style={[styles.tabText, activeTab === 'management' && styles.tabTextActive]}>
            Управление
          </ThemedText>
        </Pressable>
      </View>

      {activeTab === 'requests' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <ThemedText style={[styles.sectionTitle, { color: text }]}>
            Управление запросами на регистрацию
          </ThemedText>
          <ThemedText style={[styles.hint, { color: textMuted }]}>
            Отклонённые и одобренные заявки автоматически удаляются каждые 7 дней
          </ThemedText>

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Офис</ThemedText>
            <Pressable
              style={[styles.selectTrigger, { borderColor: border, backgroundColor: surfaceElevated }]}
              onPress={() => {
                setShowOfficeDropdown((v) => !v);
                setShowStatusDropdown(false);
              }}
            >
              <ThemedText style={[styles.selectTriggerText, { color: text }]}>{registrationOfficeLabel}</ThemedText>
              <MaterialIcons
                name={showOfficeDropdown ? 'expand-less' : 'expand-more'}
                size={22}
                color={textMuted}
              />
            </Pressable>
            {showOfficeDropdown && (
              <View style={[styles.dropdown, { backgroundColor: surfaceElevated, borderWidth: 1, borderColor: border }]}>
                <Pressable
                  style={[
                    styles.dropdownItem,
                    !filterOfficeId && { backgroundColor: accentSoft },
                  ]}
                  onPress={() => {
                    setFilterOfficeId('');
                    setRequestPage(1);
                    setShowOfficeDropdown(false);
                  }}
                >
                  <ThemedText style={[styles.dropdownItemText, { color: text }]}>Все офисы</ThemedText>
                </Pressable>
                {offices.map((o) => (
                  <Pressable
                    key={o.id}
                    style={[
                      styles.dropdownItem,
                      filterOfficeId === String(o.id) && { backgroundColor: accentSoft },
                    ]}
                    onPress={() => {
                      setFilterOfficeId(String(o.id));
                      setRequestPage(1);
                      setShowOfficeDropdown(false);
                    }}
                  >
                    <ThemedText style={[styles.dropdownItemText, { color: text }]}>{o.name}</ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Статус</ThemedText>
            <Pressable
              style={[styles.selectTrigger, { borderColor: border, backgroundColor: surfaceElevated }]}
              onPress={() => {
                setShowStatusDropdown((v) => !v);
                setShowOfficeDropdown(false);
              }}
            >
              <ThemedText style={[styles.selectTriggerText, { color: text }]}>
                {filters.status ? REGISTRATION_STATUS_LABELS[filters.status] ?? filters.status : 'Все статусы'}
              </ThemedText>
              <MaterialIcons
                name={showStatusDropdown ? 'expand-less' : 'expand-more'}
                size={22}
                color={textMuted}
              />
            </Pressable>
            {showStatusDropdown && (
              <View style={[styles.dropdown, { backgroundColor: surfaceElevated, borderWidth: 1, borderColor: border }]}>
                <Pressable
                  style={[styles.dropdownItem, !filters.status && { backgroundColor: accentSoft }]}
                  onPress={() => {
                    setFilters((f) => ({ ...f, status: '' }));
                    setRequestPage(1);
                    setShowStatusDropdown(false);
                  }}
                >
                  <ThemedText style={[styles.dropdownItemText, { color: text }]}>Все статусы</ThemedText>
                </Pressable>
                {(['pending', 'approved', 'rejected'] as const).map((s) => (
                  <Pressable
                    key={s}
                    style={[styles.dropdownItem, filters.status === s && { backgroundColor: accentSoft }]}
                    onPress={() => {
                      setFilters((f) => ({ ...f, status: s }));
                      setRequestPage(1);
                      setShowStatusDropdown(false);
                    }}
                  >
                    <ThemedText style={[styles.dropdownItemText, { color: text }]}>
                      {REGISTRATION_STATUS_LABELS[s]}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {requestsLoading ? (
            <View style={styles.loadingBox}>
              <PageLoader size={80} />
              <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
            </View>
          ) : requests.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: textMuted }]}>Запросы не найдены</ThemedText>
          ) : (
            <View style={styles.requestList}>
              {requests.map((req) => (
                <View
                  key={req.id}
                  style={[styles.registrationCard, { borderColor: border, backgroundColor: surfaceElevated }]}
                >
                  <View style={styles.requestCardHeader}>
                    <ThemedText style={[styles.requestName, { color: text }]} numberOfLines={2}>
                      {req.full_name}
                    </ThemedText>
                    <View
                      style={[
                        styles.registrationStatusPill,
                        {
                          backgroundColor:
                            req.status === 'pending' ? accentSoft : req.status === 'approved' ? successSoft : dangerSoft,
                        },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.registrationStatusPillText,
                          {
                            color:
                              req.status === 'pending' ? primary : req.status === 'approved' ? success : danger,
                          },
                        ]}
                      >
                        {REGISTRATION_STATUS_LABELS[req.status] ?? req.status}
                      </ThemedText>
                    </View>
                  </View>
                  <ThemedText style={[styles.requestMeta, { color: textMuted }]}>Телефон: {req.phone}</ThemedText>
                  <ThemedText style={[styles.requestMeta, { color: textMuted }]}>
                    Офис: {req.office?.name ?? '—'}
                  </ThemedText>
                  <ThemedText style={[styles.requestMeta, { color: textMuted }]}>
                    Роль: {ROLE_LABELS[req.role] ?? req.role}
                  </ThemedText>
                  {req.role === 'executor' && req.service_category && (
                    <ThemedText style={[styles.requestMeta, { color: textMuted }]}>
                      Категория: {req.service_category.name}
                    </ThemedText>
                  )}
                  <ThemedText style={[styles.requestMeta, { color: textMuted }]}>
                    Дата: {formatRequestDate(req.created_at)}
                  </ThemedText>
                  {req.status === 'pending' && (
                    <View style={styles.requestActions}>
                      <Pressable
                        style={[
                          styles.registrationActionBtn,
                          {
                            borderColor: success,
                            backgroundColor: successSoft,
                            minHeight: 44,
                          },
                          actionRequestId === req.id && styles.buttonDisabled,
                        ]}
                        onPress={() => handleApprove(req.id)}
                        disabled={actionRequestId === req.id}
                      >
                        {actionRequestId === req.id ? (
                          <ActivityIndicator size="small" color={success} />
                        ) : (
                          <ThemedText style={[styles.registrationActionBtnLabel, { color: success }]}>Одобрить</ThemedText>
                        )}
                      </Pressable>
                      <Pressable
                        style={[
                          styles.registrationActionBtn,
                          {
                            borderColor: danger,
                            backgroundColor: dangerSoft,
                            minHeight: 44,
                          },
                          actionRequestId === req.id && styles.buttonDisabled,
                        ]}
                        onPress={() => handleReject(req.id)}
                        disabled={actionRequestId === req.id}
                      >
                        <ThemedText style={[styles.registrationActionBtnLabel, { color: danger }]}>Отклонить</ThemedText>
                      </Pressable>
                    </View>
                  )}
                </View>
              ))}
            </View>
          )}

          {!requestsLoading && requestMeta.total > 0 ? (
            <View style={[styles.paginationBar, { borderTopColor: border }]}>
              <ThemedText style={[styles.paginationInfo, { color: textMuted }]}>
                Страница {requestMeta.page} из {requestMeta.totalPages} · Всего {requestMeta.total}
              </ThemedText>
              <View style={styles.paginationButtons}>
                <Pressable
                  style={[
                    styles.paginationBtn,
                    { borderColor: border, backgroundColor: surfaceElevated },
                    requestMeta.page <= 1 && styles.buttonDisabled,
                  ]}
                  onPress={() => setRequestPage((p) => Math.max(1, p - 1))}
                  disabled={requestMeta.page <= 1}
                >
                  <ThemedText style={[styles.paginationBtnText, { color: text }]}>Назад</ThemedText>
                </Pressable>
                <Pressable
                  style={[
                    styles.paginationBtn,
                    { borderColor: border, backgroundColor: surfaceElevated },
                    requestMeta.page >= requestMeta.totalPages && styles.buttonDisabled,
                  ]}
                  onPress={() => setRequestPage((p) => Math.min(requestMeta.totalPages, p + 1))}
                  disabled={requestMeta.page >= requestMeta.totalPages}
                >
                  <ThemedText style={[styles.paginationBtnText, { color: text }]}>Вперёд</ThemedText>
                </Pressable>
              </View>
            </View>
          ) : null}
        </ScrollView>
      )}

      {activeTab === 'management' && (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          {officeUsersLoading ? (
            <View style={styles.loadingBox}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : (
            <>
              <View style={[styles.card, { backgroundColor: gray600 }]}>
                <ThemedText style={[styles.cardTitle, { color: text }]}>Смена пароля</ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
                  Изменение пароля пользователей вашего офиса
                </ThemedText>
                <Pressable
                  style={[styles.selectTrigger, { borderColor: gray600, backgroundColor: screenBg }]}
                  onPress={() => setShowUserDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: selectedUserName ? text : textMuted }]}>
                    {selectedUserName ?? 'Выберите пользователя'}
                  </ThemedText>
                  <MaterialIcons name={showUserDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
                </Pressable>
                {showUserDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: screenBg }]}>
                    {officeUsers.map((u) => (
                      <Pressable
                        key={u.id}
                        style={[styles.dropdownItem, u.id === selectedUserId && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedUserId(u.id);
                          setShowUserDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>
                          {u.full_name} ({u.phone})
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
                <TextInput
                  style={[styles.input, { color: text, borderColor: gray600, backgroundColor: screenBg }]}
                  placeholder="Новый пароль"
                  placeholderTextColor={textMuted}
                  value={newPassword}
                  onChangeText={setNewPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
                />
                <TextInput
                  style={[styles.input, { color: text, borderColor: gray600, backgroundColor: screenBg }]}
                  placeholder="Подтверждение"
                  placeholderTextColor={textMuted}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  editable={!isChangingPassword}
                />
                {passwordError ? (
                  <ThemedText style={styles.errorText}>{passwordError}</ThemedText>
                ) : null}
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: primary },
                    (!selectedUserId || !newPassword || !confirmPassword || isChangingPassword) && styles.buttonDisabled,
                  ]}
                  onPress={handleChangePassword}
                  disabled={!selectedUserId || !newPassword || !confirmPassword || isChangingPassword}
                >
                  {isChangingPassword ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Изменить пароль</ThemedText>
                  )}
                </Pressable>
              </View>

              <View style={[styles.card, { backgroundColor: gray600 }]}>
                <ThemedText style={[styles.cardTitle, { color: text }]}>Смена роли</ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
                  Изменение роли пользователей вашего офиса
                </ThemedText>
                <Pressable
                  style={[styles.selectTrigger, { borderColor: gray600, backgroundColor: screenBg }]}
                  onPress={() => setShowRoleUserDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: selectedRoleUserName ? text : textMuted }]}>
                    {selectedRoleUserName
                      ? `${selectedRoleUserName} — ${ROLE_LABELS[officeUsers.find((u) => u.id === selectedRoleUserId)?.role ?? ''] ?? ''}`
                      : 'Выберите пользователя'}
                  </ThemedText>
                  <MaterialIcons name={showRoleUserDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
                </Pressable>
                {showRoleUserDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: screenBg }]}>
                    {officeUsers.map((u) => (
                      <Pressable
                        key={u.id}
                        style={[styles.dropdownItem, u.id === selectedRoleUserId && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedRoleUserId(u.id);
                          setShowRoleUserDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>
                          {u.full_name} — {ROLE_LABELS[u.role] ?? u.role}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
                <Pressable
                  style={[styles.selectTrigger, { borderColor: gray600, backgroundColor: screenBg }]}
                  onPress={() => setShowRoleDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: newRole ? text : textMuted }]}>
                    {newRole ? ROLE_LABELS[newRole] ?? newRole : 'Выберите роль'}
                  </ThemedText>
                  <MaterialIcons name={showRoleDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
                </Pressable>
                {showRoleDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: screenBg }]}>
                    {Object.entries(ROLE_LABELS).map(([id, label]) => (
                      <Pressable
                        key={id}
                        style={[styles.dropdownItem, id === newRole && styles.dropdownItemActive]}
                        onPress={() => {
                          setNewRole(id);
                          setShowRoleDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>{label}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
                {roleError ? <ThemedText style={styles.errorText}>{roleError}</ThemedText> : null}
                <Pressable
                  style={[
                    styles.primaryButton,
                    { backgroundColor: primary },
                    (!selectedRoleUserId || !newRole || isChangingRole) && styles.buttonDisabled,
                  ]}
                  onPress={handleChangeRole}
                  disabled={!selectedRoleUserId || !newRole || isChangingRole}
                >
                  {isChangingRole ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Изменить роль</ThemedText>
                  )}
                </Pressable>
              </View>

              <View style={[styles.card, { backgroundColor: gray600 }]}>
                <ThemedText style={[styles.cardTitle, { color: text }]}>Смена руководителя категории</ThemedText>
                <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
                  Назначение нового руководителя для категории услуг
                </ThemedText>
                <Pressable
                  style={[styles.selectTrigger, { borderColor: gray600, backgroundColor: screenBg }]}
                  onPress={() => !isLoadingExecutors && setShowCategoryDropdown((v) => !v)}
                >
                  <ThemedText style={[styles.selectTriggerText, { color: selectedCategoryName ? text : textMuted }]}>
                    {selectedCategoryName ?? (isLoadingExecutors ? 'Загрузка...' : 'Выберите категорию')}
                  </ThemedText>
                  <MaterialIcons name={showCategoryDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
                </Pressable>
                {showCategoryDropdown && (
                  <View style={[styles.dropdown, { backgroundColor: screenBg }]}>
                    {categories.map((c) => (
                      <Pressable
                        key={c.id}
                        style={[styles.dropdownItem, c.id === selectedCategoryId && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedCategoryId(c.id);
                          setShowCategoryDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>{c.name}</ThemedText>
                      </Pressable>
                    ))}
                  </View>
                )}
                {selectedCategoryId && (
                  <>
                    <Pressable
                      style={[styles.selectTrigger, { borderColor: gray600, backgroundColor: screenBg }]}
                      onPress={() => !isLoadingExecutors && setShowExecutorDropdown((v) => !v)}
                    >
                      <ThemedText style={[styles.selectTriggerText, { color: selectedExecutorName ? text : textMuted }]}>
                        {selectedExecutorName ?? (isLoadingExecutors ? 'Загрузка...' : 'Выберите исполнителя')}
                      </ThemedText>
                      <MaterialIcons name={showExecutorDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
                    </Pressable>
                    {showExecutorDropdown && (
                      <View style={[styles.dropdown, { backgroundColor: screenBg }]}>
                        {executors.length === 0 && !isLoadingExecutors ? (
                          <ThemedText style={[styles.dropdownItemText, styles.dropdownItemDisabled]}>
                            Нет доступных исполнителей
                          </ThemedText>
                        ) : (
                          executors.map((e) => (
                            <Pressable
                              key={e.id}
                              style={[styles.dropdownItem, e.id === selectedExecutorId && styles.dropdownItemActive]}
                              onPress={() => {
                                setSelectedExecutorId(e.id);
                                setShowExecutorDropdown(false);
                              }}
                            >
                              <ThemedText style={styles.dropdownItemText}>
                                {e.user?.full_name} — {e.specialty}
                              </ThemedText>
                            </Pressable>
                          ))
                        )}
                      </View>
                    )}
                  </>
                )}
                {changeHeadError ? <ThemedText style={styles.errorText}>{changeHeadError}</ThemedText> : null}
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
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Сменить руководителя</ThemedText>
                  )}
                </Pressable>
                {(selectedCategoryId || selectedExecutorId) && (
                  <Pressable
                    style={[styles.secondaryButton, { borderColor: gray600 }]}
                    onPress={() => {
                      setSelectedCategoryId(null);
                      setSelectedExecutorId(null);
                      setShowCategoryDropdown(false);
                      setShowExecutorDropdown(false);
                    }}
                    disabled={isChangingHead}
                  >
                    <ThemedText style={styles.secondaryButtonText}>Сбросить</ThemedText>
                  </Pressable>
                )}
              </View>

              <View style={styles.warnBox}>
                <MaterialIcons name="info-outline" size={20} color={primary} />
                <ThemedText style={styles.warnText}>
                  Новый пароль — минимум 6 символов. Пользователь сможет войти с новым паролем сразу после изменения.
                </ThemedText>
              </View>
            </>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
    borderRadius: 10,
    padding: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: 8,
  },
  tabActive: {},
  tabText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.7)',
  },
  tabTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
  },
  selectTrigger: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectTriggerText: {
    fontSize: 16,
  },
  loadingBox: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
  requestList: {
    gap: 12,
  },
  registrationCard: {
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
  },
  requestCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  requestName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
    minWidth: 0,
  },
  requestMeta: {
    fontSize: 14,
    marginBottom: 2,
  },
  registrationStatusPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  registrationStatusPillText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  registrationActionBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  registrationActionBtnLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  paginationBar: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  paginationInfo: {
    fontSize: 13,
    marginBottom: 12,
    textAlign: 'center',
  },
  paginationButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  paginationBtn: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
  },
  paginationBtnText: {
    fontSize: 15,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  dropdown: {
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
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    marginBottom: 8,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  secondaryButton: {
    marginTop: 8,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 16,
  },
  warnBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(226,91,33,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(226,91,33,0.4)',
    borderRadius: 10,
    padding: 12,
  },
  warnText: {
    fontSize: 13,
    color: '#FCD34D',
    flex: 1,
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
});
