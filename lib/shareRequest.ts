import { Share } from 'react-native';

import { getTypeLabel, formatServiceCategoryDisplayName } from '@/constants/requests';
import { config } from '@/lib/config';
import type { RequestGroup, SubRequest } from '@/lib/api';

const MAX_SHARE_PHOTOS = 10;

export interface ShareRequestParams {
  requestId: number;
  subRequestId?: number;
  serviceType?: string;
  urgency?: string;
  officeName?: string;
  officeAddress?: string;
  location?: string;
  categoryName?: string;
  description?: string;
  createdDate?: string;
}

function formatShareCreatedDate(iso: string | undefined): string | undefined {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Собирает URL заявки для шаринга (как у бронирования: путь /requests/:id).
 * Открывается в приложении (Universal/App Links) или в браузере на app.tmk-workflow.kz.
 */
export function getRequestShareUrl(params: ShareRequestParams): string {
  const base = config.webAppBaseUrl.replace(/\/$/, '');
  return `${base}/requests/${params.requestId}`;
}

export function buildShareRequestParams(
  request: RequestGroup,
  subRequest?: SubRequest | null
): ShareRequestParams {
  const sub = subRequest ?? request.requests?.[0];
  return {
    requestId: request.id,
    subRequestId: subRequest?.id,
    serviceType: formatServiceCategoryDisplayName(sub?.category?.name),
    urgency: getTypeLabel(request.request_type ?? 'normal'),
    officeName: request.office?.name,
    officeAddress: request.office?.address,
    location: request.location_detail?.trim() || request.location?.trim(),
    categoryName: sub?.category?.name?.trim() || sub?.title?.trim(),
    description: sub?.description?.trim(),
    createdDate: formatShareCreatedDate(request.created_date || sub?.created_date),
  };
}

/**
 * Текст сообщения для шаринга заявки.
 */
export function getRequestShareMessage(params: ShareRequestParams): string {
  const displayNum =
    params.subRequestId != null
      ? `${params.requestId}/${params.subRequestId}`
      : String(params.requestId);

  const parts: string[] = [
    'Сервисная заявка Workflow',
    '',
    `Заявка №${displayNum}`,
  ];

  const addLine = (label: string, value?: string | null) => {
    const v = value?.trim();
    if (v) parts.push(`${label}: ${v}`);
  };

  addLine('Тип', params.serviceType);
  addLine('Срочность', params.urgency);
  addLine('Офис', params.officeName);
  addLine('Адрес', params.officeAddress);
  addLine('Локация', params.location);
  addLine('Категория', params.categoryName);
  addLine('Описание', params.description);
  addLine('Дата создания', params.createdDate);

  parts.push(`Ссылка: ${getRequestShareUrl(params)}`);
  parts.push('');
  parts.push('Заявка создана в приложении Workflow.');

  return parts.join('\n');
}

/**
 * URL для открытия WhatsApp с предзаполненным сообщением (как в kcell-service-front).
 */
export function getWhatsAppShareUrl(params: ShareRequestParams): string {
  const message = getRequestShareMessage(params);
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** URL фото заявки (группа before/after или фото подзаявки). */
export function collectRequestPhotoUrls(
  request: RequestGroup,
  subRequest?: SubRequest | null
): string[] {
  const sub = subRequest ?? request.requests?.[0];
  const before =
    request.photos?.filter((p) => p.type === 'before').map((p) => p.photo_url) ?? [];
  const after =
    request.photos?.filter((p) => p.type === 'after').map((p) => p.photo_url) ?? [];
  if (before.length || after.length) {
    return [...before, ...after].filter(Boolean).slice(0, MAX_SHARE_PHOTOS);
  }
  const source = subRequest ?? sub;
  return (source?.photos?.map((p) => p.photo_url) ?? [])
    .filter(Boolean)
    .slice(0, MAX_SHARE_PHOTOS);
}

function getShareTitle(params: ShareRequestParams): string {
  const displayNum =
    params.subRequestId != null
      ? `${params.requestId}/${params.subRequestId}`
      : String(params.requestId);
  return `Заявка #${displayNum}`;
}

function appendPhotoLinksToMessage(message: string, photoUrls: string[]): string {
  if (!photoUrls.length) return message;
  const lines = photoUrls.map((url, i) => `${i + 1}. ${url}`).join('\n');
  return `${message}\n\nФото:\n${lines}`;
}

/**
 * Системное «Поделиться»: текст заявки; фото — ссылками в тексте (iOS и Android).
 */
export async function shareRequestWithContent(
  request: RequestGroup,
  subRequest?: SubRequest | null
): Promise<void> {
  const params = buildShareRequestParams(request, subRequest);
  const message = getRequestShareMessage(params);
  const title = getShareTitle(params);
  const photoUrls = collectRequestPhotoUrls(request, subRequest);

  await Share.share({
    title,
    message:
      photoUrls.length > 0
        ? appendPhotoLinksToMessage(message, photoUrls)
        : message,
  });
}

/**
 * Извлекает requestId из URL заявки.
 * Поддерживает:
 * - https://workflow-back-zpk4.onrender.com?requestId=123 (Universal/App Links)
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
