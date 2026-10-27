import { useEffect } from 'react';
import { AppState } from 'react-native';

import { syncWorkflowWidgets } from '@/lib/widgets/sync';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

/**
 * Держит системные виджеты вровень с задачником: вход, выход, правка задачи
 * и возврат приложения на экран. До гидрации сессии ничего не публикует,
 * иначе пустой стор на секунду стёр бы задачу прошлого запуска.
 */
export function WorkflowWidgetsHost() {
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const userId = useAuthStore((state) => state.user?.id ?? null);
  const version = useUserTasksInvalidateStore((state) => state.version);

  useEffect(() => {
    let active = true;
    const run = () => {
      if (active && useAuthStore.persist.hasHydrated()) void syncWorkflowWidgets();
    };
    run();
    const unsubscribe = useAuthStore.persist.onFinishHydration(run);
    return () => {
      active = false;
      unsubscribe();
    };
  }, [token, isGuest, userId, version]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && useAuthStore.persist.hasHydrated()) void syncWorkflowWidgets();
    });
    return () => subscription.remove();
  }, []);

  return null;
}
