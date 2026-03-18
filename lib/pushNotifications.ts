import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';

import { saveFcmToken, deleteFcmToken } from '@/lib/api';

const DEFAULT_CHANNEL_ID = 'default';

/** Последний токен, отправленный на бэкенд — нужен для удаления при выходе (сам device token при смене аккаунта не меняется). */
let lastRegisteredPushToken: string | null = null;

const TASK_REMINDER_CATEGORY_ID = 'task_reminder';

/**
 * Регистрирует категорию task_reminder с кнопками действий для пушей.
 * Вызывать при старте приложения (вместе с setNotificationHandler).
 */
export async function setupTaskReminderCategory(): Promise<void> {
  try {
    await Notifications.setNotificationCategoryAsync(TASK_REMINDER_CATEGORY_ID, [
      {
        identifier: 'in_1h',
        buttonTitle: 'Через 1 час',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'tomorrow',
        buttonTitle: 'Завтра',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'off',
        buttonTitle: 'Выключить',
        options: { opensAppToForeground: false },
      },
    ]);
  } catch (e) {
    console.warn('[Push] setupTaskReminderCategory failed:', e);
  }
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
 * Создаёт канал уведомлений на Android (обязательно до запроса токена на Android 13+).
 */
export async function setupAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  await Notifications.setNotificationChannelAsync(DEFAULT_CHANNEL_ID, {
    name: 'Уведомления',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#0066CC',
    sound: 'default',
  });
}

/**
 * Запрашивает разрешения и возвращает нативный push-токен (FCM на Android, APNs на iOS).
 * На эмуляторе возвращает null.
 */
export async function getDevicePushToken(): Promise<string | null> {
  if (!Device.isDevice) return null;

  await setupAndroidChannel();

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
    const deviceToken = await Notifications.getDevicePushTokenAsync();
    const token = deviceToken?.data ?? null;
    return token;
  } catch (e) {
    console.warn('[Push] getDevicePushTokenAsync failed:', e);
    return null;
  }
}

/**
 * Платформа для бэкенда: android | ios (бэкенд поддерживает FCM для обоих).
 */
export function getPlatform(): 'android' | 'ios' {
  return Platform.OS === 'ios' ? 'ios' : 'android';
}

/**
 * Регистрирует push-токен на бэкенде (как в веб: POST /api/fcm/token).
 * Вызывать после успешного входа, когда есть JWT.
 */
export async function registerPushTokenWithBackend(): Promise<boolean> {
  const token = await getDevicePushToken();
  if (!token) return false;

  const platform = getPlatform();
  const deviceId = Constants.sessionId ?? undefined;

  const result = await saveFcmToken({
    token,
    platform,
    deviceId: deviceId ?? null,
  });

  if (result.ok) {
    lastRegisteredPushToken = token;
    return true;
  }
  console.warn('[Push] saveFcmToken failed:', result.error);
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
