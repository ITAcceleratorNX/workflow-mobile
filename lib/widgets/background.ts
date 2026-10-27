import * as BackgroundTask from 'expo-background-task';
import * as TaskManager from 'expo-task-manager';

import { syncWorkflowWidgetsFromStorage } from './sync';

const BACKGROUND_WIDGETS_TASK = 'workflow-widgets-sync';

TaskManager.defineTask(BACKGROUND_WIDGETS_TASK, async () => {
  try {
    await syncWorkflowWidgetsFromStorage();
    return BackgroundTask.BackgroundTaskResult.Success;
  } catch (error) {
    console.warn('[widgets] фоновое обновление не удалось', error);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

export async function registerWorkflowWidgetsTask(): Promise<void> {
  try {
    const status = await BackgroundTask.getStatusAsync();
    if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;
    const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_WIDGETS_TASK);
    if (already) return;
    await BackgroundTask.registerTaskAsync(BACKGROUND_WIDGETS_TASK, { minimumInterval: 15 });
  } catch (error) {
    console.warn('[widgets] фоновая задача не зарегистрирована', error);
  }
}
