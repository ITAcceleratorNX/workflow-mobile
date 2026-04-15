import { useEffect, useRef } from 'react';

import { formatDateForApi } from '@/lib/dateTimeUtils';
import { syncHealthyData } from '@/lib/healthy-api';
import { useAuthStore } from '@/stores/auth-store';
import { useMoodStore } from '@/stores/mood-store';
import { useSleepStore } from '@/stores/sleep-store';
import { useStepsStore } from '@/stores/steps-store';
import { useWaterStore } from '@/stores/water-store';

const SYNC_INTERVAL_MS = 5 * 60 * 1000;

export function useHealthySync() {
  const lastSyncRef = useRef<number>(0);
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);

  const sleepSettings = useSleepStore((s) => s.settings);
  const dayRecords = useSleepStore((s) => s.dayRecords);
  const lastNightSleepMinutes = useSleepStore((s) => s.lastNightSleepMinutes);
  const avgSleep7DaysMinutes = useSleepStore((s) => s.avgSleep7DaysMinutes);
  const healthAccessGranted = useSleepStore((s) => s.healthAccessGranted);

  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsLastDate = useStepsStore((s) => s.lastStepsDate);
  const stepHistory = useStepsStore((s) => s.history);
  const stepsSettings = useStepsStore((s) => s.settings);

  const intakeTodayMl = useWaterStore((s) => s.intakeTodayMl);
  const healthWaterTodayMl = useWaterStore((s) => s.healthWaterTodayMl);
  const getTodayGoalMl = useWaterStore((s) => s.getTodayGoalMl);

  const moodRecords = useMoodStore((s) => s.records);

  useEffect(() => {
    if (!token || isGuest) return;

    const sync = async () => {
      const todayKey = formatDateForApi(new Date());
      const todayMood = moodRecords[todayKey] ?? null;
      const todaySleep = dayRecords[todayKey] ?? null;
      const waterGoalMl = getTodayGoalMl({
        heightCm: stepsSettings.heightCm,
        weightKg: stepsSettings.weightKg,
        stepsToday,
        sleepRating: todaySleep?.rating ?? null,
      });

      const metrics = [
        {
          date: todayKey,
          sleep_minutes: lastNightSleepMinutes,
          sleep_rating: todaySleep?.rating ?? null,
          water_ml: intakeTodayMl + (healthWaterTodayMl ?? 0),
          water_goal_ml: waterGoalMl,
          steps_count: stepsToday,
          mood_value: todayMood?.moodValue ?? null,
          energy_level: todayMood?.energy ?? null,
          stress_level: todayMood?.stress ?? null,
          data_sources: {
            apple_health_sleep: healthAccessGranted === true,
            apple_health_water: healthWaterTodayMl != null,
            pedometer: stepsLastDate === todayKey,
            mood_check_in: Boolean(todayMood),
          },
        },
        ...stepHistory.map((item) => {
          const mood = moodRecords[item.date] ?? null;
          const sleep = dayRecords[item.date] ?? null;
          return {
            date: item.date,
            sleep_minutes: item.date === todayKey ? lastNightSleepMinutes : avgSleep7DaysMinutes,
            sleep_rating: sleep?.rating ?? null,
            water_ml: null,
            water_goal_ml: null,
            steps_count: item.steps,
            mood_value: mood?.moodValue ?? null,
            energy_level: mood?.energy ?? null,
            stress_level: mood?.stress ?? null,
            data_sources: {
              pedometer: true,
              mood_check_in: Boolean(mood),
            },
          };
        }),
      ];

      const uniqueMetrics = Array.from(
        new Map(metrics.map((item) => [item.date, item])).values()
      ).sort((a, b) => a.date.localeCompare(b.date));

      const result = await syncHealthyData({
        profile: {
          sleep_goal_minutes: sleepSettings.goalMinutes,
          steps_goal: stepsSettings.goalSteps ?? null,
          weight_kg: stepsSettings.weightKg ?? null,
          height_cm: stepsSettings.heightCm ?? null,
          timezone: 'Asia/Almaty',
          health_data_consent: true,
          apple_health_enabled: healthAccessGranted === true,
          sleep_notifications_enabled: sleepSettings.notificationsEnabled !== false,
          steps_notifications_enabled: stepsSettings.stepsNotificationsEnabled !== false,
          no_activity_interval_hours: stepsSettings.noActivityIntervalHours ?? 2,
        },
        metrics: uniqueMetrics,
      });

      if (result.ok) {
        lastSyncRef.current = Date.now();
      }
    };

    const intervalId = setInterval(sync, SYNC_INTERVAL_MS);
    sync();

    return () => clearInterval(intervalId);
  }, [
    token,
    isGuest,
    sleepSettings,
    dayRecords,
    lastNightSleepMinutes,
    avgSleep7DaysMinutes,
    healthAccessGranted,
    stepsToday,
    stepsLastDate,
    stepHistory,
    stepsSettings,
    intakeTodayMl,
    healthWaterTodayMl,
    getTodayGoalMl,
    moodRecords,
  ]);
}

