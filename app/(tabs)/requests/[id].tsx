import { useAsyncResource } from '@/hooks/use-async-resource';
import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { AssignExecutorsModal } from '@/components/requests/assign-executors-modal';
import { CompleteTaskModal } from '@/components/requests/complete-task-modal';
import { ClientRemarkModal } from '@/components/requests/client-remark-modal';
import { CommentsModal } from '@/components/requests/comments-modal';
import { DeleteRequestModal } from '@/components/requests/delete-request-modal';
import {
  AdminAcceptRequestModal,
  AdminRejectRequestModal,
  type AdminAcceptRequestPayload,
} from '@/components/requests/admin-request-decision-modals';
import { EditRequestGroupModal } from '@/components/requests/edit-request-group-modal';
import { RatingModal } from '@/components/requests/rating-modal';
import { RedirectModal } from '@/components/requests/redirect-modal';
import { RejectModal } from '@/components/requests/reject-modal';
import { RequestClosureInfo } from '@/components/requests/request-closure-info';
import { RequestRejectionInfo } from '@/components/requests/request-rejection-info';
import { RequestActionMenu, type RequestUserRole } from '@/components/requests/request-action-menu';
import {
  getRequestPrimaryActions,
  isStaffCompletableSubRequest,
} from '@/components/requests/request-action-config';
import {
  RequestDescriptionCard,
  RequestDetailHeader,
  RequestLocationCard,
  RequestMetaCard,
  RequestObserverNotice,
  RequestPhotoStrip,
  RequestPrimaryActions,
} from '@/components/requests/request-detail-ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  assignExecutorsToRequest,
  changeExecutorsToRequest,
  clientConfirmRequest,
  clientRemarkRequest,
  confirmRequestWork,
  completeRequest,
  deleteRequestGroup,
  executeRequest,
  getExecutors,
  getSubRequestCategoryId,
  getOffices,
  getRequestGroupById,
  getServiceCategories,
  patchRequestGroup,
  postClientRating,
  postRating,
  postRejectNotification,
  adminCompleteRequest,
  adminStartRequest,
  takeRequestGroup,
  redirectRequest,
  rejectRequest,
  toggleLongTermRequest,
  updateRequestGroup,
  uploadRequestPhotos,
  type ExecutorInCategory,
  type Office,
  type RequestGroup,
  type SubRequest,
  type UpdateRequestGroupPayload,
} from '@/lib/api';
import { PageLoader } from '@/components/ui';
import { useAuthStore } from '@/stores/auth-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  formatServiceCategoryDisplayName,
  isAdministrativeRequestGroup,
  isLongTermRequestGroup,
} from '@/constants/requests';
import { shareRequestWithContent } from '@/lib/shareRequest';

function getSubcategoryName(sub: SubRequest | undefined): string | undefined {
  if (!sub?.title?.trim()) return undefined;
  const title = sub.title.trim();
  const categoryDisplay = formatServiceCategoryDisplayName(sub.category?.name);
  if (title === categoryDisplay) return undefined;
  if (sub.category?.name?.trim() === title) return undefined;
  return title;
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

  const [photoModalUrl, setPhotoModalUrl] = useState<string | null>(null);

  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [completeMode, setCompleteMode] = useState<'executor' | 'staff'>('executor');
  const [staffCompleteTargets, setStaffCompleteTargets] = useState<SubRequest[]>([]);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [showClientRatingModal, setShowClientRatingModal] = useState(false);
  const [showRedirectModal, setShowRedirectModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAcceptGroupModal, setShowAcceptGroupModal] = useState(false);
  const [showRejectGroupModal, setShowRejectGroupModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showRemarkModal, setShowRemarkModal] = useState(false);
  const [remarkError, setRemarkError] = useState<string | null>(null);

  const [taskForComplete, setTaskForComplete] = useState<SubRequest | null>(null);
  const [subForReject, setSubForReject] = useState<SubRequest | null>(null);
  const [subForRate, setSubForRate] = useState<SubRequest | null>(null);
  const [subForRedirect, setSubForRedirect] = useState<SubRequest | null>(null);
  const [subForAssign, setSubForAssign] = useState<SubRequest | null>(null);

  const [actionLoading, setActionLoading] = useState(false);
  const [rejectError, setRejectError] = useState<string | null>(null);
  const [redirectError, setRedirectError] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [offices, setOffices] = useState<Office[]>([]);
  /** Офис, выбранный в модалке принятия: категории грузятся под него. */
  const [acceptOfficeId, setAcceptOfficeId] = useState<number | null>(null);

  const [adminAcceptError, setAdminAcceptError] = useState<string | null>(null);
  const [adminRejectError, setAdminRejectError] = useState<string | null>(null);
  const [showCommentsModal, setShowCommentsModal] = useState(false);

  const numId = id ? parseInt(id, 10) : NaN;

  const fetchRequest = useCallback(async () => {
    if (!id || !Number.isInteger(numId) || numId === 0) throw new Error('Неверный id заявки');
    if (isGuest && numId < 0) {
      const found = guestRequests.find((request) => request.id === numId);
      if (!found) throw new Error('Заявка не найдена (демо)');
      return found as RequestGroup;
    }
    const res = await getRequestGroupById(numId);
    if (!res.ok) throw new Error(res.error);
    return res.data;
  }, [id, numId, isGuest, guestRequests]);
  const { data: request, setData: setRequest, loading, error, refresh: refetch } = useAsyncResource<RequestGroup | null>(fetchRequest, null, true, user?.id);

  const editOfficeId = request?.office_id ?? request?.office?.id;
  const loadEditCategories = useCallback(async () => {
    if (!editOfficeId) return [];
    const res = await getServiceCategories(editOfficeId);
    return res.ok ? res.data : [];
  }, [editOfficeId]);
  const { data: categories } = useAsyncResource(loadEditCategories, [], showEditModal && !!editOfficeId);

  useEffect(() => {
    if (role === 'admin-worker') {
      getOffices().then(setOffices);
    }
  }, [role]);

  /** Категории привязаны к офису: перезагружаем их при смене офиса в модалке принятия. */
  const loadAcceptCategories = useCallback(async () => {
    if (acceptOfficeId == null) return [];
    const res = await getServiceCategories(acceptOfficeId);
    return res.ok ? res.data : [];
  }, [acceptOfficeId]);
  const { data: acceptCategories, loading: acceptCategoriesLoading } = useAsyncResource(loadAcceptCategories, [], showAcceptGroupModal && acceptOfficeId != null);

  const assignCategoryId = subForAssign ? getSubRequestCategoryId(subForAssign) : null;
  const loadExecutors = useCallback(async () => {
    if (!assignCategoryId) return [];
    const res = await getExecutors(assignCategoryId, editOfficeId);
    return res.ok ? res.data : [];
  }, [assignCategoryId, editOfficeId]);
  const { data: executors, loading: executorsLoading } = useAsyncResource<ExecutorInCategory[]>(loadExecutors, [], role === 'department-head' && showAssignModal && !!assignCategoryId);

  /** Как системный свайп «назад»: pop стека. Без истории (deep link и т.п.) — на список заявок. */
  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/requests');
    }
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

  const defaultStaffCompleteComment =
    role === 'department-head' ? 'Завершено офис-менеджером' : 'Завершено администратором';
  /** Сотрудник отметил выполнение сам — заявка сразу уходит Клиенту на подтверждение. */
  const staffCompleteSuccessTitle =
    'Выполнение отмечено — заявка передана Клиенту на подтверждение';

  const handleCompleteTask = useCallback(
    async (comment: string, photoUris: string[]) => {
      if (!request) return;
      setActionLoading(true);
      try {
        if (completeMode === 'staff') {
          if (!staffCompleteTargets.length) {
            showToast({ title: 'Нет подзаявок для завершения', variant: 'destructive' });
            return;
          }
          const completionComment = comment.trim() || defaultStaffCompleteComment;
          for (const sr of staffCompleteTargets) {
            const res = await adminCompleteRequest(sr.id, { comment: completionComment });
            if (!res.ok) {
              throw new Error(res.error);
            }
          }
          if (photoUris.length > 0) {
            const uploadRes = await uploadRequestPhotos(
              request.id,
              photoUris.map((uri) => ({ uri })),
              'after'
            );
            if (!uploadRes.ok) {
              showToast({
                title: 'Ошибка загрузки',
                description: uploadRes.error,
                variant: 'destructive',
                duration: 4000,
              });
            }
          }
          showToast({ title: staffCompleteSuccessTitle, variant: 'success' });
          setShowCompleteModal(false);
          setTaskForComplete(null);
          setStaffCompleteTargets([]);
          setCompleteMode('executor');
          refetch();
          return;
        }

        if (!taskForComplete) return;
        const res = await completeRequest(taskForComplete.id, { comment });
        if (res.ok && photoUris.length > 0) {
          const uploadRes = await uploadRequestPhotos(
            request.id,
            photoUris.map((uri) => ({ uri })),
            'after'
          );
          if (!uploadRes.ok) {
            showToast({
              title: 'Ошибка загрузки',
              description: uploadRes.error,
              variant: 'destructive',
              duration: 4000,
            });
          }
        }
        if (res.ok) {
          showToast({ title: 'Работы отмечены выполненными', variant: 'success' });
          setShowCompleteModal(false);
          setTaskForComplete(null);
          refetch();
        } else {
          showToast({ title: res.error, variant: 'destructive' });
        }
      } catch (e) {
        const message = e instanceof Error ? e.message : 'Ошибка при завершении заявки';
        showToast({ title: message, variant: 'destructive' });
      } finally {
        setActionLoading(false);
      }
    },
    [
      completeMode,
      taskForComplete,
      request,
      staffCompleteTargets,
      defaultStaffCompleteComment,
      staffCompleteSuccessTitle,
      refetch,
      showToast,
    ]
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
    [subForRate, isGuest, request, setRequest, showToast, refetch]
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
    async (execs: { id: number; role: 'executor' | 'leader' }[]) => {
      if (!subForAssign) return;
      setActionLoading(true);
      setAssignError(null);
      const useAssignApi = subForAssign.status === 'awaiting_assignment';
      try {
        const res = useAssignApi
          ? await assignExecutorsToRequest(subForAssign.id, execs)
          : await changeExecutorsToRequest(subForAssign.id, execs);
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

  /** Удаление — только Руководитель платформы: вся заявка, логически, с необязательной причиной. */
  const handleDelete = useCallback(() => {
    setDeleteError(null);
    setShowDeleteModal(true);
  }, []);

  const handleConfirmDelete = useCallback(
    async (reason: string | null) => {
      if (!request) return;
      // В демо-режиме просто закрываем экран, ничего не шлём на сервер
      if (isGuest && request.id < 0) {
        setShowDeleteModal(false);
        showToast({ title: 'Демо', description: 'Заявка удалена локально', variant: 'default' });
        goBack();
        return;
      }
      setDeleting(true);
      setDeleteError(null);
      try {
        const res = await deleteRequestGroup(request.id, reason);
        if (res.ok) {
          setShowDeleteModal(false);
          showToast({
            title: 'Заявка удалена',
            description: 'Запись сохранена в журнале удалений',
            variant: 'success',
          });
          goBack();
        } else {
          setDeleteError(res.error);
        }
      } finally {
        setDeleting(false);
      }
    },
    [goBack, showToast, isGuest, request]
  );

  /** Администратор подтверждает выполненные работы — заявка уходит Клиенту. */
  const handleAdminConfirmWork = useCallback(() => {
    if (!request) return;
    Alert.alert(
      'Подтвердить выполнение?',
      'Заявка уйдёт Клиенту на подтверждение. Если он не ответит за 24 часа, она закроется автоматически.',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Подтвердить',
          onPress: async () => {
            setActionLoading(true);
            try {
              const res = await confirmRequestWork(request.id);
              if (res.ok) {
                showToast({ title: 'Заявка передана Клиенту на подтверждение', variant: 'success' });
                refetch();
              } else {
                showToast({ title: res.error, variant: 'destructive' });
              }
            } finally {
              setActionLoading(false);
            }
          },
        },
      ]
    );
  }, [request, refetch, showToast]);

  /** Автор принимает результат — заявка закрывается. */
  const handleClientConfirm = useCallback(() => {
    if (!request) return;
    Alert.alert('Подтвердить выполнение?', 'Заявка будет закрыта.', [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Подтвердить',
        onPress: async () => {
          setActionLoading(true);
          try {
            const res = await clientConfirmRequest(request.id);
            if (res.ok) {
              showToast({ title: 'Заявка закрыта', description: 'Спасибо за подтверждение', variant: 'success' });
              refetch();
            } else {
              showToast({ title: res.error, variant: 'destructive' });
            }
          } finally {
            setActionLoading(false);
          }
        },
      },
    ]);
  }, [request, refetch, showToast]);

  /** Автор возвращает заявку на доработку с замечаниями. */
  const handleClientRemark = useCallback(
    async (remark: string) => {
      if (!request || !remark) return;
      setRemarkError(null);
      setActionLoading(true);
      try {
        const res = await clientRemarkRequest(request.id, remark);
        if (res.ok) {
          setShowRemarkModal(false);
          showToast({ title: 'Замечания отправлены', description: 'Заявка возвращена на доработку', variant: 'success' });
          refetch();
        } else {
          setRemarkError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [request, refetch, showToast]
  );

  const openRemarkModal = useCallback(() => {
    setRemarkError(null);
    setShowRemarkModal(true);
  }, []);

  const handleAdminAccept = useCallback(
    async (body: AdminAcceptRequestPayload) => {
      if (!request) return;
      setAdminAcceptError(null);
      setActionLoading(true);
      try {
        const res = await patchRequestGroup(request.id, 1, body);
        if (res.ok) {
          const direct = body.sub_requests.filter((sr) => sr.executors?.length).length;
          showToast({
            title:
              direct === 0
                ? 'Заявка передана офис-менеджеру'
                : direct === body.sub_requests.length
                  ? 'Исполнитель назначен'
                  : 'Исполнители назначены, остальное передано офис-менеджеру',
            variant: 'success',
          });
          refetch();
          setShowAcceptGroupModal(false);
        } else {
          setAdminAcceptError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [request, refetch, showToast]
  );

  const handleAdminReject = useCallback(
    async (rejection_reason: string) => {
      if (!request) return;
      setAdminRejectError(null);
      setActionLoading(true);
      try {
        const res = await patchRequestGroup(request.id, 2, { rejection_reason });
        if (res.ok) {
          showToast({ title: 'Заявка отклонена', variant: 'success' });
          refetch();
          setShowRejectGroupModal(false);
          goBack();
        } else {
          setAdminRejectError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [request, refetch, showToast, goBack]
  );

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

  const handleEditRequestGroup = useCallback(
    async (payload: UpdateRequestGroupPayload) => {
      if (!request) return;
      setActionLoading(true);
      setEditError(null);
      try {
        const res = await updateRequestGroup(request.id, payload);
        if (res.ok) {
          showToast({ title: 'Заявка обновлена', variant: 'success' });
          setShowEditModal(false);
          refetch();
        } else {
          setEditError(res.error);
        }
      } finally {
        setActionLoading(false);
      }
    },
    [request, refetch, showToast]
  );

  /** «Взять в работу»: администратор закрепляет Техника/Клининг заявку за собой. */
  const handleAdminTakeGroup = useCallback(async () => {
    if (!request) return;
    setActionLoading(true);
    try {
      const res = await takeRequestGroup(request.id);
      if (res.ok) {
        showToast({ title: 'Заявка закреплена за вами', variant: 'success' });
        refetch();
      } else {
        showToast({ title: res.error, variant: 'destructive' });
      }
    } finally {
      setActionLoading(false);
    }
  }, [request, refetch, showToast]);

  /** Взять административную заявку в работу без назначения исполнителя. */
  const handleStaffStartGroup = useCallback(
    async (subReq: SubRequest) => {
      setActionLoading(true);
      try {
        const res = await adminStartRequest(subReq.id);
        if (res.ok) {
          showToast({ title: 'Заявка взята в работу', variant: 'success' });
          refetch();
        } else {
          showToast({ title: res.error, variant: 'destructive' });
        }
      } finally {
        setActionLoading(false);
      }
    },
    [refetch, showToast]
  );

  const handleAdminCompleteGroup = useCallback(() => {
    if (!request) return;

    const targets = (request.requests ?? []).filter(isStaffCompletableSubRequest);

    if (!targets.length) {
      showToast({ title: 'Нет подзаявок для завершения', variant: 'destructive' });
      return;
    }

    setCompleteMode('staff');
    setStaffCompleteTargets(targets);
    setTaskForComplete(targets[0]);
    setShowCompleteModal(true);
  }, [request, showToast]);

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
        <Pressable onPress={goBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
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
  const isLongTerm = isLongTermRequestGroup(request);
  const isAdministrative = isAdministrativeRequestGroup(request);
  const description = sub?.description?.trim() ?? '';
  const executorNames = sub
    ? (sub.executors ?? (sub.executor ? [sub.executor] : [])).map(
        (e) => e.user?.full_name?.trim() || '—'
      )
    : [];
  const primaryActions =
    role && sub
      ? getRequestPrimaryActions({
          request,
          subRequest: sub,
          userRole: role,
          userId: user?.id,
          isExecutorLeader: isExecutorLeader(sub),
          onShare: () => {
            void shareRequestWithContent(request, sub).catch((err) => {
              if (__DEV__) console.warn('[RequestDetail] Share failed', err);
            });
          },
          onStartTask: (tid) => handleStartTask(Number(tid)),
          onCompleteTask: (s) => {
            setCompleteMode('executor');
            setStaffCompleteTargets([]);
            setTaskForComplete(s);
            setShowCompleteModal(true);
          },
          onAdminCompleteGroup: handleAdminCompleteGroup,
          onStaffStartGroup: (s) => void handleStaffStartGroup(s),
          onAdminTakeGroup: () => void handleAdminTakeGroup(),
          onAdminConfirmWork: handleAdminConfirmWork,
          onClientConfirm: handleClientConfirm,
          onClientRemark: openRemarkModal,
          onAdminAcceptGroup: () => {
            setAdminAcceptError(null);
            setShowAcceptGroupModal(true);
          },
        })
      : [];

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
        <Pressable onPress={goBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
        </Pressable>
        <View style={styles.headerTitleSpacer} />
        <View style={styles.headerActions}>
          {!isGuest && sub ? (
            <Pressable
              onPress={() => setShowCommentsModal(true)}
              style={({ pressed }) => [
                styles.headerIconBtn,
                { opacity: pressed ? 0.75 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Комментарии"
            >
              <MaterialIcons
                name="chat-bubble-outline"
                size={22}
                color={showCommentsModal ? primaryColor : textColor}
              />
            </Pressable>
          ) : null}
          {role && sub ? (
          <RequestActionMenu
            request={request}
            subRequest={sub}
            userRole={role}
            userId={user?.id}
            isExecutorLeader={isExecutorLeader(sub)}
            onStartTask={(tid) => handleStartTask(Number(tid))}
            onCompleteTask={(s) => {
              setCompleteMode('executor');
              setStaffCompleteTargets([]);
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
            onRedirect={
              role === 'executor'
                ? (s) => {
                    setSubForRedirect(s);
                    setRedirectError(null);
                    setShowRedirectModal(true);
                  }
                : undefined
            }
            onRateRequest={(s) => {
              setSubForRate(s);
              setShowRatingModal(true);
            }}
            onRateClient={() => setShowClientRatingModal(true)}
            onToggleLongTerm={handleToggleLongTerm}
            onAdminCompleteGroup={handleAdminCompleteGroup}
            onStaffStartGroup={(s) => void handleStaffStartGroup(s)}
            onAdminTakeGroup={() => void handleAdminTakeGroup()}
            onAdminConfirmWork={handleAdminConfirmWork}
            onClientConfirm={handleClientConfirm}
            onClientRemark={openRemarkModal}
            onAdminAcceptGroup={() => {
              setAdminAcceptError(null);
              setShowAcceptGroupModal(true);
            }}
            onAdminRejectGroup={() => {
              setAdminRejectError(null);
              setShowRejectGroupModal(true);
            }}
            onEditRequestGroup={() => {
              setEditError(null);
              setShowEditModal(true);
            }}
            onOpenComments={() => setShowCommentsModal(true)}
          />
          ) : null}
        </View>
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <RequestDetailHeader request={request} sub={sub} isLongTerm={isLongTerm} />

        <RequestRejectionInfo request={request} userRole={role} />

        <RequestClosureInfo
          request={request}
          isAuthor={user?.id != null && Number(request.client_id) === Number(user.id)}
        />

        {isAdministrative && role === 'admin-worker' ? (
          <RequestObserverNotice text="Административная заявка. Её ведёт офис-менеджер офиса — вы видите её для контроля статуса и истории." />
        ) : null}

        {description ? <RequestDescriptionCard description={description} /> : null}

        <RequestLocationCard
          officeName={request.office?.name}
          officeAddress={request.office?.address}
          locationDetail={request.location_detail}
        />

        <RequestMetaCard
          categoryName={sub?.category?.name}
          subcategoryName={getSubcategoryName(sub)}
          createdDate={request.created_date || sub?.created_date}
          clientName={request.client?.full_name}
          plannedDate={
            request.request_type === 'planned' ? request.planned_date : undefined
          }
          executors={executorNames.length > 0 ? executorNames : undefined}
          responsibleName={request.takenByAdmin?.full_name}
          completionComment={
            sub?.status === 'completed' ? sub.comment : undefined
          }
        />

        {subRequests.length > 1 ? (
          subRequests.slice(1).map((sr) => (
            <RequestMetaCard
              key={sr.id}
              title={`Подзаявка #${sr.id}`}
              categoryName={sr.category?.name}
              subcategoryName={getSubcategoryName(sr)}
              createdDate={sr.created_date}
              completionComment={
                sr.status === 'completed' ? sr.comment : undefined
              }
              executors={
                (sr.executors ?? (sr.executor ? [sr.executor] : [])).map(
                  (e) => e.user?.full_name?.trim() || '—'
                )
              }
            />
          ))
        ) : null}

        <RequestPhotoStrip
          photos={allPhotos}
          onPress={(url) => setPhotoModalUrl(url)}
        />

        <RequestPrimaryActions actions={primaryActions} />
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

      <CommentsModal
        visible={showCommentsModal}
        onClose={() => setShowCommentsModal(false)}
        requestId={sub?.id ?? null}
        currentUserId={user?.id}
        currentUserName={user?.full_name}
        currentUserRole={role ?? undefined}
      />

      <CompleteTaskModal
        visible={showCompleteModal}
        onClose={() => {
          setShowCompleteModal(false);
          setTaskForComplete(null);
          setStaffCompleteTargets([]);
          setCompleteMode('executor');
        }}
        onSubmit={handleCompleteTask}
        subRequest={taskForComplete}
        requestGroupId={request.id}
        loading={actionLoading}
        title={
          completeMode === 'staff' ? 'Завершить без назначения' : 'Завершить задачу'
        }
        subtitle={
          completeMode === 'staff'
            ? `Заявка #${request.id}${staffCompleteTargets.length > 1 ? ` · подзаявок: ${staffCompleteTargets.length}` : ''}`
            : undefined
        }
      />

      {role === 'admin-worker' && request.status === 'in_progress' && (
        <>
          <AdminAcceptRequestModal
            visible={showAcceptGroupModal}
            request={request}
            offices={offices}
            categories={acceptCategories}
            categoriesLoading={acceptCategoriesLoading}
            loading={actionLoading}
            error={adminAcceptError}
            onClose={() => {
              setShowAcceptGroupModal(false);
              setAdminAcceptError(null);
              setAcceptOfficeId(null);
            }}
            onOfficeChange={setAcceptOfficeId}
            onAccept={handleAdminAccept}
          />
          <AdminRejectRequestModal
            visible={showRejectGroupModal}
            loading={actionLoading}
            error={adminRejectError}
            onClose={() => {
              setShowRejectGroupModal(false);
              setAdminRejectError(null);
            }}
            onReject={handleAdminReject}
          />
        </>
      )}

      {showRemarkModal ? (
        <ClientRemarkModal
          visible
          loading={actionLoading}
          error={remarkError}
          onClose={() => setShowRemarkModal(false)}
          onSubmit={handleClientRemark}
        />
      ) : null}

      {role === 'manager' ? (
        <DeleteRequestModal
          visible={showDeleteModal}
          requestId={request.id}
          loading={deleting}
          error={deleteError}
          onClose={() => setShowDeleteModal(false)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}

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
        executorsLoading={executorsLoading}
        loading={actionLoading}
        error={assignError}
      />

      <EditRequestGroupModal
        visible={showEditModal}
        request={request}
        categories={categories}
        loading={actionLoading}
        error={editError}
        onClose={() => {
          setShowEditModal(false);
          setEditError(null);
        }}
        onSubmit={handleEditRequestGroup}
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
    minWidth: 44,
    minHeight: 44,
    padding: 8,
    marginRight: 8,
  },
  headerTitleSpacer: {
    flex: 1,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 24,
    paddingBottom: 48,
  },
  photoModal: {
    ...StyleSheet.absoluteFill,
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
});
