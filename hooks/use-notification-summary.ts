import * as Notifications from 'expo-notifications';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { useAuthStore } from '@/stores/auth-store';
import { useNotificationCategoriesStore } from '@/stores/notification-categories-store';

/**
 * Сводка уведомлений по категориям для колокольчика и экрана «Уведомления». Перечитывается,
 * когда экран снова виден, при возврате приложения и при новом push в открытом приложении.
 */
export function useNotificationSummary() {
  const token = useAuthStore((s) => s.token);
  const ownerToken = useNotificationCategoriesStore((s) => s.ownerToken);
  const summary = useNotificationCategoriesStore((s) => s.summary);
  const loading = useNotificationCategoriesStore((s) => s.summaryLoading);
  const error = useNotificationCategoriesStore((s) => s.summaryError);

  const refresh = useCallback(() => {
    if (token) void useNotificationCategoriesStore.getState().refreshSummary(token);
  }, [token]);

  useEffect(() => {
    if (!token) {
      useNotificationCategoriesStore.getState().reset();
      return;
    }
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    const received = Notifications.addNotificationReceivedListener(refresh);
    return () => {
      appState.remove();
      received.remove();
    };
  }, [token, refresh]);

  useFocusEffect(refresh);

  const own = ownerToken === token ? summary : null;
  return {
    summary: own,
    categories: own?.categories ?? [],
    unreadCount: own?.unread_count ?? 0,
    loading,
    error,
    refresh,
  };
}
