import type { MaterialIcons } from '@expo/vector-icons';
import type { RequestGroup, SubRequest } from '@/lib/api';

export type RequestUserRole =
  | 'client'
  | 'admin-worker'
  | 'department-head'
  | 'executor'
  | 'manager';

export interface ActionItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onClick: () => void;
  variant: 'default' | 'destructive' | 'primary';
}

export interface GetActionsParams {
  request: RequestGroup;
  subRequest?: SubRequest | null;
  userRole: RequestUserRole;
  userServiceCategoryId?: number;
  userId?: number;
  isExecutorLeader?: boolean;
  onShare: () => void;
  onStartTask?: (id: number) => void;
  onCompleteTask?: (subReq: SubRequest) => void;
  onReject?: (subReq: SubRequest) => void;
  onDelete?: (subReq: SubRequest) => void;
  onAssignExecutor?: (subReq: SubRequest) => void;
  onChangeExecutors?: (subReq: SubRequest) => void;
  onRedirect?: (subReq: SubRequest) => void;
  onRateRequest?: (subReq: SubRequest) => void;
  onRateClient?: () => void;
  onToggleLongTerm?: (
    requestId: number,
    requestGroupId: number,
    currentStatus: boolean
  ) => void;
  onAdminCompleteGroup?: () => void;
  onAdminAcceptGroup?: () => void;
  onAdminRejectGroup?: () => void;
  onEditRequestGroup?: () => void;
  onOpenComments?: () => void;
}

const STAFF_COMPLETE_SUB_STATUSES = ['in_progress', 'awaiting_assignment', 'assigned'];

/** Подзаявки, которые можно закрыть без назначения (группа не в финальном статусе). */
function canStaffCompleteWithoutAssignment(request: RequestGroup): boolean {
  if (['completed', 'rejected', 'cancelled'].includes(request.status)) {
    return false;
  }
  return (request.requests ?? []).some((sr) => STAFF_COMPLETE_SUB_STATUSES.includes(sr.status));
}

export function getRequestActions(params: GetActionsParams): ActionItem[] {
  const {
    request,
    subRequest,
    userRole,
    userServiceCategoryId,
    userId,
    isExecutorLeader,
    onShare,
    onStartTask,
    onCompleteTask,
    onReject,
    onDelete,
    onAssignExecutor,
    onChangeExecutors,
    onRedirect,
    onRateRequest,
    onRateClient,
    onToggleLongTerm,
    onAdminCompleteGroup,
    onAdminAcceptGroup,
    onAdminRejectGroup,
    onEditRequestGroup,
    onOpenComments,
  } = params;

  const actions: ActionItem[] = [];
  const isSub = !!subRequest;

  const shareRoles: RequestUserRole[] = [
    'client',
    'executor',
    'manager',
    'department-head',
    'admin-worker',
  ];
  if (shareRoles.includes(userRole)) {
    actions.push({
      icon: 'share',
      label: 'Поделиться ссылкой',
      onClick: onShare,
      variant: 'default',
    });
  }

  if (onOpenComments) {
    actions.push({
      icon: 'chat-bubble-outline',
      label: 'Комментировать',
      onClick: onOpenComments,
      variant: 'default',
    });
  }

  if (userRole === 'client') {
    if (isSub && subRequest) {
      if (subRequest.status === 'completed' && onRateRequest) {
        actions.push({
          icon: 'star',
          label: subRequest.rating ? 'Изменить оценку' : 'Оценить работу',
          onClick: () => onRateRequest(subRequest),
          variant: 'primary',
        });
      }
      if (subRequest.status === 'in_progress' && onDelete) {
        actions.push({
          icon: 'delete',
          label: 'Удалить заявку',
          onClick: () => onDelete(subRequest),
          variant: 'destructive',
        });
      }
    } else if (!isSub && request.status === 'in_progress' && onDelete) {
      actions.push({
        icon: 'delete',
        label: 'Удалить заявку',
        onClick: () => onDelete(request.requests?.[0] ?? ({} as SubRequest)),
        variant: 'destructive',
      });
    }
  }

  if (userRole === 'executor' && isSub && subRequest && isExecutorLeader) {
    if (subRequest.status === 'assigned' && onStartTask) {
      actions.push({
        icon: 'play-arrow',
        label: 'Начать задачу',
        onClick: () => onStartTask(subRequest.id),
        variant: 'primary',
      });
    }
    if (subRequest.status === 'execution' && onCompleteTask) {
      actions.push({
        icon: 'check-circle',
        label: 'Завершить задачу',
        onClick: () => onCompleteTask(subRequest),
        variant: 'primary',
      });
    }
    if (
      (subRequest.status === 'assigned' || subRequest.status === 'execution') &&
      onReject
    ) {
      actions.push({
        icon: 'cancel',
        label: 'Отклонить',
        onClick: () => onReject(subRequest),
        variant: 'destructive',
      });
    }
    if (subRequest.status !== 'completed' && onRedirect) {
      actions.push({
        icon: 'arrow-forward',
        label: 'Перенаправить к другой категории',
        onClick: () => onRedirect(subRequest),
        variant: 'default',
      });
    }
    if (
      request.status === 'completed' &&
      request.client?.role === 'client' &&
      onRateClient
    ) {
      actions.push({
        icon: 'star',
        label: 'Оценить клиента',
        onClick: onRateClient,
        variant: 'default',
      });
    }
  }

  if (userRole === 'manager') {
    if (isSub && subRequest?.status === 'completed' && onRateRequest) {
      actions.push({
        icon: 'star',
        label: subRequest.rating ? 'Изменить оценку' : 'Оценить работу',
        onClick: () => onRateRequest(subRequest),
        variant: 'primary',
      });
    }
    const deleteTarget = isSub && subRequest ? subRequest : request.requests?.[0];
    if (onDelete && deleteTarget) {
      actions.push({
        icon: 'delete',
        label: 'Удалить',
        onClick: () => onDelete(deleteTarget),
        variant: 'destructive',
      });
    }
    if (
      request.status !== 'completed' &&
      onEditRequestGroup
    ) {
      actions.push({
        icon: 'edit',
        label: 'Редактировать заявку',
        onClick: onEditRequestGroup,
        variant: 'primary',
      });
    }
  }

  if (userRole === 'department-head' && isSub && subRequest) {
    if (onAdminCompleteGroup && canStaffCompleteWithoutAssignment(request)) {
      actions.push({
        icon: 'done-all',
        label: 'Завершить без назначения',
        onClick: onAdminCompleteGroup,
        variant: 'primary',
      });
    }

    if (subRequest.status === 'awaiting_assignment' && onAssignExecutor) {
      actions.push({
        icon: 'person-add',
        label: 'Назначить исполнителей',
        onClick: () => onAssignExecutor(subRequest),
        variant: 'primary',
      });
    }
    if (
      subRequest.status !== 'in_progress' &&
      subRequest.status !== 'awaiting_assignment' &&
      subRequest.status !== 'completed' &&
      onChangeExecutors
    ) {
      actions.push({
        icon: 'person-add',
        label: 'Изменить исполнителей',
        onClick: () => onChangeExecutors(subRequest),
        variant: 'primary',
      });
    }
    if (onDelete) {
      actions.push({
        icon: 'delete',
        label: 'Удалить заявку',
        onClick: () => onDelete(subRequest),
        variant: 'destructive',
      });
    }
  }

  if (userRole === 'admin-worker' && isSub && subRequest) {
    const canProcessGroup = request.status === 'in_progress';

    if (onAdminAcceptGroup && canProcessGroup) {
      actions.push({
        icon: 'playlist-add-check',
        label: 'Принять заявку',
        onClick: onAdminAcceptGroup,
        variant: 'primary',
      });
    }

    if (onAdminRejectGroup && canProcessGroup) {
      actions.push({
        icon: 'cancel',
        label: 'Отклонить заявку',
        onClick: onAdminRejectGroup,
        variant: 'destructive',
      });
    }

    if (onAdminCompleteGroup && canStaffCompleteWithoutAssignment(request)) {
      actions.push({
        icon: 'done-all',
        label: 'Завершить без назначения',
        onClick: onAdminCompleteGroup,
        variant: 'primary',
      });
    }

    if (subRequest.status === 'completed' && onRateRequest) {
      actions.push({
        icon: 'star',
        label: subRequest.rating ? 'Изменить оценку' : 'Оценить работу',
        onClick: () => onRateRequest(subRequest),
        variant: 'primary',
      });
    }
    if (
      onToggleLongTerm &&
      ['in_progress', 'execution', 'awaiting_assignment', 'assigned'].includes(
        subRequest.status
      ) &&
      request.request_type !== 'recurring'
    ) {
      actions.push({
        icon: 'schedule',
        label: subRequest.is_long_term
          ? 'Снять с долгосрочных'
          : 'Пометить как долгосрочную',
        onClick: () =>
          onToggleLongTerm(
            subRequest.id,
            request.id,
            subRequest.is_long_term ?? false
          ),
        variant: 'default',
      });
    }
    if (onDelete) {
      actions.push({
        icon: 'delete',
        label: 'Удалить заявку',
        onClick: () => onDelete(subRequest),
        variant: 'destructive',
      });
    }
    if (
      request.status !== 'completed' &&
      onEditRequestGroup
    ) {
      actions.push({
        icon: 'edit',
        label: 'Редактировать заявку',
        onClick: onEditRequestGroup,
        variant: 'primary',
      });
    }
  } else if (userRole === 'admin-worker' && !isSub) {
    if (request.status === 'completed' && onRateClient) {
      actions.push({
        icon: 'star',
        label: 'Оценить клиента',
        onClick: onRateClient,
        variant: 'default',
      });
    }
    if (onDelete && request.requests?.[0]) {
      actions.push({
        icon: 'delete',
        label: 'Удалить',
        onClick: () => onDelete(request.requests[0]),
        variant: 'destructive',
      });
    }
  }

  return actions;
}

export type PrimaryActionKey = 'accept' | 'complete' | 'share';

export interface PrimaryActionItem {
  key: PrimaryActionKey;
  label: string;
  variant: 'primary' | 'default';
  onClick: () => void;
}

/**
 * Ключевые действия для нижнего блока карточки заявки:
 * Принять / Завершить / Поделиться заявкой.
 */
export function getRequestPrimaryActions(params: GetActionsParams): PrimaryActionItem[] {
  const {
    request,
    subRequest,
    userRole,
    isExecutorLeader,
    onShare,
    onCompleteTask,
    onAdminCompleteGroup,
    onAdminAcceptGroup,
  } = params;

  const actions: PrimaryActionItem[] = [];
  const shareRoles: RequestUserRole[] = [
    'client',
    'executor',
    'manager',
    'department-head',
    'admin-worker',
  ];

  if (
    userRole === 'admin-worker' &&
    subRequest &&
    request.status === 'in_progress' &&
    onAdminAcceptGroup
  ) {
    actions.push({
      key: 'accept',
      label: 'Принять',
      variant: 'primary',
      onClick: onAdminAcceptGroup,
    });
  }

  if (
    userRole === 'executor' &&
    subRequest &&
    isExecutorLeader &&
    subRequest.status === 'execution' &&
    onCompleteTask
  ) {
    actions.push({
      key: 'complete',
      label: 'Завершить',
      variant: 'primary',
      onClick: () => onCompleteTask(subRequest),
    });
  }

  if (
    (userRole === 'admin-worker' || userRole === 'department-head') &&
    onAdminCompleteGroup &&
    canStaffCompleteWithoutAssignment(request)
  ) {
    actions.push({
      key: 'complete',
      label: 'Завершить',
      variant: 'primary',
      onClick: onAdminCompleteGroup,
    });
  }

  if (shareRoles.includes(userRole)) {
    actions.push({
      key: 'share',
      label: 'Поделиться заявкой',
      variant: 'default',
      onClick: onShare,
    });
  }

  return actions;
}
