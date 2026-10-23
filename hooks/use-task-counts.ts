import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { getTaskCounts, type TaskCounts } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

/**
 * Badges of the task tabs for the user's day. Reloaded after every change of a task (the shared
 * invalidation version), when the app comes back to the foreground and on `reload`; the last
 * known numbers stay while a reload runs or fails.
 */
export function useTaskCounts(todayKey: string): { counts: TaskCounts | null; reload: () => void } {
  const [counts, setCounts] = useState<TaskCounts | null>(null);
  const [attempt, setAttempt] = useState(0);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useUserTasksInvalidateStore((s) => s.version);
  const reload = useCallback(() => setAttempt((n) => n + 1), []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') reload();
    });
    return () => subscription.remove();
  }, [reload]);

  useEffect(() => {
    if (!token || isGuest) return;
    let cancelled = false;
    void getTaskCounts(todayKey).then((res) => {
      if (!cancelled && res.ok) setCounts(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [token, isGuest, todayKey, version, attempt]);

  return { counts: token && !isGuest ? counts : null, reload };
}
