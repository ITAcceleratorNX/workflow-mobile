/**
 * Сессия входа: короткий access-токен и refresh-токен, которым клиент сам получает новый
 * access-токен (POST /auth/refresh). Здесь только логика — хранилище и сеть передаются снаружи,
 * чтобы её можно было проверить без React Native (lib/session.ts связывает её с приложением).
 */

export interface SessionTokens {
  token: string;
  refreshToken: string;
}

export interface SessionStore {
  /** refreshToken === null — вход до появления сессий (старый токен без продления). */
  read(): { token: string | null; refreshToken: string | null };
  save(tokens: SessionTokens): void;
  /** Сервер завершил сессию: выйти из аккаунта. */
  end(): void;
}

export type FetchLike = (url: string, init: RequestInit) => Promise<Response>;

/**
 * 'renewed' — новые токены сохранены; 'ended' — сервер завершил сессию, пользователь вышел;
 * 'unavailable' — сеть или сервер недоступны: сессия остаётся, попробуем при следующем запросе.
 */
export type RenewOutcome = { kind: 'renewed'; token: string } | { kind: 'ended' } | { kind: 'unavailable' };

/** Токен продлевается заранее, если до конца его жизни меньше этого. */
export const RENEW_BEFORE_MS = 60_000;

function claimsOf(token: string): { exp?: unknown; sid?: unknown } | null {
  const payload = token.split('.')[1];
  if (!payload) return null;
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=')));
  } catch {
    return null;
  }
}

/** Конец жизни JWT (мс от эпохи) или null, если токен не JWT. */
export function tokenExpiresAt(token: string): number | null {
  const exp = claimsOf(token)?.exp;
  return typeof exp === 'number' ? exp * 1000 : null;
}

/** Токен открытой сессии (в нём есть sid). Старый токен без сессии переводится через /auth/session. */
export function isSessionToken(token: string): boolean {
  return claimsOf(token)?.sid != null;
}

type Exchange = { kind: 'renewed'; tokens: SessionTokens } | { kind: 'ended' } | { kind: 'unavailable' };

export function createSession({
  apiBaseUrl,
  store,
  fetch,
  now = Date.now,
}: {
  apiBaseUrl: string;
  store: SessionStore;
  fetch: FetchLike;
  now?: () => number;
}) {
  let inFlight: Promise<RenewOutcome> | null = null;

  async function exchange(path: string, body: unknown, bearer?: string): Promise<Exchange> {
    let res: Response;
    try {
      res = await fetch(`${apiBaseUrl}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(bearer ? { Authorization: `Bearer ${bearer}` } : {}) },
        body: JSON.stringify(body),
      });
    } catch {
      return { kind: 'unavailable' };
    }
    if (res.status === 401) return { kind: 'ended' };
    if (!res.ok) return { kind: 'unavailable' };
    const data = (await res.json().catch(() => ({}))) as { token?: unknown; refresh_token?: unknown };
    if (typeof data.token !== 'string' || typeof data.refresh_token !== 'string') return { kind: 'unavailable' };
    return { kind: 'renewed', tokens: { token: data.token, refreshToken: data.refresh_token } };
  }

  /**
   * Продлевает сессию. Параллельные вызовы ждут один запрос: refresh-токен одноразовый,
   * и лишний запрос тем же токеном сервер может принять за кражу.
   */
  function renew(): Promise<RenewOutcome> {
    if (inFlight) return inFlight;
    const { token, refreshToken } = store.read();
    if (!token) return Promise.resolve({ kind: 'ended' });
    inFlight = (async (): Promise<RenewOutcome> => {
      const result = refreshToken
        ? await exchange('/auth/refresh', { refresh_token: refreshToken })
        : await exchange('/auth/session', {}, token);
      // Пока шёл запрос, пользователь мог выйти или войти заново: чужой ответ не применяем.
      const stillOurs = store.read().token === token;
      if (result.kind === 'renewed') {
        if (!stillOurs) return { kind: 'ended' };
        store.save(result.tokens);
        return { kind: 'renewed', token: result.tokens.token };
      }
      if (result.kind === 'ended' && stillOurs) store.end();
      return result;
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  }

  /** Access-токен для запроса: продлевает заранее, если он вот-вот истечёт. Сеть недоступна — отдаёт текущий. */
  async function accessToken(): Promise<string | null> {
    const { token, refreshToken } = store.read();
    if (!token) return null;
    const expiresAt = tokenExpiresAt(token);
    const expiring = expiresAt !== null && expiresAt - now() < RENEW_BEFORE_MS;
    // Без refresh-токена — вход до появления сессий: переводим на сессию сразу, пока старый токен ещё годен.
    if (!expiring && refreshToken) return token;
    const outcome = await renew();
    if (outcome.kind === 'renewed') return outcome.token;
    return outcome.kind === 'ended' ? null : token;
  }

  /**
   * Сервер ответил 401 на запрос с `usedToken`. Возвращает токен для повтора (null — повторять нечем)
   * и `ended` — завершена ли сессия: тогда пользователь уже вышел.
   */
  async function afterUnauthorized(usedToken: string): Promise<{ token: string | null; ended: boolean }> {
    const current = store.read().token;
    if (!current) return { token: null, ended: true };
    // Другой запрос уже продлил сессию, пока этот летел со старым токеном.
    if (current !== usedToken) return { token: current, ended: false };
    const outcome = await renew();
    if (outcome.kind === 'renewed') return { token: outcome.token, ended: false };
    return { token: null, ended: outcome.kind === 'ended' };
  }

  /** Выход: сервер завершает сессию. Ошибка сети выходу на устройстве не мешает. */
  async function signOutOnServer(refreshToken: string | null): Promise<void> {
    if (!refreshToken) return;
    try {
      await fetch(`${apiBaseUrl}/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
    } catch {
      // Сессия на сервере истечёт сама.
    }
  }

  return { renew, accessToken, afterUnauthorized, signOutOnServer };
}
