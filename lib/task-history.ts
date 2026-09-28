/**
 * Журнал действий задачи (GET /user-tasks/:id/history): создание, передачи, ответственный,
 * завершение и возврат в работу. Чистые функции без React Native — покрыты тестами.
 */

export type TaskEventAction =
  | 'created'
  | 'transferred'
  | 'responsible_assigned'
  | 'responsible_changed'
  | 'responsible_removed'
  | 'completed'
  | 'reopened';

type EventUser = { id: number; full_name: string | null } | null;

type NamedRef = { id: number; name: string | null } | null;

/** Получатель задачи на момент события — снимок с именами, прошлые записи не меняются. */
export type TaskRecipientSnapshot =
  | { type: 'personal' }
  | { type: 'user'; id: number; full_name: string | null }
  | { type: 'users'; company: NamedRef; users: { id: number; full_name: string | null }[] }
  | { type: 'department'; id: number; name: string | null; company: NamedRef }
  | { type: 'company'; id: number; name: string | null }
  | { type: 'team'; id: number; name: string | null };

export interface TaskEvent {
  /** 0 — событие создания задачи, записанной до появления журнала. */
  id: number;
  action: TaskEventAction;
  created_at: string;
  actor: { id: number; full_name: string | null } | null;
  details: {
    from?: EventUser | TaskRecipientSnapshot;
    to?: EventUser | TaskRecipientSnapshot;
    reason?: string;
    responsible_id?: number | null;
  } | null;
}

function isRecipient(value: unknown): value is TaskRecipientSnapshot {
  return value != null && typeof value === 'object' && typeof (value as { type?: unknown }).type === 'string';
}

/** «Отдел Финансы», «Иван Иванов», «Иван, Ольга», «Компания Extra». */
export function recipientSnapshotLabel(recipient: TaskRecipientSnapshot | null | undefined): string {
  if (!recipient) return 'получатель';
  switch (recipient.type) {
    case 'personal':
      return 'без исполнителя';
    case 'user':
      return recipient.full_name ?? 'сотрудник';
    case 'users': {
      const names = recipient.users.map((u) => u.full_name ?? 'сотрудник');
      if (names.length <= 3) return names.join(', ');
      return `${names.slice(0, 2).join(', ')} и ещё ${names.length - 2}`;
    }
    case 'department':
      return `Отдел ${recipient.name ?? ''}`.trim();
    case 'company':
      return `Компания ${recipient.name ?? ''}`.trim();
    case 'team':
      return `Команда ${recipient.name ?? ''}`.trim();
    default:
      return 'получатель';
  }
}

function personName(value: EventUser | TaskRecipientSnapshot | undefined, fallback: string): string {
  if (value && !isRecipient(value) && value.full_name) return value.full_name;
  return fallback;
}

/** Короткая строка истории: «Иван передал(а) задачу → Отдел Финансы». */
export function describeTaskEvent(event: TaskEvent): string {
  const actor = event.actor?.full_name ?? 'Система';
  const details = event.details;
  switch (event.action) {
    case 'created': {
      const to = isRecipient(details?.to) ? details.to : null;
      return to && to.type !== 'personal'
        ? `${actor} создал(а) задачу → ${recipientSnapshotLabel(to)}`
        : `${actor} создал(а) задачу`;
    }
    case 'transferred': {
      const to = isRecipient(details?.to) ? details.to : null;
      return `${actor} передал(а) задачу → ${recipientSnapshotLabel(to)}`;
    }
    case 'responsible_assigned': {
      const to = personName(details?.to, 'участника');
      return event.actor && !isRecipient(details?.to) && event.actor.id === details?.to?.id
        ? `${actor} назначен(а) ответственным`
        : `${actor} назначил(а) ответственным: ${to}`;
    }
    case 'responsible_changed':
      return `${actor} сменил(а) ответственного: ${personName(details?.from, 'участника')} → ${personName(details?.to, 'участника')}`;
    case 'responsible_removed': {
      const from = personName(details?.from, 'участника');
      if (details?.reason === 'transfer') return `Ответственный снят при передаче: ${from}`;
      return event.actor ? `${actor} снял(а) ответственного: ${from}` : `Ответственный снят: ${from} больше не участник задачи`;
    }
    case 'completed':
      return `${actor} завершил(а) задачу`;
    case 'reopened':
      return `${actor} вернул(а) задачу в работу`;
    default:
      return actor;
  }
}
