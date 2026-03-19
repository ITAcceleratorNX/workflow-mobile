import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback } from 'react';
import {
    ActivityIndicator,
    Pressable,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoList } from '@/hooks/use-todo-list';
import { formatTaskTime, toAppDateKey } from '@/lib/taskDateTime';
import { getDeadlineStatus } from '@/lib/taskDeadlineUtils';
import type { UserTask } from '@/lib/user-tasks-api';

interface TodoTabProps {
  filter?: 'all' | 'overdue';
}

function TaskRow({
  task,
  onToggle,
  onPress,
  textColor,
  textMuted,
  primary,
  borderColor,
}: {
  task: UserTask;
  onToggle: () => void;
  onPress: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
}) {
  const status = getDeadlineStatus(task.deadline_to, task.deadline_time);
  const scheduledStr = task.scheduled_at
    ? `${toAppDateKey(task.scheduled_at)} ${formatTaskTime(task.scheduled_at)}`
    : null;
  const hasScheduled = !!task.scheduled_at;

  return (
    <View style={[styles.taskRow, { borderBottomColor: borderColor }]}>
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onToggle();
        }}
        hitSlop={10}
        style={[
          styles.checkbox,
          { borderColor: task.completed ? primary : borderColor },
          task.completed && { backgroundColor: primary },
        ]}
      >
        {task.completed && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
      </Pressable>
      <Pressable
        onPress={onPress}
        hitSlop={{ top: 10, bottom: 10, left: 6, right: 16 }}
        style={({ pressed }) => [styles.taskPressArea, { opacity: pressed ? 0.92 : 1 }]}
      >
        <View style={styles.taskContent}>
          <ThemedText
            style={[
              styles.taskTitle,
              { color: task.completed ? textMuted : textColor },
              task.completed && styles.taskCompleted,
            ]}
            numberOfLines={2}
          >
            {task.title}
          </ThemedText>
          {scheduledStr && (
            <ThemedText style={[styles.taskMeta, { color: textMuted }]}>{scheduledStr}</ThemedText>
          )}
          {task.assignee_ids?.length > 0 && (
            <View style={[styles.badge, styles.badgeRow, { backgroundColor: primary }]}>
              <MaterialIcons name="group" size={12} color="#FFFFFF" style={styles.badgeIcon} />
              <ThemedText style={styles.badgeText}>Командная</ThemedText>
            </View>
          )}
          {status === 'overdue' && !task.completed && (
            <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
              <ThemedText style={styles.badgeText}>Просрочено</ThemedText>
            </View>
          )}
          {status === 'expiring' && !task.completed && (
            <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
              <ThemedText style={styles.badgeText}>Истекает срок</ThemedText>
            </View>
          )}
          {task.reminders_disabled && (
            <View style={styles.remindersOffWrap}>
              <MaterialIcons name="notifications-off" size={14} color={textMuted} />
              <ThemedText style={[styles.remindersOffText, { color: textMuted }]}>Без напоминаний</ThemedText>
            </View>
          )}
        </View>
        <MaterialIcons name="chevron-right" size={24} color={textMuted} />
      </Pressable>
    </View>
  );
}

export function TodoTab({ filter = 'all' }: TodoTabProps) {
  const router = useRouter();
  const { tasks, loading, toggleComplete } = useTodoList(
    filter === 'overdue' ? 'overdue' : 'all'
  );

  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');

  const handleEditTask = useCallback((task: UserTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (task?.id == null) return;
    router.push({ pathname: '/client/tasks/task-editor', params: { mode: 'edit', taskId: String(task.id) } });
  }, [router]);

  return (
    <View style={styles.container}>
      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : tasks.length === 0 ? (
        <View style={styles.empty}>
          <MaterialIcons name="format-list-bulleted" size={48} color={textMuted} />
          <ThemedText style={[styles.emptyText, { color: textMuted }]}>
            {filter === 'overdue' ? 'Нет просроченных задач' : 'Нет задач'}
          </ThemedText>
        </View>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={() => toggleComplete(task)}
              onPress={() => handleEditTask(task)}
              textColor={text}
              textMuted={textMuted}
              primary={primary}
              borderColor={border}
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    minHeight: 200,
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  empty: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  emptyText: {
    marginTop: 12,
    fontSize: 15,
  },
  list: {
    maxHeight: 300,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    minHeight: 56,
  },
  taskPressArea: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
    minWidth: 0,
  },
  taskTitle: {
    fontSize: 16,
  },
  taskCompleted: {
    textDecorationLine: 'line-through',
  },
  taskMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badgeIcon: {
    marginRight: 4,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  remindersOffWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  remindersOffText: {
    fontSize: 11,
  },
  menuBtn: {
    padding: 4,
    marginRight: 4,
  },
  removeBtn: {
    padding: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 4,
  },
  modalSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  optionalRow: {
    marginBottom: 12,
  },
  optionalLabel: {
    fontSize: 12,
    marginBottom: 6,
  },
  assigneeSearch: {
    marginBottom: 4,
  },
  searchHint: {
    fontSize: 12,
    marginBottom: 4,
  },
  assigneeResults: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 120,
    marginBottom: 8,
  },
  assigneeResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  assigneeResultText: {
    fontSize: 14,
  },
  assigneeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  assigneeChipText: {
    fontSize: 13,
    maxWidth: 120,
  },
  assigneeChipRemove: {
    marginLeft: 4,
  },
  removeFromCalendarBtn: {
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    marginBottom: 12,
  },
  removeFromCalendarText: {
    fontSize: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
  },
  modalBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  actionsList: {
    marginTop: 12,
    gap: 8,
  },
  actionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
  },
  actionIcon: {
    marginRight: 12,
  },
  actionText: {
    fontSize: 15,
  },
});
