/**
 * Фоновая задача: синк шагов на сервер для пуш-уведомлений.
 * Работает когда приложение в фоне или закрыто (система периодически будит).
 * iOS: BGTaskScheduler, прочие платформы: нативные фоновые механизмы.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { config } from '@/lib/config';
import { fetchStepsTodayFromPedometer, parsePersisted } from '@/lib/background-sync-utils';

const BACKGROUND_STEPS_TASK = 'background-steps-sync';

interface PersistedAuthState {
  token?: string | null;
}

interface PersistedStepsState {
  stepsToday?: number;
  lastStepsDate?: string | null;
  settings?: {
    goalSteps?: number | null;
    noActivityIntervalHours?: number;
    stepsNotificationsEnabled?: boolean;
  };
}


async function syncStepsToServerBackground(payload: {
  token: string;
  stepsToday: number;
  goalSteps: number | null;
  noActivityIntervalHours: number;
  stepsNotificationsEnabled: boolean;
}): Promise<boolean> {
  const url = `${config.apiBaseUrl}/steps/sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${payload.token}`,
    },
    body: JSON.stringify({
      stepsToday: payload.stepsToday,
      goalSteps: payload.goalSteps,
      noActivityIntervalHours: payload.noActivityIntervalHours,
      stepsNotificationsEnabled: payload.stepsNotificationsEnabled,
    }),
  });
  return res.ok;
}

/**
 * Определение задачи в глобальной области — обязательно для фонового запуска.
 */
TaskManager.defineTask(BACKGROUND_STEPS_TASK, async () => {
  try {
    const authRaw = await AsyncStorage.getItem('auth-storage');
    const auth = parsePersisted<PersistedAuthState>(authRaw);
    const token = auth?.token;
    if (!token || token === 'guest-demo') {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const stepsRaw = await AsyncStorage.getItem('steps-storage');
    const stepsState = parsePersisted<PersistedStepsState>(stepsRaw);
    const stepsToday = await fetchStepsTodayFromPedometer();
    const settings = stepsState?.settings ?? {};
    const goalSteps = settings.goalSteps ?? null;
    const noActivityIntervalHours = settings.noActivityIntervalHours ?? 2;
    const stepsNotificationsEnabled = settings.stepsNotificationsEnabled !== false;

    const ok = await syncStepsToServerBackground({
      token,
      stepsToday,
      goalSteps,
      noActivityIntervalHours,
      stepsNotificationsEnabled,
    });

    return ok ? BackgroundTask.BackgroundTaskResult.Success : BackgroundTask.BackgroundTaskResult.Failed;
  } catch (e) {
    console.error('[BackgroundStepsSync]', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export const BACKGROUND_STEPS_TASK_NAME = BACKGROUND_STEPS_TASK;

export async function registerBackgroundStepsTask(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;

  const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
  if (already) return;

  await BackgroundTask.registerTaskAsync(BACKGROUND_STEPS_TASK, {
    minimumInterval: 15,
  });
}

export async function unregisterBackgroundStepsTask(): Promise<void> {
  const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_STEPS_TASK);
  if (already) {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_STEPS_TASK);
  }
}
