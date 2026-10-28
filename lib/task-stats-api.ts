import { request } from '@/lib/api';
import type { RequestFailure } from '@/lib/api-errors';
import type { StatsEmployeesScope, StatsPeriod, TaskStats } from '@/lib/task-stats';

/** Own statistics, or an employee's (`userId`) within the departments the user heads. */
export function fetchTaskStats(
  period: Pick<StatsPeriod, 'from' | 'to'>,
  userId: number | null,
  signal?: AbortSignal,
): Promise<{ ok: true; data: TaskStats } | RequestFailure> {
  const params: Record<string, string> = { from: period.from, to: period.to };
  if (userId != null) params.user_id = String(userId);
  return request<TaskStats>('/user-tasks/stats', { params, signal });
}

/** Departments and employees whose statistics the user may open; empty for everyone else. */
export function fetchStatsEmployees(signal?: AbortSignal): Promise<{ ok: true; data: StatsEmployeesScope } | RequestFailure> {
  return request<StatsEmployeesScope>('/user-tasks/stats/employees', { signal });
}
