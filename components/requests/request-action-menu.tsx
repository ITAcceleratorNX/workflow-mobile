import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { RequestGroup, SubRequest } from '@/lib/api';

export type RequestUserRole =
  | 'client'
  | 'admin-worker'
  | 'department-head'
  | 'executor'
  | 'manager';

interface ActionItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onClick: () => void;
  variant: 'default' | 'destructive' | 'primary';
}

interface RequestActionMenuProps {
  request: RequestGroup;
  subRequest?: SubRequest | null;
  userRole: RequestUserRole;
  userServiceCategoryId?: number;
  userId?: number;
  isExecutorLeader?: boolean;
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
}

export function RequestActionMenu({
  request,
  subRequest,
  userRole,
  userServiceCategoryId,
  userId,
  isExecutorLeader,
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
}: RequestActionMenuProps) {
  const [visible, setVisible] = useState(false);
  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const target = subRequest ?? request;
  const isSub = !!subRequest;

  const getActions = (): ActionItem[] => {
    const actions: ActionItem[] = [];

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
      if (
        subRequest.status !== 'completed' &&
        onRedirect
      ) {
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
        if (
          subRequest.status === 'awaiting_assignment' &&
          onAssignExecutor
        ) {
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
  };

  const actions = getActions();
  if (actions.length === 0) return null;

  const openMenu = () => {
    if (visible) {
      setVisible(false);
      return;
    }
    setVisible(true);
  };

  const handleAction = (action: ActionItem) => {
    setVisible(false);
    action.onClick();
  };

  return (
    <>
      <Pressable
        onPress={openMenu}
        style={({ pressed }) => [
          styles.trigger,
          { opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <MaterialIcons name="more-horiz" size={24} color={text} />
      </Pressable>
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setVisible(false)}
        >
          <View style={[styles.sheet, { backgroundColor: cardBackground, borderColor: border }]}>
            <View style={styles.handle} />
            <ThemedText style={[styles.sheetTitle, { color: text }]}>
              Действия
            </ThemedText>
            <ThemedText style={[styles.sheetSubtitle, { color: textMuted }]}>
              Заявка #{isSub && subRequest ? subRequest.id : request.id}
            </ThemedText>
            <ScrollView style={styles.actionsList} bounces={false}>
              {actions.map((action, i) => (
                <Pressable
                  key={i}
                  onPress={() => handleAction(action)}
                  style={({ pressed }) => [
                    styles.actionItem,
                    {
                      backgroundColor: pressed ? 'rgba(255,255,255,0.08)' : 'transparent',
                    },
                    action.variant === 'destructive' && styles.actionDestructive,
                    action.variant === 'primary' && { borderLeftColor: primary },
                  ]}
                >
                  <MaterialIcons
                    name={action.icon}
                    size={22}
                    color={
                      action.variant === 'destructive'
                        ? '#EF4444'
                        : action.variant === 'primary'
                          ? primary
                          : textMuted
                    }
                  />
                  <ThemedText
                    style={[
                      styles.actionLabel,
                      { color: action.variant === 'destructive' ? '#EF4444' : text },
                      action.variant === 'primary' && { color: primary, fontWeight: '600' },
                    ]}
                  >
                    {action.label}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 24,
    paddingBottom: 32,
    maxHeight: '70%',
    borderTopWidth: 1,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#6B7280',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  sheetSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  actionsList: {
    maxHeight: 300,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderLeftWidth: 3,
    borderLeftColor: 'transparent',
    marginBottom: 4,
  },
  actionDestructive: {},
  actionLabel: {
    fontSize: 16,
  },
});
