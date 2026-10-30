import { router } from 'expo-router';

import { config } from '@/lib/config';
import { createSession } from '@/lib/session-core';
import { useAuthStore } from '@/stores/auth-store';

/** Сессия входа приложения: токены лежат в auth-store, он же — единственное место, куда пишется refresh-токен. */
const session = createSession({
  apiBaseUrl: config.apiBaseUrl,
  fetch: (url, init) => fetch(url, init),
  store: {
    read: () => {
      const { token, refreshToken, isGuest } = useAuthStore.getState();
      // Демо-вход не настоящий: продлевать нечего.
      return isGuest ? { token: null, refreshToken: null } : { token, refreshToken };
    },
    save: ({ token, refreshToken }) => useAuthStore.getState().setTokens(token, refreshToken),
    end: () => {
      useAuthStore.getState().clearAuth();
      try {
        router.replace('/login');
      } catch {
        // Фоновая задача без открытого экрана: вход попросят при следующем запуске.
      }
    },
  },
});

/**
 * Состояние входа из хранилища. Фоновые задачи запускаются раньше, чем стор его прочтёт:
 * без ожидания они бы решили, что пользователь не вошёл.
 */
export function authHydrated(): Promise<void> {
  if (useAuthStore.persist.hasHydrated()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsubscribe = useAuthStore.persist.onFinishHydration(() => {
      unsubscribe();
      resolve();
    });
  });
}

/** Токен для запроса к API: продлённый, если старый истекает. В демо-режиме — 'guest-demo'. */
export async function getAccessToken(): Promise<string | null> {
  await authHydrated();
  if (useAuthStore.getState().isGuest) return useAuthStore.getState().token;
  return session.accessToken();
}

/**
 * Сервер ответил 401 на запрос с `usedToken`: продлевает сессию. Вернёт токен для повтора запроса
 * или null; `ended` — сессия завершена и пользователь уже на экране входа.
 */
export function renewAfterUnauthorized(usedToken: string) {
  return session.afterUnauthorized(usedToken);
}

/** Ручной выход: завершает сессию на сервере и выходит на устройстве. */
export async function signOut(): Promise<void> {
  const { refreshToken } = useAuthStore.getState();
  useAuthStore.getState().clearAuth();
  await session.signOutOnServer(refreshToken);
}

/**
 * fetch с access-токеном `token`: на 401 продлевает сессию и повторяет запрос один раз.
 * Сеть не дала продлить — бросает ошибку, как при сбое сети; сессия завершена — отдаёт ответ 401.
 */
export async function fetchWithSession(url: string, init: RequestInit, token: string): Promise<Response> {
  const send = (bearer: string) =>
    fetch(url, { ...init, headers: { ...(init.headers as Record<string, string>), Authorization: `Bearer ${bearer}` } });
  const res = await send(token);
  if (res.status !== 401 || token === 'guest-demo') return res;
  const renewed = await renewAfterUnauthorized(token);
  if (renewed.token) return send(renewed.token);
  if (renewed.ended) return res;
  throw new Error('Не удалось продлить сессию');
}
