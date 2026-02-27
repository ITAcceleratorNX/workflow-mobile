import { config } from '@/lib/config';
import type { MeetingRoom, Office } from '@/lib/api';

/**
 * Нормализует строку картинки в валидный URI для `expo-image`.
 * - поддерживает `data:*` (base64 Data URI) как есть
 * - поддерживает абсолютные `http(s)://`
 * - относительные пути дополняет базовым хостом (без `/api`)
 */
export function getImageUri(photo?: string | null): string | null {
  if (!photo || typeof photo !== 'string' || !photo.trim()) return null;
  const trimmed = photo.trim();
  if (trimmed.startsWith('data:')) return trimmed;
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  const base = config.apiBaseUrl.replace(/\/api\/?$/, '');
  return base + (trimmed.startsWith('/') ? trimmed : `/${trimmed}`);
}

type WithPhoto =
  | (Pick<Office, 'photo'> & { photos?: unknown[] })
  | (Pick<MeetingRoom, 'photo' | 'photos'> & { image_url?: unknown; photo_url?: unknown });

export function getPrimaryPhotoUri(entity?: WithPhoto | null): string | null {
  if (!entity) return null;

  let raw: unknown =
    (Array.isArray((entity as { photos?: unknown[] }).photos)
      ? (entity as { photos?: unknown[] }).photos?.[0]
      : null) ??
    (entity as { photo?: unknown }).photo ??
    (entity as { image_url?: unknown }).image_url ??
    (entity as { photo_url?: unknown }).photo_url ??
    null;

  if (raw != null && typeof raw === 'object' && 'url' in (raw as object)) raw = (raw as { url: unknown }).url;
  else if (raw != null && typeof raw === 'object' && 'src' in (raw as object)) raw = (raw as { src: unknown }).src;

  if (!raw || typeof raw !== 'string' || !raw.trim()) return null;
  return getImageUri(raw.trim());
}

