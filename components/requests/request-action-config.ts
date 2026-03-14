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
  }

  if (userRole === 'department-head' && isSub && subRequest) {
    const sameCategory =
      userServiceCategoryId != null &&
      subRequest.category_id === userServiceCategoryId;
    if (sameCategory) {
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
      if (subRequest.status !== 'completed' && onRedirect) {
        actions.push({
          icon: 'arrow-forward',
          label: 'Перенаправить к другой категории',
          onClick: () => onRedirect(subRequest),
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
    } else if (onDelete && request.client_id === userId) {
      actions.push({
        icon: 'delete',
        label: 'Удалить',
        onClick: () => onDelete(subRequest),
        variant: 'destructive',
      });
    }
  }

  if (userRole === 'admin-worker' && isSub && subRequest) {
    const canProcessGroup = request.status === 'in_progress';
    const hasActiveForAdminComplete =
      canProcessGroup &&
      (request.requests ?? []).some((sr) =>
        ['in_progress', 'awaiting_assignment', 'assigned'].includes(sr.status)
      );

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

    if (onAdminCompleteGroup && hasActiveForAdminComplete) {
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
