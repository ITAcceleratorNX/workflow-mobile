import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { TaskExecutorRef, TaskTeamRef } from '@/lib/user-tasks-api';

/** Минимум полей для бейджей (списки, календарь, детали). */
export type TaskBadgeSource = {
  team_id?: number | null;
  executor_id?: number | null;
  team?: TaskTeamRef | null;
  executor?: TaskExecutorRef | null;
  assignees?: { id: number; full_name: string }[];
};

export type TaskAssignmentBadgesProps = {
  task: TaskBadgeSource;
  primary: string;
  currentUserId?: number | null;
  /** Более плотные отступы (например TodoTab) */
  compact?: boolean;
};

/** Бейджи команды и исполнителей для списков, календаря и деталей. */
export function TaskAssignmentBadges({
  task,
  primary,
  currentUserId,
  compact,
}: TaskAssignmentBadgesProps) {
  const teamName = task.team_id && task.team?.name ? task.team.name : null;
  const people =
    task.assignees && task.assignees.length > 0
      ? task.assignees
      : task.executor_id && task.executor?.full_name
        ? [{ id: task.executor_id, full_name: task.executor.full_name }]
        : [];

  if (!teamName && people.length === 0) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {teamName ? (
        <View style={[styles.pill, styles.pillOutline, { borderColor: primary }]}>
          <MaterialIcons name="groups" size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            {teamName}
          </ThemedText>
        </View>
      ) : null}
      {people.length === 1 ? (
        <View
          style={[
            styles.pill,
            styles.pillOutline,
            { borderColor: primary },
            currentUserId != null && people[0].id === currentUserId && { backgroundColor: `${primary}18` },
          ]}
        >
          <MaterialIcons name="person" size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            {currentUserId != null && people[0].id === currentUserId ? 'Вы' : people[0].full_name}
          </ThemedText>
        </View>
      ) : people.length > 1 ? (
        <View style={[styles.pill, styles.pillOutline, { borderColor: primary }]}>
          <MaterialIcons name="group" size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            Исполнители · {people.length}
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 6,
    alignItems: 'center',
  },
  wrapCompact: {
    marginTop: 4,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    maxWidth: '100%',
  },
  pillOutline: {
    backgroundColor: 'transparent',
  },
  pillText: {
    fontSize: 11,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: 148,
  },
});
