import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useImperativeHandle, useRef, useState, type Ref } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputSelectionChangeEventData,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useToast } from '@/context/toast-context';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useCommentDraft, type useTaskComments } from '@/hooks/use-task-comments';
import {
  applyTextChange,
  asNewMessage,
  caretAfterChange,
  checkDraft,
  COUNTER_FROM,
  draftFromComment,
  EMPTY_DRAFT,
  insertMention,
  MAX_MENTIONS,
  MAX_TEXT_CODE_POINTS,
  mentionQueryAt,
  withoutRejectedMentions,
} from '@/lib/task-comments/composer';
import type { TaskCommentFailure } from '@/lib/task-comments/errors';
import { failureText } from '@/lib/task-comments/presentation';
import type { CommentDraft, MentionCandidate, TaskComment } from '@/lib/task-comments/types';

import type { CommentPalette } from './comment-item';
import { MentionPicker } from './mention-picker';

type Comments = ReturnType<typeof useTaskComments>;
type Selection = { start: number; end: number };

/** Что поле ввода умеет по просьбе списка. */
export interface CommentComposerHandle {
  /** Открыть поле для набора: например, чтобы исправить вернувшееся неотправленное сообщение. */
  focus(): void;
}

interface CommentComposerProps {
  taskId: number;
  comments: Comments;
  /** Свой комментарий, который правится; null — новое сообщение. */
  editing: TaskComment | null;
  onStopEditing: () => void;
  /** Сообщение ушло в ленту: список прокручивается к нему. */
  onSent: () => void;
  palette: CommentPalette;
  ref?: Ref<CommentComposerHandle>;
}

const formatCount = (value: number) => String(value).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');

/** Что сказать о неудачной правке: черновик остаётся в поле, поэтому объясняем, что делать дальше. */
function editNotice(failure: TaskCommentFailure): string {
  if (failure.code === 'COMMENT_VERSION_CONFLICT') {
    return 'Комментарий изменили на другом устройстве, лента обновлена. Ваш текст сохранён: нажмите «Сохранить», чтобы заменить.';
  }
  return failureText(failure);
}

/**
 * Поле ввода под лентой: новое сообщение или правка своего комментария, упоминания через @.
 *
 * Новое сообщение хранится черновиком задачи и уходит в ленту сразу: поле очищается, поэтому
 * повторное нажатие ничего не отправит. Правка сохраняется по версии; при ошибке текст остаётся.
 * Если писать больше нельзя, недописанный текст остаётся видимым, пока его не очистят.
 */
export function CommentComposer({
  taskId,
  comments,
  editing,
  onStopEditing,
  onSent,
  palette,
  ref,
}: CommentComposerProps) {
  const [newDraft, setNewDraft] = useCommentDraft(taskId);
  const [editDraft, setEditDraft] = useState<CommentDraft | null>(() => (editing ? draftFromComment(editing) : null));
  const [selection, setSelection] = useState<Selection>({ start: 0, end: 0 });
  const [forcedSelection, setForcedSelection] = useState<Selection | undefined>(undefined);
  /** Где стоит @, для которого список закрыли вручную. */
  const [dismissedAt, setDismissedAt] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const inputRef = useRef<TextInput>(null);
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight(true);
  const { show: showToast } = useToast();

  useImperativeHandle(ref, () => ({ focus: () => inputRef.current?.focus() }), []);

  // Ссылка стабильна: действия хука меняются только со сменой задачи.
  const { refresh } = comments;
  const refreshRights = useCallback(() => void refresh(), [refresh]);

  const editingMode = editing !== null && editDraft !== null;
  const draft = editDraft ?? newDraft;
  const update = (next: CommentDraft) => (editDraft !== null ? setEditDraft(next) : setNewDraft(next));
  const check = checkDraft(draft);
  const writable = comments.status === 'ready' && comments.canComment;
  // Список не зависит от фокуса: нажатие на кандидата снимает фокус раньше, чем выбирает его.
  const query = writable && selection.start === selection.end ? mentionQueryAt(draft, selection.end) : null;
  const activeQuery = query !== null && query.start !== dismissedAt ? query : null;

  const onChangeText = (text: string) => {
    const caret = caretAfterChange(draft.text, text);
    update(applyTextChange(draft, text));
    setSelection({ start: caret, end: caret });
    if (notice !== null && !saving) setNotice(null);
  };

  const onSelectionChange = (event: NativeSyntheticEvent<TextInputSelectionChangeEventData>) => {
    setSelection(event.nativeEvent.selection);
    if (forcedSelection) setForcedSelection(undefined);
  };

  const onPick = (person: MentionCandidate) => {
    if (!activeQuery) return;
    const { draft: next, cursor } = insertMention(draft, activeQuery, person);
    update(next);
    setSelection({ start: cursor, end: cursor });
    setForcedSelection({ start: cursor, end: cursor });
    inputRef.current?.focus();
  };

  const send = () => {
    if (!writable || !check.canSend) return;
    const outgoing = draft;
    setNewDraft(EMPTY_DRAFT);
    setDismissedAt(null);
    void comments.send(outgoing);
    onSent();
  };

  const save = async () => {
    if (!editing || editDraft === null || saving || !writable || !check.canSend) return;
    setSaving(true);
    setNotice(null);
    const outcome = await comments.edit(editing.id, editDraft);
    setSaving(false);
    if (outcome.ok) {
      onStopEditing();
      return;
    }
    const { failure } = outcome;
    if (failure.kind === 'cancelled') return;
    if (failure.code === 'COMMENT_DELETED' || failure.code === 'COMMENT_NOT_FOUND') {
      // Править уже нечего: текст не пропадает — он становится новым сообщением, если поле свободно.
      if (comments.peekDraft().text === '') {
        comments.setDraft(asNewMessage(editDraft));
        showToast({
          title: 'Комментарий уже удалён',
          description: 'Текст правки оставлен в поле ввода: его можно отправить новым сообщением.',
          duration: 4000,
        });
        onStopEditing();
        return;
      }
      setNotice('Комментарий уже удалён, сохранить правку нельзя. Скопируйте текст, если он нужен, и отмените редактирование.');
      return;
    }
    if (failure.kind === 'rejected') setEditDraft(withoutRejectedMentions(editDraft, failure));
    setNotice(editNotice(failure));
  };

  const paddingBottom = keyboardHeight > 0 ? Spacing.sm : Math.max(insets.bottom, Spacing.sm);
  const bar = [styles.bar, { borderTopColor: palette.border, backgroundColor: palette.background, paddingBottom }];

  if (!writable) {
    // Пока лента не загружена, неизвестно, можно ли писать.
    if (comments.status !== 'ready' && comments.status !== 'unavailable') return null;
    if (check.blank) {
      return comments.status === 'ready' ? (
        <View style={[bar, styles.readOnly]}>
          <MaterialIcons name="lock-outline" size={18} color={palette.textMuted} />
          <ThemedText style={[styles.note, styles.grow, { color: palette.textMuted }]}>
            Задача доступна вам только для чтения: комментарии можно читать, но не писать
          </ThemedText>
        </View>
      ) : null;
    }
    // Права отозвали, пока человек писал: текст не пропадает молча.
    return (
      <View style={bar}>
        <ThemedText style={[styles.note, { color: palette.danger }]}>
          {comments.status === 'unavailable'
            ? 'Не отправлено: задача больше недоступна'
            : 'Не отправлено: задача стала доступна вам только для чтения'}
        </ThemedText>
        <ScrollView style={styles.leftover}>
          <ThemedText selectable style={[styles.leftoverText, { color: palette.text }]}>
            {draft.text}
          </ThemedText>
        </ScrollView>
        <Pressable
          onPress={() => (editingMode ? onStopEditing() : setNewDraft(EMPTY_DRAFT))}
          hitSlop={8}
          style={({ pressed }) => [styles.clear, pressed && styles.pressed]}
          accessibilityRole="button"
        >
          <ThemedText style={[styles.note, { color: palette.primary }]}>Очистить</ThemedText>
        </Pressable>
      </View>
    );
  }

  const disabled = !check.canSend || saving;
  return (
    <View style={bar}>
      {editingMode ? (
        <View style={styles.editHeader}>
          <MaterialIcons name="edit" size={16} color={palette.primary} />
          <ThemedText style={[styles.editTitle, { color: palette.primary }]}>Редактирование комментария</ThemedText>
          <Pressable
            onPress={onStopEditing}
            hitSlop={10}
            style={({ pressed }) => pressed && styles.pressed}
            accessibilityRole="button"
            accessibilityLabel="Отменить редактирование"
          >
            <MaterialIcons name="close" size={20} color={palette.textMuted} />
          </Pressable>
        </View>
      ) : null}
      {notice ? <ThemedText style={[styles.note, styles.notice, { color: palette.danger }]}>{notice}</ThemedText> : null}
      {activeQuery ? (
        <MentionPicker
          taskId={taskId}
          query={activeQuery.query}
          full={draft.mentions.length >= MAX_MENTIONS}
          onPick={onPick}
          onClose={() => setDismissedAt(activeQuery.start)}
          onReadOnly={refreshRights}
          palette={palette}
        />
      ) : null}
      <View style={styles.inputRow}>
        <TextInput
          ref={inputRef}
          value={draft.text}
          onChangeText={onChangeText}
          onSelectionChange={onSelectionChange}
          selection={forcedSelection}
          autoFocus={editingMode}
          multiline
          textAlignVertical="top"
          placeholder={editingMode ? 'Текст комментария' : 'Комментарий, @ — упомянуть'}
          placeholderTextColor={palette.textMuted}
          style={[styles.input, { color: palette.text, backgroundColor: palette.card, borderColor: palette.border }]}
          accessibilityLabel={editingMode ? 'Текст комментария' : 'Новый комментарий'}
        />
        <Pressable
          onPress={editingMode ? () => void save() : send}
          disabled={disabled}
          style={({ pressed }) => [
            styles.send,
            { backgroundColor: palette.primary, opacity: disabled ? 0.45 : pressed ? 0.8 : 1 },
          ]}
          accessibilityRole="button"
          accessibilityLabel={editingMode ? 'Сохранить изменения' : 'Отправить комментарий'}
          accessibilityState={{ disabled, busy: saving }}
        >
          {saving ? (
            <ActivityIndicator size="small" color={palette.onPrimary} />
          ) : (
            <MaterialIcons name={editingMode ? 'check' : 'send'} size={20} color={palette.onPrimary} />
          )}
        </Pressable>
      </View>
      {check.length >= COUNTER_FROM || check.tooManyMentions ? (
        <ThemedText
          style={[styles.counter, { color: check.tooLong || check.tooManyMentions ? palette.danger : palette.textMuted }]}
        >
          {check.tooManyMentions
            ? `Упоминаний больше ${MAX_MENTIONS}: уберите лишние`
            : `${formatCount(check.length)} / ${formatCount(MAX_TEXT_CODE_POINTS)}`}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  readOnly: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingTop: Spacing.md,
  },
  grow: {
    flex: 1,
  },
  note: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  notice: {
    marginBottom: Spacing.sm,
  },
  editHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  editTitle: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: Spacing.sm,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 132,
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingTop: 11,
    paddingBottom: 11,
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  counter: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  leftover: {
    maxHeight: 120,
    marginVertical: Spacing.sm,
  },
  leftoverText: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  clear: {
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingBottom: Spacing.xs,
  },
  pressed: {
    opacity: 0.6,
  },
});
