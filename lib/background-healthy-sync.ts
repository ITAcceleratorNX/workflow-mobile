/**
 * Фоновая задача: синк Healthy-метрик на сервер.
 * Работает когда приложение в фоне или закрыто (система периодически будит).
 * iOS: BGTaskScheduler, Android: WorkManager — через expo-background-task.
 *
 * Читает данные напрямую из AsyncStorage (без React и сторов).
 * Отправляет сегодняшний день + историю шагов на /healthy/sync.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as BackgroundTask from 'expo-background-task';
import { Platform } from 'react-native';
import * as TaskManager from 'expo-task-manager';

import { config } from '@/lib/config';
import { fetchStepsTodayFromPedometer, parsePersisted } from '@/lib/background-sync-utils';

export const BACKGROUND_HEALTHY_TASK = 'background-healthy-sync';

const HEALTHY_API_VERSION = 'healthy.v1';

// ===== AsyncStorage ключи =====

const AUTH_KEY = 'auth-storage';
const SLEEP_KEY = 'sleep-storage';
const STEPS_KEY = 'steps-storage';
const WATER_KEY = 'water-storage';
const MOOD_KEY = 'mood-storage';

// ===== Типы persist-состояний =====

interface PersistedAuth {
  token?: string | null;
}

interface PersistedSleep {
  settings?: {
    goalMinutes?: number;
    notificationsEnabled?: boolean;
  };
  dayRecords?: Record<string, { date: string; rating: 'poor' | 'ok' | 'good' }>;
  lastNightSleepMinutes?: number | null;
  avgSleep7DaysMinutes?: number | null;
}

interface PersistedSteps {
  settings?: {
    goalSteps?: number | null;
    heightCm?: number | null;
    weightKg?: number | null;
    stepsNotificationsEnabled?: boolean;
    noActivityIntervalHours?: number;
  };
  history?: { date: string; steps: number }[];
  stepsToday?: number;
  lastStepsDate?: string | null;
}

interface PersistedWater {
  intakeTodayMl?: number;
  lastDate?: string | null;
  manualGoalMl?: number | null;
}

interface PersistedMood {
  records?: Record<
    string,
    {
      moodValue: number;
      energy: 'low' | 'medium' | 'high';
      stress: 'low' | 'medium' | 'high';
    }
  >;
}

// ===== Дата YYYY-MM-DD без сдвига UTC =====

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// ===== Расчёт нормы воды (портировано из water-utils) =====

function calculateWaterGoalSimple(args: {
  heightCm: number | null;
  weightKg: number | null;
  stepsToday: number;
  sleepRating: 'poor' | 'ok' | 'good' | null;
}): number {
  let base = 2000;
  if (args.weightKg != null && args.weightKg > 0) {
    base = Math.round(args.weightKg * 30);
    if (args.heightCm != null && args.heightCm > 150) {
      base += Math.round((args.heightCm - 150) * 12);
    }
  }
  let actBonus = 0;
  if (args.stepsToday > 5000) {
    actBonus = Math.min(500, Math.floor((args.stepsToday - 5000) * 0.1));
  }
  const sleepBonus = args.sleepRating === 'poor' ? 200 : 0;
  return Math.max(1500, Math.min(4000, base + actBonus + sleepBonus));
}

// ===== Отправка на сервер =====

interface HealthyMetricRow {
  date: string;
  sleep_minutes: number | null;
  sleep_rating: 'poor' | 'ok' | 'good' | null;
  water_ml: number | null;
  water_goal_ml: number | null;
  steps_count: number | null;
  mood_value: number | null;
  energy_level: 'low' | 'medium' | 'high' | null;
  stress_level: 'low' | 'medium' | 'high' | null;
  data_sources: Record<string, boolean>;
}

async function sendHealthySync(args: {
  token: string;
  profile: {
    sleep_goal_minutes: number;
    steps_goal: number | null;
    weight_kg: number | null;
    height_cm: number | null;
    timezone: string;
    health_data_consent: boolean;
    apple_health_enabled: boolean;
    sleep_notifications_enabled: boolean;
    steps_notifications_enabled: boolean;
    no_activity_interval_hours: number;
  };
  metrics: HealthyMetricRow[];
}): Promise<boolean> {
  const url = `${config.apiBaseUrl}/healthy/sync`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.token}`,
    },
    body: JSON.stringify({
      version: HEALTHY_API_VERSION,
      profile: args.profile,
      metrics: args.metrics,
    }),
  });
  return res.ok;
}

// ===== Определение задачи (вне компонентов, в глобальной области) =====

TaskManager.defineTask(BACKGROUND_HEALTHY_TASK, async () => {
  try {
    const [authRaw, sleepRaw, stepsRaw, waterRaw, moodRaw] =
      await AsyncStorage.multiGet([AUTH_KEY, SLEEP_KEY, STEPS_KEY, WATER_KEY, MOOD_KEY]).then(
        (pairs) => pairs.map(([, v]) => v)
      );

    const auth = parsePersisted<PersistedAuth>(authRaw);
    const token = auth?.token;
    if (!token || token === 'guest-demo') {
      return BackgroundTask.BackgroundTaskResult.Success;
    }

    const sleep = parsePersisted<PersistedSleep>(sleepRaw);
    const steps = parsePersisted<PersistedSteps>(stepsRaw);
    const water = parsePersisted<PersistedWater>(waterRaw);
    const mood = parsePersisted<PersistedMood>(moodRaw);

    const today = todayKey();

    const stepsToday = Platform.OS === 'ios'
      ? await fetchStepsTodayFromPedometer()
      : (steps?.stepsToday ?? 0);

    const sleepGoalMinutes = sleep?.settings?.goalMinutes ?? 480;
    const stepsGoal = steps?.settings?.goalSteps ?? null;
    const heightCm = steps?.settings?.heightCm ?? null;
    const weightKg = steps?.settings?.weightKg ?? null;
    const noActivityHours = steps?.settings?.noActivityIntervalHours ?? 2;
    const sleepNotifications = sleep?.settings?.notificationsEnabled !== false;
    const stepsNotifications = steps?.settings?.stepsNotificationsEnabled !== false;

    const todaySleepRating = sleep?.dayRecords?.[today]?.rating ?? null;
    const lastNightSleep = sleep?.lastNightSleepMinutes ?? null;
    const avgSleep = sleep?.avgSleep7DaysMinutes ?? null;

    const waterToday = (() => {
      const w = water ?? {};
      if (w.lastDate === today) return w.intakeTodayMl ?? 0;
      return 0;
    })();
    const waterGoal = calculateWaterGoalSimple({
      heightCm,
      weightKg,
      stepsToday,
      sleepRating: todaySleepRating,
    });

    const todayMood = mood?.records?.[today] ?? null;
    const history = steps?.history ?? [];

    const todayRow: HealthyMetricRow = {
      date: today,
      sleep_minutes: lastNightSleep,
      sleep_rating: todaySleepRating,
      water_ml: waterToday,
      water_goal_ml: waterGoal,
      steps_count: stepsToday,
      mood_value: todayMood?.moodValue ?? null,
      energy_level: todayMood?.energy ?? null,
      stress_level: todayMood?.stress ?? null,
      data_sources: {
        background_task: true,
        pedometer: Platform.OS === 'ios',
        mood_check_in: Boolean(todayMood),
      },
    };

    const historyRows: HealthyMetricRow[] = history
      .filter((h) => h.date !== today)
      .map((h) => {
        const hMood = mood?.records?.[h.date] ?? null;
        const hSleep = sleep?.dayRecords?.[h.date] ?? null;
        return {
          date: h.date,
          sleep_minutes: avgSleep,
          sleep_rating: hSleep?.rating ?? null,
          water_ml: null,
          water_goal_ml: null,
          steps_count: h.steps,
          mood_value: hMood?.moodValue ?? null,
          energy_level: hMood?.energy ?? null,
          stress_level: hMood?.stress ?? null,
          data_sources: { pedometer: true, mood_check_in: Boolean(hMood) },
        };
      });

    const uniqueMetrics = Array.from(
      new Map([todayRow, ...historyRows].map((r) => [r.date, r])).values()
    ).sort((a, b) => a.date.localeCompare(b.date));

    const ok = await sendHealthySync({
      token,
      profile: {
        sleep_goal_minutes: sleepGoalMinutes,
        steps_goal: stepsGoal,
        weight_kg: weightKg,
        height_cm: heightCm,
        timezone: 'Asia/Almaty',
        health_data_consent: true,
        apple_health_enabled: Platform.OS === 'ios',
        sleep_notifications_enabled: sleepNotifications,
        steps_notifications_enabled: stepsNotifications,
        no_activity_interval_hours: noActivityHours,
      },
      metrics: uniqueMetrics,
    });

    return ok
      ? BackgroundTask.BackgroundTaskResult.Success
      : BackgroundTask.BackgroundTaskResult.Failed;
  } catch (e) {
    console.error('[BackgroundHealthySync]', e);
    return BackgroundTask.BackgroundTaskResult.Failed;
  }
});

// ===== Регистрация / отмена =====

export async function registerBackgroundHealthyTask(): Promise<void> {
  const status = await BackgroundTask.getStatusAsync();
  if (status === BackgroundTask.BackgroundTaskStatus.Restricted) return;

  const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEALTHY_TASK);
  if (already) return;

  await BackgroundTask.registerTaskAsync(BACKGROUND_HEALTHY_TASK, {
    minimumInterval: 15,
  });
}

export async function unregisterBackgroundHealthyTask(): Promise<void> {
  const already = await TaskManager.isTaskRegisteredAsync(BACKGROUND_HEALTHY_TASK);
  if (already) {
    await BackgroundTask.unregisterTaskAsync(BACKGROUND_HEALTHY_TASK);
  }
}
