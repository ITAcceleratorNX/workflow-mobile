import { useEffect } from 'react';

import { scheduleSleepNotifications } from '@/lib/sleep-notifications';
import { useSleepStore } from '@/stores/sleep-store';

/**
 * Планирует уведомления сна при изменении настроек.
 */
export function useSleepNotifications() {
  const settings = useSleepStore((s) => s.settings);

  useEffect(() => {
    scheduleSleepNotifications(settings);
  }, [
    settings.goalMinutes,
    settings.bedtimeHour,
    settings.bedtimeMinute,
    settings.wakeHour,
    settings.wakeMinute,
    settings.notificationsEnabled,
  ]);
}
