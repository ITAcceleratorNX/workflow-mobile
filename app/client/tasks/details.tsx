import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback } from 'react';

import { TaskDetailView } from '@/components/tasks/TaskDetailView';
import { useCurrentTaskDay } from '@/hooks/use-current-task-day';

/** One task (Figma «Задачи · Карточка задачи»): opened from the lists, the calendar and notifications. */
export default function TaskDetailsScreen() {
  const router = useRouter();
  const { taskId } = useLocalSearchParams<{ taskId?: string }>();
  const id = Number(taskId);
  const todayKey = useCurrentTaskDay();
  // A task opened from a notification has no screen behind it: go to the list instead.
  const back = useCallback(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/client/tasks');
  }, [router]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      {Number.isInteger(id) && id > 0 ? <TaskDetailView taskId={id} todayKey={todayKey} onClose={back} onGone={back} /> : null}
    </>
  );
}
