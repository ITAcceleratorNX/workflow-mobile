import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { GroupTaskFields, TaskExecutorRef, TaskTeamRef } from '@/lib/user-tasks-api';
import { isReadOnlyTask } from '@/lib/group-task-completion';

/** Минимум полей для бейджей (списки, календарь, детали). */
export type TaskBadgeSource = Pick<
  GroupTaskFields,
  'assignment_type' | 'targetCompany' | 'targetDepartment' | 'targetUsers' | 'responsible' | 'task_permissions'
> & {
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

function groupBadge(task: TaskBadgeSource): { icon: keyof typeof MaterialIcons.glyphMap; label: string } | null {
  if (task.assignment_type === 'company') return { icon: 'business', label: task.targetCompany?.name ?? 'Компания' };
  if (task.assignment_type === 'department') return { icon: 'apartment', label: task.targetDepartment?.name ?? 'Отдел' };
  if (task.assignment_type === 'users') {
    const count = task.targetUsers?.length ?? 0;
    return { icon: 'people', label: count ? `Сотрудники: ${count}` : 'Сотрудники' };
  }
  return null;
}

/** Переданная задача осталась у пользователя: видна там же, но только для просмотра. */
function ReadOnlyPill({ color, compact }: { color: string; compact?: boolean }) {
  return (
    <View style={[styles.pill, styles.pillOutline, { borderColor: color }]}>
      <MaterialIcons name="visibility" size={compact ? 11 : 12} color={color} />
      <ThemedText style={[styles.pillText, { color }]} numberOfLines={1}>
        Только просмотр
      </ThemedText>
    </View>
  );
}

/** Бейджи команды и исполнителей для списков, календаря и деталей. */
export function TaskAssignmentBadges({
  task,
  primary,
  currentUserId,
  compact,
}: TaskAssignmentBadgesProps) {
  const readOnly = isReadOnlyTask(task) ? <ReadOnlyPill color={primary} compact={compact} /> : null;
  const group = groupBadge(task);
  if (group) {
    const responsible = task.responsible?.full_name
      ? currentUserId != null && task.responsible.id === currentUserId
        ? 'Вы'
        : task.responsible.full_name
      : null;
    return (
      <View style={[styles.wrap, compact && styles.wrapCompact]}>
        {readOnly}
        <View style={[styles.pill, styles.pillOutline, { borderColor: primary }]}>
          <MaterialIcons name={group.icon} size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            {group.label}
          </ThemedText>
        </View>
        {responsible ? (
          <View style={[styles.pill, styles.pillOutline, { borderColor: primary, backgroundColor: `${primary}18` }]}>
            <MaterialIcons name="verified-user" size={compact ? 11 : 12} color={primary} />
            <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
              {responsible}
            </ThemedText>
          </View>
        ) : null}
      </View>
    );
  }

  const teamName = task.team_id && task.team?.name ? task.team.name : null;
  const executorName =
    !teamName && task.executor_id && task.executor?.full_name ? task.executor.full_name : null;
  const legacyAssignee =
    !teamName && !executorName && task.assignees?.[0]?.full_name
      ? task.assignees[0].full_name
      : null;
  const personName = executorName ?? legacyAssignee;

  if (!teamName && !personName && !readOnly) return null;

  return (
    <View style={[styles.wrap, compact && styles.wrapCompact]}>
      {readOnly}
      {teamName ? (
        <View style={[styles.pill, styles.pillOutline, { borderColor: primary }]}>
          <MaterialIcons name="groups" size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            {teamName}
          </ThemedText>
        </View>
      ) : null}
      {personName ? (
        <View
          style={[
            styles.pill,
            styles.pillOutline,
            { borderColor: primary },
            currentUserId != null &&
              task.executor_id === currentUserId && { backgroundColor: `${primary}18` },
          ]}
        >
          <MaterialIcons name="person" size={compact ? 11 : 12} color={primary} />
          <ThemedText style={[styles.pillText, { color: primary }]} numberOfLines={1}>
            {currentUserId != null && task.executor_id === currentUserId ? 'Вы' : personName}
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
