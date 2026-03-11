import { config } from '@/lib/config';

const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершена',
  in_progress: 'В процессе',
  awaiting_assignment: 'Ожидает назначения',
  execution: 'Выполняется',
  assigned: 'Назначена',
  rejected: 'Отклонена',
  cancelled: 'Отменена',
};

function translateStatus(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export interface ShareRequestParams {
  requestId: number;
  subRequestId?: number;
  title?: string;
  status?: string;
  description?: string;
}

/**
 * Собирает URL заявки для шаринга.
 * Открывается в приложении (если настроены Universal/App Links) или в браузере на app.tmk-workflow.kz.
 */
export function getRequestShareUrl(params: ShareRequestParams): string {
  const base = config.webAppBaseUrl.replace(/\/$/, '');
  const search = new URLSearchParams();
  search.set('requestId', String(params.requestId));
  if (params.subRequestId != null) {
    search.set('subRequestId', String(params.subRequestId));
  }
  return `${base}?${search.toString()}`;
}

/**
 * Текст сообщения для шаринга заявки (как в веб-версии).
 */
export function getRequestShareMessage(params: ShareRequestParams): string {
  const displayId =
    params.subRequestId != null
      ? `${params.requestId}/${params.subRequestId}`
      : String(params.requestId);
  const title = params.title ?? 'Заявка';
  const status = translateStatus(params.status ?? '');
  const desc = (params.description ?? '').slice(0, 200);
  const shortDesc = params.description && params.description.length > 200 ? `${desc}...` : desc;
  const url = getRequestShareUrl(params);
  return (
    `Заявка #${displayId}\n\n` +
    `Название: ${title}\n` +
    `Статус: ${status}\n` +
    (shortDesc ? `Описание: ${shortDesc}\n\n` : '\n') +
    `Ссылка: ${url}`
  );
}

/**
 * URL для открытия WhatsApp с предзаполненным сообщением (как в kcell-service-front).
 */
export function getWhatsAppShareUrl(params: ShareRequestParams): string {
  const message = getRequestShareMessage(params);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/**
 * Извлекает requestId из URL заявки (https://app.tmk-workflow.kz?requestId=...).
 * Возвращает null, если URL не от нашего домена или нет requestId.
 */
export function parseRequestDeepLinkUrl(url: string): { requestId: number } | null {
  try {
    const parsed = new URL(url);
    const appHost = new URL(config.webAppBaseUrl).hostname;
    if (parsed.hostname !== appHost) return null;
    const requestId = parsed.searchParams.get('requestId');
    if (!requestId) return null;
    const id = parseInt(requestId, 10);
    if (!Number.isFinite(id)) return null;
    return { requestId: id };
  } catch {
    return null;
  }
}
