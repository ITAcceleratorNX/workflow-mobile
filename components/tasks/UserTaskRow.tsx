import { View, Pressable, StyleSheet } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';

import { TaskAssignmentBadges } from '@/components/tasks/TaskAssignmentBadges';
import { ThemedText } from '@/components/themed-text';
import { formatDateForApi, formatTimeOnly } from '@/lib/dateTimeUtils';
import { formatSectionDateLabel } from '@/lib/task-views';
import type { UserTask } from '@/lib/user-tasks-api';

export interface UserTaskRowProps {
  item: UserTask;
  todayKey: string;
  onToggle: () => void;
  /** Вся строка (кроме чекбокса) ведёт на экран подробностей */
  onPressRow: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
  cardBackground: string;
  isTeam: boolean;
  currentUserId?: number | null;
}

/**
 * Компактная строка задачи. Редактирование — только в «Подробно».
 */
export function UserTaskRow({
  item,
  todayKey,
  onToggle,
  onPressRow,
  textColor,
  textMuted,
  primary,
  borderColor,
  cardBackground,
  isTeam,
  currentUserId,
}: UserTaskRowProps) {
  const titleRaw = item.title ?? '';
  const firstLine = (titleRaw.split('\n')[0] ?? '').trim() || 'Без названия';
  const dateStr = item.scheduled_at ? formatDateForApi(new Date(item.scheduled_at)) : null;
  const timeStr = item.scheduled_at ? formatTimeOnly(item.scheduled_at) : null;
  const priorityLabel = item.priority === 'high' ? 'Высокий' : item.priority === 'low' ? 'Низкий' : 'Средний';
  const priorityColor = item.priority === 'high' ? '#EF4444' : item.priority === 'low' ? '#22C55E' : '#F59E0B';

  return (
    <View style={[styles.row, { backgroundColor: cardBackground, borderColor }]}>
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onToggle();
        }}
        hitSlop={8}
        style={[
          styles.checkbox,
          { borderColor: item.completed ? primary : borderColor },
          item.completed && { backgroundColor: primary },
        ]}
      >
        {item.completed && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
      </Pressable>
      <Pressable onPress={onPressRow} style={styles.rowPress} hitSlop={4}>
        <View style={styles.rowContent}>
          <ThemedText
            style={[
              styles.title,
              { color: item.completed ? textMuted : textColor },
              item.completed && styles.textCompleted,
            ]}
            numberOfLines={2}
          >
            {firstLine}
          </ThemedText>
          {(dateStr || timeStr) && (
            <ThemedText style={[styles.meta, { color: textMuted }]}>
              {dateStr ? formatSectionDateLabel(dateStr, todayKey) : ''}
              {timeStr ? `${dateStr ? ' • ' : ''}${timeStr}` : ''}
            </ThemedText>
          )}
          <TaskAssignmentBadges task={item} primary={primary} currentUserId={currentUserId} />
          <View style={styles.metaRow}>
            <MaterialIcons name="flag" size={12} color={priorityColor} />
            <ThemedText style={[styles.meta, { color: textMuted }]}>{priorityLabel}</ThemedText>
            {(dateStr || timeStr || isTeam) && (
              <ThemedText style={[styles.meta, { color: textMuted }]}>
                {dateStr && ` • ${formatSectionDateLabel(dateStr, todayKey)}`}
                {timeStr && ` • ${timeStr}`}
                {isTeam && ' • Командный'}
              </ThemedText>
            )}
          </View>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={textMuted} />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: { flex: 1, minWidth: 0 },
  title: { fontSize: 16, lineHeight: 22 },
  textCompleted: { textDecorationLine: 'line-through' },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 4, gap: 4, flexWrap: 'wrap' },
  meta: { fontSize: 12, marginTop: 0 },
});
