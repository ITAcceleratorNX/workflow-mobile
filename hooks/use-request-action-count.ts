import { useEffect } from 'react';
import { AppState } from 'react-native';

import {
  hasRequestActionCount,
  REQUEST_ACTION_COUNT_POLL_MS,
  subscribeRequestStateChanged,
} from '@/lib/request-action-count';
import { useAuthStore } from '@/stores/auth-store';
import { useRequestActionCountStore } from '@/stores/request-action-count-store';

/**
 * Число для бейджа «Заявки». Перечитывается при входе и запуске, после действий
 * с заявками в приложении, при возврате приложения на экран и раз в
 * REQUEST_ACTION_COUNT_POLL_MS — заявки двигают и другие участники.
 */
export function useRequestActionCount(): number {
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const enabled = hasRequestActionCount(role, token);
  const count = useRequestActionCountStore((s) => s.count);
  const ownerToken = useRequestActionCountStore((s) => s.ownerToken);

  useEffect(() => {
    if (!enabled || !token) {
      useRequestActionCountStore.getState().reset();
      return;
    }
    const refresh = () => {
      if (AppState.currentState === 'active') {
        void useRequestActionCountStore.getState().refresh(token);
      }
    };
    refresh();
    const timer = setInterval(refresh, REQUEST_ACTION_COUNT_POLL_MS);
    const unsubscribe = subscribeRequestStateChanged(refresh);
    const appState = AppState.addEventListener('change', (next) => {
      if (next === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      unsubscribe();
      appState.remove();
    };
  }, [enabled, token, role]);

  return enabled && ownerToken === token ? count : 0;
}
