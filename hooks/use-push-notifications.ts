import { useEffect, useRef, useCallback } from 'react';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { Platform } from 'react-native';

import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';
import {
  bookingPushHref,
  fcmPayloadToRecord,
  hasNonTaskPushNavigationIntent,
  nonTaskPushNavigationDedupKey,
  parseBookingPush,
  parseTaskPush,
  pushPayloadType,
  ROUTE_ADMIN_REGISTRATION_REQUESTS,
  shouldSkipDuplicatePushOpen,
  taskPushHref,
  workflowRequestNavigateIdFromPayload,
  type TaskPushTarget,
} from '@/lib/push-notification-open';
import {
  setNotificationHandler,
  setupTaskReminderCategory,
  registerPushTokenWithBackend,
  clearBadge,
  showForegroundPushesOnAndroid,
  watchPushTokenRefresh,
} from '@/lib/pushNotifications';
import { completeUserTask, remindUserTask } from '@/lib/user-tasks-api';
import { waitForAuthHydrated } from '@/lib/wait-auth-hydrated';
import { useToast } from '@/context/toast-context';

/** Кнопки push напоминания — категория `task_reminder` (см. setupTaskReminderCategory). */
const REMIND_ACTIONS = ['in_1h', 'tomorrow', 'off'] as const;
type ReminderAction = 'complete' | (typeof REMIND_ACTIONS)[number];

const isReminderAction = (action: string): action is ReminderAction =>
  action === 'complete' || (REMIND_ACTIONS as readonly string[]).includes(action);

/** Кто нажал на push: вошедший пользователь, демо-режим или никто — тогда переход ждёт входа. */
type PushSession = 'user' | 'guest' | 'signed_out';

function pushSession(): PushSession {
  const { isGuest, token } = useAuthStore.getState();
  if (isGuest || token === 'guest-demo') return 'guest';
  return token ? 'user' : 'signed_out';
}

function responseDedupKey(response: Notifications.NotificationResponse): string {
  return `${response.notification.request.identifier}|${response.actionIdentifier}`;
}

function clearLastResponse(): void {
  try {
    Notifications.clearLastNotificationResponse();
  } catch {
    /* noop — модуль может быть недоступен в тестах */
  }
}

/**
 * Регистрирует push-уведомления и отправляет токен на бэкенд при авторизации.
 * Обрабатывает переход по нажатию на уведомление: задачник (`parseTaskPush`), брони
 * переговорных для персонала (`parseBookingPush`), заявки
 * (data.requestId, data.requestGroupId) и запросы на регистрацию.
 */
export function usePushNotifications(): void {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const router = useRouter();
  const { show: showToast } = useToast();
  const handledResponses = useRef(new Set<string>());

  const navigateFromPushDataNonTask = useCallback(
    async (data: Record<string, unknown>, opts?: { deferUntilSplash: boolean }) => {
      const defer = opts?.deferUntilSplash ?? false;
      const type = pushPayloadType(data);

      if (shouldSkipDuplicatePushOpen(nonTaskPushNavigationDedupKey(data))) return;

      await waitForAuthHydrated();

      if (type === 'new_registration_request') {
        if (pushSession() !== 'user') {
          showToast({
            title: 'Войдите в аккаунт',
            description:
              'Раздел запросов на доступ доступен после входа под учётной записью администратора.',
            variant: 'error',
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
        if (pushSession() !== 'user') {
          showToast({
            title: 'Демо-режим',
            description:
              'Переход к заявке из уведомления доступен после входа в аккаунт. Откройте заявку в списке заявок.',
            variant: 'info',
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

  /**
   * Переход по push задачника откладывается в `pendingPostAuthHref`, как переходы виджетов: его
   * открывают вкладки, если приложение уже на них, `app/index.tsx` после splash или экран входа.
   */
  const openTaskPush = useCallback(
    async (target: TaskPushTarget) => {
      if (shouldSkipDuplicatePushOpen(`task:${target.taskId}:${target.commentId ?? ''}:${target.event ?? ''}`)) return;
      await waitForAuthHydrated();

      const session = pushSession();
      if (session === 'guest') {
        showToast({
          title: 'Войдите в аккаунт',
          description: 'Действия с задачей доступны после входа.',
          variant: 'error',
          duration: 4000,
        });
        return;
      }
      useDeepLinkStore.getState().setPendingPostAuthHref(taskPushHref(target));
      if (target.event === 'deleted') {
        showToast({ title: 'Задача удалена', variant: 'info', duration: 4000 });
      } else if (session === 'signed_out') {
        showToast({ title: 'Войдите в аккаунт', description: 'Задача откроется после входа.', variant: 'info', duration: 4000 });
      }
      await clearBadge();
    },
    [showToast]
  );

  /**
   * Push персонала о брони — так же через `pendingPostAuthHref`: без входа карточка откроется после
   * него. Права по роли и офису проверяет сервер, когда карточка загружается.
   */
  const openBookingPush = useCallback(
    async (bookingId: number) => {
      if (shouldSkipDuplicatePushOpen(`booking:${bookingId}`)) return;
      await waitForAuthHydrated();

      const session = pushSession();
      if (session === 'guest') {
        showToast({
          title: 'Войдите в аккаунт',
          description: 'Бронирование из уведомления доступно после входа.',
          variant: 'error',
          duration: 4000,
        });
        return;
      }
      useDeepLinkStore.getState().setPendingPostAuthHref(bookingPushHref(bookingId));
      if (session === 'signed_out') {
        showToast({ title: 'Войдите в аккаунт', description: 'Бронирование откроется после входа.', variant: 'info', duration: 4000 });
      }
      await clearBadge();
    },
    [showToast]
  );

  const runReminderAction = useCallback(
    async (taskId: number, action: ReminderAction) => {
      await waitForAuthHydrated();

      if (pushSession() !== 'user') {
        showToast({
          title: 'Войдите в аккаунт',
          description: 'Действия с напоминанием доступны после входа.',
          variant: 'error',
          duration: 4000,
        });
        return;
      }

      if (action === 'complete') {
        const result = await completeUserTask(taskId);
        if (!result.ok) {
          showToast({
            title: 'Не удалось отметить задачу',
            description: result.error,
            variant: 'error',
            duration: 4000,
          });
        } else {
          showToast({ title: 'Задача выполнена', variant: 'success' });
        }
        return;
      }

      const result = await remindUserTask(taskId, action);
      if (!result.ok) {
        showToast({
          title: 'Не удалось обновить напоминание',
          description: result.error,
          variant: 'error',
          duration: 4000,
        });
      } else {
        showToast({ title: 'Напоминание обновлено', variant: 'success' });
      }
    },
    [showToast]
  );

  /** Нажатие на уведомление Expo: push на iOS или локальное уведомление открытого приложения на Android. */
  const handleNotificationResponse = useCallback(
    async (response: Notifications.NotificationResponse, coldStart: boolean) => {
      const data = response.notification.request.content.data as Record<string, unknown>;
      const target = parseTaskPush(data);

      if (!target) {
        const bookingId = parseBookingPush(data);
        if (bookingId !== null) {
          await openBookingPush(bookingId);
          clearLastResponse();
        } else if (hasNonTaskPushNavigationIntent(data)) {
          await navigateFromPushDataNonTask(data, { deferUntilSplash: coldStart });
        } else if (!coldStart) {
          await clearBadge();
        }
        return;
      }

      // Нажатие, запустившее приложение, приходит и слушателю, и в getLastNotificationResponseAsync.
      const key = responseDedupKey(response);
      if (handledResponses.current.has(key)) return;
      handledResponses.current.add(key);
      setTimeout(() => handledResponses.current.delete(key), 3000);

      try {
        const action = response.actionIdentifier;
        if (isReminderAction(action)) {
          await runReminderAction(target.taskId, action);
        } else {
          await openTaskPush(target);
        }
      } finally {
        clearLastResponse();
      }
    },
    [navigateFromPushDataNonTask, openBookingPush, openTaskPush, runReminderAction]
  );

  /** Нажатие на push, которое отдал RN Firebase: кнопок здесь нет, только открытие. */
  const handleFcmNotificationOpen = useCallback(
    async (data: Record<string, unknown>, openedFromQuitState: boolean) => {
      const target = parseTaskPush(data);
      if (target) {
        await openTaskPush(target);
        return;
      }
      const bookingId = parseBookingPush(data);
      if (bookingId !== null) {
        await openBookingPush(bookingId);
        return;
      }
      await navigateFromPushDataNonTask(data, { deferUntilSplash: openedFromQuitState });
    },
    [navigateFromPushDataNonTask, openBookingPush, openTaskPush]
  );

  useEffect(() => {
    setNotificationHandler();
    setupTaskReminderCategory();
  }, []);

  useEffect(() => {
    if (!token || isGuest || token === 'guest-demo') return;

    let cancelled = false;
    let stopWatching: (() => void) | undefined;
    (async () => {
      if (cancelled || !(await registerPushTokenWithBackend())) return;
      const stop = await watchPushTokenRefresh();
      if (cancelled) stop();
      else stopWatching = stop;
    })();
    return () => {
      cancelled = true;
      stopWatching?.();
    };
  }, [token, isGuest]);

  useEffect(() => {
    // На вебе метода нет — expo-notifications бросает ошибку при открытии приложения.
    if (Platform.OS === 'web') return;
    let cancelled = false;
    (async () => {
      const last = await Notifications.getLastNotificationResponseAsync();
      if (cancelled || !last) return;
      await handleNotificationResponse(last, true);
    })();
    return () => {
      cancelled = true;
    };
  }, [handleNotificationResponse]);

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      void handleNotificationResponse(response, false);
    });
    return () => sub.remove();
  }, [handleNotificationResponse]);

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

  useEffect(() => {
    let cancelled = false;
    let stop: (() => void) | undefined;
    void showForegroundPushesOnAndroid().then((unsubscribe) => {
      if (cancelled) unsubscribe();
      else stop = unsubscribe;
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, []);
}
