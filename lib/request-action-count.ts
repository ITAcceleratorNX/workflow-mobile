/**
 * Счётчик вкладки «Заявки»: сколько заявок ждут действия текущего пользователя.
 * Число считает бэкенд (GET /request-groups/action-count) — оно одинаковое в
 * приложении и в вебе и восстанавливается после перезапуска и повторного входа.
 * Это не счётчик непрочитанного: открытие заявки его не меняет.
 */

/** Роли со счётчиком. У руководителя платформы (manager) его нет. */
const REQUEST_ACTION_COUNT_ROLES = ['admin-worker', 'department-head', 'executor', 'client'];

export const REQUEST_ACTION_COUNT_PATH = '/request-groups/action-count';

/** Как часто перечитывать число, пока приложение на экране: заявки двигают и другие участники. */
export const REQUEST_ACTION_COUNT_POLL_MS = 30_000;

export function hasRequestActionCount(
  role: string | null | undefined,
  token: string | null | undefined
): boolean {
  // Демо-сессия на бэкенде не существует: счётчика у неё нет.
  if (!token || token === 'guest-demo') return false;
  return role != null && REQUEST_ACTION_COUNT_ROLES.includes(role);
}

/** Текст бейджа; null — бейдж не показывать совсем (ни «0», ни пустого кружка). */
export function formatRequestActionBadge(count: number | null | undefined): string | null {
  if (typeof count !== 'number' || !Number.isFinite(count) || count <= 0) return null;
  return count > 99 ? '99+' : String(Math.floor(count));
}

const REQUEST_STATE_PATH_PREFIXES = ['/request-groups', '/requests', '/request-executors', '/ratings'];

/**
 * Запрос мог сдвинуть заявку по маршруту (создание, передача, назначение,
 * взятие в работу, завершение, оценка, удаление) — после него число перечитывается.
 */
export function isRequestStateMutation(
  method: string | null | undefined,
  path: string | null | undefined
): boolean {
  if (!method || !path || method.toUpperCase() === 'GET') return false;
  const clean = `/${path.split('?')[0].replace(/^\/+/, '')}`;
  return REQUEST_STATE_PATH_PREFIXES.some(
    (prefix) => clean === prefix || clean.startsWith(`${prefix}/`)
  );
}

type Listener = () => void;
const listeners = new Set<Listener>();

/** Сообщить, что состояние заявок изменилось и число пора перечитать. */
export function notifyRequestStateChanged(): void {
  listeners.forEach((listener) => listener());
}

export function subscribeRequestStateChanged(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
