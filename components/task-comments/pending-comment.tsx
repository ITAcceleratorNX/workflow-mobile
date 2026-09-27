import { memo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import type { TaskCommentFailureKind } from '@/lib/task-comments/errors';
import { authorInitial, failureText, mentionSegments } from '@/lib/task-comments/presentation';
import type { PendingComment } from '@/lib/task-comments/store';

import type { CommentPalette } from './comment-item';

/** Повтор поможет, только если сервер не ответил или не справился; отклонённое содержимое надо исправить. */
const RETRYABLE: ReadonlySet<TaskCommentFailureKind> = new Set(['offline', 'server', 'rate_limited', 'cancelled']);

interface PendingCommentItemProps {
  entry: PendingComment;
  authorName: string;
  /** Можно ли сейчас писать в задачу. */
  writable: boolean;
  palette: CommentPalette & { danger: string };
  onRetry: (entry: PendingComment) => void;
  onEdit: (entry: PendingComment) => void;
  onDiscard: (entry: PendingComment) => void;
}

/** Своё сообщение, которое сервер ещё не подтвердил: отправляется или не отправлено и почему. */
export const PendingCommentItem = memo(function PendingCommentItem({
  entry,
  authorName,
  writable,
  palette,
  onRetry,
  onEdit,
  onDiscard,
}: PendingCommentItemProps) {
  const sending = entry.status === 'sending';
  const { text, mentions } = entry.draft;
  const labelled = mentions.map((mention) => ({ ...mention, label: text.slice(mention.start + 1, mention.end) }));
  const canRetry = writable && entry.failure !== null && RETRYABLE.has(entry.failure.kind);
  const status = sending ? 'Отправляется' : `Не отправлено: ${entry.failure ? failureText(entry.failure) : ''}`;

  return (
    <View style={styles.row}>
      <View style={[styles.avatar, { backgroundColor: palette.card }]}>
        <ThemedText style={[styles.avatarText, { color: palette.primary }]}>{authorInitial(authorName)}</ThemedText>
      </View>
      <View style={styles.body}>
        <ThemedText style={[styles.author, { color: palette.text }]} numberOfLines={1}>
          {authorName}
        </ThemedText>
        <View
          style={[
            styles.bubble,
            { backgroundColor: palette.ownCard, borderColor: sending ? palette.ownCard : palette.danger },
            sending && styles.sending,
          ]}
          accessible
          accessibilityLabel={`${status}. ${text}`}
        >
          {/* Когда писать уже нельзя, остаётся только скопировать текст и удалить сообщение. */}
          <Text selectable={!sending} style={[styles.text, { color: palette.text }]}>
            {mentionSegments(text, labelled).map((segment, index) =>
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
        {sending ? (
          <View style={styles.meta}>
            <ActivityIndicator size="small" color={palette.textMuted} />
            <ThemedText style={[styles.metaText, { color: palette.textMuted }]}>Отправляется…</ThemedText>
          </View>
        ) : (
          <View style={styles.failed}>
            <ThemedText style={[styles.metaText, { color: palette.danger }]}>{status}</ThemedText>
            <View style={styles.actions}>
              {canRetry ? <Action label="Повторить" color={palette.primary} onPress={() => onRetry(entry)} /> : null}
              {writable ? <Action label="Изменить" color={palette.primary} onPress={() => onEdit(entry)} /> : null}
              <Action label="Удалить" color={palette.danger} onPress={() => onDiscard(entry)} />
            </View>
          </View>
        )}
      </View>
    </View>
  );
});

function Action({ label, color, onPress }: { label: string; color: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => [styles.action, pressed && styles.pressed]}
      accessibilityRole="button"
    >
      <ThemedText style={[styles.actionText, { color }]}>{label}</ThemedText>
    </Pressable>
  );
}

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
  sending: {
    opacity: 0.7,
  },
  text: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
  },
  mention: {
    fontWeight: '600',
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  metaText: {
    fontSize: 12,
    lineHeight: 16,
  },
  failed: {
    marginTop: Spacing.xs,
    gap: Spacing.xs,
  },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.lg,
  },
  action: {
    paddingVertical: 2,
  },
  actionText: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
    fontWeight: '600',
  },
  pressed: {
    opacity: 0.6,
  },
});
