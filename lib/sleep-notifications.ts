import * as Notifications from 'expo-notifications';

import type { SleepSettings } from '@/stores/sleep-store';

const BEDTIME_CHANNEL = 'sleep-bedtime';
const WAKE_CHANNEL = 'sleep-wake';
const BEDTIME_ID = 'sleep-bedtime-notification';

/**
 * Утреннее уведомление раньше было одно на все дни («Как спал?»). Старый id
 * гасим при перепланировании, иначе на обновлённых установках оно продолжит
 * приходить рядом с новыми текстами.
 */
const LEGACY_WAKE_ID = 'sleep-wake-notification';

/**
 * Утреннее уведомление Healthy: свой текст на каждый день недели.
 * weekday — нумерация expo-notifications: 1 = воскресенье, 7 = суббота;
 * записи идут от понедельника к воскресенью, как читается календарь.
 */
const WAKE_WEEKDAY_MESSAGES: { weekday: number; body: string }[] = [
  { weekday: 2, body: 'Пусть начало недели будет лёгким' },
  { weekday: 3, body: 'Начните день в комфортном ритме' },
  { weekday: 4, body: 'Пусть день начнётся спокойно и легко' },
  { weekday: 5, body: 'Хорошего старта нового дня' },
  { weekday: 6, body: 'Пусть начало дня задаст хороший ритм' },
  { weekday: 7, body: 'Пусть выходной начнётся неспешно' },
  { weekday: 1, body: 'Хорошего отдыха и спокойного утра' },
];

const wakeNotificationId = (weekday: number) => `sleep-wake-notification-${weekday}`;

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
  const ids = [
    BEDTIME_ID,
    LEGACY_WAKE_ID,
    ...WAKE_WEEKDAY_MESSAGES.map((m) => wakeNotificationId(m.weekday)),
  ];
  for (const id of ids) {
    try {
      await Notifications.cancelScheduledNotificationAsync(id);
    } catch {
      // ignore
    }
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

    // Время то же, что и раньше (wakeHour/wakeMinute) — меняется только текст
    // по дню недели, поэтому вместо одного DAILY семь недельных уведомлений.
    for (const { weekday, body } of WAKE_WEEKDAY_MESSAGES) {
      await Notifications.scheduleNotificationAsync({
        identifier: wakeNotificationId(weekday),
        content: {
          title: 'Оцени сон',
          body,
          sound: 'default',
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.WEEKLY,
          weekday,
          hour: settings.wakeHour,
          minute: settings.wakeMinute,
          channelId: WAKE_CHANNEL,
        },
      });
    }
  } catch (e) {
    console.warn('Sleep notifications schedule error:', e);
  }
}
