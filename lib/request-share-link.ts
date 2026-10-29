/**
 * Гостевая ссылка на сервисную заявку (ТЗ «Поделиться сервисной заявкой»).
 * Ссылку `{web}/r/{token}` выдаёт backend: по ней заявку можно посмотреть в браузере без входа
 * и без приложения. App Links приложения путь `/r/` не перехватывают (app.json, AASA в workflow-web).
 */

const GUEST_PATH = /^\/r\/([A-Za-z0-9_-]{32})\/?$/;

export function guestRequestUrl(webAppBaseUrl: string, token: string): string {
  return `${webAppBaseUrl.replace(/\/+$/, '')}/r/${encodeURIComponent(token)}`;
}

/** Токен из гостевой ссылки `https://…/r/{token}`; null для любых других адресов. */
export function parseGuestRequestToken(url: string): string | null {
  if (!url || typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    return parsed.pathname.match(GUEST_PATH)?.[1] ?? null;
  } catch {
    return null;
  }
}
