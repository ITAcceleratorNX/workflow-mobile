import { request } from './api';

import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/auth-store';
import {
  normalizeRecurrenceFromApi,
  type RecurrenceCustomUnit,
  type RecurrenceType,
} from '@/lib/task-recurrence';

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
  recurrence_type: RecurrenceType;
  recurrence_interval: number;
  recurrence_custom_unit: RecurrenceCustomUnit | null;
  recurrence_weekdays: number[] | null;
  created_at: string;
  updated_at: string;
  assignee_ids: number[];
  /** Исполнители с именами (приходит с API при list/getById/create/update) */
  assignees?: { id: number; full_name: string }[];
  /** Вложения (приходит с /attachments или может быть подмешано на клиенте) */
  attachments?: UserTaskAttachment[];
  team_id?: number | null;
  executor_id?: number | null;
  team?: TaskTeamRef | null;
  executor?: TaskExecutorRef | null;
}

function unwrapTaskPayload(raw: unknown): UserTask {
  let t: UserTask | undefined;
  if (raw && typeof raw === 'object' && 'task' in raw) {
    t = (raw as { task?: UserTask }).task;
  } else {
    t = raw as UserTask | undefined;
  }
  if (!t) return raw as UserTask;
  return normalizeUserTaskRow(t);
}

function normalizeUserTaskRow(t: UserTask): UserTask {
  const rec = normalizeRecurrenceFromApi(t);
  return { ...t, ...rec };
}

export type UserTaskAttachmentKind = 'image' | 'video' | 'document';

export interface UserTaskAttachment {
  id: number;
  user_task_id: number;
  uploaded_by_id: number;
  file_url: string;
  file_name: string | null;
  mime_type: string | null;
  file_kind: UserTaskAttachmentKind;
  created_at: string;
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
  return {
    ok: true,
    data: {
      ...result.data,
      tasks: result.data.tasks.map((t) => normalizeUserTaskRow(t)),
    },
  };
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
  recurrence_type?: RecurrenceType;
  recurrence_interval?: number;
  recurrence_custom_unit?: RecurrenceCustomUnit | null;
  recurrence_weekdays?: number[] | null;
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
    recurrence_type: RecurrenceType;
    recurrence_interval: number;
    recurrence_custom_unit: RecurrenceCustomUnit | null;
    recurrence_weekdays: number[] | null;
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

export async function getUserTaskAttachments(
  taskId: number
): Promise<{ ok: true; data: UserTaskAttachment[] } | { ok: false; error: string }> {
  const result = await request<{ attachments: UserTaskAttachment[] }>(`/user-tasks/${taskId}/attachments`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data.attachments ?? [] };
}

export async function uploadUserTaskAttachments(
  taskId: number,
  files: Array<{ uri: string; name: string; type?: string }>
): Promise<{ ok: true; data: UserTaskAttachment[] } | { ok: false; error: string }> {
  const formData = new FormData();
  files.forEach((f) => {
    formData.append(
      'files',
      {
        uri: f.uri,
        name: f.name,
        type: f.type ?? 'application/octet-stream',
      } as unknown as Blob
    );
  });

  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${config.apiBaseUrl}/user-tasks/${taskId}/attachments`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data?.error ?? data?.message) || 'Ошибка загрузки вложений';
      return { ok: false, error: err };
    }
    return { ok: true, data: data.attachments ?? [] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка загрузки вложений';
    return { ok: false, error: msg };
  }
}

export async function deleteUserTaskAttachment(
  taskId: number,
  attachmentId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/user-tasks/${taskId}/attachments/${attachmentId}`, { method: 'DELETE' });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}
