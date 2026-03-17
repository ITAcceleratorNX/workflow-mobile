/**
 * Фоновая синхронизация шагов на сервер.
 * Использует expo-background-task + expo-task-manager для периодического
 * запуска задачи в фоне (даже когда приложение свёрнуто).
 *
 * defineTask должен быть вызван на уровне модуля (не внутри компонента).
 */
import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { config } from '@/lib/config';
import { toDateKey } from '@/lib/steps-utils';
import { useAuthStore } from '@/stores/auth-store';
import { useStepsStore } from '@/stores/steps-store';

const BACKGROUND_STEPS_TASK = 'background-steps-sync';

async function syncStepsInBackground(): Promise<BackgroundTask.BackgroundTaskResult> {
  const token = useAuthStore.getState().token;
  const isGuest = useAuthStore.getState().isGuest;
  if (!token || isGuest) return BackgroundTask.BackgroundTaskResult.Success;

  const todayKey = toDateKey(new Date());
  const { stepsToday, lastStepsDate, settings } = useStepsStore.getState();
  if (lastStepsDate !== todayKey) return BackgroundTask.BackgroundTaskResult.Success;

  try {
    const res = await fetch(`${config.apiBaseUrl}/steps/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        stepsToday,
        goalSteps: settings.goalSteps ?? null,
        noActivityIntervalHours: settings.noActivityIntervalHours ?? 2,
        stepsNotificationsEnabled: settings.stepsNotificationsEnabled !== false,
      }),
    });
    if (!res.ok) return BackgroundTask.BackgroundTaskResult.Failed;
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch {
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
}

// defineTask должен быть на уровне модуля — не внутри компонента/хука
TaskManager.defineTask(BACKGROUND_STEPS_TASK, async () => {
  return syncStepsInBackground();
});

/**
 * Регистрирует фоновую задачу синхронизации шагов.
 * Вызывать при старте приложения (например, в _layout.tsx).
 */
export async function registerBackgroundStepsTask(): Promise<void> {
  const available = await TaskManager.isAvailableAsync();
  if (!available) return;

  const status = await BackgroundTask.getStatusAsync();
  if (status !== BackgroundTask.BackgroundTaskStatus.Available) return;

  await BackgroundTask.registerTaskAsync(BACKGROUND_STEPS_TASK, {
    minimumInterval: 15, // минимум 15 минут между запусками
  });
}
