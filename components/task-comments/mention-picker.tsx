import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View, type ListRenderItem } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useMentionSearch } from '@/hooks/use-mention-search';
import { MAX_MENTIONS } from '@/lib/task-comments/composer';
import { authorInitial } from '@/lib/task-comments/presentation';
import type { MentionCandidate } from '@/lib/task-comments/types';

import type { CommentPalette } from './comment-item';

interface MentionPickerProps {
  taskId: number;
  /** Что набрано после @. */
  query: string;
  /** Упоминаний уже столько, сколько принимает сервер. */
  full: boolean;
  onPick: (person: MentionCandidate) => void;
  onClose: () => void;
  /** Сервер ответил, что писать в задачу больше нельзя. */
  onReadOnly: () => void;
  palette: CommentPalette;
}

const keyOf = (person: MentionCandidate) => String(person.id);

/**
 * Кого можно упомянуть: только тех, кого предлагает сервер, — текущих участников задачи, кроме
 * самого пишущего. Поиск по ФИО и должности идёт после паузы в наборе.
 */
export function MentionPicker({ taskId, query, full, onPick, onClose, onReadOnly, palette }: MentionPickerProps) {
  const { state, search } = useMentionSearch(taskId);

  useEffect(() => {
    if (!full) search.search(query);
  }, [search, query, full]);

  const readOnly = state.failure?.kind === 'read_only';
  useEffect(() => {
    if (readOnly) onReadOnly();
  }, [readOnly, onReadOnly]);

  const renderItem = useCallback<ListRenderItem<MentionCandidate>>(
    ({ item }) => (
      <Pressable
        onPress={() => onPick(item)}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        accessibilityRole="button"
        accessibilityLabel={`Упомянуть: ${item.full_name}${item.position ? `, ${item.position}` : ''}`}
      >
        <View style={[styles.avatar, { backgroundColor: palette.ownCard }]}>
          <ThemedText style={[styles.avatarText, { color: palette.primary }]}>{authorInitial(item.full_name)}</ThemedText>
        </View>
        <View style={styles.person}>
          <ThemedText style={[styles.name, { color: palette.text }]} numberOfLines={1}>
            {item.full_name}
          </ThemedText>
          {item.position ? (
            <ThemedText style={[styles.position, { color: palette.textMuted }]} numberOfLines={1}>
              {item.position}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    ),
    [onPick, palette]
  );

  let body: React.ReactNode;
  if (full) {
    body = <Note palette={palette}>Больше {MAX_MENTIONS} упоминаний в одном комментарии нельзя</Note>;
  } else if (state.failure) {
    body = (
      <View style={styles.failure}>
        <Note palette={palette}>{state.failure.message}</Note>
        {readOnly ? null : (
          <Pressable onPress={() => search.search(query)} hitSlop={8} accessibilityRole="button">
            <ThemedText style={[styles.note, { color: palette.primary }]}>Повторить</ThemedText>
          </Pressable>
        )}
      </View>
    );
  } else if (!state.loading && state.items.length === 0) {
    body = <Note palette={palette}>Никого не найдено. Упомянуть можно только участников задачи</Note>;
  } else {
    body = (
      <FlatList
        data={state.items}
        keyExtractor={keyOf}
        renderItem={renderItem}
        keyboardShouldPersistTaps="always"
        onEndReached={() => search.loadMore()}
        onEndReachedThreshold={0.5}
        style={styles.list}
      />
    );
  }

  return (
    <View style={[styles.picker, { backgroundColor: palette.card, borderColor: palette.border }]}>
      <View style={styles.header}>
        <ThemedText style={[styles.title, { color: palette.textMuted }]}>Упомянуть участника</ThemedText>
        {state.loading ? <ActivityIndicator size="small" color={palette.textMuted} /> : null}
        <Pressable
          onPress={onClose}
          hitSlop={10}
          style={({ pressed }) => [styles.close, pressed && styles.pressed]}
          accessibilityRole="button"
          accessibilityLabel="Закрыть список участников"
        >
          <MaterialIcons name="close" size={18} color={palette.textMuted} />
        </Pressable>
      </View>
      {body}
    </View>
  );
}

function Note({ children, palette }: { children: React.ReactNode; palette: CommentPalette }) {
  return <ThemedText style={[styles.note, styles.noteBox, { color: palette.textMuted }]}>{children}</ThemedText>;
}

const styles = StyleSheet.create({
  picker: {
    borderWidth: 1,
    borderRadius: Radius.md,
    marginBottom: Spacing.sm,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  close: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  list: {
    maxHeight: 216,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pressed: {
    opacity: 0.6,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  person: {
    flex: 1,
    minWidth: 0,
  },
  name: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
    fontWeight: '600',
  },
  position: {
    fontSize: 12,
    lineHeight: 16,
  },
  failure: {
    alignItems: 'flex-start',
    paddingBottom: Spacing.sm,
  },
  note: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  noteBox: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
});
