import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

import { useStepsStore } from '@/stores/steps-store';
import { startOfDay, toDateKey } from '@/lib/steps-utils';

const IOS_POLL_INTERVAL_MS = 60 * 1000;

/**
 * Хук шагомера: запрос разрешений, загрузка шагов за сегодня и за неделю (iOS),
 * подписка на обновления (watchStepCount). Обновляет steps-store.
 */
export function usePedometer() {
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const { setStepsToday, setHistory, lastStepsDate, stepsToday } = useStepsStore();

  const stepsAtWatchStartRef = useRef<number>(0);
  const sessionStepsAtFirstCallbackRef = useRef<number | null>(null);
  const sessionStepsAtDateChangeRef = useRef<number>(0);
  const subscriptionRef = useRef<ReturnType<typeof Pedometer.watchStepCount> | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const todayKey = toDateKey(new Date());

  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await Pedometer.requestPermissionsAsync();
      return status === 'granted';
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    const init = async () => {
      try {
        const available = await Pedometer.isAvailableAsync();
        if (cancelled) return;
        setIsAvailable(available);
        useStepsStore.getState().setPedometerStatus(available, false);

        if (!available) {
          setIsLoading(false);
          return;
        }

        // На Android без разрешения ACTIVITY_RECOGNITION шаги не приходят — запрашиваем при старте.
        const { status } = await Pedometer.requestPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setIsAvailable(false);
          useStepsStore.getState().setPedometerStatus(false, false);
          setIsLoading(false);
          return;
        }

        if (Platform.OS === 'ios') {
          const refreshToday = async () => {
            if (cancelled) return;
            try {
              const start = startOfDay(new Date());
              const end = new Date();
              const result = await Pedometer.getStepCountAsync(start, end);
              if (cancelled) return;
              const steps = result?.steps ?? 0;
              stepsAtWatchStartRef.current = steps;
              setStepsToday(steps, toDateKey(new Date()));
            } catch {
              // ignore
            }
          };

          await refreshToday();

          const historyRecords: { date: string; steps: number }[] = [];
          for (let i = 1; i <= 7; i++) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dayStart = startOfDay(d);
            const dayEnd = new Date(dayStart);
            dayEnd.setHours(23, 59, 59, 999);
            try {
              const dayResult = await Pedometer.getStepCountAsync(dayStart, dayEnd);
              historyRecords.push({
                date: toDateKey(d),
                steps: dayResult?.steps ?? 0,
              });
            } catch {
              historyRecords.push({ date: toDateKey(d), steps: 0 });
            }
          }
          if (!cancelled) setHistory(historyRecords.sort((a, b) => b.date.localeCompare(a.date)));

          pollIntervalRef.current = setInterval(refreshToday, IOS_POLL_INTERVAL_MS);
        } else {
          const stored = useStepsStore.getState().stepsToday;
          const lastDate = useStepsStore.getState().lastStepsDate;
          if (lastDate === todayKey) {
            stepsAtWatchStartRef.current = stored;
          } else {
            stepsAtWatchStartRef.current = 0;
            sessionStepsAtDateChangeRef.current = 0;
            setStepsToday(0, todayKey);
          }
          sessionStepsAtFirstCallbackRef.current = null;
        }

        const sub = Pedometer.watchStepCount((result) => {
          if (Platform.OS === 'ios') return;
          const sessionSteps = result?.steps ?? 0;
          const dateKey = toDateKey(new Date());
          const state = useStepsStore.getState();
          const prevDate = state.lastStepsDate;

          {
            if (sessionStepsAtFirstCallbackRef.current === null) {
              sessionStepsAtFirstCallbackRef.current = sessionSteps;
            }
            if (prevDate && prevDate !== dateKey) {
              sessionStepsAtDateChangeRef.current = sessionSteps;
            }
            const delta =
              prevDate !== dateKey
                ? sessionSteps - sessionStepsAtDateChangeRef.current
                : sessionSteps - (sessionStepsAtFirstCallbackRef.current ?? 0);
            const total = prevDate === dateKey ? stepsAtWatchStartRef.current + delta : delta;
            setStepsToday(Math.max(0, total), dateKey);
          }
        });
        subscriptionRef.current = sub;
      } catch (e) {
        if (!cancelled) {
          setIsAvailable(false);
          useStepsStore.getState().setPedometerStatus(false, false);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          const current = useStepsStore.getState().pedometerAvailable;
          useStepsStore.getState().setPedometerStatus(current ?? null, false);
        }
      }
    };

    init();
    return () => {
      cancelled = true;
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
      }
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [todayKey, setStepsToday, setHistory]);

  return {
    isAvailable,
    isLoading,
    requestPermission,
    stepsToday: lastStepsDate === todayKey ? stepsToday : 0,
  };
}
