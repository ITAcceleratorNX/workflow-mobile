import { router } from 'expo-router';
import { Share } from 'react-native';

import {
  formatServiceCategoryDisplayName,
  formatServiceCategoryName,
  getTypeLabel,
} from '@/constants/requests';
import { config } from '@/lib/config';
import {
  createRequestShareLink,
  getSharedRequestId,
  type RequestGroup,
  type SubRequest,
} from '@/lib/api';
import { guestRequestUrl, parseGuestRequestToken } from '@/lib/request-share-link';
import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';

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
  /** Гостевая ссылка `/r/{token}`: заявку видно без входа, но не изменить. */
  shareUrl: string;
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

export function buildShareRequestParams(
  request: RequestGroup,
  subRequest: SubRequest | null | undefined,
  shareUrl: string
): ShareRequestParams {
  const sub = subRequest ?? request.requests?.[0];
  return {
    requestId: request.id,
    subRequestId: subRequest?.id,
    serviceType: formatServiceCategoryDisplayName(sub?.category?.name),
    urgency: getTypeLabel(request.request_type ?? 'normal'),
    officeName: request.office?.name,
    officeAddress: request.office?.address,
    // Только локация в офисе: в `location` лежат координаты устройства.
    location: request.location_detail?.trim(),
    categoryName: formatServiceCategoryName(sub?.category?.name) || sub?.title?.trim(),
    description: sub?.description?.trim(),
    createdDate: formatShareCreatedDate(request.created_date || sub?.created_date),
    shareUrl,
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

  parts.push(`Ссылка: ${params.shareUrl}`);
  parts.push('');
  parts.push('Заявка создана в приложении Workflow.');

  return parts.join('\n');
}

function getShareTitle(params: ShareRequestParams): string {
  const displayNum =
    params.subRequestId != null
      ? `${params.requestId}/${params.subRequestId}`
      : String(params.requestId);
  return `Заявка #${displayNum}`;
}

/**
 * Системное «Поделиться» (WhatsApp, Telegram и другие приложения): номер заявки, её данные
 * и гостевая ссылка. Фото получатель смотрит по ссылке. Адресата выбирает пользователь.
 * Ссылка всегда на всю заявку (группу), даже если делятся из подзаявки.
 */
export async function shareRequestWithContent(
  request: RequestGroup,
  subRequest?: SubRequest | null
): Promise<void> {
  const link = await createRequestShareLink(request.id);
  if (!link.ok) throw new Error(link.error);
  const shareUrl = guestRequestUrl(config.webAppBaseUrl, link.data.token);
  const params = buildShareRequestParams(request, subRequest, shareUrl);

  await Share.share({
    title: getShareTitle(params),
    message: getRequestShareMessage(params),
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

/**
 * Заявка по входящей ссылке: обычная (`?requestId=`, `/requests/:id`, схема приложения) или
 * гостевая `/r/{token}` — её номер приходит с backend. Права в приложении — по роли, как всегда.
 */
export async function resolveRequestDeepLink(url: string): Promise<{ requestId: number } | null> {
  const parsed = parseRequestDeepLinkUrl(url);
  if (parsed) return parsed;
  const token = parseGuestRequestToken(url);
  if (!token) return null;
  const shared = await getSharedRequestId(token);
  return shared.ok ? { requestId: shared.data } : null;
}

/**
 * Ссылка пришла, когда приложение уже открыто. Без входа (или в демо-режиме) сначала экран входа:
 * заявка запоминается и открывается после входа (`consumePostAuthHref` на экране входа), как у виджетов.
 */
export function openRequestFromLink(requestId: number): void {
  const href = `/(tabs)/requests/${requestId}`;
  const hydrated = useAuthStore.persist.hasHydrated();
  const { token, isGuest } = useAuthStore.getState();
  if (!hydrated || !token || isGuest) {
    useDeepLinkStore.getState().setPendingPostAuthHref(href);
    if (hydrated) router.replace('/login');
    return;
  }
  router.replace({ pathname: '/(tabs)/requests/[id]', params: { id: String(requestId) } });
}
