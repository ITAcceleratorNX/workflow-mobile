/**
 * API новостей по спецификации бэкенда.
 *
 * Публичные (без авторизации):
 * - GET /news/main — для главного экрана (status=active)
 * - GET /news/all — для «Все новости» (status in active, hidden)
 * - GET /news/:id — одна новость
 *
 * Админские (Bearer token):
 * - POST /news — создание (multipart: title, content, notification_type, publish_mode, published_at?, image)
 * - GET /news/admin/list?status= — админская история
 * - PATCH /news/admin/:id/hide
 * - PATCH /news/admin/:id/archive
 * - PATCH /news/admin/:id/unhide
 */

import { config } from '@/lib/config';
import type { NewsReactionKind } from '@/lib/news-reactions';
import { normalizeReactionCounts } from '@/lib/news-reactions';
import { useAuthStore } from '@/stores/auth-store';

const { apiBaseUrl } = config;

/** Модель новости с бэкенда */
export interface ApiNewsItem {
  id: number;
  title: string;
  content: string;
  status: 'active' | 'hidden' | 'archived' | 'scheduled';
  image_url?: string | null;
  image?: string | null;
  published_at: string;
  created_at?: string;
  created_by?: number;
  view_count?: number;
  reaction_counts?: Partial<Record<NewsReactionKind, number>> | null;
  my_reaction?: NewsReactionKind | null;
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
  /** ISO 8601 с сервера (для сортировки и отображения времени публикации) */
  publishedAtIso?: string;
  status?: 'active' | 'hidden' | 'archived' | 'scheduled';
  /** Статистика (из API) */
  view_count?: number;
  reaction_counts?: import('@/lib/news-reactions').NewsReactionCounts;
  my_reaction?: NewsReactionKind | null;
}

function toDisplayItem(item: ApiNewsItem): NewsDisplayItem {
  const imageUrl = item.image_url ?? item.image ?? '';
  const publishedRaw = item.published_at ?? '';
  const date = publishedRaw ? publishedRaw.slice(0, 10) : item.created_at?.slice(0, 10) ?? '';
  return {
    id: String(item.id),
    tag: 'Новость',
    title: item.title,
    desc: item.content ?? '',
    image: imageUrl,
    date,
    publishedAtIso: publishedRaw || undefined,
    status: item.status,
    view_count: item.view_count ?? 0,
    reaction_counts: normalizeReactionCounts(item.reaction_counts),
    my_reaction: item.my_reaction ?? null,
  };
}

/** Публичный запрос без обязательной авторизации (не шлём guest-demo — иначе бэкенд может ответить 401). */
async function publicRequest<T>(path: string): Promise<{ data: T; ok: true } | { error: string; ok: false }> {
  const rawToken = useAuthStore.getState().token;
  const useBearer =
    typeof rawToken === 'string' && rawToken.length > 0 && rawToken !== 'guest-demo';
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(useBearer ? { Authorization: `Bearer ${rawToken}` } : {}),
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
  const rawToken = useAuthStore.getState().token;
  const token = rawToken && rawToken !== 'guest-demo' ? rawToken : null;
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

/** Засчитать просмотр (авторизованный клиент; уникально на пользователя) */
export async function recordNewsView(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const raw = useAuthStore.getState().token;
  const token = raw && raw !== 'guest-demo' ? raw : null;
  if (!token) return { ok: false, error: 'Нет авторизации' };
  try {
    const res = await fetch(`${apiBaseUrl}/news/${id}/view`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err = (data as { error?: string })?.error ?? (data as { message?: string })?.message ?? 'Ошибка';
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Сетевая ошибка' };
  }
}

/** Поставить или сменить реакцию (одна на пользователя) */
export async function setNewsReaction(
  id: number,
  reaction: NewsReactionKind
): Promise<{ ok: true; data: ApiNewsItem } | { ok: false; error: string }> {
  const result = await authRequest<ApiNewsItem>(`/news/${id}/reaction`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reaction }),
  });
  return result;
}

export type { NewsReactionKind };

// ==================== Админские ====================

export type NotificationType = 'none' | 'push_sound' | 'push_silent';

export type NewsPublishMode = 'now' | 'schedule';

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
  publish_mode?: NewsPublishMode;
  published_at?: string;
  image?: { uri: string; name?: string; type?: string } | null;
}): Promise<{ ok: true; data: ApiNewsItem } | { ok: false; error: string }> {
  const formData = new FormData();
  formData.append('title', params.title.trim());
  formData.append('content', params.content.trim());
  formData.append('notification_type', params.notification_type ?? 'none');
  const mode = params.publish_mode ?? 'now';
  formData.append('publish_mode', mode);
  if (mode === 'schedule' && params.published_at) {
    formData.append('published_at', params.published_at);
  }

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

  const raw = useAuthStore.getState().token;
  const token = raw && raw !== 'guest-demo' ? raw : null;
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
export async function getNewsAdminList(status?: 'active' | 'hidden' | 'archived' | 'scheduled'): Promise<
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
    publish_mode?: NewsPublishMode;
    published_at?: string;
    image?: { uri: string; name?: string; type?: string } | null;
  }
): Promise<{ ok: true; data: ApiNewsItem } | { ok: false; error: string }> {
  const formData = new FormData();
  formData.append('title', params.title.trim());
  formData.append('content', params.content.trim());
  formData.append('notification_type', params.notification_type ?? 'none');
  if (params.publish_mode) {
    formData.append('publish_mode', params.publish_mode);
    if (params.publish_mode === 'schedule' && params.published_at) {
      formData.append('published_at', params.published_at);
    }
  }

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

  const raw = useAuthStore.getState().token;
  const token = raw && raw !== 'guest-demo' ? raw : null;
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
