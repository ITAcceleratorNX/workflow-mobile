/**
 * Фоновая задача: синк шагов на сервер для пуш-уведомлений.
 * Работает когда приложение в фоне или закрыто (система периодически будит).
 * iOS: BGTaskScheduler, прочие платформы: нативные фоновые механизмы.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import { Pedometer } from 'expo-sensors';
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';

import { config } from '@/lib/config';
import { startOfDay } from '@/lib/steps-utils';

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

function parsePersisted<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: T } | T;
    return (parsed && typeof parsed === 'object' && 'state' in parsed ? parsed.state : parsed) as T;
  } catch {
    return null;
  }
}

async function fetchStepsToday(): Promise<number> {
  if (Platform.OS === 'ios') {
    const start = startOfDay(new Date());
    const end = new Date();
    const result = await Pedometer.getStepCountAsync(start, end);
    return result?.steps ?? 0;
  }
  // Фолбэк: используем getStepCountAsync и на других платформах.
  try {
    const start = startOfDay(new Date());
    const end = new Date();
    const result = await Pedometer.getStepCountAsync(start, end);
    return result?.steps ?? 0;
  } catch {
    return 0;
  }
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
    const stepsToday = await fetchStepsToday();
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

  await BackgroundTask.registerTaskAsync(BACKGROUND_STEPS_TASK, {
    minimumInterval: 15,
  });
}

export async function unregisterBackgroundStepsTask(): Promise<void> {
  await BackgroundTask.unregisterTaskAsync(BACKGROUND_STEPS_TASK);
}
