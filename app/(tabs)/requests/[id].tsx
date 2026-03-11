import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AssignExecutorsModal } from '@/components/requests/assign-executors-modal';
import { CompleteTaskModal } from '@/components/requests/complete-task-modal';
import { RatingModal } from '@/components/requests/rating-modal';
import { RedirectModal } from '@/components/requests/redirect-modal';
import { RejectModal } from '@/components/requests/reject-modal';
import { RequestActionMenu, type RequestUserRole } from '@/components/requests/request-action-menu';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  assignExecutorsToRequest,
  completeRequest,
  deleteRequest,
  executeRequest,
  getExecutors,
  getRequestGroupById,
  getServiceCategories,
  patchRequestGroup,
  postClientRating,
  postRating,
  postRejectNotification,
  redirectRequest,
  rejectRequest,
  toggleLongTermRequest,
  uploadRequestPhotos,
  type AcceptSubRequestPayload,
  type RequestGroup,
  type SubRequest,
} from '@/lib/api';
import { PageLoader, Select } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершено',
  in_progress: 'В обработке',
  awaiting_assignment: 'Ожидает назначения',
  execution: 'Исполнение',
  rejected: 'Отклонено',
  cancelled: 'Отменено',
};

const TYPE_LABELS: Record<string, string> = {
  urgent: 'Экстренная',
  planned: 'Плановая',
  normal: 'Обычная',
};

const REQUEST_TYPE_OPTIONS = [
  { value: 'normal', label: 'Обычная' },
  { value: 'urgent', label: 'Экстренная' },
  { value: 'planned', label: 'Плановая' },
];

const SLA_OPTIONS = [
  { value: '1h', label: '1 час' },
  { value: '4h', label: '4 часа' },
  { value: '8h', label: '8 часов' },
  { value: '1d', label: '1 день' },
  { value: '3d', label: '3 дня' },
  { value: '1w', label: '1 неделя' },
];

const COMPLEXITY_OPTIONS = [
  { value: 'simple', label: 'Простая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'complex', label: 'Сложная' },
];

function translateStatus(s: string) {
  return STATUS_LABELS[s] ?? s;
}

function translateType(t: string) {
  return TYPE_LABELS[t] ?? 'Обычная';
}

function PhotoGrid({
  photos,
  onPress,
}: {
  photos: Array<{ photo_url: string }>;
  onPress: (url: string) => void;
}) {
  const { width } = useWindowDimensions();
  const gap = 8;
  const count = 3;
  const size = (width - 48 - gap * (count - 1)) / count;

  if (!photos?.length) return null;

  return (
    <View style={styles.photoSection}>
      <ThemedText style={styles.photoSectionTitle}>Фотографии</ThemedText>
      <View style={[styles.photoGrid, { gap }]}>
        {photos.map((p, idx) => (
          <Pressable
            key={`${p.photo_url}-${idx}`}
            onPress={() => onPress(p.photo_url)}
            style={[styles.photoTile, { width: size, height: size }]}
          >
            <Image
              source={{ uri: p.photo_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

export default function RequestDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { show: showToast } = useToast();
  const role = useAuthStore((s) => s.role) as RequestUserRole | null;
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const guestRequests = useGuestDemoStore((s) => s.requests);

  const insets = useSafeAreaInsets();
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const [request, setRequest] = useState<RequestGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showClientRatingModal, setShowClientRatingModal] = useState(false);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);

  const [taskForComplete, setTaskForComplete] = useState<SubRequest | null>(null);
  const [subForReject, setSubForReject] = useState<SubRequest | null>(null);
  const [subForRate, setSubForRate] = useState<SubRequest | null>(null);
  const [subForRedirect, setSubForRedirect] = useState<SubRequest | null>(null);
  const [subForAssign, setSubForAssign] = useState<SubRequest | null>(null);

  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [executors, setExecutors] = useState<
    Array<{ id: number; user?: { full_name?: string }; specialty?: string }>
  >([]);

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [rejectGroupReason, setRejectGroupReason] = useState('');
  const [editableRequestType, setEditableRequestType] = useState<string>('normal');
  const [subRequestSettings, setSubRequestSettings] = useState<Record<number, { sla: string; complexity: string }>>({});
  const [locationDetail, setLocationDetail] = useState('');
  const [acceptFormError, setAcceptFormError] = useState<string | null>(null);

  const numId = id ? parseInt(id, 10) : NaN;

  const refetch = useCallback(async () => {
    if (!id || Number.isNaN(numId)) return;
    if (isGuest && numId < 0) {
      const found = guestRequests.find((r) => r.id === numId);
      if (found) setRequest(found as RequestGroup);
      return;
    }
    const res = await getRequestGroupById(numId);
    if (res.ok) setRequest(res.data);
  }, [id, numId, isGuest, guestRequests]);

  useEffect(() => {
    if (!id || Number.isNaN(numId)) {
      setError('Неверный id заявки');
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(null);
    const load = async () => {
      if (isGuest && numId < 0) {
        const found = guestRequests.find((r) => r.id === numId);
        if (!cancelled) {
          if (found) setRequest(found as RequestGroup);
          else setError('Заявка не найдена (демо)');
          setLoading(false);
        }
        return;
      }
      const res = await getRequestGroupById(numId);
      if (!cancelled) {
        if (res.ok) setRequest(res.data);
        else setError(res.error);
        setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id, numId, isGuest, guestRequests]);

  useEffect(() => {
    if (role === 'department-head' || role === 'executor') {
      getServiceCategories().then((res) => {
        if (res.ok && res.data) {
          setCategories(res.data.map((c) => ({ id: c.id, name: c.name })));
        }
      });
    }
    if (role === 'department-head') {
      getExecutors().then((res) => {
        if (res.ok && res.data) {
          setExecutors(res.data);
        }
      });
    }
  }, [role]);

  // Всегда переходим в список заявок, чтобы при открытии из уведомления (Профиль) вкладка «Заявки» не застревала на экране заявки
  const goBack = useCallback(() => {
    router.replace('/(tabs)/requests');
  }, [router]);

  const handleStartTask = useCallback(
    async (taskId: number) => {
      const res = await executeRequest(taskId);
      if (res.ok) {
        showToast({ title: 'Задача начата', variant: 'success' });
        refetch();
      } else {
        showToast({ title: res.error, variant: 'destructive' });
      }
    },
    [refetch, showToast]
  );

  const handleCompleteTask = useCallback(
    async (comment: string, photoUris: string[]) => {
      if (!taskForComplete) return;
      setActionLoading(true);
      try {
        const res = await completeRequest(taskForComplete.id, { comment });
        if (res.ok && photoUris.length > 0 && request) {
          const uploadRes = await uploadRequestPhotos(
            request.id,
            photoUris.map((uri) => ({ uri })),
            'after'
          );
          if (!uploadRes.ok) {
            showToast({ title: uploadRes.error, variant: 'destructive' });
          }
        }
        if (res.ok) {
          showToast({ title: 'Заявка завершена', variant: 'success' });
          setShowCompleteModal(false);
          setTaskForComplete(null);
          refetch();
        } else {
          showToast({ title: res.error, variant: 'destructive' });
        }
      } finally {
        setActionLoading(false);
      }
    },
    [taskForComplete, request, refetch, showToast]
  );

  const handleReject = useCallback(
    async (reason: string) => {
      if (!subForReject) return;
      setActionLoading(true);
      setRejectError(null);
      try {
        const res = await rejectRequest(subForReject.id);
        if (res.ok) {
          await postRejectNotification(subForReject.id, reason);
          showToast({ title: 'Подзаявка отклонена', variant: 'success' });
          setShowRejectModal(false);
          setSubForReject(null);
          refetch();
        } else {
          setRejectError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [subForReject, refetch, showToast]
  );

  const handleRateRequest = useCallback(
    async (rating: number, comment?: string) => {
      if (!subForRate) return;

      // В демо-режиме обновляем только локальный стор
      if (isGuest && request && request.id < 0) {
        setRequest((prev) => {
          if (!prev) return prev;
          const updated = {
            ...prev,
            requests: prev.requests.map((sr) =>
              sr.id === subForRate.id
                ? {
                    ...sr,
                    rating,
                    comment,
                  }
                : sr
            ),
          } as RequestGroup;
          return updated;
        });
        showToast({ title: 'Оценка (демо) сохранена', variant: 'success' });
        setShowRatingModal(false);
        setSubForRate(null);
        return;
      }

      const res = await postRating(subForRate.id, rating, comment);
      if (res.ok) {
        showToast({ title: 'Оценка отправлена', variant: 'success' });
        setShowRatingModal(false);
        setSubForRate(null);
        refetch();
      } else {
        showToast({ title: res.error, variant: 'destructive' });
      }
    },
    [subForRate, refetch, showToast, isGuest, request]
  );

  const handleRateClient = useCallback(
    async (rating: number, comment?: string) => {
      if (!request) return;
      const res = await postClientRating(request.id, rating, comment);
      if (res.ok) {
        showToast({ title: 'Оценка клиента отправлена', variant: 'success' });
        setShowClientRatingModal(false);
        refetch();
      } else {
        showToast({ title: res.error, variant: 'destructive' });
      }
    },
    [request, refetch, showToast]
  );

  const handleRedirect = useCallback(
    async (categoryId: number) => {
      if (!subForRedirect) return;
      setActionLoading(true);
      setRedirectError(null);
      try {
        const res = await redirectRequest(subForRedirect.id, categoryId);
        if (res.ok) {
          showToast({ title: 'Подзаявка перенаправлена', variant: 'success' });
          setShowRedirectModal(false);
          setSubForRedirect(null);
          refetch();
        } else {
          setRedirectError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [subForRedirect, refetch, showToast]
  );

  const handleAssign = useCallback(
    async (execs: Array<{ id: number; role: 'executor' | 'leader' }>) => {
      if (!subForAssign) return;
      setActionLoading(true);
      setAssignError(null);
      try {
        const res = await assignExecutorsToRequest(subForAssign.id, execs);
        if (res.ok) {
          showToast({ title: 'Исполнители назначены', variant: 'success' });
          setShowAssignModal(false);
          setSubForAssign(null);
          refetch();
        } else {
          setAssignError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [subForAssign, refetch, showToast]
  );

  const handleDelete = useCallback(
    (sub: SubRequest) => {
      Alert.alert(
        'Удалить заявку?',
        'Это действие нельзя отменить.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              // В демо-режиме просто закрываем экран, ничего не шлём на сервер
              if (isGuest && request && request.id < 0) {
                showToast({ title: 'Демо', description: 'Заявка удалена локально', variant: 'default' });
                goBack();
                return;
              }

              const res = await deleteRequest(sub.id);
              if (res.ok) {
                showToast({ title: 'Заявка удалена', variant: 'success' });
                goBack();
              } else {
                showToast({ title: res.error, variant: 'destructive' });
              }
            },
          },
        ]
      );
    },
    [goBack, showToast, isGuest, request]
  );

  useEffect(() => {
    if (request && role === 'admin-worker' && request.status === 'in_progress') {
      setEditableRequestType(request.request_type ?? 'normal');
      setLocationDetail(request.location_detail ?? '');
      setSubRequestSettings({});
      setAcceptFormError(null);
    }
  }, [request?.id, request?.status, request?.request_type, request?.location_detail, role]);

  const handleAcceptGroupSubmit = useCallback(async () => {
    if (!request) return;
    if (editableRequestType !== 'planned') {
      const allHave = (request.requests ?? []).every((sr) => {
        const s = subRequestSettings[sr.id];
        return s?.sla && s?.complexity;
      });
      if (!allHave) {
        setAcceptFormError('Укажите время выполнения и сложность для всех подзаявок');
        return;
      }
    }
    setAcceptFormError(null);
    setActionLoading(true);
    try {
      const sub_requests: AcceptSubRequestPayload[] = (request.requests ?? []).map((sr) => {
        const s = subRequestSettings[sr.id];
        return {
          id: sr.id,
          sla: editableRequestType === 'planned' ? null : s?.sla ?? null,
          complexity: editableRequestType === 'planned' ? null : s?.complexity ?? null,
          category_id: sr.category_id,
        };
      });
      const res = await patchRequestGroup(request.id, 1, {
        request_type: editableRequestType,
        location_detail: locationDetail.trim() || undefined,
        sub_requests,
      });
      if (res.ok) {
        showToast({ title: 'Заявка принята в работу', variant: 'success' });
        refetch();
      } else {
        setAcceptFormError(res.error);
      }
    } finally {
      setActionLoading(false);
    }
  }, [request, editableRequestType, subRequestSettings, locationDetail, refetch, showToast]);

  const handleRejectGroup = useCallback(async () => {
    if (!request || !rejectGroupReason.trim()) return;
    setActionLoading(true);
    setAcceptFormError(null);
    try {
      const res = await patchRequestGroup(request.id, 2, {
        rejection_reason: rejectGroupReason.trim(),
      });
      if (res.ok) {
        showToast({ title: 'Заявка отклонена', variant: 'success' });
        setRejectGroupReason('');
        refetch();
        goBack();
      } else {
        setAcceptFormError(res.error);
      }
    } finally {
      setActionLoading(false);
    }
  }, [request, rejectGroupReason, refetch, showToast, goBack]);

  const handleToggleLongTerm = useCallback(
    async (requestId: number, _requestGroupId: number, currentStatus: boolean) => {
      const res = await toggleLongTermRequest(requestId, !currentStatus);
      if (res.ok) {
        showToast({
          title: currentStatus ? 'Снято с долгосрочных' : 'Помечено как долгосрочная',
          variant: 'success',
        });
        refetch();
      } else {
        showToast({ title: res.error, variant: 'destructive' });
      }
    },
    [refetch, showToast]
  );

  const isExecutorLeader = useCallback(
    (sub: SubRequest) => {
      return sub.executors?.some(
        (e) => e.user?.id === user?.id && e.RequestExecutor?.role === 'leader'
      );
    },
    [user?.id]
  );

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <PageLoader size={80} />
        <ThemedText style={[styles.loadingText, { color: mutedColor }]}>
          Загрузка заявки...
        </ThemedText>
      </ThemedView>
    );
  }

  if (error || !request) {
    return (
      <ThemedView style={styles.container}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
          <ThemedText style={{ color: textColor, marginLeft: 8 }}>Назад</ThemedText>
        </Pressable>
        <View style={styles.centered}>
          <ThemedText style={[styles.errorText, { color: mutedColor }]}>
            {error || 'Заявка не найдена'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  const sub = request.requests?.[0];
  const allPhotos = (() => {
    const before =
      request.photos?.filter((p) => p.type === 'before').map((p) => ({ photo_url: p.photo_url })) ?? [];
    const after =
      request.photos?.filter((p) => p.type === 'after').map((p) => ({ photo_url: p.photo_url })) ?? [];
    if (before.length || after.length) return [...before, ...after];
    return (sub?.photos ?? []).map((p) => ({ photo_url: p.photo_url }));
  })();

  const subRequests = request.requests ?? [];

  return (
    <ThemedView style={styles.container}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: borderColor,
            paddingTop: 12 + insets.top,
          },
        ]}
      >
        <Pressable onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
          <ThemedText style={[styles.backLabel, { color: textColor }]}>Назад</ThemedText>
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Заявка #{request.id}
        </ThemedText>
        {role && sub && (
          <RequestActionMenu
            request={request}
            subRequest={sub}
            userRole={role}
            userServiceCategoryId={user?.service_category_id}
            userId={user?.id}
            isExecutorLeader={isExecutorLeader(sub)}
            onStartTask={(tid) => handleStartTask(Number(tid))}
            onCompleteTask={(s) => {
              setTaskForComplete(s);
              setShowCompleteModal(true);
            }}
            onReject={(s) => {
              setSubForReject(s);
              setRejectError(null);
              setShowRejectModal(true);
            }}
            onDelete={handleDelete}
            onAssignExecutor={(s) => {
              setSubForAssign(s);
              setAssignError(null);
              setShowAssignModal(true);
            }}
            onChangeExecutors={(s) => {
              setSubForAssign(s);
              setAssignError(null);
              setShowAssignModal(true);
            }}
            onRedirect={(s) => {
              setSubForRedirect(s);
              setRedirectError(null);
              setShowRedirectModal(true);
            }}
            onRateRequest={(s) => {
              setSubForRate(s);
              setShowRatingModal(true);
            }}
            onRateClient={() => setShowClientRatingModal(true)}
            onToggleLongTerm={handleToggleLongTerm}
          />
        )}
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.badges}>
          <View style={[styles.badge, { backgroundColor: primaryColor }]}>
            <ThemedText style={styles.badgeText}>
              {translateStatus(request.status)}
            </ThemedText>
          </View>
          <View style={[styles.badge, { backgroundColor: mutedColor }]}>
            <ThemedText style={styles.badgeText}>
              {translateType(request.request_type ?? 'normal')}
            </ThemedText>
          </View>
        </View>

        {request.request_type === 'planned' && request.planned_date && (
          <View style={styles.block}>
            <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
              Запланировано на
            </ThemedText>
            <ThemedText style={{ color: textColor }}>
              {new Date(request.planned_date).toLocaleDateString('ru-RU', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </ThemedText>
          </View>
        )}

        {subRequests.map((sr) => (
          <View key={sr.id} style={styles.subBlock}>
            {(sr.title || sr.category?.name) && (
              <View style={styles.block}>
                <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
                  Заявка #{sr.id}
                </ThemedText>
                <ThemedText style={[styles.blockValue, { color: textColor }]}>
                  {sr.title || sr.category?.name}
                </ThemedText>
                {sr.category?.name && sr.title && (
                  <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
                    {sr.category.name}
                  </ThemedText>
                )}
              </View>
            )}
            {sr.description ? (
              <View style={styles.block}>
                <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
                  Описание
                </ThemedText>
                <ThemedText style={[styles.blockValue, { color: textColor }]}>
                  {sr.description}
                </ThemedText>
              </View>
            ) : null}
            {(sr.complexity || sr.sla) && (
              <View style={styles.block}>
                <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
                  Доп. информация
                </ThemedText>
                <ThemedText style={{ color: textColor }}>
                  {[
                    sr.complexity && `Сложность: ${sr.complexity}`,
                    sr.sla && `Срок: ${sr.sla}`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </ThemedText>
              </View>
            )}
            {(sr.executors?.length || sr.executor) && (
              <View style={styles.block}>
                <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
                  Исполнители
                </ThemedText>
                {(sr.executors ?? (sr.executor ? [sr.executor] : [])).map(
                  (e: { user?: { full_name?: string } }, i: number) => (
                    <ThemedText key={i} style={{ color: textColor }}>
                      {e.user?.full_name ?? '—'}
                    </ThemedText>
                  )
                )}
              </View>
            )}
            {sr.status === 'completed' && sr.comment && (
              <View style={styles.block}>
                <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
                  Комментарий по выполнению
                </ThemedText>
                <ThemedText style={[styles.blockValue, { color: textColor }]}>
                  {sr.comment}
                </ThemedText>
              </View>
            )}
          </View>
        ))}

        {request.location_detail ? (
          <View style={styles.block}>
            <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
              Локация в офисе
            </ThemedText>
            <ThemedText style={{ color: textColor }}>
              {request.location_detail}
            </ThemedText>
          </View>
        ) : null}

        <View style={styles.block}>
          <ThemedText style={[styles.blockLabel, { color: mutedColor }]}>
            Дата создания
          </ThemedText>
          <ThemedText style={{ color: textColor }}>
            {request.created_date
              ? new Date(request.created_date).toLocaleString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '—'}
          </ThemedText>
        </View>

        {allPhotos.length > 0 && (
          <PhotoGrid
            photos={allPhotos}
            onPress={(url) => setPhotoModalUrl(url)}
          />
        )}

        {role === 'admin-worker' && request.status === 'in_progress' && (
          <View style={[styles.acceptRejectBlock, { backgroundColor: cardBackground, borderColor }]}>
            <ThemedText style={[styles.acceptRejectBlockTitle, { color: textColor }]}>
              Действия по заявке
            </ThemedText>

            <ThemedText style={[styles.acceptModalLabel, { color: mutedColor }]}>
              Тип заявки
            </ThemedText>
            <View style={styles.acceptModalSelectWrap}>
              <Select
                value={editableRequestType}
                onValueChange={setEditableRequestType}
                options={REQUEST_TYPE_OPTIONS}
                placeholder="Выберите тип"
              />
            </View>

            {editableRequestType !== 'planned' && (
              <>
                <ThemedText style={[styles.acceptModalLabel, { color: mutedColor }]}>
                  Время и сложность по подзаявкам
                </ThemedText>
                {(request.requests ?? []).map((sr) => (
                  <View key={sr.id} style={[styles.acceptModalSubBlock, { borderColor }]}>
                    <ThemedText style={[styles.acceptModalSubTitle, { color: textColor }]}>
                      {sr.title || `Подзаявка #${sr.id}`}
                    </ThemedText>
                    <View style={styles.acceptModalRow}>
                      <View style={styles.acceptModalField}>
                        <ThemedText style={[styles.acceptModalFieldLabel, { color: mutedColor }]}>
                          Время (SLA)
                        </ThemedText>
                        <Select
                          value={subRequestSettings[sr.id]?.sla ?? ''}
                          onValueChange={(v) =>
                            setSubRequestSettings((prev) => ({
                              ...prev,
                              [sr.id]: {
                                sla: v,
                                complexity: prev[sr.id]?.complexity ?? '',
                              },
                            }))
                          }
                          options={SLA_OPTIONS}
                          placeholder="Выберите"
                        />
                      </View>
                      <View style={styles.acceptModalField}>
                        <ThemedText style={[styles.acceptModalFieldLabel, { color: mutedColor }]}>
                          Сложность
                        </ThemedText>
                        <Select
                          value={subRequestSettings[sr.id]?.complexity ?? ''}
                          onValueChange={(v) =>
                            setSubRequestSettings((prev) => ({
                              ...prev,
                              [sr.id]: {
                                sla: prev[sr.id]?.sla ?? '',
                                complexity: v,
                              },
                            }))
                          }
                          options={COMPLEXITY_OPTIONS}
                          placeholder="Выберите"
                        />
                      </View>
                    </View>
                  </View>
                ))}
              </>
            )}

            <ThemedText style={[styles.acceptModalLabel, { color: mutedColor }]}>
              Локация в офисе (необязательно)
            </ThemedText>
            <TextInput
              style={[
                styles.acceptRejectBlockInput,
                {
                  color: textColor,
                  borderColor,
                  backgroundColor,
                },
              ]}
              placeholder="Укажите локацию"
              placeholderTextColor={mutedColor}
              value={locationDetail}
              onChangeText={setLocationDetail}
            />

            <ThemedText style={[styles.acceptModalLabel, { color: mutedColor }]}>
              Причина отклонения (если необходимо)
            </ThemedText>
            <TextInput
              style={[
                styles.rejectGroupInput,
                {
                  color: textColor,
                  borderColor,
                  backgroundColor,
                },
              ]}
              placeholder="Укажите причину отклонения..."
              placeholderTextColor={mutedColor}
              value={rejectGroupReason}
              onChangeText={setRejectGroupReason}
              multiline
            />

            {acceptFormError ? (
              <ThemedText style={styles.acceptModalError}>{acceptFormError}</ThemedText>
            ) : null}

            <View style={styles.acceptRejectBlockButtons}>
              <Pressable
                onPress={handleAcceptGroupSubmit}
                disabled={actionLoading}
                style={[styles.acceptRejectBlockBtn, styles.acceptRejectBlockBtnAccept]}
              >
                <MaterialIcons name="check-circle" size={20} color="#FFF" />
                <ThemedText style={styles.acceptRejectLabel}>
                  {actionLoading ? '...' : 'Принять'}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => handleRejectGroup()}
                disabled={!rejectGroupReason.trim() || actionLoading}
                style={[styles.acceptRejectBlockBtn, styles.acceptRejectBlockBtnReject]}
              >
                <MaterialIcons name="cancel" size={20} color="#FFF" />
                <ThemedText style={styles.acceptRejectLabel}>
                  Отклонить
                </ThemedText>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      {photoModalUrl ? (
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setPhotoModalUrl(null)}
        >
          <View style={styles.photoModal}>
            <Image
              source={{ uri: photoModalUrl }}
              style={styles.photoModalImage}
              resizeMode="contain"
            />
            <ThemedText style={styles.photoModalHint}>Нажмите, чтобы закрыть</ThemedText>
          </View>
        </Pressable>
      ) : null}

      <CompleteTaskModal
        visible={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false);
          setTaskForComplete(null);
        }}
        onSubmit={handleCompleteTask}
        subRequest={taskForComplete}
        requestGroupId={request.id}
        loading={actionLoading}
      />

      <RejectModal
        visible={showRejectModal}
        onClose={() => {
          setShowRejectModal(false);
          setSubForReject(null);
          setRejectError(null);
        }}
        onSubmit={handleReject}
        subRequest={subForReject}
        loading={actionLoading}
        error={rejectError}
      />

      <RatingModal
        visible={showRatingModal}
        onClose={() => {
          setShowRatingModal(false);
          setSubForRate(null);
        }}
        onSubmit={handleRateRequest}
        title="Оценить работу"
        subRequestId={subForRate?.id}
      />

      <RatingModal
        visible={showClientRatingModal}
        onClose={() => setShowClientRatingModal(false)}
        onSubmit={handleRateClient}
        title="Оценить клиента"
      />

      <RedirectModal
        visible={showRedirectModal}
        onClose={() => {
          setShowRedirectModal(false);
          setSubForRedirect(null);
          setRedirectError(null);
        }}
        onSubmit={handleRedirect}
        subRequest={subForRedirect}
        categories={categories}
        loading={actionLoading}
        error={redirectError}
      />

      <AssignExecutorsModal
        visible={showAssignModal}
        onClose={() => {
          setShowAssignModal(false);
          setSubForAssign(null);
          setAssignError(null);
        }}
        onSubmit={handleAssign}
        subRequest={subForAssign}
        executors={executors}
        userServiceCategoryId={user?.service_category_id}
        loading={actionLoading}
        error={assignError}
      />

    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 8,
  },
  backLabel: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  badges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 20,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 14,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  block: {
    marginBottom: 20,
  },
  subBlock: {
    marginBottom: 8,
  },
  blockLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  blockValue: {
    fontSize: 16,
    lineHeight: 22,
  },
  photoSection: {
    marginTop: 8,
    marginBottom: 24,
  },
  photoSectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  photoGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  photoTile: {
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: '#1C1C1E',
  },
  photoModal: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  photoModalImage: {
    width: '100%',
    height: '80%',
  },
  photoModalHint: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 12,
    marginTop: 12,
  },
  acceptRejectLabel: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  acceptRejectBlock: {
    marginTop: 24,
    marginBottom: 32,
    padding: 20,
    borderRadius: 16,
    borderWidth: 1,
  },
  acceptRejectBlockTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  acceptRejectBlockInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 44,
    marginBottom: 16,
  },
  acceptRejectBlockButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  acceptRejectBlockBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 8,
  },
  acceptRejectBlockBtnAccept: {
    backgroundColor: '#22C55E',
  },
  acceptRejectBlockBtnReject: {
    backgroundColor: '#EF4444',
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  rejectGroupContent: {
    borderRadius: 16,
    padding: 24,
  },
  rejectGroupTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  rejectGroupSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  rejectGroupInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 20,
  },
  rejectGroupButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  rejectGroupBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
  },
  rejectGroupBtnDanger: {
    backgroundColor: '#EF4444',
    borderColor: '#EF4444',
  },
  rejectGroupBtnDangerText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  acceptModalContent: {
    borderRadius: 16,
    padding: 24,
    maxHeight: '85%',
  },
  acceptModalScroll: {
    maxHeight: 400,
  },
  acceptModalLabel: {
    fontSize: 12,
    marginBottom: 8,
    marginTop: 4,
  },
  acceptModalSelectWrap: {
    marginBottom: 16,
  },
  acceptModalSubBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  acceptModalSubTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  acceptModalRow: {
    flexDirection: 'row',
    gap: 12,
  },
  acceptModalField: {
    flex: 1,
    gap: 6,
  },
  acceptModalFieldLabel: {
    fontSize: 11,
  },
  acceptModalButtons: {
    marginTop: 16,
  },
  acceptModalBtnSuccess: {
    backgroundColor: '#22C55E',
    borderColor: '#22C55E',
  },
  acceptModalError: {
    color: '#EF4444',
    fontSize: 14,
    marginTop: 12,
  },
});
