import { useEffect, useRef } from 'react';

import { getOfficeById } from '@/lib/api';
import { toDateKey } from '@/lib/steps-utils';
import { useStepsStore } from '@/stores/steps-store';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/context/toast-context';

const CHECK_INTERVAL_MS = 60 * 1000;
const DEFAULT_START = '08:00:00';
const DEFAULT_END = '18:00:00';
const ALMOST_GOAL_MIN = 0.75;
const ALMOST_GOAL_MAX = 0.9;

function isWithinWorkingHours(startStr: string, endStr: string): boolean {
  const now = new Date();
  const currentMinutes =
    now.getHours() * 60 + now.getMinutes() + Math.floor(now.getSeconds() / 60);
  const [startH, startM, startS] = startStr.split(':').map(Number);
  const [endH, endM, endS] = endStr.split(':').map(Number);
  const startTimeMinutes = startH * 60 + startM + Math.floor((startS ?? 0) / 60);
  const endTimeMinutes = endH * 60 + endM + Math.floor((endS ?? 0) / 60);
  return currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
}

/**
 * Умные уведомления шагомера: 50% цели, почти цель (75–90%), нет активности (2ч).
 * Только в активные часы (рабочее время офиса), ограничение 1–3 «нет активности» в день.
 */
export function useStepsReminders() {
  const { show } = useToast();
  const officeInfoRef = useRef<{ start: string; end: string } | null>(null);
  const lastStepsRef = useRef<number>(0);
  const lastCheckAtRef = useRef<number>(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stepsToday = useStepsStore((s) => s.stepsToday);
  const lastStepsDate = useStepsStore((s) => s.lastStepsDate);
  const settings = useStepsStore((s) => s.settings);
  const notificationFlags = useStepsStore((s) => s.notificationFlags);
  const setLastStepsValueForActivity = useStepsStore((s) => s.setLastStepsValueForActivity);
  const markFiftyPercentSent = useStepsStore((s) => s.markFiftyPercentSent);
  const markAlmostGoalSent = useStepsStore((s) => s.markAlmostGoalSent);
  const markNoActivitySent = useStepsStore((s) => s.markNoActivitySent);
  const canSendNoActivity = useStepsStore((s) => s.canSendNoActivity);

  const officeId = useAuthStore((s) => s.user?.office_id);
  const todayKey = toDateKey(new Date());

  useEffect(() => {
    if (!settings.stepsNotificationsEnabled || lastStepsDate !== todayKey) return;

    const goal = settings.goalSteps ?? 0;
    if (goal <= 0) return;

    const loadOffice = async (): Promise<{ start: string; end: string } | null> => {
      if (officeId == null) {
        officeInfoRef.current = { start: DEFAULT_START, end: DEFAULT_END };
        return officeInfoRef.current;
      }
      try {
        const res = await getOfficeById(officeId);
        if (res.ok) {
          const start = res.data.working_hours_start ?? DEFAULT_START;
          const end = res.data.working_hours_end ?? DEFAULT_END;
          officeInfoRef.current = { start, end };
          return officeInfoRef.current;
        }
      } catch {
        // ignore
      }
      if (!officeInfoRef.current) {
        officeInfoRef.current = { start: DEFAULT_START, end: DEFAULT_END };
      }
      return officeInfoRef.current;
    };

    const check = async () => {
      const office = await loadOffice();
      if (!office || !isWithinWorkingHours(office.start, office.end)) return;

      const state = useStepsStore.getState();
      const steps = state.stepsToday;
      const flags = state.notificationFlags;
      const noActivityHours = state.settings.noActivityIntervalHours;
      const now = Date.now();

      if (state.lastStepsDate !== todayKey) return;

      const goal = state.settings.goalSteps ?? 0;
      if (goal <= 0) return;

      const ratio = steps / goal;

      if (!flags.fiftyPercentSentToday && ratio >= 0.5) {
        state.markFiftyPercentSent();
        show({
          title: 'Шаги — 50% цели',
          description: `Вы прошли половину дневной цели: ${steps.toLocaleString()} из ${goal.toLocaleString()} шагов.`,
          variant: 'default',
          duration: 5000,
        });
      }

      if (!flags.almostGoalSentToday && ratio >= ALMOST_GOAL_MIN && ratio <= ALMOST_GOAL_MAX) {
        state.markAlmostGoalSent();
        show({
          title: 'Шаги — почти цель',
          description: `Осталось немного до цели: ${steps.toLocaleString()} из ${goal.toLocaleString()} шагов.`,
          variant: 'success',
          duration: 5000,
        });
      }

      if (state.canSendNoActivity()) {
        const lastVal = state.lastStepsValueForActivity;
        const lastAt = state.lastStepsValueForActivityAt;
        const intervalMs = noActivityHours * 60 * 60 * 1000;
        if (lastAt > 0 && now - lastAt >= intervalMs && steps <= lastVal) {
          state.markNoActivitySent();
          state.setLastStepsValueForActivity(steps);
          show({
            title: 'Шаги — нет активности',
            description: `За последние ${noActivityHours} ч шаги не изменились. Пора размяться?`,
            variant: 'default',
            duration: 5000,
          });
        }
      }

      lastStepsRef.current = steps;
      lastCheckAtRef.current = now;
      setLastStepsValueForActivity(steps);
    };

    intervalRef.current = setInterval(check, CHECK_INTERVAL_MS);
    check();

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    settings.stepsNotificationsEnabled,
    settings.goalSteps,
    settings.noActivityIntervalHours,
    lastStepsDate,
    todayKey,
    stepsToday,
    notificationFlags.fiftyPercentSentToday,
    notificationFlags.almostGoalSentToday,
    notificationFlags.noActivityCountToday,
    officeId,
    show,
    setLastStepsValueForActivity,
    markFiftyPercentSent,
    markAlmostGoalSent,
    markNoActivitySent,
    canSendNoActivity,
  ]);

  return null;
}
