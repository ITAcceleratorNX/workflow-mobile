import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import {
  authorInitial,
  commentAccessibilityLabel,
  commentMeta,
  commentState,
  DELETED_COMMENT_TEXT,
  formatCommentMoment,
  mentionSegments,
} from '@/lib/task-comments/presentation';
import type { TaskComment } from '@/lib/task-comments/types';

/** Цвета темы, общие для всех комментариев ленты: список берёт их один раз. */
export interface CommentPalette {
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  danger: string;
  background: string;
  card: string;
  border: string;
  ownCard: string;
}

interface CommentItemProps {
  comment: TaskComment;
  /** Свой комментарий: выделяется фоном. */
  own: boolean;
  palette: CommentPalette;
  /** Идёт правка или удаление этого комментария. */
  changing?: 'edit' | 'delete' | null;
  /** Действия со своим комментарием — долгим нажатием; нет, если менять его нельзя. */
  onActions?: (comment: TaskComment) => void;
}

/** Комментарий ленты задачи: автор, текст с упоминаниями, дата, время и метка «изменено». */
export const CommentItem = memo(function CommentItem({ comment, own, palette, changing = null, onActions }: CommentItemProps) {
  const moment = formatCommentMoment(comment.created_at);
  const { deleted } = commentState(comment);
  const meta = commentMeta(comment, moment, changing);
  const actionable = onActions !== undefined && changing === null;

  return (
    <Pressable
      style={styles.row}
      onLongPress={actionable ? () => onActions?.(comment) : undefined}
      delayLongPress={350}
      accessible
      accessibilityLabel={commentAccessibilityLabel(comment, moment)}
      accessibilityHint={actionable ? 'Удерживайте, чтобы изменить или удалить' : undefined}
      accessibilityActions={actionable ? [{ name: 'longpress', label: 'Изменить или удалить' }] : undefined}
      onAccessibilityAction={actionable ? () => onActions?.(comment) : undefined}
    >
      <View style={[styles.avatar, { backgroundColor: palette.card }]}>
        <ThemedText style={[styles.avatarText, { color: palette.primary }]}>
          {authorInitial(comment.author.full_name)}
        </ThemedText>
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.author, { color: palette.text }]} numberOfLines={1}>
          {comment.author.full_name}
        </ThemedText>
        {deleted ? (
          <View style={[styles.bubble, styles.deletedBubble, { borderColor: palette.border }]}>
            <ThemedText style={[styles.deletedText, { color: palette.textMuted }]}>{DELETED_COMMENT_TEXT}</ThemedText>
          </View>
        ) : (
          <View
            style={[
              styles.bubble,
              own
                ? { backgroundColor: palette.ownCard, borderColor: palette.ownCard }
                : { backgroundColor: palette.card, borderColor: palette.border },
            ]}
          >
            <Text style={[styles.text, { color: palette.text }]}>
              {mentionSegments(comment.text ?? '', comment.mentions).map((segment, index) =>
                segment.mention ? (
                  <Text key={index} style={[styles.mention, { color: palette.primary }]}>
                    {segment.text}
                  </Text>
                ) : (
                  segment.text
                )
              )}
            </Text>
          </View>
        )}
        <ThemedText style={[styles.meta, { color: palette.textMuted }]}>{meta}</ThemedText>
      </View>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  avatarText: {
    fontSize: 13,
    lineHeight: 16,
    fontWeight: '700',
  },
  body: {
    flex: 1,
    minWidth: 0,
  },
  author: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    marginBottom: Spacing.xs,
  },
  bubble: {
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  deletedBubble: {
    borderStyle: 'dashed',
  },
  text: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
  },
  mention: {
    fontWeight: '600',
  },
  deletedText: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
    fontStyle: 'italic',
  },
  meta: {
    fontSize: 11,
    lineHeight: 14,
    marginTop: Spacing.xs,
  },
});
