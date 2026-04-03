import { config } from '@/lib/config';
import { getStatusLabel } from '@/constants/requests';

export interface ShareRequestParams {
  requestId: number;
  subRequestId?: number;
  title?: string;
  status?: string;
  description?: string;
}

/**
 * Собирает URL заявки для шаринга (как у бронирования: путь /requests/:id).
 * Открывается в приложении (Universal/App Links) или в браузере на app.tmk-workflow.kz.
 */
export function getRequestShareUrl(params: ShareRequestParams): string {
  const base = config.webAppBaseUrl.replace(/\/$/, '');
  return `${base}/requests/${params.requestId}`;
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
  const status = getStatusLabel(params.status ?? '');
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
 * Извлекает requestId из URL заявки.
 * Поддерживает:
 * - http://localhost:3001?requestId=123 (Universal/App Links)
 * - workflowmobile://...?requestId=123 (custom scheme)
 * - любой URL с query-параметром requestId
 * - путь вида /requests/123 (если есть в pathname)
 */
export function parseRequestDeepLinkUrl(url: string): { requestId: number } | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);

    const fromQuery = parsed.searchParams.get('requestId');
    if (fromQuery) {
      const id = parseInt(fromQuery, 10);
      if (Number.isFinite(id) && id > 0) return { requestId: id };
    }

    const pathMatch = parsed.pathname.match(/\/requests\/(\d+)/);
    if (pathMatch) {
      const id = parseInt(pathMatch[1], 10);
      if (Number.isFinite(id) && id > 0) return { requestId: id };
    }

    return null;
  } catch {
    const fallback = url.match(/[?&]requestId=(\d+)/);
    if (fallback) {
      const id = parseInt(fallback[1], 10);
      if (Number.isFinite(id) && id > 0) return { requestId: id };
    }
    return null;
  }
}
