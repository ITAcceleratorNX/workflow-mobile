import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { RequestGroup, SubRequest } from '@/lib/api';
import { getRequestShareMessage } from '@/lib/shareRequest';
import {
  getRequestActions,
  type ActionItem,
  type RequestUserRole,
} from './request-action-config';

export type { RequestUserRole };

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
  onAdminCompleteGroup?: () => void;
  onAdminAcceptGroup?: () => void;
  onAdminRejectGroup?: () => void;
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
  onAdminCompleteGroup,
  onAdminAcceptGroup,
  onAdminRejectGroup,
}: RequestActionMenuProps) {
  const [visible, setVisible] = useState(false);
  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const target = subRequest ?? request;
  const isSub = !!subRequest;

  const handleShare = () => {
    const target = subRequest ?? request.requests?.[0];
    const params = {
      requestId: request.id,
      subRequestId: subRequest?.id,
      title: target?.title,
      status: (subRequest ?? request).status,
      description: target?.description,
    };
    const message = getRequestShareMessage(params);
    const displayId = subRequest != null ? `${request.id}/${subRequest.id}` : String(request.id);
    const sharePayload = {
      title: `Заявка #${displayId}`,
      message,
    };
    Share.share(sharePayload)
      .then(() => setVisible(false))
      .catch((err) => {
        setVisible(false);
        if (__DEV__) console.warn('[RequestActionMenu] Share failed', err);
      });
  };

  const actions = getRequestActions({
    request,
    subRequest,
    userRole,
    userServiceCategoryId,
    userId,
    isExecutorLeader,
    onShare: handleShare,
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
  });
  if (actions.length === 0) return null;

  const openMenu = () => {
    if (visible) {
      setVisible(false);
      return;
    }
    setVisible(true);
  };

  const handleAction = (action: ActionItem) => {
    const isShare = action.label === 'Поделиться ссылкой';
    if (!isShare) setVisible(false);
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
    width: 44,
    height: 44,
    borderRadius: 22,
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
