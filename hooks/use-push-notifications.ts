import { useEffect, useRef, useCallback } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';
import {
  buildDeferredTaskDetailsHref,
  fcmPayloadToRecord,
  hasNonTaskPushNavigationIntent,
  isGuestOrDemoSession,
  nonTaskPushNavigationDedupKey,
  parseTaskIdFromPushPayload,
  pushPayloadType,
  ROUTE_ADMIN_REGISTRATION_REQUESTS,
  shouldSkipDuplicatePushOpen,
  workflowRequestNavigateIdFromPayload,
} from '@/lib/push-notification-open';
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

function responseDedupKey(response: Notifications.NotificationResponse): string {
  const id = response.notification.request.identifier;
  const action = response.actionIdentifier;
  const data = response.notification.request.content.data as Record<string, unknown>;
  const taskId = String(parseTaskIdFromPushPayload(data) ?? '');
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
  const { show: showToast } = useToast();
  const handledKeys = useRef(new Set<string>());

  const navigateFromPushDataNonTask = useCallback(
    async (data: Record<string, unknown>, opts?: { deferUntilSplash: boolean }) => {
      const defer = opts?.deferUntilSplash ?? false;
      const type = pushPayloadType(data);

      if (shouldSkipDuplicatePushOpen(nonTaskPushNavigationDedupKey(data))) return;

      await waitForAuthHydrated();

      if (type === 'new_registration_request') {
        if (isGuestOrDemoSession()) {
          showToast({
            title: 'Войдите в аккаунт',
            description:
              'Раздел запросов на доступ доступен после входа под учётной записью администратора.',
            variant: 'destructive',
            duration: 4000,
          });
          return;
        }
        if (defer) {
          useDeepLinkStore.getState().setPendingPostAuthHref(ROUTE_ADMIN_REGISTRATION_REQUESTS);
        } else {
          router.push(ROUTE_ADMIN_REGISTRATION_REQUESTS);
        }
        await clearBadge();
        return;
      }

      const id = workflowRequestNavigateIdFromPayload(data);
      if (id != null && !Number.isNaN(id)) {
        if (isGuestOrDemoSession()) {
          showToast({
            title: 'Демо-режим',
            description:
              'Переход к заявке из уведомления доступен после входа в аккаунт. Откройте заявку в списке заявок.',
            variant: 'default',
            duration: 4500,
          });
        } else if (defer) {
          useDeepLinkStore.getState().setPendingRequestId(id);
        } else {
          router.push(`/(tabs)/requests/${id}` as const);
        }
      }
      await clearBadge();
    },
    [router, showToast]
  );

  const handleFcmNotificationOpen = useCallback(
    async (raw: Record<string, unknown>, openedFromQuitState = false) => {
      const type = pushPayloadType(raw) ?? '';

      if (type === 'task_reminder' || type === 'user_task_assigned') {
        const taskId = parseTaskIdFromPushPayload(raw);
        if (taskId == null || Number.isNaN(taskId)) return;
        const key = `fcm:task_open:${taskId}`;
        if (shouldSkipDuplicatePushOpen(key)) return;
        await waitForAuthHydrated();

        if (isGuestOrDemoSession()) {
          showToast({
            title: 'Войдите в аккаунт',
            description: 'Действия с задачей доступны после входа.',
            variant: 'destructive',
            duration: 4000,
          });
          return;
        }
        if (openedFromQuitState) {
          useDeepLinkStore.getState().setPendingPostAuthHref(buildDeferredTaskDetailsHref(taskId));
        } else {
          router.push({
            pathname: '/client/tasks/details',
            params: { taskId: String(taskId) },
          });
        }
        await clearBadge();
        return;
      }
      await navigateFromPushDataNonTask(raw, { deferUntilSplash: openedFromQuitState });
    },
    [navigateFromPushDataNonTask, router, showToast]
  );

  const handleTaskReminderResponse = useCallback(
    async (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const taskId = parseTaskIdFromPushPayload(data);
      const action = response.actionIdentifier;

      if (taskId == null || Number.isNaN(taskId)) return;

      const key = responseDedupKey(response);
      if (handledKeys.current.has(key)) return;
      handledKeys.current.add(key);
      setTimeout(() => handledKeys.current.delete(key), 3000);

      try {
        await waitForAuthHydrated();

        if (isGuestOrDemoSession()) {
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
      await registerPushTokenWithBackend();
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

      const openType = pushPayloadType(data);
      if (openType === 'task_reminder' || openType === 'user_task_assigned') {
        await handleFcmNotificationOpen(data as Record<string, unknown>, true);
        try {
          Notifications.clearLastNotificationResponse();
        } catch {
          /* noop */
        }
        return;
      }

      if (hasNonTaskPushNavigationIntent(data)) {
        if (cancelled) return;
        await navigateFromPushDataNonTask(data, { deferUntilSplash: true });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [handleFcmNotificationOpen, navigateFromPushDataNonTask]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as Record<string, unknown>;

      const responseType = pushPayloadType(data);
      if (responseType === 'task_reminder') {
        void handleTaskReminderResponse(response);
        return;
      }
      if (responseType === 'user_task_assigned') {
        void handleFcmNotificationOpen(data, false);
        return;
      }

      if (!hasNonTaskPushNavigationIntent(data)) {
        void clearBadge();
        return;
      }
      void navigateFromPushDataNonTask(data);
    });
    return () => sub.remove();
  }, [handleTaskReminderResponse, navigateFromPushDataNonTask]);

  /**
   * FCM с блоком «notification»: на Android тап часто приходит через RN Firebase, а не через Expo —
   * тогда data пустой в addNotificationResponseReceivedListener и экран не открывается.
   */
  useEffect(() => {
    if (Constants.appOwnership === 'expo') return;

    let unsubscribe: (() => void) | undefined;
    let cancelled = false;

    void (async () => {
      try {
        const messaging = (await import('@react-native-firebase/messaging')).default;

        unsubscribe = messaging().onNotificationOpenedApp((remoteMessage) => {
          const data = fcmPayloadToRecord(remoteMessage?.data);
          void handleFcmNotificationOpen(data, false);
        });

        const initial = await messaging().getInitialNotification();
        if (cancelled || !initial?.data || Object.keys(initial.data).length === 0) {
          return;
        }
        const data = fcmPayloadToRecord(initial.data);
        await waitForAuthHydrated();
        if (!cancelled) {
          await handleFcmNotificationOpen(data, true);
        }
      } catch {
        /* RNFB недоступен (тесты / веб). */
      }
    })();

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [handleFcmNotificationOpen]);
}
