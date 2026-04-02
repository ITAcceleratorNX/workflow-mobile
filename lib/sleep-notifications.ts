import * as Notifications from 'expo-notifications';

import type { SleepSettings } from '@/stores/sleep-store';

const BEDTIME_CHANNEL = 'sleep-bedtime';
const WAKE_CHANNEL = 'sleep-wake';
const BEDTIME_ID = 'sleep-bedtime-notification';
const WAKE_ID = 'sleep-wake-notification';

/** Создаёт каналы для Android */
export async function ensureSleepChannels(): Promise<void> {
  try {
    await Notifications.setNotificationChannelAsync(BEDTIME_CHANNEL, {
      name: 'Пора ложиться',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
    await Notifications.setNotificationChannelAsync(WAKE_CHANNEL, {
      name: 'Оцени сон',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default',
    });
  } catch {
    // ignore
  }
}

/** Отменяет все запланированные уведомления сна */
export async function cancelSleepNotifications(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(BEDTIME_ID);
    await Notifications.cancelScheduledNotificationAsync(WAKE_ID);
  } catch {
    // ignore
  }
}

/** Планирует уведомления «Пора ложиться» и «Оцени сон» на завтра по расписанию */
export async function scheduleSleepNotifications(settings: SleepSettings): Promise<void> {
  if (!settings.notificationsEnabled) {
    await cancelSleepNotifications();
    return;
  }

  await ensureSleepChannels();
  await cancelSleepNotifications();

  try {
    await Notifications.scheduleNotificationAsync({
      identifier: BEDTIME_ID,
      content: {
        title: 'Пора ложиться',
        body: 'Время отхода ко сну по расписанию',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.bedtimeHour,
        minute: settings.bedtimeMinute,
        channelId: BEDTIME_CHANNEL,
      },
    });

    await Notifications.scheduleNotificationAsync({
      identifier: WAKE_ID,
      content: {
        title: 'Оцени сон',
        body: 'Как спал?',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: settings.wakeHour,
        minute: settings.wakeMinute,
        channelId: WAKE_CHANNEL,
      },
    });
  } catch (e) {
    console.warn('Sleep notifications schedule error:', e);
  }
}
