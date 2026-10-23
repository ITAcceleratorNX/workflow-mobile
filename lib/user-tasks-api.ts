import type { TaskSortField, TaskSortDirection } from "@/lib/task-list-sort";
import { request } from './api';

import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/auth-store';
import type { TaskAssignmentInput, TaskTransferInput } from '@/lib/task-recipients-api';
import {
  normalizeRecurrenceFromApi,
  type RecurrenceCustomUnit,
  type RecurrenceType,
} from '@/lib/task-recurrence';
import { formDataFile } from '@/lib/form-data-file';

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
  /** Текущая должность сотрудника (в карточке задачи); null — не указана. */
  position?: string | null;
}

/** Групповое назначение через оргструктуру; null — личная задача, исполнитель или команда. */
export type TaskAssignmentType = 'company' | 'department' | 'users';

/** Права текущего пользователя в групповой задаче (приходят с API только для групповых). */
export interface GroupTaskPermissions {
  can_complete: boolean;
  can_reopen: boolean;
  can_manage_responsible: boolean;
  can_take_responsibility: boolean;
}

/**
 * Права текущего пользователя в любой задаче. read_only — бывший участник после передачи:
 * задача остаётся там же, где была, но менять её нельзя.
 */
export interface TaskPermissions {
  can_complete: boolean;
  can_reopen: boolean;
  /** Уже учитывает, что выполненную задачу сначала возвращают в работу. */
  can_transfer: boolean;
  can_view_history: boolean;
  /** Название, описание, срок, приоритет, напоминания, вложения. Нет у старого backend. */
  can_edit?: boolean;
  /** Удаление — только автор. Нет у старого backend. */
  can_delete?: boolean;
  read_only: boolean;
}

/** Поля групповой задачи: получатель, ответственный и права. */
export interface GroupTaskFields {
  assignment_type?: TaskAssignmentType | null;
  target_company_id?: number | null;
  target_department_id?: number | null;
  targetCompany?: { id: number; name: string } | null;
  targetDepartment?: {
    id: number;
    name: string;
    company_id: number;
    company?: { id: number; name: string } | null;
  } | null;
  targetUsers?: TaskExecutorRef[];
  responsible_id?: number | null;
  responsible?: TaskExecutorRef | null;
  group_permissions?: GroupTaskPermissions | null;
  /** Права в любой задаче (не только групповой); у старого backend поля нет. */
  task_permissions?: TaskPermissions | null;
  /** Только в карточке задачи (GET /user-tasks/:id). */
  participants_count?: number;
}

export interface UserTask extends GroupTaskFields {
  id: number;
  creator_id: number;
  /** Автор с должностью; у старого backend поля нет. */
  creator?: TaskExecutorRef | null;
  title: string;
  /** «Описание»; у старого backend поля нет. */
  description?: string | null;
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
  assignees?: TaskExecutorRef[];
  /** Вложения (приходит с /attachments или может быть подмешано на клиенте) */
  attachments?: UserTaskAttachment[];
  team_id?: number | null;
  executor_id?: number | null;
  team?: TaskTeamRef | null;
  executor?: TaskExecutorRef | null;
  completed_by?: number | null;
  completed_by_user?: TaskExecutorRef | null;
  completedByUser?: TaskExecutorRef | null;
  /** true: задача «Входящие»; без даты/срока — только там; с датой (scheduled_at или срок) также в «Сегодня»/«Предстоящие» и календаре */
  inbox: boolean;
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
  const completedByUser = t.completed_by_user ?? t.completedByUser ?? undefined;
  return { ...t, ...rec, inbox: Boolean(t.inbox), completed_by_user: completedByUser };
}

/** Создатель или руководитель команды (для задач с team_id). */
export function canEditUserTaskDetails(task: UserTask, userId: number | null | undefined): boolean {
  if (typeof task?.task_permissions?.can_edit === 'boolean') return task.task_permissions.can_edit;
  if (!task || userId == null) return false;
  if (task.creator_id === userId) return true;
  if (task.team_id == null) return false;
  const leaderId = task.team?.leader_id;
  return leaderId != null && leaderId === userId;
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

/** A task of GET /user-tasks/calendar: the full task; the date of a legacy deadline fills scheduled_at. */
export type CalendarTask = UserTask & { scheduled_at: string };

/** Счётчики вкладок: GET /user-tasks/counts. */
export interface TaskCounts {
  inbox: number;
  today: number;
  upcoming: number;
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

/** Вкладки списка задач (серверная фильтрация + пагинация). */
export type TaskListView = 'inbox' | 'list_today' | 'list_upcoming' | 'list_completed';

export async function getUserTasks(params: {
  filter?: TaskFilter;
  view?: TaskListView;
  date?: string;
  today?: string;
  sort_by?: TaskSortField;
  sort_direction?: TaskSortDirection;
  from_date?: string;
  to_date?: string;
  completed_on?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  pageSize?: number;
  light?: boolean | '1';
}): Promise<{ ok: true; data: UserTasksListResponse } | { ok: false; error: string }> {
  const searchParams: Record<string, string> = {};
  if (params.filter) searchParams.filter = params.filter;
  if (params.view) searchParams.view = params.view;
  if (params.date) searchParams.date = params.date;
  if (params.today) searchParams.today = params.today;
  if (params.sort_by) searchParams.sort_by = params.sort_by;
  if (params.sort_direction) searchParams.sort_direction = params.sort_direction;
  if (params.from_date) searchParams.from_date = params.from_date;
  if (params.to_date) searchParams.to_date = params.to_date;
  if (params.completed_on) searchParams.completed_on = params.completed_on;
  if (params.start_date) searchParams.start_date = params.start_date;
  if (params.end_date) searchParams.end_date = params.end_date;
  if (params.page != null) searchParams.page = String(params.page);
  if (params.pageSize != null) searchParams.pageSize = String(params.pageSize);
  if (params.light) searchParams.light = '1';

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
  return { ok: true, data: { tasks: result.data.tasks.map((task) => normalizeUserTaskRow(task) as CalendarTask) } };
}

export async function getTaskCounts(
  today: string
): Promise<{ ok: true; data: TaskCounts } | { ok: false; error: string }> {
  const result = await request<TaskCounts>('/user-tasks/counts', { params: { today } });
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
  description?: string | null;
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
  inbox?: boolean;
  /** Компания / отдел / сотрудники одной компании из поля «Исполнитель». */
  assignment?: TaskAssignmentInput;
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
    description: string | null;
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
    inbox: boolean;
  }>
): Promise<{ ok: true; data: UserTask } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask }>(`/user-tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: unwrapTaskPayload(result.data) };
}

/**
 * «Передать задачу»: та же задача (ID, поля, вложения, история) получает нового получателя.
 * data: null — после передачи задача пользователю больше не видна.
 */
export async function transferUserTask(
  id: number,
  body: TaskTransferInput
): Promise<{ ok: true; data: UserTask | null } | { ok: false; error: string }> {
  const result = await request<{ task: UserTask | null }>(`/user-tasks/${id}/transfer`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data?.task ? unwrapTaskPayload(result.data) : null };
}

/** network: the request did not reach the server, so the task is untouched and a retry is safe. */
export async function deleteUserTask(
  id: number
): Promise<{ ok: true } | { ok: false; error: string; network: boolean }> {
  const result = await request<undefined>(`/user-tasks/${id}`, { method: 'DELETE' });
  if (!result.ok) return { ok: false, error: result.error, network: result.status == null && !result.aborted };
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
  files: { uri: string; name: string; type?: string }[]
): Promise<{ ok: true; data: UserTaskAttachment[] } | { ok: false; error: string }> {
  const formData = new FormData();
  files.forEach((f) => {
    formData.append(
      'files',
      formDataFile({ uri: f.uri, name: f.name, type: f.type ?? 'application/octet-stream' })
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

/** Only the author deletes a task; older servers do not send `can_delete`. */
export function canDeleteUserTask(task: UserTask, userId: number | null | undefined): boolean {
  if (typeof task?.task_permissions?.can_delete === 'boolean') return task.task_permissions.can_delete;
  return userId != null && task?.creator_id === userId;
}
