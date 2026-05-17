import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminUserManagementTab } from '@/components/admin-worker/user-management-tab';
import { PageLoader, ScreenHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  type RegistrationRequestItem,
  type Office,
  type ServiceCategory,
  getOffices,
  getRegistrationRequests,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  deleteRejectedRegistrationRequest,
  getServiceCategories,
} from '@/lib/api';
import { formatServiceCategoryDisplayName } from '@/constants/requests';
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
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const screenBg = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'border');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const success = useThemeColor({}, 'success');
  const successSoft = useThemeColor({}, 'successSoft');
  const danger = useThemeColor({}, 'danger');
  const dangerSoft = useThemeColor({}, 'dangerSoft');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const textSecondary = useThemeColor({}, 'textSecondary');

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

  const handleDeleteRejected = useCallback(
    async (requestId: number) => {
      setActionRequestId(requestId);
      const result = await deleteRejectedRegistrationRequest(requestId);
      if (result.ok) {
        showToast({ title: 'Удалено', description: 'Отклонённый запрос удалён из списка', variant: 'success' });
        loadRequests();
      } else {
        showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
      }
      setActionRequestId(null);
    },
    [showToast, loadRequests]
  );

  const confirmDeleteRejectedRequest = useCallback(
    (requestId: number) => {
      Alert.alert(
        'Удалить запрос?',
        'Запись об отклонённой заявке будет удалена безвозвратно.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: () => {
              void handleDeleteRejected(requestId);
            },
          },
        ]
      );
    },
    [handleDeleteRejected]
  );

  const [categories, setCategories] = useState<ServiceCategory[]>([]);

  useEffect(() => {
    getServiceCategories().then((res) => {
      if (res.ok) setCategories(res.data);
      else setCategories([]);
    });
  }, []);

  const registrationOfficeLabel = useMemo(() => {
    if (!filterOfficeId) return 'Все офисы';
    return offices.find((o) => String(o.id) === filterOfficeId)?.name ?? 'Офис';
  }, [filterOfficeId, offices]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: screenBg }]}>
      <ScreenHeader title="Пользователи" />

      <View style={[styles.tabs, { backgroundColor: surfaceMuted, borderWidth: 1, borderColor: border }]}>
        <Pressable
          style={[styles.tab, activeTab === 'requests' && { backgroundColor: primary }]}
          onPress={() => setActiveTab('requests')}
        >
          <MaterialIcons
            name="person-add"
            size={18}
            color={activeTab === 'requests' ? onPrimary : textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === 'requests' ? onPrimary : textSecondary },
              activeTab === 'requests' && styles.tabTextSelected,
            ]}
          >
            Запросы
          </ThemedText>
        </Pressable>
        <Pressable
          style={[styles.tab, activeTab === 'management' && { backgroundColor: primary }]}
          onPress={() => {
            setActiveTab('management');
            setShowOfficeDropdown(false);
            setShowStatusDropdown(false);
          }}
        >
          <MaterialIcons
            name="groups"
            size={18}
            color={activeTab === 'management' ? onPrimary : textSecondary}
          />
          <ThemedText
            style={[
              styles.tabText,
              { color: activeTab === 'management' ? onPrimary : textSecondary },
              activeTab === 'management' && styles.tabTextSelected,
            ]}
          >
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
                      Категория: {formatServiceCategoryDisplayName(req.service_category.name)}
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
                  {req.status === 'rejected' && (
                    <View style={styles.requestActions}>
                      <Pressable
                        style={[
                          styles.registrationActionBtn,
                          {
                            borderColor: border,
                            backgroundColor: surfaceMuted,
                            minHeight: 44,
                          },
                          actionRequestId === req.id && styles.buttonDisabled,
                        ]}
                        onPress={() => confirmDeleteRejectedRequest(req.id)}
                        disabled={actionRequestId === req.id}
                      >
                        {actionRequestId === req.id ? (
                          <ActivityIndicator size="small" color={danger} />
                        ) : (
                          <ThemedText style={[styles.registrationActionBtnLabel, { color: danger }]}>Удалить</ThemedText>
                        )}
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
        <AdminUserManagementTab
          offices={offices}
          categories={categories}
          isActive={activeTab === 'management'}
        />
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  tabText: {
    fontSize: 14,
  },
  tabTextSelected: {
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
  dropdownItemText: {
    fontSize: 16,
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
    marginBottom: 8,
  },
  primaryButton: {
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 4,
  },
  primaryButtonText: {
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
    fontSize: 16,
    fontWeight: '500',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
});
