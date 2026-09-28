import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  View,
  type LayoutChangeEvent,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Spacing } from '@/constants/theme';
import { useToast } from '@/context/toast-context';
import { useTaskComments } from '@/hooks/use-task-comments';
import { useThemeColor } from '@/hooks/use-theme-color';
import { withoutRejectedMentions } from '@/lib/task-comments/composer';
import { ownCommentActions } from '@/lib/task-comments/presentation';
import type { PendingComment } from '@/lib/task-comments/store';
import type { TaskComment } from '@/lib/task-comments/types';
import { useAuthStore } from '@/stores/auth-store';

import { CommentActionsSheet, type CommentMenuTarget } from './comment-actions-sheet';
import { CommentComposer, type CommentComposerHandle } from './comment-composer';
import { CommentItem, type CommentPalette } from './comment-item';
import { PendingCommentItem } from './pending-comment';

type Comments = ReturnType<typeof useTaskComments>;

interface TaskCommentsListProps {
  taskId: number;
  /** Содержимое карточки над комментариями. */
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
}

const keyOf = (comment: TaskComment) => comment.id;

/**
 * Основной список карточки задачи: её содержимое сверху, под ним — блок «Комментарии».
 *
 * Один виртуализированный список вместо ScrollView: длинная переписка не монтируется целиком.
 * История догружается кнопкой над первым комментарием: более ранние встают под ней, и то,
 * на что смотрит пользователь, не сдвигается. Под лентой закреплено поле ввода; свои
 * комментарии меняются и удаляются долгим нажатием.
 */
export function TaskCommentsList({ taskId, children, style, contentContainerStyle }: TaskCommentsListProps) {
  const comments = useTaskComments(taskId);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const currentUserName = useAuthStore((state) => state.user?.full_name ?? '');
  const { show: showToast } = useToast();
  const listRef = useRef<FlatList<TaskComment>>(null);
  /** Свой комментарий, который сейчас правится в поле ввода. */
  const [editing, setEditing] = useState<TaskComment | null>(null);
  const [menu, setMenu] = useState<CommentMenuTarget | null>(null);
  const composerRef = useRef<CommentComposerHandle>(null);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const danger = useThemeColor({}, 'danger');
  const background = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');
  const ownCard = useThemeColor({}, 'accentSoft');
  const palette = useMemo<CommentPalette>(
    () => ({ text, textMuted, primary, onPrimary, danger, background, card, border, ownCard }),
    [text, textMuted, primary, onPrimary, danger, background, card, border, ownCard]
  );

  const { changing, remove, retry, discard, peekDraft, setDraft } = comments;
  const isActionable = useCallback((comment: TaskComment) => {
    const actions = ownCommentActions(comment, currentUserId);
    return actions.edit || actions.remove;
  }, [currentUserId]);
  const openMenu = useCallback((comment: TaskComment) => setMenu({ kind: 'comment', comment }), []);
  const closeMenu = useCallback(() => setMenu(null), []);
  const stopEditing = useCallback(() => setEditing(null), []);

  const renderItem = useCallback<ListRenderItem<TaskComment>>(
    ({ item }) => (
      <CommentItem
        comment={item}
        own={currentUserId !== null && item.author.id === currentUserId}
        palette={palette}
        changing={changing[item.id] ?? null}
        onActions={isActionable(item) ? openMenu : undefined}
      />
    ),
    [currentUserId, palette, changing, isActionable, openMenu]
  );

  // Своё сообщение появляется внизу ленты: перейти к нему. Цель — настоящая высота содержимого:
  // высоты не отрисованных комментариев список лишь оценивает, и scrollToEnd до конца не доходит.
  // Пока конец ленты дорисовывается, высота растёт, и лента недолго догоняет её — без анимации,
  // иначе плавная прокрутка через длинную переписку не успевает.
  const contentHeight = useRef(0);
  const viewportHeight = useRef(0);
  const followEndUntil = useRef(0);
  const scrollToBottom = useCallback(() => {
    listRef.current?.scrollToOffset({ offset: Math.max(0, contentHeight.current - viewportHeight.current), animated: false });
  }, []);
  const scrollToEnd = useCallback(() => {
    followEndUntil.current = Date.now() + 2000;
    requestAnimationFrame(scrollToBottom);
  }, [scrollToBottom]);
  const onContentSizeChange = useCallback(
    (_width: number, height: number) => {
      contentHeight.current = height;
      if (Date.now() < followEndUntil.current) scrollToBottom();
    },
    [scrollToBottom]
  );
  const onLayout = useCallback((event: LayoutChangeEvent) => {
    viewportHeight.current = event.nativeEvent.layout.height;
  }, []);
  const stopFollowingEnd = useCallback(() => {
    followEndUntil.current = 0;
  }, []);

  const startEditing = useCallback((comment: TaskComment) => {
    setMenu(null);
    setEditing(comment);
  }, []);

  const deleteComment = useCallback(
    (comment: TaskComment) => {
      setMenu(null);
      setEditing((current) => (current?.id === comment.id ? null : current));
      void remove(comment.id).then((outcome) => {
        if (outcome.ok || outcome.failure.kind === 'cancelled') return;
        showToast({
          title: 'Не удалось удалить комментарий',
          description: outcome.failure.message,
          variant: 'destructive',
          duration: 4000,
        });
      });
    },
    [remove, showToast]
  );

  const retryPending = useCallback((entry: PendingComment) => void retry(entry.localId), [retry]);
  const askDiscard = useCallback((entry: PendingComment) => setMenu({ kind: 'pending', entry }), []);
  const discardPending = useCallback(
    (entry: PendingComment) => {
      setMenu(null);
      discard(entry.localId);
    },
    [discard]
  );

  /** Неотправленное — обратно в поле ввода: отклонённые упоминания становятся обычным текстом. */
  const editPending = useCallback(
    (entry: PendingComment) => {
      if (peekDraft().text !== '') {
        showToast({
          title: 'Поле ввода занято',
          description: 'Отправьте или сотрите набранный текст, чтобы исправить неотправленное сообщение.',
          duration: 4000,
        });
        return;
      }
      const draft = discard(entry.localId);
      if (!draft) return;
      setEditing(null);
      setDraft(entry.failure ? withoutRejectedMentions(draft, entry.failure) : draft);
      // Фокус — сразу в обработчике: после перерисовки нажатая кнопка исчезает и уносит его с собой.
      composerRef.current?.focus();
    },
    [discard, peekDraft, setDraft, showToast]
  );

  const shown = comments.status !== 'disabled';
  const hint = comments.status === 'ready' && comments.items.some(isActionable);
  const menuKey = menu === null ? 'none' : menu.kind === 'comment' ? `comment-${menu.comment.id}` : `pending-${menu.entry.localId}`;

  return (
    <View style={styles.container}>
      <FlatList
        ref={listRef}
        style={style}
        contentContainerStyle={contentContainerStyle}
        data={comments.items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {children}
            {shown ? (
              <CommentsHeader comments={comments} palette={palette} hint={hint} onLoadOlder={stopFollowingEnd} />
            ) : null}
          </>
        }
        ListFooterComponent={
          shown ? (
            <CommentsFooter
              comments={comments}
              palette={palette}
              authorName={currentUserName}
              onRetry={retryPending}
              onEdit={editPending}
              onDiscard={askDiscard}
            />
          ) : null
        }
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        // В вебе «on-drag» снимает фокус при любой прокрутке, в том числе программной.
        keyboardDismissMode={Platform.OS === 'web' ? 'none' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={onContentSizeChange}
        onLayout={onLayout}
        onScrollBeginDrag={stopFollowingEnd}
      />
      {shown ? (
        <CommentComposer
          key={editing ? `edit-${editing.id}` : 'new'}
          taskId={taskId}
          comments={comments}
          editing={editing}
          onStopEditing={stopEditing}
          onSent={scrollToEnd}
          palette={palette}
          ref={composerRef}
        />
      ) : null}
      <CommentActionsSheet
        key={menuKey}
        target={menu}
        onClose={closeMenu}
        onEdit={startEditing}
        onDelete={deleteComment}
        onDiscard={discardPending}
      />
    </View>
  );
}

interface CommentsHeaderProps {
  comments: Comments;
  palette: CommentPalette;
  hint: boolean;
  onLoadOlder: () => void;
}

function CommentsHeader({ comments, palette, hint, onLoadOlder }: CommentsHeaderProps) {
  const ready = comments.status === 'ready';
  return (
    <View>
      <View style={styles.titleRow}>
        <ThemedText style={[styles.title, { color: palette.textMuted }]} accessibilityRole="header">
          Комментарии
        </ThemedText>
        {ready ? (
          comments.refreshing ? (
            <ActivityIndicator size="small" color={palette.textMuted} style={styles.refresh} />
          ) : (
            <Pressable
              onPress={() => void comments.refresh()}
              hitSlop={12}
              style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
              accessibilityRole="button"
              accessibilityLabel="Обновить комментарии"
            >
              <MaterialIcons name="refresh" size={20} color={palette.textMuted} />
            </Pressable>
          )
        ) : null}
      </View>
      {hint ? (
        <ThemedText style={[styles.hint, { color: palette.textMuted }]}>
          Удерживайте свой комментарий, чтобы изменить или удалить его
        </ThemedText>
      ) : null}

      {ready && comments.readError ? (
        <Pressable
          onPress={() => void comments.refresh()}
          style={({ pressed }) => [styles.banner, { borderColor: palette.border }, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel={`Не удалось обновить комментарии: ${comments.readError.message}. Повторить`}
        >
          <MaterialIcons name="error-outline" size={18} color={palette.textMuted} />
          <ThemedText style={[styles.note, styles.bannerText, { color: palette.textMuted }]}>
            {comments.readError.message}
          </ThemedText>
          <ThemedText style={[styles.note, { color: palette.primary }]}>Повторить</ThemedText>
        </Pressable>
      ) : null}

      {ready && comments.hasOlder ? (
        comments.historyLimited ? (
          <ThemedText style={[styles.note, styles.older, { color: palette.textMuted }]}>
            Более ранние комментарии в приложении не показываются: переписка слишком длинная
          </ThemedText>
        ) : (
          <Pressable
            onPress={() => {
              onLoadOlder();
              void comments.loadOlder();
            }}
            disabled={comments.loadingOlder}
            style={({ pressed }) => [styles.olderButton, pressed && styles.pressed]}
            accessibilityRole="button"
            accessibilityState={{ busy: comments.loadingOlder }}
          >
            {comments.loadingOlder ? (
              <ActivityIndicator size="small" color={palette.primary} />
            ) : (
              <MaterialIcons name="expand-less" size={20} color={palette.primary} />
            )}
            <ThemedText style={[styles.note, { color: palette.primary }]}>Показать более ранние</ThemedText>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

interface CommentsFooterProps {
  comments: Comments;
  palette: CommentPalette;
  authorName: string;
  onRetry: (entry: PendingComment) => void;
  onEdit: (entry: PendingComment) => void;
  onDiscard: (entry: PendingComment) => void;
}

/** Под лентой: свои неотправленные сообщения, затем состояние ленты. */
function CommentsFooter({ comments, palette, authorName, onRetry, onEdit, onDiscard }: CommentsFooterProps) {
  const writable = comments.status === 'ready' && comments.canComment;
  return (
    <>
      {comments.pending.map((entry) => (
        <PendingCommentItem
          key={entry.localId}
          entry={entry}
          authorName={authorName}
          writable={writable}
          palette={palette}
          onRetry={onRetry}
          onEdit={onEdit}
          onDiscard={onDiscard}
        />
      ))}
      <FeedState comments={comments} palette={palette} />
    </>
  );
}

function FeedState({ comments, palette }: { comments: Comments; palette: CommentPalette }) {
  switch (comments.status) {
    case 'idle':
    case 'loading':
      return (
        <View style={styles.state}>
          <ActivityIndicator size="small" color={palette.primary} />
          <ThemedText style={[styles.note, { color: palette.textMuted }]}>Загружаем комментарии…</ThemedText>
        </View>
      );
    case 'failed': {
      const failure = comments.readError;
      // Повтор не поможет, если сервер не знает этого API или закрыл модуль для роли.
      const retryable = failure !== null && failure.kind !== 'unsupported' && failure.kind !== 'forbidden';
      return (
        <View style={styles.state}>
          <ThemedText style={[styles.note, styles.centered, { color: palette.textMuted }]}>
            {failure?.message || 'Не удалось загрузить комментарии'}
          </ThemedText>
          {retryable ? (
            <Pressable
              onPress={() => void comments.refresh()}
              hitSlop={8}
              style={({ pressed }) => pressed && styles.pressed}
              accessibilityRole="button"
            >
              <ThemedText style={[styles.note, { color: palette.primary }]}>Повторить</ThemedText>
            </Pressable>
          ) : null}
        </View>
      );
    }
    case 'unavailable':
      return (
        <ThemedText style={[styles.note, styles.stateText, { color: palette.textMuted }]}>
          Комментарии недоступны: задачи нет или у вас больше нет к ней доступа
        </ThemedText>
      );
    case 'ready':
      return comments.items.length === 0 && comments.pending.length === 0 ? (
        <ThemedText style={[styles.note, styles.stateText, { color: palette.textMuted }]}>
          Комментариев пока нет
        </ThemedText>
      ) : null;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // Как подписи разделов карточки: «Вложения», «Срок», «Приоритет».
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 18,
    marginBottom: 8,
  },
  title: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  refresh: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.65,
  },
  hint: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: -Spacing.xs,
    marginBottom: Spacing.sm,
  },
  note: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.md,
  },
  bannerText: {
    flex: 1,
  },
  older: {
    marginBottom: Spacing.md,
  },
  olderButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  state: {
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  stateText: {
    textAlign: 'center',
    paddingVertical: Spacing.lg,
  },
  centered: {
    textAlign: 'center',
  },
});
