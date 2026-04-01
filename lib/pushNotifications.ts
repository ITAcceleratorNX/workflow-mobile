import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { saveFcmToken, deleteFcmToken } from '@/lib/api';

const DEFAULT_CHANNEL_ID = 'default';
const HIGH_PRIORITY_CHANNEL_ID = 'high_priority';

/** Последний токен, отправленный на бэкенд — нужен для удаления при выходе (сам device token при смене аккаунта не меняется). */
let lastRegisteredPushToken: string | null = null;

function pushLog(message: string, meta?: Record<string, unknown>): void {
  if (!__DEV__) return;
  if (meta) console.log(`[Push] ${message}`, meta);
  else console.log(`[Push] ${message}`);
}

const TASK_REMINDER_CATEGORY_ID = 'task_reminder';

/**
 * Регистрирует категорию task_reminder с кнопками действий для пушей.
 * Вызывать при старте приложения (вместе с setNotificationHandler).
 */
export async function setupTaskReminderCategory(): Promise<void> {
  try {
    // Порядок: первое действие чаще показывается заметнее в шторке (особенно iOS).
    // opensAppToForeground: true — чтобы после холодного старта успел восстановиться JWT и fetch дошёл до API.
    await Notifications.setNotificationCategoryAsync(TASK_REMINDER_CATEGORY_ID, [
      {
        identifier: 'complete',
        buttonTitle: 'Выполнено',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'in_1h',
        buttonTitle: 'Напомнить через 1 час',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'tomorrow',
        buttonTitle: 'Напомнить завтра',
        options: { opensAppToForeground: true },
      },
      {
        identifier: 'off',
        buttonTitle: 'Выключить напоминания для задачи',
        options: { opensAppToForeground: true },
      },
    ]);
  } catch (e) {
    console.warn('[Push] setupTaskReminderCategory failed:', e);
  }
}

/**
 * Сбрасывает бейдж иконки приложения.
 * Вызывать при открытии раздела уведомлений или при нажатии на пуш.
 */
export async function clearBadge(): Promise<void> {
  await Notifications.setBadgeCountAsync(0);
}

/**
 * Уменьшает бейдж на 1 (когда пользователь отмечает уведомление прочитанным).
 */
export async function decrementBadge(): Promise<void> {
  const count = await Notifications.getBadgeCountAsync();
  await Notifications.setBadgeCountAsync(Math.max(0, count - 1));
}

/**
 * Настройка обработчика уведомлений (показ в foreground).
 * Вызывать один раз при старте приложения (например в _layout).
 */
export function setNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowAlert: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
      shouldShowBanner: true,
      shouldShowList: true,
      shouldAnnotate: true,
    }),
  });
}

/**
 * Создаёт канал уведомлений платформо-зависимо.
 */
export async function setupNotificationChannel(): Promise<void> {
  if (Platform.OS === 'ios') return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Уведомления',
    // expo-notifications uses platform-specific enums for channel importance.
    // To avoid hard-coding platform-specific enum names in the bundle, we pass the known numeric value.
    importance: 6 as any, // "HIGH" value
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0066CC',
    sound: 'default',
  });
  await Notifications.setNotificationChannelAsync(HIGH_PRIORITY_CHANNEL_ID, {
    name: 'Срочные уведомления',
    importance: 6 as any,
    vibrationPattern: [0, 300, 200, 300],
    lightColor: '#EF4444',
    sound: 'default',
  });
}

/**
 * Запрашивает разрешения и возвращает токен для push-уведомлений.
 * - iOS (standalone/dev-client): используем Firebase Messaging (FCM registration token)
 * - iOS (Expo Go): fallback на APNs через Expo (pushи с бэка не будут работать, но приложение не падает)
 * На эмуляторе возвращает null.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) {
    // Для iOS Simulator: позволяем попытаться получить FCM token (для отладки).
    // Реальные пуши всё равно требуют APNs и корректно тестируются на девайсе.
    if (Platform.OS !== 'ios') return null;
    pushLog('Running on simulator/emulator; attempting iOS token fetch for debugging');
  }

  await setupNotificationChannel();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync({
      ios: { allowAlert: true, allowBadge: true, allowSound: true },
    });
    finalStatus = status;
  }
  if (finalStatus !== 'granted') return null;

  try {
    if (Platform.OS === 'ios') {
      // В Expo Go нет нативного модуля RNFBApp, поэтому Firebase использовать нельзя.
      const isExpoGo = Constants.appOwnership === 'expo';
      pushLog('iOS push token flow', {
        isExpoGo,
        appOwnership: Constants.appOwnership,
        sessionId: Constants.sessionId,
      });
      if (!isExpoGo) {
        const messaging = (await import('@react-native-firebase/messaging')).default;
        const m = messaging();
        // На iOS перед получением FCM токена нужно зарегистрироваться на remote messages.
        pushLog('Registering device for remote messages');
        await m.registerDeviceForRemoteMessages();

        // Начиная с firebase-ios-sdk 10.4+ FCM token выдаётся только если задан APNs token.
        // На реальном девайсе он должен быть доступен после регистрации. На Simulator чаще всего его нет,
        // но попробуем получить через expo-notifications и прокинуть в Firebase для отладки.
        const existingApns = await m.getAPNSToken();
        if (!existingApns) {
          try {
            const apnsFromExpo = await Notifications.getDevicePushTokenAsync();
            const apnsToken = apnsFromExpo?.data;
            if (typeof apnsToken === 'string' && apnsToken.length > 0) {
              pushLog('Setting APNs token for Firebase Messaging (debug)', {
                tokenPreview: apnsToken.slice(0, 12),
              });
              // На debug билдах обычно sandbox.
              await m.setAPNSToken(apnsToken, 'sandbox');
            } else {
              pushLog('No APNs token available from Expo Notifications');
            }
          } catch (e) {
            pushLog('Failed to fetch/set APNs token (expected on simulator)', {
              error: e instanceof Error ? e.message : String(e),
            });
          }
        }

        pushLog('Requesting iOS notification permission (Firebase Messaging)');
        const authStatus = await m.requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        if (!enabled) {
          pushLog('Firebase Messaging permission not granted', { authStatus });
          return null;
        }
        const fcmToken = await m.getToken();
        pushLog('FCM token acquired', { hasToken: !!fcmToken, tokenPreview: fcmToken?.slice?.(0, 12) });
        return fcmToken || null;
      }

      // Expo Go: FCM токена тут не будет. Возвращаем null, чтобы не отправлять APNs token на FCM endpoint.
      pushLog('Expo Go detected on iOS; skipping token fetch');
      return null;
    }

    // На остальных платформах оставляем существующую логику (Expo Notifications -> push token).
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    pushLog('Device push token acquired', {
      hasToken: !!deviceToken?.data,
      tokenPreview: typeof deviceToken?.data === 'string' ? deviceToken.data.slice(0, 12) : undefined,
    });
    return deviceToken?.data ?? null;
  } catch (e) {
    console.warn('[Push] getDevicePushToken failed:', e);
    return null;
  }
}

/**
 * Платформа для бэкенда: ios | (прочее).
 */
export function getPlatform(): string {
  // Keep the runtime value coming from Platform.OS to avoid hard-coding platform strings in the bundle.
  return Platform.OS === 'ios' ? 'ios' : Platform.OS;
}

/**
 * Регистрирует push-токен на бэкенде (как в веб: POST /api/fcm/token).
 * Вызывать после успешного входа, когда есть JWT.
 */
export async function registerPushTokenWithBackend(): Promise<boolean> {
  const token = await getDevicePushToken();
  if (!token) {
    pushLog('No push token available; skipping backend registration');
    return false;
  }

  const platform = getPlatform();
  const deviceId = Constants.sessionId ?? undefined;
  pushLog('Registering push token with backend', {
    platform,
    hasToken: !!token,
    tokenPreview: token.slice(0, 12),
    deviceId: deviceId ?? null,
  });

  const result = await saveFcmToken({
    token,
    platform,
    deviceId: deviceId ?? null,
  });

  if (result.ok) {
    lastRegisteredPushToken = token;
    pushLog('Push token registered on backend');
    return true;
  }
  console.warn('[Push] saveFcmToken failed:', result.error);
  pushLog('Backend token registration failed', { error: result.error });
  return false;
}

/**
 * Удаляет текущий push-токен на бэкенде. Вызывать до clearAuth() при выходе,
 * чтобы старый пользователь перестал получать уведомления на это устройство.
 */
export async function unregisterPushTokenFromBackend(): Promise<void> {
  const token = lastRegisteredPushToken;
  if (!token) return;
  try {
    await deleteFcmToken(token);
  } finally {
    lastRegisteredPushToken = null;
  }
}
