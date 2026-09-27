import { request } from './api';

import type { TaskAssignmentType, UserTask } from '@/lib/user-tasks-api';

/** Сотрудник в справочнике получателей. department_id: null — «Без отдела». */
export interface RecipientEmployee {
  id: number;
  full_name: string;
  position: string | null;
  department_id: number | null;
}

export interface RecipientDepartment {
  id: number;
  name: string;
}

export interface RecipientCompany {
  id: number;
  name: string;
  /** Для внешней компании: доступна целиком (можно назначить всей компании). Своя — всегда целиком. */
  whole: boolean;
  office?: { id: number; name: string } | null;
  departments: RecipientDepartment[];
  employees: RecipientEmployee[];
}

/** «Моя компания» + «Доступные компании» (через группы взаимодействия Администратора). */
export interface RecipientDirectory {
  my_company: RecipientCompany | null;
  available_companies: RecipientCompany[];
}

type RawDirectory = {
  my_company: Omit<RecipientCompany, 'whole'> | null;
  available_companies: RecipientCompany[];
};

/** Выбор в поле «Исполнитель». Один тип назначения на задачу. */
export type RecipientSelection =
  | { type: 'company'; company: { id: number; name: string } }
  | { type: 'department'; company: { id: number; name: string }; department: RecipientDepartment }
  | { type: 'users'; company: { id: number; name: string }; users: { id: number; full_name: string }[] }
  /** Пользователь без компании в оргструктуре — прежний поиск и executor_id. */
  | { type: 'legacy_user'; user: { id: number; full_name: string } };

export type TaskAssignmentInput =
  | { type: 'company'; company_id: number }
  | { type: 'department'; department_id: number }
  | { type: 'users'; user_ids: number[] };

export function toAssignmentInput(selection: RecipientSelection): TaskAssignmentInput | null {
  switch (selection.type) {
    case 'company':
      return { type: 'company', company_id: selection.company.id };
    case 'department':
      return { type: 'department', department_id: selection.department.id };
    case 'users':
      return { type: 'users', user_ids: selection.users.map((u) => u.id) };
    default:
      return null;
  }
}

/** Выбор целиком компании или отдела — перед созданием нужно подтверждение. */
export function massAssignmentConfirmText(selection: RecipientSelection | null): string | null {
  if (selection?.type === 'company') {
    return `Задача будет назначена всем сотрудникам компании ${selection.company.name}. Продолжить?`;
  }
  if (selection?.type === 'department') {
    return `Задача будет назначена всем сотрудникам отдела ${selection.department.name}. Продолжить?`;
  }
  return null;
}

export function recipientSelectionLabel(selection: RecipientSelection | null): string {
  if (!selection) return 'Исполнитель';
  switch (selection.type) {
    case 'company':
      return selection.company.name;
    case 'department':
      return selection.department.name;
    case 'users':
      return selection.users.length === 1
        ? selection.users[0].full_name
        : `${selection.users[0].full_name} +${selection.users.length - 1}`;
    case 'legacy_user':
      return selection.user.full_name;
  }
}

/** Подпись получателя групповой задачи с API. */
export function groupRecipientLabel(task: Pick<UserTask, 'assignment_type' | 'targetCompany' | 'targetDepartment' | 'targetUsers'>): string {
  const type: TaskAssignmentType | null | undefined = task.assignment_type;
  if (type === 'company') return task.targetCompany?.name ? `Компания «${task.targetCompany.name}»` : 'Компания';
  if (type === 'department') {
    const name = task.targetDepartment?.name;
    const company = task.targetDepartment?.company?.name;
    if (!name) return 'Отдел';
    return company ? `Отдел «${name}» · ${company}` : `Отдел «${name}»`;
  }
  if (type === 'users') {
    const users = task.targetUsers ?? [];
    if (users.length === 0) return 'Сотрудники';
    return users.map((u) => u.full_name).join(', ');
  }
  return '';
}

export async function getTaskRecipients(): Promise<
  { ok: true; data: RecipientDirectory } | { ok: false; error: string }
> {
  const result = await request<RawDirectory>('/user-tasks/recipients');
  if (!result.ok) return { ok: false, error: result.error };
  const raw = result.data;
  return {
    ok: true,
    data: {
      my_company: raw.my_company ? { ...raw.my_company, whole: true } : null,
      available_companies: raw.available_companies ?? [],
    },
  };
}

export interface TaskParticipant {
  id: number;
  full_name: string;
  position: string | null;
  department_id: number | null;
}

export async function getTaskParticipants(
  taskId: number,
  q?: string
): Promise<{ ok: true; data: TaskParticipant[] } | { ok: false; error: string }> {
  const params: Record<string, string> = {};
  if (q && q.trim()) params.q = q.trim();
  const result = await request<{ participants: TaskParticipant[] }>(`/user-tasks/${taskId}/participants`, {
    params: Object.keys(params).length ? params : undefined,
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data.participants ?? [] };
}

/** user_id: null — снять ответственного. */
export async function setTaskResponsible(
  taskId: number,
  userId: number | null
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/user-tasks/${taskId}/responsible`, {
    method: 'PUT',
    body: JSON.stringify({ user_id: userId }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export type TaskEventAction =
  | 'responsible_assigned'
  | 'responsible_changed'
  | 'responsible_removed'
  | 'completed'
  | 'reopened';

type EventUser = { id: number; full_name: string | null } | null;

export interface TaskEvent {
  id: number;
  action: TaskEventAction;
  created_at: string;
  actor: { id: number; full_name: string } | null;
  details: { from?: EventUser; to?: EventUser; reason?: string; responsible_id?: number | null } | null;
}

export async function getTaskHistory(
  taskId: number
): Promise<{ ok: true; data: TaskEvent[] } | { ok: false; error: string }> {
  const result = await request<{ events: TaskEvent[] }>(`/user-tasks/${taskId}/history`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data.events ?? [] };
}

/** Короткая строка истории: «Иван назначил ответственным Ольгу». */
export function describeTaskEvent(event: TaskEvent): string {
  const actor = event.actor?.full_name ?? 'Система';
  const from = event.details?.from?.full_name ?? 'участника';
  const to = event.details?.to?.full_name ?? 'участника';
  switch (event.action) {
    case 'responsible_assigned':
      return event.actor && event.actor.id === event.details?.to?.id
        ? `${actor} назначил(а) себя ответственным`
        : `${actor} назначил(а) ответственным: ${to}`;
    case 'responsible_changed':
      return `${actor} сменил(а) ответственного: ${from} → ${to}`;
    case 'responsible_removed':
      return event.actor
        ? `${actor} снял(а) ответственного: ${from}`
        : `Ответственный снят: ${from} больше не участник задачи`;
    case 'completed':
      return `${actor} завершил(а) задачу`;
    case 'reopened':
      return `${actor} вернул(а) задачу в работу`;
    default:
      return actor;
  }
}
