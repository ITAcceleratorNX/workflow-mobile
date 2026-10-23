import type { GroupTaskFields, TaskExecutorRef, TaskTeamRef } from '@/lib/user-tasks-api';

/**
 * Who the task is for, as the lists and the card show it: the department, team or company of a
 * group task, the person it was given to, or — for a task given to the current user — its author.
 */

export type RecipientIcon = 'person' | 'group' | 'company';
export type TaskRecipientSummary = { icon: RecipientIcon; label: string };

export type RecipientSource = Pick<
  GroupTaskFields,
  'assignment_type' | 'targetCompany' | 'targetDepartment' | 'targetUsers'
> & {
  creator_id?: number;
  creator?: TaskExecutorRef | null;
  team_id?: number | null;
  team?: TaskTeamRef | null;
  executor_id?: number | null;
  executor?: TaskExecutorRef | null;
  assignees?: TaskExecutorRef[];
};

function groupSummary(task: RecipientSource): TaskRecipientSummary | null {
  if (task.assignment_type === 'company') return { icon: 'company', label: task.targetCompany?.name ?? 'Компания' };
  if (task.assignment_type === 'department') return { icon: 'group', label: task.targetDepartment?.name ?? 'Отдел' };
  if (task.assignment_type === 'users') {
    const users = task.targetUsers ?? [];
    if (users.length === 0) return { icon: 'group', label: 'Сотрудники' };
    return { icon: 'group', label: users.length <= 2 ? users.map((u) => u.full_name).join(', ') : `${users[0].full_name} +${users.length - 1}` };
  }
  return null;
}

function executorOf(task: RecipientSource): TaskExecutorRef | null {
  if (task.executor_id != null && task.executor?.full_name) return task.executor;
  return task.assignees?.[0] ?? null;
}

/** The recipient line of a list row; null for the user's own task without a recipient. */
export function taskRecipientSummary(task: RecipientSource, currentUserId: number | null): TaskRecipientSummary | null {
  const group = groupSummary(task);
  if (group) return group;
  if (task.team_id != null && task.team?.name) return { icon: 'group', label: task.team.name };
  const executor = executorOf(task);
  if (executor && executor.id !== currentUserId) return { icon: 'person', label: executor.full_name };
  const fromSomeoneElse = task.creator_id != null && currentUserId != null && task.creator_id !== currentUserId;
  if (fromSomeoneElse && task.creator?.full_name) return { icon: 'person', label: `от ${task.creator.full_name}` };
  return null;
}

/** The «Исполнитель» value of the card and the delete question: «Я» for the user's own task. */
export function taskRecipientLabel(task: RecipientSource, currentUserId: number | null): string {
  const group = groupSummary(task);
  if (group) return group.label;
  if (task.team_id != null && task.team?.name) return task.team.name;
  const executor = executorOf(task);
  if (!executor || executor.id === currentUserId) return 'Я';
  return executor.full_name;
}

/** Someone besides the current user takes part, so deletion removes the task for them too. */
export function hasOtherRecipient(task: RecipientSource, currentUserId: number | null): boolean {
  if (task.assignment_type || task.team_id != null) return true;
  const executor = executorOf(task);
  return executor != null && executor.id !== currentUserId;
}
