import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  View,
  type ListRenderItem,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Spacing } from '@/constants/theme';
import { useTaskComments } from '@/hooks/use-task-comments';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TaskComment } from '@/lib/task-comments/types';
import { useAuthStore } from '@/stores/auth-store';

import { CommentItem, type CommentPalette } from './comment-item';

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
 * на что смотрит пользователь, не сдвигается.
 */
export function TaskCommentsList({ taskId, children, style, contentContainerStyle }: TaskCommentsListProps) {
  const comments = useTaskComments(taskId);
  const currentUserId = useAuthStore((state) => state.user?.id ?? null);
  const insets = useSafeAreaInsets();

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const card = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');
  const ownCard = useThemeColor({}, 'accentSoft');
  const background = useThemeColor({}, 'background');
  const palette = useMemo<CommentPalette>(
    () => ({ text, textMuted, primary, card, border, ownCard }),
    [text, textMuted, primary, card, border, ownCard]
  );

  const renderItem = useCallback<ListRenderItem<TaskComment>>(
    ({ item }) => (
      <CommentItem comment={item} own={currentUserId !== null && item.author.id === currentUserId} palette={palette} />
    ),
    [currentUserId, palette]
  );

  const shown = comments.status !== 'disabled';

  return (
    <View style={styles.container}>
      <FlatList
        style={style}
        contentContainerStyle={contentContainerStyle}
        data={comments.items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        ListHeaderComponent={
          <>
            {children}
            {shown ? <CommentsHeader comments={comments} palette={palette} /> : null}
          </>
        }
        ListFooterComponent={shown ? <CommentsFooter comments={comments} palette={palette} /> : null}
        initialNumToRender={10}
        maxToRenderPerBatch={10}
        windowSize={9}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
      {comments.status === 'ready' && !comments.canComment ? (
        <View
          style={[
            styles.readOnly,
            { borderTopColor: border, backgroundColor: background, paddingBottom: Math.max(insets.bottom, Spacing.md) },
          ]}
        >
          <MaterialIcons name="lock-outline" size={18} color={textMuted} />
          <ThemedText style={[styles.note, styles.readOnlyText, { color: textMuted }]}>
            Задача доступна вам только для чтения: комментарии можно читать, но не писать
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

function CommentsHeader({ comments, palette }: { comments: Comments; palette: CommentPalette }) {
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
            onPress={() => void comments.loadOlder()}
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

function CommentsFooter({ comments, palette }: { comments: Comments; palette: CommentPalette }) {
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
      return comments.items.length === 0 ? (
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
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
  },
  readOnlyText: {
    flex: 1,
  },
});
