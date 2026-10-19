/**
 * Кто может отклонять и удалять сервисные заявки. Backend проверяет то же самое —
 * здесь правила только для того, чтобы не показывать недоступные действия.
 */

type RejectableRequest = {
  status: string;
  taken_by_admin_id?: number | null;
};

/** Удаление — только Руководитель платформы, логическое, с записью в журнале удалений. */
export function canDeleteRequests(role: string | null | undefined): boolean {
  return role === 'manager';
}

/**
 * Отклонение — только Администратор и только новой заявки, которая ждёт первоначального
 * подтверждения: после передачи Офис-менеджеру, назначения Исполнителя или «Взять в работу»
 * отклонить её нельзя.
 */
export function canRejectRequest(
  role: string | null | undefined,
  request: RejectableRequest
): boolean {
  return role === 'admin-worker' && request.status === 'in_progress' && !request.taken_by_admin_id;
}

export function isRejectedRequest(request: { status: string }): boolean {
  return request.status === 'rejected';
}

/** Роли, которым видно, кем и когда отклонена заявка, и её история статусов. */
export function canSeeRejectionDetails(role: string | null | undefined): boolean {
  return role === 'admin-worker' || role === 'manager';
}

/** Сколько заявка ждёт подтверждения Клиента, прежде чем закроется автоматически. */
export const CLIENT_CONFIRMATION_WINDOW_MS = 24 * 60 * 60 * 1000;

type ClosableRequest = {
  status: string;
  client_id?: number | null;
  work_done_at?: string | null;
};

/** Исполнитель выполнил все подзаявки — заявка «На проверке», Администратор подтверждает работы. */
export function canConfirmWork(role: string | null | undefined, request: ClosableRequest): boolean {
  return role === 'admin-worker' && request.status === 'awaiting_admin_review';
}

/**
 * «Подтвердить» / «Есть замечания» — только автор заявки, пока она ждёт его подтверждения.
 * Закрыть заявку вместо Клиента другие роли не могут.
 */
export function canClientRespond(
  userId: number | null | undefined,
  request: ClosableRequest
): boolean {
  return (
    userId != null &&
    request.status === 'awaiting_confirmation' &&
    Number(request.client_id) === Number(userId)
  );
}

/**
 * «Оценить работу» — у любой роли только после закрытия заявки: до этого её ещё проверяет
 * Администратор («На проверке») или принимает Клиент. Оценка необязательна.
 */
export function canRateWork(request: { status: string }): boolean {
  return request.status === 'completed';
}

/** До какого момента Клиент может ответить; null — заявка не ждёт подтверждения. */
export function clientConfirmationDeadline(request: {
  status: string;
  confirmation_requested_at?: string | null;
}): Date | null {
  if (request.status !== 'awaiting_confirmation' || !request.confirmation_requested_at) return null;
  const start = new Date(request.confirmation_requested_at).getTime();
  return Number.isNaN(start) ? null : new Date(start + CLIENT_CONFIRMATION_WINDOW_MS);
}
