/**
 * API новостей по спецификации бэкенда.
 *
 * Публичные (без авторизации):
 * - GET /news/main — для главного экрана (status=active)
 * - GET /news/all — для «Все новости» (status in active, hidden)
 * - GET /news/:id — одна новость
 *
 * Админские (Bearer token):
 * - POST /news — создание (multipart: title, content, notification_type, image)
 * - GET /news/admin/list?status= — админская история
 * - PATCH /news/admin/:id/hide
 * - PATCH /news/admin/:id/archive
 * - PATCH /news/admin/:id/unhide
 */

import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/auth-store';

const { apiBaseUrl } = config;

/** Модель новости с бэкенда */
export interface ApiNewsItem {
  id: number;
  title: string;
  content: string;
  status: 'active' | 'hidden' | 'archived';
  image_url?: string | null;
  image?: string | null;
  published_at: string;
  created_at?: string;
  created_by?: number;
}

type NewsListResponse = { news: ApiNewsItem[] };
type NewsItemResponse = ApiNewsItem;

/** Нормализованная новость для UI (совместимость с tag, desc, image) */
export interface NewsDisplayItem {
  id: string;
  tag: string;
  title: string;
  desc: string;
  image: string;
  date?: string;
  status?: 'active' | 'hidden' | 'archived';
}

function toDisplayItem(item: ApiNewsItem): NewsDisplayItem {
  const imageUrl = item.image_url ?? item.image ?? '';
  const date = item.published_at?.slice(0, 10) ?? item.created_at?.slice(0, 10) ?? '';
  return {
    id: String(item.id),
    tag: 'Новость',
    title: item.title,
    desc: item.content ?? '',
    image: imageUrl,
    date,
    status: item.status,
  };
}

/** Публичный запрос без обязательной авторизации */
async function publicRequest<T>(path: string): Promise<{ data: T; ok: true } | { error: string; ok: false }> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(useAuthStore.getState().token ? { Authorization: `Bearer ${useAuthStore.getState().token}` } : {}),
  };
  try {
    const res = await fetch(`${apiBaseUrl}${path}`, { headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as { error?: string })?.error ?? (data as { message?: string })?.message ?? 'Ошибка';
      return { ok: false, error: err };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сетевая ошибка' };
  }
}

/** Авторизованный запрос (админ) */
async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T; ok: true } | { error: string; ok: false }> {
  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers as HeadersInit),
  };
  try {
    const res = await fetch(`${apiBaseUrl}${path}`, { ...options, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = (data as { error?: string })?.error ?? (data as { message?: string })?.message ?? 'Ошибка';
      return { ok: false, error: err };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сетевая ошибка' };
  }
}

// ==================== Публичные ====================

/** Список для главного экрана (status=active) */
export async function getNewsMain(): Promise<
  { ok: true; data: NewsDisplayItem[] } | { ok: false; error: string }
> {
  const result = await publicRequest<NewsListResponse>('/news/main');
  if (!result.ok) return result;
  const items = (result.data.news ?? []).map(toDisplayItem);
  return { ok: true, data: items };
}

/** Список для «Все новости» (status in active, hidden) */
export async function getNewsAll(): Promise<
  { ok: true; data: NewsDisplayItem[] } | { ok: false; error: string }
> {
  const result = await publicRequest<NewsListResponse>('/news/all');
  if (!result.ok) return result;
  const items = (result.data.news ?? []).map(toDisplayItem);
  return { ok: true, data: items };
}

/** Одна новость по id */
export async function getNewsById(
  id: number
): Promise<{ ok: true; data: NewsDisplayItem } | { ok: false; error: string }> {
  const result = await publicRequest<NewsItemResponse>(`/news/${id}`);
  if (!result.ok) return result;
  return { ok: true, data: toDisplayItem(result.data) };
}

// ==================== Админские ====================

export type NotificationType = 'none' | 'push_sound' | 'push_silent';

/** Извлечь текст ошибки из ответа бэкенда */
function extractError(data: unknown): string {
  if (!data || typeof data !== 'object') return 'Ошибка создания';
  const d = data as Record<string, unknown>;
  if (typeof d.error === 'string') return d.error;
  if (typeof d.message === 'string') return d.message;
  if (Array.isArray(d.details)) {
    const first = d.details[0] as { message?: string } | undefined;
    if (first && typeof first.message === 'string') return first.message;
  }
  if (Array.isArray(d.errors)) {
    const first = d.errors[0] as string | { msg?: string };
    if (typeof first === 'string') return first;
    if (first && typeof (first as { msg?: string }).msg === 'string') return (first as { msg: string }).msg;
  }
  return 'Ошибка создания';
}

/** Создание новости (multipart/form-data) */
export async function createNews(params: {
  title: string;
  content: string;
  notification_type?: NotificationType;
  image?: { uri: string; name?: string; type?: string } | null;
}): Promise<{ ok: true; data: ApiNewsItem } | { ok: false; error: string }> {
  const formData = new FormData();
  formData.append('title', params.title.trim());
  formData.append('content', params.content.trim());
  formData.append('notification_type', params.notification_type ?? 'none');

  if (params.image?.uri) {
    const img = params.image;
    const fileName = img.name ?? `image_${Date.now()}.jpg`;
    const mimeType = img.type ?? 'image/jpeg';
    formData.append('image', {
      uri: img.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
  // Не ставим Content-Type — fetch сам добавит multipart/form-data с boundary

  try {
    const res = await fetch(`${apiBaseUrl}/news`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = extractError(data);
      console.warn('[news-api] createNews error:', res.status, data);
      return { ok: false, error: err };
    }
    return { ok: true, data: data as ApiNewsItem };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Сетевая ошибка';
    console.warn('[news-api] createNews exception:', e);
    return { ok: false, error: msg };
  }
}

/** Админская история: status = active | hidden | archived или без параметра (все) */
export async function getNewsAdminList(status?: 'active' | 'hidden' | 'archived'): Promise<
  { ok: true; data: NewsDisplayItem[] } | { ok: false; error: string }
> {
  const path = status ? `/news/admin/list?status=${status}` : '/news/admin/list';
  const result = await authRequest<NewsListResponse>(path);
  if (!result.ok) return result;
  const items = (result.data.news ?? []).map(toDisplayItem);
  return { ok: true, data: items };
}

/** Скрыть новость (status = hidden) */
export async function hideNews(id: number): Promise<
  { ok: true; data: ApiNewsItem } | { ok: false; error: string }
> {
  return authRequest<ApiNewsItem>(`/news/admin/${id}/hide`, { method: 'PATCH' });
}

/** Архивировать (status = archived) */
export async function archiveNews(id: number): Promise<
  { ok: true; data: ApiNewsItem } | { ok: false; error: string }
> {
  return authRequest<ApiNewsItem>(`/news/admin/${id}/archive`, { method: 'PATCH' });
}

/** Вернуть в активные */
export async function unhideNews(id: number): Promise<
  { ok: true; data: ApiNewsItem } | { ok: false; error: string }
> {
  return authRequest<ApiNewsItem>(`/news/admin/${id}/unhide`, { method: 'PATCH' });
}

/** Редактирование новости (multipart/form-data) */
export async function updateNews(
  id: number,
  params: {
    title: string;
    content: string;
    notification_type?: NotificationType;
    image?: { uri: string; name?: string; type?: string } | null;
  }
): Promise<{ ok: true; data: ApiNewsItem } | { ok: false; error: string }> {
  const formData = new FormData();
  formData.append('title', params.title.trim());
  formData.append('content', params.content.trim());
  formData.append('notification_type', params.notification_type ?? 'none');

  if (params.image?.uri) {
    const img = params.image;
    const fileName = img.name ?? `image_${Date.now()}.jpg`;
    const mimeType = img.type ?? 'image/jpeg';
    formData.append('image', {
      uri: img.uri,
      name: fileName,
      type: mimeType,
    } as unknown as Blob);
  }

  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${apiBaseUrl}/news/admin/${id}`, {
      method: 'PATCH',
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = extractError(data);
      console.warn('[news-api] updateNews error:', res.status, data);
      return { ok: false, error: err };
    }
    return { ok: true, data: data as ApiNewsItem };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Сетевая ошибка';
    return { ok: false, error: msg };
  }
}

/** Удаление новости */
export async function deleteNews(id: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await authRequest<unknown>(`/news/admin/${id}`, { method: 'DELETE' });
  if (!result.ok) return result;
  return { ok: true };
}
