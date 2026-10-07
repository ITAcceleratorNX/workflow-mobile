import { config } from '@/lib/config';

/** ID приложения в App Store и package в Google Play — для кнопки «Обновить». */
const IOS_APP_STORE_ID = '6759451937';
const ANDROID_PACKAGE = 'com.workflow.kz';

const MIN_VERSION_TIMEOUT_MS = 5000;

function parseVersion(value: string): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return match ? match.slice(1).map(Number) : null;
}

/**
 * Нужно ли обновление: версия приложения старше минимальной.
 * Если какую-то из версий не удалось разобрать — не блокируем.
 */
export function isUpdateRequired(current: string | null | undefined, min: string | null | undefined): boolean {
  if (!current || !min) return false;
  const a = parseVersion(current);
  const b = parseVersion(min);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

/** Ссылка на страницу приложения в сторе платформы. */
export function storeUrl(platform: string): string {
  return platform === 'ios'
    ? `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}`
    : `market://details?id=${ANDROID_PACKAGE}`;
}

/** Та же страница в браузере, если приложение стора не открылось. */
export function storeWebUrl(platform: string): string {
  return platform === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
}

/**
 * Минимальная поддерживаемая версия с бэкенда (GET /app-version, без авторизации).
 * Нет сети, ошибка сервера или старый бэкенд без эндпоинта — null: пользователя не блокируем.
 */
export async function fetchMinAppVersion(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MIN_VERSION_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${config.apiBaseUrl}/app-version`, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as { min_version?: unknown };
    return typeof body.min_version === 'string' ? body.min_version : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
