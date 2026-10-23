import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskCommentsList } from '@/components/task-comments/task-comments-list';
import { GroupTaskDetails } from '@/components/tasks/GroupTaskDetails';
import { RecipientPickerScreen } from '@/components/tasks/RecipientPickerScreen';
import { TaskAttachmentsSection } from '@/components/tasks/TaskAttachmentsSection';
import { TaskChoicePicker } from '@/components/tasks/TaskChoicePicker';
import { TaskDueEditor, type DueValue } from '@/components/tasks/TaskDueEditor';
import { TaskHistorySection } from '@/components/tasks/TaskHistorySection';
import { Button } from '@/components/ui/button';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { InlineEditText } from '@/components/ui/inline-edit-text';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { useProductUi } from '@/hooks/use-product-ui';
import { useTaskDetail } from '@/hooks/use-task-detail';
import { isGroupTask, isReadOnlyTask, taskToggleBlockedReason } from '@/lib/group-task-completion';
import { dueToScheduledAt, formatDue, isTaskOverdue, taskDue } from '@/lib/task-due';
import { TASK_DESCRIPTION_MAX_LENGTH, TASK_TITLE_MAX_LENGTH } from '@/lib/task-fields';
import { hasOtherRecipient, taskRecipientLabel, taskRecipientSummary } from '@/lib/task-recipient-display';
import type { RecipientSelection } from '@/lib/task-recipients-api';
import { normalizeRecurrenceFromApi } from '@/lib/task-recurrence';
import { reminderLabel, reminderOptionsFor, reminderValue } from '@/lib/task-reminders';
import { canDeleteUserTask, canEditUserTaskDetails, type TaskPriority, type UserTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';

const PRIORITY_LABEL: Record<TaskPriority, string> = { low: 'Низкий', medium: 'Средний', high: 'Высокий' };
const PRIORITY_CHOICES = (['low', 'medium', 'high'] as const).map((value) => ({ value, label: PRIORITY_LABEL[value] }));

type TaskDetailViewProps = {
  taskId: number;
  todayKey: string;
  /** Back to the list. */
  onClose: () => void;
  /** The task was deleted or is no longer visible to the user. */
  onGone: () => void;
};

/**
 * The task card (Figma «Задачи · Карточка задачи»): title and status, «Отметить выполненной»,
 * «Исполнитель / Срок / Приоритет / Напоминание», «Описание», handing over, deletion, attachments,
 * the history and comments. What the user may change comes from the server.
 */
export function TaskDetailView({ taskId, todayKey, onClose, onGone }: TaskDetailViewProps) {
  const ui = useProductUi();
  const detail = useTaskDetail(taskId, { onGone });

  if (detail.state.status === 'ready' && detail.task) {
    return <TaskCard detail={detail} task={detail.task} todayKey={todayKey} onClose={onClose} onGone={onGone} />;
  }
  return (
    <Frame onClose={onClose}>
      {detail.state.status === 'error' ? (
        <EmptyState
          style={styles.state}
          icon="visibility-off"
          title="Не удалось открыть задачу"
          description={detail.state.message}
          action={<Button title="Повторить" onPress={() => void detail.reload()} variant="accent-outline" size="compact" />}
        />
      ) : (
        <ActivityIndicator style={styles.state} size="large" color={ui.accent} accessibilityLabel="Загружаем задачу" />
      )}
    </Frame>
  );
}

function Frame({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 12 }]}>
      <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Назад к задачам" style={styles.back}>
        <MaterialIcons name="chevron-left" size={28} color={ui.accent} />
        <Text style={[styles.backLabel, { color: ui.accent }]}>Задачи</Text>
      </Pressable>
      {children}
    </View>
  );
}

type Detail = ReturnType<typeof useTaskDetail>;
type Editor = 'due' | 'priority' | 'reminder' | 'transfer' | 'delete' | null;

function TaskCard({ detail, task, todayKey, onClose, onGone }: { detail: Detail; task: UserTask; todayKey: string; onClose: () => void; onGone: () => void }) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const isGuest = useAuthStore((s) => s.isGuest);
  const [editor, setEditor] = useState<Editor>(null);
  const close = () => setEditor(null);

  const canEdit = canEditUserTaskDetails(task, currentUserId);
  const canDelete = canDeleteUserTask(task, currentUserId);
  const canTransfer = task.task_permissions?.can_transfer === true;
  const readOnly = isReadOnlyTask(task);
  const blockedReason = taskToggleBlockedReason(task);
  const due = taskDue(task);
  const overdue = isTaskOverdue(task);
  const dueText = formatDue(due, todayKey, ', ');
  const recipientLabel = taskRecipientLabel(task, currentUserId);
  const recipient = taskRecipientSummary(task, currentUserId);
  const recipientIcon = recipient?.icon === 'company' ? 'business' : recipient?.icon === 'group' ? 'groups' : 'person';
  const reminderFields = { reminders_disabled: task.reminders_disabled, remind_before_minutes: task.remind_before_minutes };
  const authorName = task.creator_id !== currentUserId ? task.creator?.full_name : null;
  const dueValue: DueValue = { due, recurrence: normalizeRecurrenceFromApi(task) };
  const deleteMessage = hasOtherRecipient(task, currentUserId)
    ? `«${task.title}» будет удалена у вас и у исполнителя (${recipientLabel}). Это действие нельзя отменить.`
    : `«${task.title}» будет удалена. Это действие нельзя отменить.`;

  const applyDue = (value: DueValue) =>
    void detail.save({
      scheduled_at: dueToScheduledAt(value.due),
      ...(value.due
        ? value.recurrence
        : { recurrence_type: 'none', recurrence_interval: 1, recurrence_custom_unit: null, recurrence_weekdays: null }),
    });

  const transferTo = (selection: RecipientSelection | null) => {
    if (selection && selection.type !== 'team') void detail.transfer(selection);
  };

  return (
    <Frame onClose={onClose}>
      <TaskCommentsList taskId={task.id} style={styles.list} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>
        <View style={styles.body}>
          <View style={styles.titleBlock}>
            <InlineEditText
              value={task.title}
              editable={canEdit}
              label="Название задачи"
              requiredMessage="Введите название задачи"
              maxLength={TASK_TITLE_MAX_LENGTH}
              onSave={(title) => detail.save({ title })}
              textStyle={[styles.title, { color: ui.fg() }]}
            />
            <View style={styles.badges}>
              {task.completed ? (
                <View style={[styles.badge, { backgroundColor: ui.fg(0.08) }]}>
                  <MaterialIcons name="check" size={14} color={ui.done} />
                  <Text style={[styles.badgeText, { color: ui.done }]}>Выполнена</Text>
                </View>
              ) : overdue ? (
                <View style={[styles.badge, { backgroundColor: `${ui.danger}29` }]}>
                  <Text style={[styles.badgeText, { color: ui.danger }]}>Просрочено · {dueText}</Text>
                </View>
              ) : null}
              {task.priority !== 'medium' ? (
                <View style={[styles.badge, { backgroundColor: ui.fg(0.08) }]}>
                  {task.priority === 'high' ? <MaterialIcons name="flag" size={13} color={ui.danger} /> : null}
                  <Text style={[styles.badgeText, { color: ui.fg() }]}>{PRIORITY_LABEL[task.priority]}</Text>
                </View>
              ) : null}
            </View>
          </View>

          {readOnly ? (
            <View style={[styles.notice, { backgroundColor: ui.fg(0.04) }]}>
              <MaterialIcons name="visibility" size={18} color={ui.fg(0.5)} />
              <Text style={[styles.noticeText, { color: ui.fg(0.7) }]}>
                Задача передана другому получателю. Вы видите её состояние и историю, но не можете её менять.
              </Text>
            </View>
          ) : null}

          <View style={styles.complete}>
            <Button
              title={task.completed ? 'Вернуть в работу' : 'Отметить выполненной'}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                void detail.toggleComplete();
              }}
              variant={task.completed ? 'raised' : 'accent'}
              size="block"
              disabled={blockedReason != null}
              loading={detail.busy === 'complete'}
              leftIcon={<MaterialIcons name={task.completed ? 'replay' : 'check'} size={20} color={task.completed ? ui.fg() : ui.onAccent} />}
            />
            {blockedReason ? <Text style={[styles.blocked, { color: ui.fg(0.55) }]}>{blockedReason}</Text> : null}
          </View>

          <ListGroup accessibilityLabel="Параметры задачи">
            <ListRow icon={recipientIcon} label="Исполнитель" value={recipientLabel} onPress={canTransfer ? () => setEditor('transfer') : undefined} />
            <ListRow
              icon="event"
              label="Срок"
              value={dueText}
              valueTone={overdue ? 'danger' : 'muted'}
              onPress={canEdit ? () => setEditor('due') : undefined}
            />
            <ListRow icon="flag" label="Приоритет" value={PRIORITY_LABEL[task.priority]} onPress={canEdit ? () => setEditor('priority') : undefined} />
            <ListRow
              icon="notifications"
              label="Напоминание"
              value={due ? reminderLabel(reminderFields) : 'Нужен срок'}
              onPress={canEdit && due ? () => setEditor('reminder') : undefined}
            />
            {authorName ? <ListRow icon="person-outline" label="Автор" value={authorName} /> : null}
          </ListGroup>

          {task.description?.trim() || canEdit ? (
            <View style={[styles.description, { backgroundColor: ui.surface }]}>
              <Text style={[styles.descriptionLabel, { color: ui.fg(0.5) }]}>Описание</Text>
              <InlineEditText
                value={task.description ?? ''}
                editable={canEdit}
                multiline
                label="Описание"
                maxLength={TASK_DESCRIPTION_MAX_LENGTH}
                emptyLabel="Добавить описание"
                onSave={(description) => detail.save({ description: description || null })}
                textStyle={[styles.descriptionText, { color: ui.fg() }]}
              />
            </View>
          ) : null}

          {canTransfer || canDelete ? (
            <ListGroup accessibilityLabel="Действия">
              {canTransfer ? (
                <ListRow
                  icon="arrow-forward"
                  label="Передать задачу"
                  tone="accent"
                  disabled={detail.busy === 'transfer'}
                  onPress={() => setEditor('transfer')}
                />
              ) : null}
              {canDelete ? <ListRow icon="delete" label="Удалить" tone="danger" chevron={false} onPress={() => setEditor('delete')} /> : null}
            </ListGroup>
          ) : null}

          {!isGuest ? <TaskAttachmentsSection key={task.id} taskId={task.id} canEdit={canEdit} /> : null}
          {!isGuest && isGroupTask(task) ? <GroupTaskDetails task={task} currentUserId={currentUserId} onChanged={() => void detail.reload()} /> : null}
          {!isGuest && task.task_permissions?.can_view_history !== false ? <TaskHistorySection task={task} /> : null}
        </View>
      </TaskCommentsList>

      <TaskDueEditor visible={editor === 'due'} onClose={close} value={dueValue} onApply={applyDue} todayKey={todayKey} />
      <TaskChoicePicker
        visible={editor === 'priority'}
        onClose={close}
        title="Приоритет"
        value={task.priority}
        options={PRIORITY_CHOICES}
        onChange={(priority) => void detail.save({ priority })}
      />
      <TaskChoicePicker
        visible={editor === 'reminder'}
        onClose={close}
        title="Напоминание"
        value={reminderValue(reminderFields)}
        options={reminderOptionsFor(reminderFields)}
        onChange={(value) => {
          const option = reminderOptionsFor(reminderFields).find((item) => item.value === value);
          if (option) void detail.save(option.fields);
        }}
      />
      <RecipientPickerScreen visible={editor === 'transfer'} onClose={close} value={null} mode="transfer" title="Передать задачу" onSelect={transferTo} />
      <ConfirmSheet
        visible={editor === 'delete'}
        onClose={close}
        title="Удалить задачу?"
        message={deleteMessage}
        confirmLabel="Удалить"
        busy={detail.busy === 'delete'}
        onConfirm={() => {
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          void detail.remove().then((deleted) => {
            close();
            if (deleted) onGone();
          });
        }}
      />
    </Frame>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', marginLeft: 10, minHeight: 44 },
  backLabel: { fontSize: 18 },
  state: { marginTop: 80 },
  list: { flex: 1 },
  body: { paddingHorizontal: 16, paddingTop: 12, gap: 16 },
  titleBlock: { gap: 8 },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 8, paddingVertical: 4, paddingHorizontal: 8 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  notice: { flexDirection: 'row', gap: 10, borderRadius: 16, padding: 12 },
  noticeText: { flex: 1, fontSize: 14, lineHeight: 19 },
  complete: { gap: 6 },
  blocked: { fontSize: 13 },
  description: { borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  descriptionLabel: { fontSize: 13, fontWeight: '500' },
  descriptionText: { fontSize: 16, lineHeight: 19 },
});
