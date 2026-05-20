import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { PageLoader } from '@/components/ui';
import { FontSizes, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  createRequestComment,
  deleteRequestComment,
  getRequestComments,
  updateRequestComment,
  type RequestComment,
} from '@/lib/api';

const ROLE_LABELS: Record<string, string> = {
  client: 'Клиент',
  'admin-worker': 'Администратор офиса',
  'department-head': 'Офис менеджер',
  executor: 'Исполнитель',
  manager: 'Руководитель',
};

function formatCommentTime(timestamp: string): string {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

interface CommentsModalProps {
  visible: boolean;
  onClose: () => void;
  requestId: number | null;
  currentUserId?: number;
  currentUserName?: string;
  currentUserRole?: string;
}

export function CommentsModal({
  visible,
  onClose,
  requestId,
  currentUserId,
  currentUserName,
  currentUserRole,
}: CommentsModalProps) {
  const insets = useSafeAreaInsets();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const surface = useThemeColor({}, 'surface');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const [comments, setComments] = useState<RequestComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [draft, setDraft] = useState('');
  const [editCommentId, setEditCommentId] = useState<number | null>(null);

  const loadComments = useCallback(async () => {
    if (!requestId) return;
    setLoading(true);
    const res = await getRequestComments(requestId);
    if (res.ok) setComments(res.data);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    if (visible && requestId) {
      void loadComments();
    }
  }, [visible, requestId, loadComments]);

  useEffect(() => {
    if (!visible) {
      setDraft('');
      setEditCommentId(null);
    }
  }, [visible]);

  const handleSend = async () => {
    if (!requestId || !draft.trim() || sending) return;

    setSending(true);
    try {
      if (editCommentId) {
        const res = await updateRequestComment(editCommentId, requestId, draft);
        if (res.ok) {
          setComments((prev) =>
            prev.map((c) => (c.id === editCommentId ? { ...c, ...res.data } : c))
          );
          setDraft('');
          setEditCommentId(null);
        }
      } else {
        const res = await createRequestComment(requestId, draft);
        if (res.ok) {
          setComments((prev) => [
            ...prev,
            {
              ...res.data,
              user: res.data.user ?? {
                id: currentUserId ?? res.data.sender_id,
                full_name: currentUserName ?? 'Вы',
                role: currentUserRole,
              },
            },
          ]);
          setDraft('');
        }
      }
    } finally {
      setSending(false);
    }
  };

  const handleLongPress = (comment: RequestComment) => {
    if (comment.user?.id !== currentUserId && comment.sender_id !== currentUserId) {
      return;
    }

    Alert.alert('Комментарий', undefined, [
      {
        text: 'Изменить',
        onPress: () => {
          setDraft(comment.comment);
          setEditCommentId(comment.id);
        },
      },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Удалить комментарий?', 'Это действие нельзя отменить', [
            { text: 'Отмена', style: 'cancel' },
            {
              text: 'Удалить',
              style: 'destructive',
              onPress: async () => {
                const res = await deleteRequestComment(comment.id);
                if (res.ok) {
                  setComments((prev) => prev.filter((c) => c.id !== comment.id));
                  if (editCommentId === comment.id) {
                    setEditCommentId(null);
                    setDraft('');
                  }
                }
              },
            },
          ]);
        },
      },
      { text: 'Отмена', style: 'cancel' },
    ]);
  };

  const renderItem = ({ item }: { item: RequestComment }) => {
    const authorName = item.user?.full_name ?? currentUserName ?? 'Пользователь';
    const roleLabel = item.user?.role ? ROLE_LABELS[item.user.role] ?? item.user.role : null;

    return (
      <Pressable
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
        style={styles.commentRow}
      >
        <View style={[styles.avatar, { backgroundColor: surfaceMuted }]}>
          <ThemedText style={[styles.avatarText, { color: primary }]}>
            {authorName.charAt(0).toUpperCase()}
          </ThemedText>
        </View>
        <View style={styles.commentBody}>
          <View style={styles.commentHeader}>
            <ThemedText style={[styles.authorName, { color: text }]} numberOfLines={1}>
              {authorName}
            </ThemedText>
            {roleLabel ? (
              <ThemedText style={[styles.authorRole, { color: textMuted }]} numberOfLines={1}>
                ({roleLabel})
              </ThemedText>
            ) : null}
          </View>
          <View style={[styles.commentBubble, { backgroundColor: surfaceMuted }]}>
            <ThemedText style={[styles.commentText, { color: text }]}>
              {item.comment}
            </ThemedText>
          </View>
          <ThemedText style={[styles.commentTime, { color: textMuted }]}>
            {formatCommentTime(item.timestamp)}
          </ThemedText>
        </View>
      </Pressable>
    );
  };

  if (!visible || !requestId) return null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.kav}
          pointerEvents="box-none"
        >
          <Pressable
            style={[
              styles.sheet,
              {
                backgroundColor: surface,
                borderColor: border,
                paddingBottom: Math.max(insets.bottom, Spacing.md),
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.handleWrap}>
              <View style={[styles.handle, { backgroundColor: border }]} />
            </View>

            <View style={styles.headerRow}>
              <ThemedText style={[styles.title, { color: text }]}>Комментарии</ThemedText>
              <Pressable onPress={onClose} hitSlop={12} style={styles.closeBtn}>
                <MaterialIcons name="close" size={22} color={textMuted} />
              </Pressable>
            </View>

            {loading ? (
              <View style={styles.loaderWrap}>
                <PageLoader size={48} />
              </View>
            ) : (
              <FlatList
                data={comments}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderItem}
                style={styles.list}
                contentContainerStyle={[
                  styles.listContent,
                  comments.length === 0 && styles.listEmpty,
                ]}
                keyboardShouldPersistTaps="handled"
                ListEmptyComponent={
                  <ThemedText style={[styles.emptyText, { color: textMuted }]}>
                    Комментариев пока нет
                  </ThemedText>
                }
              />
            )}

            <View style={[styles.inputRow, { borderTopColor: border }]}>
              {editCommentId ? (
                <ThemedText style={[styles.editHint, { color: primary }]}>
                  Редактирование комментария
                </ThemedText>
              ) : null}
              <View style={styles.inputWrap}>
                <TextInput
                  style={[
                    styles.input,
                    { color: text, borderColor: border, backgroundColor: surfaceMuted },
                  ]}
                  placeholder="Написать комментарий..."
                  placeholderTextColor={textMuted}
                  value={draft}
                  onChangeText={setDraft}
                  multiline
                  maxLength={2000}
                  textAlignVertical="top"
                />
                <Pressable
                  onPress={() => void handleSend()}
                  disabled={!draft.trim() || sending}
                  style={({ pressed }) => [
                    styles.sendBtn,
                    {
                      backgroundColor: primary,
                      opacity: !draft.trim() || sending ? 0.45 : pressed ? 0.85 : 1,
                    },
                  ]}
                >
                  <MaterialIcons name="send" size={20} color={onPrimary} />
                </Pressable>
              </View>
              {editCommentId ? (
                <Pressable
                  onPress={() => {
                    setEditCommentId(null);
                    setDraft('');
                  }}
                  style={styles.cancelEdit}
                >
                  <ThemedText style={{ color: textMuted, fontSize: FontSizes.bodySmall }}>
                    Отменить редактирование
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedText style={[styles.hintText, { color: textMuted }]}>
                  Свои комментарии: удерживайте для изменения или удаления
                </ThemedText>
              )}
            </View>
          </Pressable>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  kav: {
    justifyContent: 'flex-end',
    maxHeight: '88%',
  },
  sheet: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    borderWidth: 1,
    minHeight: 360,
    maxHeight: '100%',
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: Radius.pill,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSizes.titleLarge,
    fontWeight: '600',
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 160,
  },
  list: {
    flexGrow: 0,
    maxHeight: 360,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  listEmpty: {
    flexGrow: 1,
    justifyContent: 'center',
    minHeight: 120,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: FontSizes.bodySmall,
  },
  commentRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    alignItems: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 13,
    fontWeight: '700',
  },
  commentBody: {
    flex: 1,
    minWidth: 0,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  authorName: {
    fontSize: FontSizes.bodySmall,
    fontWeight: '600',
  },
  authorRole: {
    fontSize: 11,
    flexShrink: 1,
  },
  commentBubble: {
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: 4,
  },
  commentText: {
    fontSize: FontSizes.bodySmall,
    lineHeight: 20,
  },
  commentTime: {
    fontSize: 11,
  },
  inputRow: {
    borderTopWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.xs,
  },
  editHint: {
    fontSize: FontSizes.bodySmall,
    fontWeight: '600',
  },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.body,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelEdit: {
    alignSelf: 'flex-start',
    paddingVertical: 4,
  },
  hintText: {
    fontSize: 11,
    paddingBottom: 2,
  },
});
