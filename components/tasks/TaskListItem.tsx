import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import { isReadOnlyTask } from '@/lib/group-task-completion';
import { dueSummary, taskDue } from '@/lib/task-due';
import { taskRecipientSummary, type RecipientIcon } from '@/lib/task-recipient-display';
import type { UserTask } from '@/lib/user-tasks-api';

type TaskListItemProps = {
  task: UserTask;
  todayKey: string;
  currentUserId: number | null;
  onToggle: (task: UserTask) => void;
  onOpen: (task: UserTask) => void;
  /** The list is of one day (calendar): the meta line shows only the time. */
  timeOnly?: boolean;
};

const RECIPIENT_ICONS: Record<RecipientIcon, React.ComponentProps<typeof MaterialIcons>['name']> = {
  person: 'person',
  group: 'groups',
  company: 'business',
};

/**
 * A task in a list (Figma «Задача · …»): the check circle, the title and one meta line — the due
 * date (red when overdue), the recipient and the high-priority flag. A completed task stays
 * crossed out with a green circle until the list drops it.
 */
export const TaskListItem = memo(function TaskListItem({ task, todayKey, currentUserId, onToggle, onOpen, timeOnly = false }: TaskListItemProps) {
  const ui = useProductUi();
  const summary = dueSummary(task, todayKey);
  const time = timeOnly ? taskDue(task)?.time ?? null : null;
  const due = timeOnly ? (time ? { ...summary, text: time } : null) : summary;
  const recipient = taskRecipientSummary(task, currentUserId);
  const readOnly = isReadOnlyTask(task);
  const title = task.title.trim() || 'Без названия';
  const overdue = due?.tone === 'overdue' && !task.completed;
  const separator = <Text style={[styles.meta, { color: ui.fg(0.35) }]}>·</Text>;

  return (
    <View style={[styles.row, { backgroundColor: ui.surface }, task.completed && styles.completed]}>
      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onToggle(task);
        }}
        hitSlop={8}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: task.completed, disabled: readOnly }}
        accessibilityLabel={task.completed ? `Вернуть в работу: ${title}` : `Отметить выполненной: ${title}`}
        style={[styles.checkZone, readOnly && styles.readOnly]}
      >
        <View style={[styles.check, task.completed ? { backgroundColor: ui.done } : { borderWidth: 2, borderColor: ui.fg(0.55) }]}>
          {task.completed ? <MaterialIcons name="check" size={14} color={ui.onAccent} /> : null}
        </View>
      </Pressable>

      <Pressable
        onPress={() => onOpen(task)}
        accessibilityRole="button"
        accessibilityLabel={[title, overdue ? `просрочено, ${due?.text}` : due?.text, recipient?.label, task.priority === 'high' ? 'высокий приоритет' : null]
          .filter(Boolean)
          .join(', ')}
        style={({ pressed }) => [styles.body, pressed && { opacity: 0.7 }]}
      >
        <Text
          numberOfLines={2}
          style={[styles.title, { color: ui.fg(0.95) }, task.completed && { color: ui.fg(0.45), textDecorationLine: 'line-through' }]}
        >
          {title}
        </Text>
        <View style={styles.metaRow}>
          {due ? (
            <Text style={[styles.meta, overdue ? [styles.metaStrong, { color: ui.danger }] : { color: due.tone === 'none' ? ui.fg(0.35) : ui.fg(0.5) }]}>
              {due.text}
            </Text>
          ) : null}
          {recipient ? (
            <>
              {due ? separator : null}
              <View style={styles.recipient}>
                <MaterialIcons name={RECIPIENT_ICONS[recipient.icon]} size={13} color={ui.fg(0.5)} />
                <Text style={[styles.meta, { color: ui.fg(0.6) }]} numberOfLines={1}>
                  {recipient.label}
                </Text>
              </View>
            </>
          ) : null}
          {readOnly ? (
            <>
              {separator}
              <View style={styles.recipient}>
                <MaterialIcons name="visibility" size={13} color={ui.fg(0.5)} />
                <Text style={[styles.meta, { color: ui.fg(0.6) }]}>Только просмотр</Text>
              </View>
            </>
          ) : null}
        </View>
      </Pressable>

      {task.priority === 'high' ? <MaterialIcons name="flag" size={16} color={ui.danger} accessibilityElementsHidden /> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingVertical: 12, paddingLeft: 12, paddingRight: 14 },
  completed: { opacity: 0.7 },
  checkZone: { width: 32, height: 32, margin: -5, alignItems: 'center', justifyContent: 'center' },
  readOnly: { opacity: 0.4 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 5 },
  title: { fontSize: 16, lineHeight: 19, fontWeight: '500' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 6, rowGap: 2 },
  meta: { fontSize: 13, lineHeight: 16 },
  metaStrong: { fontWeight: '600' },
  recipient: { flexDirection: 'row', alignItems: 'center', gap: 4, flexShrink: 1 },
});
