import { useAuthStore } from '@/stores/auth-store';

/**
 * Ждёт восстановления токена из AsyncStorage после холодного старта.
 * Без этого `request()` может уйти без Authorization и PATCH /remind не сработает.
 */
export async function waitForAuthHydrated(maxMs = 12000): Promise<void> {
  const p = useAuthStore.persist;
  if (p.hasHydrated()) return;
  await new Promise<void>((resolve) => {
    const t = setTimeout(() => resolve(), maxMs);
    const unsub = p.onFinishHydration(() => {
      clearTimeout(t);
      unsub();
      resolve();
    });
  });
}
