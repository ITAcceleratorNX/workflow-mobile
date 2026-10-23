import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RecipientPickerScreen } from '@/components/tasks/RecipientPickerScreen';
import { TaskChoicePicker } from '@/components/tasks/TaskChoicePicker';
import { TaskDueEditor, type DueValue } from '@/components/tasks/TaskDueEditor';
import { Button } from '@/components/ui/button';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
import type { NewTaskInput } from '@/hooks/use-todo-list';
import { useProductUi } from '@/hooks/use-product-ui';
import { confirmMassAssignment } from '@/lib/group-task-completion';
import { parseTaskScheduleFromText } from '@/lib/parseTaskScheduleFromText';
import { defaultDue, DEFAULT_DUE_TIME, dueToScheduledAt, formatDue } from '@/lib/task-due';
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '@/lib/task-fields';
import { defaultRecurrenceNone } from '@/lib/task-recurrence';
import { massAssignmentConfirmText, recipientSelectionLabel, type RecipientSelection } from '@/lib/task-recipients-api';
import { DEFAULT_REMINDER, REMINDER_OPTIONS, reminderLabel } from '@/lib/task-reminders';
import type { TaskPriority, UserTask } from '@/lib/user-tasks-api';

export function priorityOptions(dangerColor: string): readonly SegmentedOption<TaskPriority>[] {
  return [
    { value: 'low', label: 'Низкий' },
    { value: 'medium', label: 'Средний' },
    { value: 'high', label: 'Высокий', icon: 'flag', iconColor: dangerColor },
  ];
}

const REMINDER_CHOICES = REMINDER_OPTIONS.map((item) => ({ value: item.value, label: item.label }));

type Draft = {
  title: string;
  description: string;
  recipient: RecipientSelection | null;
  due: DueValue;
  /** The «Срок» before the title's ending («… завтра в 10») set it; null while the due is the user's own. */
  dueBeforeText: DueValue | null;
  reminder: string;
  priority: TaskPriority;
};

function initialDraft(dateKey: string | null, todayKey: string): Draft {
  return {
    title: '',
    description: '',
    recipient: null,
    due: { due: dateKey ? { dateKey, time: DEFAULT_DUE_TIME } : defaultDue(todayKey), recurrence: defaultRecurrenceNone() },
    dueBeforeText: null,
    reminder: DEFAULT_REMINDER.value,
    priority: 'medium',
  };
}

type TaskComposerProps = {
  visible: boolean;
  onClose: () => void;
  /** «Срок» suggested by the context (a calendar day); the next 18:00 without it. */
  dateKey: string | null;
  todayKey: string;
  onCreate: (input: NewTaskInput) => Promise<UserTask | null>;
};

/** The title typed so far; a due named at its end («Позвонить завтра в 10») becomes the «Срок». */
function withTitle(draft: Draft, title: string, todayKey: string): Draft {
  const parsed = parseTaskScheduleFromText(title, { todayKey });
  if (parsed.matched && (parsed.dateKey != null || parsed.time != null)) {
    const base = draft.dueBeforeText ?? draft.due;
    const dateKey = parsed.dateKey ?? base.due?.dateKey ?? todayKey;
    const time = parsed.time ?? base.due?.time ?? DEFAULT_DUE_TIME;
    return { ...draft, title, due: { due: { dateKey, time }, recurrence: base.recurrence }, dueBeforeText: base };
  }
  // The phrase was erased: the «Срок» it set goes back to what it was.
  if (draft.dueBeforeText) return { ...draft, title, due: draft.dueBeforeText, dueBeforeText: null };
  return { ...draft, title };
}

/** The title to save: without the due phrase while that phrase still sets the «Срок». */
function titleToSave(draft: Draft, todayKey: string): string {
  const typed = draft.title.trim();
  if (!draft.dueBeforeText) return typed;
  return parseTaskScheduleFromText(typed, { todayKey }).cleanedTitle.trim() || typed;
}

/**
 * «Новая задача» (Figma «Задачи · Новая задача»): title, optional description, «Исполнитель»,
 * «Срок», «Напоминание» and «Приоритет», created with «Создать задачу».
 */
export function TaskComposer({ visible, onClose, dateKey, todayKey, onCreate }: TaskComposerProps) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Draft>(() => initialDraft(dateKey, todayKey));
  const [busy, setBusy] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [picker, setPicker] = useState<'recipient' | 'due' | 'reminder' | null>(null);
  const titleRef = useRef<TextInput>(null);

  const [openedFor, setOpenedFor] = useState({ visible, dateKey });
  // A fresh draft for every opening; todayKey changing while the form is open keeps the draft.
  if (visible !== openedFor.visible || dateKey !== openedFor.dateKey) {
    setOpenedFor({ visible, dateKey });
    if (visible) {
      setDraft(initialDraft(dateKey, todayKey));
      setTitleError(null);
      setPicker(null);
    }
  }

  const update = (patch: Partial<Draft>) => setDraft((current) => ({ ...current, ...patch }));
  const dirty = draft.title.trim() !== '' || draft.description.trim() !== '';
  const reminderOption = REMINDER_OPTIONS.find((item) => item.value === draft.reminder) ?? DEFAULT_REMINDER;
  const dueText = formatDue(draft.due.due, todayKey, ', ');
  const reminderText = draft.due.due ? reminderLabel(reminderOption.fields) : 'Нужен срок';
  const recipientText = draft.recipient ? recipientSelectionLabel(draft.recipient) : 'Я';
  const recipientIcon = draft.recipient?.type === 'company' ? 'business' : draft.recipient?.type === 'department' || draft.recipient?.type === 'team' ? 'groups' : 'person';

  const requestClose = () => {
    if (busy) return;
    if (!dirty) {
      onClose();
      return;
    }
    Alert.alert('Не сохранять задачу?', 'Введённый текст пропадёт.', [
      { text: 'Продолжить', style: 'cancel' },
      { text: 'Не сохранять', style: 'destructive', onPress: onClose },
    ]);
  };

  const changeTitle = (title: string) => {
    const next = withTitle(draft, title, todayKey);
    const recognized = next.dueBeforeText != null && formatDue(next.due.due, todayKey) !== formatDue(draft.due.due, todayKey);
    if (recognized) void Haptics.selectionAsync();
    setDraft(next);
    if (titleError) setTitleError(null);
  };

  const submit = async () => {
    if (busy) return;
    const title = titleToSave(draft, todayKey);
    if (!title) {
      setTitleError('Введите название задачи');
      titleRef.current?.focus();
      return;
    }
    if (!(await confirmMassAssignment(massAssignmentConfirmText(draft.recipient)))) return;
    setBusy(true);
    const created = await onCreate({
      title,
      description: draft.description.trim() || null,
      scheduledAt: dueToScheduledAt(draft.due.due),
      recurrence: draft.due.due ? draft.due.recurrence : defaultRecurrenceNone(),
      remindersDisabled: reminderOption.fields.reminders_disabled,
      remindBeforeMinutes: reminderOption.fields.remind_before_minutes,
      recipient: draft.recipient,
      priority: draft.priority,
    });
    setBusy(false);
    if (created) onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={requestClose}>
      <KeyboardAvoidingView style={[styles.screen, { backgroundColor: ui.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable onPress={requestClose} hitSlop={10} accessibilityRole="button" disabled={busy} style={styles.cancel}>
            <Text style={[styles.cancelLabel, { color: ui.accent }]}>Отмена</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[styles.headerTitle, { color: ui.fg() }]}>
            Новая задача
          </Text>
        </View>

        <ScrollView style={styles.flex} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <View style={[styles.card, { backgroundColor: ui.surface }]}>
            <TextInput
              ref={titleRef}
              value={draft.title}
              onChangeText={changeTitle}
              placeholder="Название задачи"
              placeholderTextColor={ui.fg(0.4)}
              maxLength={TASK_TITLE_MAX_LENGTH}
              autoFocus
              returnKeyType="next"
              accessibilityLabel="Название задачи"
              style={[styles.titleInput, { color: ui.fg(), borderBottomColor: ui.fg(0.08) }]}
            />
            {titleError ? (
              <Text accessibilityRole="alert" style={[styles.error, { color: ui.danger }]}>
                {titleError}
              </Text>
            ) : null}
            <TextInput
              value={draft.description}
              onChangeText={(description) => update({ description })}
              placeholder="Описание (необязательно)"
              placeholderTextColor={ui.fg(0.4)}
              maxLength={TASK_DESCRIPTION_MAX_LENGTH}
              multiline
              accessibilityLabel="Описание"
              style={[styles.descriptionInput, { color: ui.fg() }]}
            />
          </View>

          <ListGroup>
            <ListRow icon={recipientIcon} label="Исполнитель" value={recipientText} onPress={() => setPicker('recipient')} />
            <ListRow icon="event" label="Срок" value={dueText} onPress={() => setPicker('due')} />
            <ListRow
              icon="notifications"
              label="Напоминание"
              value={reminderText}
              disabled={!draft.due.due}
              onPress={() => setPicker('reminder')}
            />
          </ListGroup>

          <View style={styles.priority}>
            <Text style={[styles.priorityLabel, { color: ui.fg(0.6) }]}>Приоритет</Text>
            <SegmentedControl<TaskPriority>
              accessibilityLabel="Приоритет"
              tone="neutral"
              fill
              value={draft.priority}
              options={priorityOptions(ui.danger)}
              onChange={(priority) => update({ priority })}
              style={styles.segmentTrack}
              optionStyle={styles.segmentOption}
            />
          </View>
        </ScrollView>

        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12) + 12 }]}>
          <Button title="Создать задачу" onPress={() => void submit()} variant="accent" size="block" loading={busy} />
        </View>

        <RecipientPickerScreen
          visible={picker === 'recipient'}
          onClose={() => setPicker(null)}
          value={draft.recipient}
          onSelect={(recipient) => update({ recipient })}
        />
        <TaskDueEditor
          visible={picker === 'due'}
          onClose={() => setPicker(null)}
          value={draft.due}
          onApply={(due) => update({ due, dueBeforeText: null })}
          todayKey={todayKey}
        />
        <TaskChoicePicker
          visible={picker === 'reminder'}
          onClose={() => setPicker(null)}
          title="Напоминание"
          value={draft.reminder}
          options={REMINDER_CHOICES}
          onChange={(reminder) => update({ reminder })}
        />
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  flex: { flex: 1 },
  header: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, paddingBottom: 4 },
  cancel: { position: 'absolute', left: 16, bottom: 4 },
  cancelLabel: { fontSize: 17 },
  headerTitle: { fontSize: 17, fontWeight: '600', paddingBottom: 6 },
  content: { padding: 16, gap: 16 },
  card: { borderRadius: 16, padding: 14, gap: 10 },
  titleInput: { fontSize: 20, fontWeight: '600', paddingBottom: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  descriptionInput: { fontSize: 15, minHeight: 44, textAlignVertical: 'top' },
  error: { fontSize: 13 },
  priority: { gap: 10 },
  priorityLabel: { fontSize: 14, fontWeight: '500' },
  segmentTrack: { borderRadius: 12 },
  segmentOption: { minHeight: 37, borderRadius: 10 },
  footer: { paddingHorizontal: 16, paddingTop: 8 },
});
