import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import { setNotificationHandler, registerPushTokenWithBackend } from '@/lib/pushNotifications';

/**
 * Регистрирует push-уведомления и отправляет токен на бэкенд при авторизации.
 * Обрабатывает переход по нажатию на уведомление (data.requestId, data.requestGroupId и т.д.).
 */
export function usePushNotifications(): void {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const router = useRouter();
  const hasRegistered = useRef(false);

  useEffect(() => {
    setNotificationHandler();
  }, []);

  useEffect(() => {
    if (!token || isGuest || token === 'guest-demo') return;

    let cancelled = false;
    (async () => {
      if (cancelled) return;
      const ok = await registerPushTokenWithBackend();
      if (ok && !cancelled) hasRegistered.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, [token, isGuest]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const parseId = (v: unknown): number | undefined =>
        typeof v === 'number' && !Number.isNaN(v) ? v : typeof v === 'string' ? parseInt(v, 10) : undefined;
      const requestGroupId = parseId(data?.request_group_id ?? data?.requestGroupId);
      const requestId = parseId(data?.request_id ?? data?.requestId);
      const id = requestGroupId ?? requestId;
      if (id != null && !Number.isNaN(id)) {
        router.push(`/(tabs)/requests/${id}` as const);
      }
    });
    return () => sub.remove();
  }, [router]);
}
