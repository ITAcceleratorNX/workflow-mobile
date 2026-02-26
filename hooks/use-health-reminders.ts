import { useEffect, useRef } from 'react';

import { useActivityTrackerStore } from '@/stores/activity-tracker-store';
import { useToast } from '@/context/toast-context';

const CHECK_INTERVAL_MS = 60 * 1000; // Проверять каждую минуту

const MESSAGES = [
  'Вы сидите уже %d мин. Пора встать и сделать перерыв!',
  'Долгое сидение вредно для здоровья. Рекомендуем встать и размяться.',
  'Вы работаете сидя %d минут. Сделайте паузу и пройдитесь!',
  'Пора размяться! Вы сидите уже %d минут.',
];

/**
 * Хук health-напоминаний: при включённом трекере и позе "сидя"
 * проверяет время сидения и показывает уведомление каждые N минут.
 */
export function useHealthReminders() {
  const { show } = useToast();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isTracking = useActivityTrackerStore((s) => s.isTracking);
  const lastPosture = useActivityTrackerStore((s) => s.lastPosture);
  const postureStartTime = useActivityTrackerStore((s) => s.postureStartTime);
  const healthReminders = useActivityTrackerStore((s) => s.healthReminders);
  const setHealthReminders = useActivityTrackerStore((s) => s.setHealthReminders);

  useEffect(() => {
    if (!isTracking || !healthReminders.enabled || lastPosture !== 'sitting') {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkSittingTime = () => {
      const state = useActivityTrackerStore.getState();
      const currentLastPosture = state.lastPosture;
      const currentPostureStartTime = state.postureStartTime;
      const currentHealthReminders = state.healthReminders;

      if (currentLastPosture !== 'sitting' || !currentPostureStartTime) return;

      const sittingDuration = Date.now() - currentPostureStartTime;
      const intervalMs = currentHealthReminders.sittingIntervalMinutes * 60 * 1000;

      const timeSinceLastReminder = currentHealthReminders.lastReminderTime
        ? Date.now() - currentHealthReminders.lastReminderTime
        : Infinity;

      if (sittingDuration >= intervalMs && timeSinceLastReminder >= intervalMs / 2) {
        const minutes = Math.floor(sittingDuration / 60000);
        const template = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
        const message = template.replace('%d', String(minutes));

        show({
          title: 'Хелси — Напоминание',
          description: message,
          variant: 'default',
          duration: 5000,
        });

        useActivityTrackerStore.getState().setHealthReminders({
          lastReminderTime: Date.now(),
        });
      }
    };

    intervalRef.current = setInterval(checkSittingTime, CHECK_INTERVAL_MS);
    const firstCheck = setTimeout(checkSittingTime, CHECK_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      clearTimeout(firstCheck);
    };
  }, [
    isTracking,
    healthReminders.enabled,
    healthReminders.sittingIntervalMinutes,
    show,
    setHealthReminders,
  ]);
}
