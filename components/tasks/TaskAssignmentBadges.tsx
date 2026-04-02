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
  assignee_ids?: number[];
};

export type TaskAssignmentBadgesProps = {
  task: TaskBadgeSource;
  primary: string;
  currentUserId?: number | null;
  /** Более плотные отступы (например TodoTab) */
  compact?: boolean;
};

/**
 * Бейджи команды, исполнителя и устаревшей «командности» по assignee_ids.
 */
export function TaskAssignmentBadges({
  task,
  primary,
  currentUserId,
  compact,
}: TaskAssignmentBadgesProps) {
  const legacyAssignees = !task.team_id && (task.assignee_ids?.length ?? 0) > 0;
  const teamName = task.team_id && task.team?.name ? task.team.name : null;
  const exec =
    task.executor_id && task.executor?.full_name
      ? { id: task.executor_id, full_name: task.executor.full_name }
      : null;
  const executorIsYou = currentUserId != null && task.executor_id === currentUserId;

  if (!legacyAssignees && !teamName && !exec) return null;

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
      {exec ? (
        <View
          style={[
            styles.pill,
            styles.pillOutline,
            { borderColor: primary },
            executorIsYou && { backgroundColor: `${primary}18` },
          ]}
        >
          <MaterialIcons name="person" size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            {executorIsYou ? 'Вы' : exec.full_name}
          </ThemedText>
        </View>
      ) : null}
      {legacyAssignees ? (
        <View style={[styles.pill, { backgroundColor: primary, borderColor: primary }]}>
          <MaterialIcons name="group" size={compact ? 11 : 12} color="#fff" />
          <ThemedText style={[styles.pillText, { color: '#fff' }]}>Командная</ThemedText>
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
