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
  /** id секции из task-views (чтобы не дублировать дату из заголовка группы). */
  sectionId?: string;
  onToggle: () => void;
  /** Вся строка (кроме чекбокса) ведёт на экран подробностей */
  onPressRow: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
  cardBackground: string;
  currentUserId?: number | null;
}

function buildScheduleLine(
  dateStr: string | null,
  timeStr: string | null,
  todayKey: string,
  sectionId?: string
): { text: string; showClock: boolean } | null {
  if (!dateStr && !timeStr) return null;
  if (!dateStr && timeStr) return { text: timeStr, showClock: true };

  const dStr = dateStr!;

  if (sectionId === 'today') {
    if (timeStr) return { text: timeStr, showClock: true };
    return { text: formatSectionDateLabel(dStr, todayKey), showClock: false };
  }

  if (sectionId?.startsWith('day-')) {
    const sectionDay = sectionId.slice('day-'.length);
    if (dStr === sectionDay) {
      if (timeStr) return { text: timeStr, showClock: true };
      return { text: formatSectionDateLabel(dStr, todayKey), showClock: false };
    }
  }

  const dateLabel = formatSectionDateLabel(dStr, todayKey);
  if (timeStr) return { text: `${dateLabel} · ${timeStr}`, showClock: false };
  return { text: dateLabel, showClock: false };
}

/**
 * Строка задачи в духе Todoist: заголовок, одна строка времени/даты без дубля с секцией, бейджи.
 */
export function UserTaskRow({
  item,
  todayKey,
  sectionId,
  onToggle,
  onPressRow,
  textColor,
  textMuted,
  primary,
  borderColor,
  cardBackground,
  currentUserId,
}: UserTaskRowProps) {
  const titleRaw = item.title ?? '';
  const firstLine = (titleRaw.split('\n')[0] ?? '').trim() || 'Без названия';
  const dateStr = item.scheduled_at ? formatDateForApi(new Date(item.scheduled_at)) : null;
  const timeStr = item.scheduled_at ? formatTimeOnly(item.scheduled_at) : null;
  const schedule = buildScheduleLine(dateStr, timeStr, todayKey, sectionId);
  const priorityColor = item.priority === 'high' ? '#EF4444' : item.priority === 'low' ? '#22C55E' : '#F59E0B';
  const showPriorityFlag = item.priority === 'high' || item.priority === 'low';

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
          <View style={styles.titleRow}>
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
            {showPriorityFlag ? (
              <MaterialIcons name="flag" size={16} color={priorityColor} style={styles.titleFlag} />
            ) : null}
          </View>
          {schedule ? (
            <View style={styles.scheduleRow}>
              {schedule.showClock ? (
                <MaterialIcons name="schedule" size={14} color={textMuted} style={styles.scheduleIcon} />
              ) : null}
              <ThemedText style={[styles.scheduleText, { color: textMuted }]} numberOfLines={1}>
                {schedule.text}
              </ThemedText>
            </View>
          ) : null}
          <TaskAssignmentBadges task={item} primary={primary} currentUserId={currentUserId} compact />
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
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    marginBottom: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowPress: { flex: 1, flexDirection: 'row', alignItems: 'center', minWidth: 0 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: { flex: 1, minWidth: 0 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  title: { flex: 1, fontSize: 16, lineHeight: 22, fontWeight: '500' },
  titleFlag: { marginTop: 2 },
  textCompleted: { textDecorationLine: 'line-through' },
  scheduleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  scheduleIcon: { marginTop: 1 },
  scheduleText: { fontSize: 13, flex: 1 },
});
