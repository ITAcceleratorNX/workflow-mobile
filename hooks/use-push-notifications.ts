import { useEffect, useRef, useCallback } from 'react';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import {
  setNotificationHandler,
  setupTaskReminderCategory,
  registerPushTokenWithBackend,
  clearBadge,
} from '@/lib/pushNotifications';
import { completeUserTask, remindUserTask } from '@/lib/user-tasks-api';
import { waitForAuthHydrated } from '@/lib/wait-auth-hydrated';
import { useToast } from '@/context/toast-context';

const REMIND_ACTIONS = ['in_1h', 'tomorrow', 'off'] as const;

function parseTaskId(data: Record<string, unknown>): number | null {
  const raw = data?.task_id;
  if (typeof raw === 'string') {
    const n = parseInt(raw, 10);
    return Number.isFinite(n) ? n : null;
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  return null;
}

function responseDedupKey(response: Notifications.NotificationResponse): string {
  const id = response.notification.request.identifier;
  const action = response.actionIdentifier;
  const taskId = String(parseTaskId(response.notification.request.content.data as Record<string, unknown>) ?? '');
  return `${id}|${action}|${taskId}`;
}

/**
 * Регистрирует push-уведомления и отправляет токен на бэкенд при авторизации.
 * Обрабатывает переход по нажатию на уведомление (data.requestId, data.requestGroupId и т.д.).
 */
export function usePushNotifications(): void {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const router = useRouter();
  const hasRegistered = useRef(false);
  const { show: showToast } = useToast();
  const handledKeys = useRef(new Set<string>());

  const handleTaskReminderResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const taskId = parseTaskId(data);
      const action = response.actionIdentifier;

      if (taskId == null || Number.isNaN(taskId)) return;

      const key = responseDedupKey(response);
      if (handledKeys.current.has(key)) return;
      handledKeys.current.add(key);
      setTimeout(() => handledKeys.current.delete(key), 3000);

      try {
        await waitForAuthHydrated();

        const authToken = useAuthStore.getState().token;
        const guest = useAuthStore.getState().isGuest;
        if (!authToken || guest || authToken === 'guest-demo') {
          showToast({
            title: 'Войдите в аккаунт',
            description: 'Действия с напоминанием доступны после входа.',
            variant: 'destructive',
            duration: 4000,
          });
          return;
        }

        if (action === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          router.push({
            pathname: '/client/tasks/details',
            params: { taskId: String(taskId) },
          });
          return;
        }

        if (action === 'complete') {
          const result = await completeUserTask(taskId);
          if (!result.ok) {
            showToast({
              title: 'Не удалось отметить задачу',
              description: result.error,
              variant: 'destructive',
              duration: 4000,
            });
          } else {
            showToast({ title: 'Задача выполнена', variant: 'success' });
          }
          return;
        }

        if (REMIND_ACTIONS.includes(action as (typeof REMIND_ACTIONS)[number])) {
          const result = await remindUserTask(taskId, action as 'in_1h' | 'tomorrow' | 'off');
          if (!result.ok) {
            showToast({
              title: 'Не удалось обновить напоминание',
              description: result.error,
              variant: 'destructive',
              duration: 4000,
            });
          } else {
            showToast({ title: 'Напоминание обновлено', variant: 'success' });
          }
          return;
        }

        router.push({
          pathname: '/client/tasks/details',
          params: { taskId: String(taskId) },
        });
      } finally {
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          /* noop — модуль может быть недоступен в тестах */
        }
      }
    },
    [router, showToast]
  );

  useEffect(() => {
    setNotificationHandler();
    setupTaskReminderCategory();
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
    let cancelled = false;
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || !last) return;
      const data = last.notification.request.content.data as Record<string, unknown>;
      if (data?.type !== 'task_reminder') return;
      await handleTaskReminderResponse(last);
    })();
    return () => {
      cancelled = true;
    };
  }, [handleTaskReminderResponse]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const type = data?.type as string | undefined;

      if (type === 'task_reminder') {
        void handleTaskReminderResponse(response);
        return;
      }

      const parseId = (v: unknown): number | undefined =>
        typeof v === 'number' && !Number.isNaN(v) ? v : typeof v === 'string' ? parseInt(v, 10) : undefined;
      const requestGroupId = parseId(data?.request_group_id ?? data?.requestGroupId);
      const requestId = parseId(data?.request_id ?? data?.requestId);
      const id = requestGroupId ?? requestId;
      if (id != null && !Number.isNaN(id)) {
        router.push(`/(tabs)/requests/${id}` as const);
      }
      void clearBadge();
    });
    return () => sub.remove();
  }, [router, handleTaskReminderResponse]);
}
