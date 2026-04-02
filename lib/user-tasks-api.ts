import { request } from './api';

export type TaskPriority = 'low' | 'medium' | 'high';

export interface TaskTeamRef {
  id: number;
  name: string;
  leader_id: number;
  leader?: { id: number; full_name: string };
  members?: { id: number; full_name: string }[];
}

export interface TaskExecutorRef {
  id: number;
  full_name: string;
}

export interface UserTask {
  id: number;
  creator_id: number;
  title: string;
  completed: boolean;
  completed_at: string | null;
  scheduled_at: string | null;
  deadline_from: string | null;
  deadline_to: string | null;
  deadline_time: string | null;
  remind_at: string | null;
  priority: TaskPriority;
  reminders_disabled: boolean;
  remind_before_minutes: number | null;
  created_at: string;
  updated_at: string;
  assignee_ids: number[];
  /** Исполнители с именами (приходит с API при list/getById/create/update) */
  assignees?: { id: number; full_name: string }[];
  team_id?: number | null;
  executor_id?: number | null;
  team?: TaskTeamRef | null;
  executor?: TaskExecutorRef | null;
}

function unwrapTaskPayload(raw: unknown): UserTask {
  if (raw && typeof raw === 'object' && 'task' in raw) {
    const t = (raw as { task?: UserTask }).task;
    if (t) return t;
  }
  return raw as UserTask;
}

export interface CalendarTask {
  id: number;
  title: string;
  scheduled_at: string;
  completed: boolean;
  creator_id?: number;
  assignee_ids?: number[];
  team_id?: number | null;
  executor_id?: number | null;
  team?: TaskTeamRef | null;
  executor?: TaskExecutorRef | null;
}

export interface TodayStats {
  todayCompleted: number;
  todayTotal: number;
  overdueCount: number;
}

export interface UserTasksListResponse {
  tasks: UserTask[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type TaskFilter = 'all' | 'today' | 'overdue';

export async function getUserTasks(params: {
  filter?: TaskFilter;
  date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ ok: true; data: UserTasksListResponse } | { ok: false; error: string }> {
  const searchParams: Record<string, string> = {};
  if (params.filter) searchParams.filter = params.filter;
  if (params.date) searchParams.date = params.date;
  if (params.start_date) searchParams.start_date = params.start_date;
  if (params.end_date) searchParams.end_date = params.end_date;
  if (params.page != null) searchParams.page = String(params.page);
  if (params.pageSize != null) searchParams.pageSize = String(params.pageSize);

  const result = await request<UserTasksListResponse>('/user-tasks', {
    params: Object.keys(searchParams).length ? searchParams : undefined,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function getUserTasksCalendar(
  startDate: string,
  endDate: string
): Promise<{ ok: true; data: { tasks: CalendarTask[] } } | { ok: false; error: string }> {
  const result = await request<{ tasks: CalendarTask[] }>('/user-tasks/calendar', {
    params: { start_date: startDate, end_date: endDate },
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function getTodayStats(): Promise<
  { ok: true; data: TodayStats } | { ok: false; error: string }
> {
  const result = await request<TodayStats>('/user-tasks/today-stats');
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function getUserTask(
  id: number
): Promise<{ ok: true; data: UserTask } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask }>(`/user-tasks/${id}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: unwrapTaskPayload(result.data) };
}

export async function createUserTask(body: {
  title: string;
  priority?: TaskPriority;
  scheduled_at?: string | null;
  deadline_from?: string | null;
  deadline_to?: string | null;
  deadline_time?: string | null;
  assignee_ids?: number[];
  team_id?: number | null;
  executor_id?: number | null;
  reminders_disabled?: boolean;
  remind_before_minutes?: number | null;
}): Promise<{ ok: true; data: UserTask } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask }>('/user-tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: unwrapTaskPayload(result.data) };
}

export async function updateUserTask(
  id: number,
  body: Partial<{
    title: string;
    priority: TaskPriority;
    completed: boolean;
    scheduled_at: string | null;
    deadline_from: string | null;
    deadline_to: string | null;
    deadline_time: string | null;
    assignee_ids: number[];
    team_id: number | null;
    executor_id: number | null;
    reminders_disabled: boolean;
    remind_at: string | null;
    remind_before_minutes: number | null;
  }>
): Promise<{ ok: true; data: UserTask } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask }>(`/user-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: unwrapTaskPayload(result.data) };
}

export async function deleteUserTask(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<undefined>(`/user-tasks/${id}`, { method: 'DELETE' });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function completeUserTask(
  id: number
): Promise<{ ok: true; data: UserTask } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask }>(`/user-tasks/${id}/complete`, {
    method: 'PATCH',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: unwrapTaskPayload(result.data) };
}

export async function remindUserTask(
  id: number,
  action: 'in_1h' | 'tomorrow' | 'off'
): Promise<{ ok: true; data: UserTask } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask }>(`/user-tasks/${id}/remind`, {
    method: 'PATCH',
    body: JSON.stringify({ action }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: unwrapTaskPayload(result.data) };
}
