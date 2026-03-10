import { useEffect, useRef } from 'react';

import { syncStepsToServer } from '@/lib/api';
import { toDateKey } from '@/lib/steps-utils';
import { useStepsStore } from '@/stores/steps-store';
import { useAuthStore } from '@/stores/auth-store';

const SYNC_INTERVAL_MS = 5 * 60 * 1000; // 5 минут

/**
 * Периодически отправляет шаги и настройки на сервер для пуш-уведомлений в фоне.
 */
export function useStepsSync() {
  const lastSyncRef = useRef<number>(0);
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const lastStepsDate = useStepsStore((s) => s.lastStepsDate);
  const settings = useStepsStore((s) => s.settings);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!token || lastStepsDate !== todayKey || isGuest) return;

    const sync = async () => {
      const result = await syncStepsToServer({
        stepsToday,
        goalSteps: settings.goalSteps ?? null,
        noActivityIntervalHours: settings.noActivityIntervalHours ?? 2,
        stepsNotificationsEnabled: settings.stepsNotificationsEnabled !== false,
      });
      if (result.ok) lastSyncRef.current = Date.now();
    };

    const intervalId = setInterval(() => {
      sync();
    }, SYNC_INTERVAL_MS);
    sync();

    return () => clearInterval(intervalId);
  }, [token, stepsToday, lastStepsDate, todayKey, settings.goalSteps, settings.noActivityIntervalHours, settings.stepsNotificationsEnabled]);
}
