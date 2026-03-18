import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import { formatDateForApi } from '@/lib/dateTimeUtils';
import { persistStorage } from '@/lib/storage';

/** Оценка сна: Не выспался | Можно и лучше | Выспался */
export type SleepRating = 'poor' | 'ok' | 'good';

export interface SleepSettings {
  /** Цель сна в минутах (например 480 = 8ч) */
  goalMinutes: number;
  /** Время отхода ко сну: часы (0-23) */
  bedtimeHour: number;
  /** Время отхода ко сну: минуты (0-59) */
  bedtimeMinute: number;
  /** Время пробуждения: часы (0-23) */
  wakeHour: number;
  /** Время пробуждения: минуты (0-59) */
  wakeMinute: number;
  /** Уведомления сна включены */
  notificationsEnabled: boolean;
}

export interface SleepDayRecord {
  date: string;
  rating: SleepRating;
  /** Рекомендации на день (сохраняются до конца дня) */
  recommendations: string[];
}

const DEFAULT_GOAL_MINUTES = 480; // 8 часов
const DEFAULT_BEDTIME = { hour: 22, minute: 0 };
const DEFAULT_WAKE = { hour: 7, minute: 0 };

const initialSettings: SleepSettings = {
  goalMinutes: DEFAULT_GOAL_MINUTES,
  bedtimeHour: DEFAULT_BEDTIME.hour,
  bedtimeMinute: DEFAULT_BEDTIME.minute,
  wakeHour: DEFAULT_WAKE.hour,
  wakeMinute: DEFAULT_WAKE.minute,
  notificationsEnabled: true,
};

interface SleepState {
  settings: SleepSettings;
  /** Записи по датам (YYYY-MM-DD → SleepDayRecord) */
  dayRecords: Record<string, SleepDayRecord>;
  /** Принудительный показ опроса (кнопка «Оценить сон») */
  forceShowSurvey: boolean;
  /** Данные сна из Apple Health: минуты за прошлую ночь (null = нет данных) */
  lastNightSleepMinutes: number | null;
  /** Среднее за 7 дней в минутах (null = нет данных) */
  avgSleep7DaysMinutes: number | null;
  /** Доступ к Apple Health получен */
  healthAccessGranted: boolean | null;

  setSettings: (s: Partial<SleepSettings>) => void;
  setSleepRating: (dateKey: string, rating: SleepRating) => void;
  getTodayRating: () => SleepRating | null;
  getTodayRecommendations: () => string[];
  setLastNightSleep: (minutes: number | null) => void;
  setAvgSleep7Days: (minutes: number | null) => void;
  setHealthAccess: (granted: boolean | null) => void;
  requestSurveyShow: () => void;
  clearForceShowSurvey: () => void;
}

/** Краткие советы по оценке */
const RECOMMENDATIONS: Record<SleepRating, string[]> = {
  poor: [
    'Сну нужно уделить внимание. Попробуйте ложиться в одно время и избегайте экранов за 1 час до сна.',
    'Избегайте кофеина после 14:00.',
    'Создайте расслабляющий ритуал перед сном.',
    'Проветривайте комнату перед сном.',
  ],
  ok: [
    'Неплохо! Попробуйте ложиться чуть раньше для лучшего результата.',
    'Избегайте тяжёлой пищи за 2–3 часа до сна.',
  ],
  good: [
    'Отлично! Вы хорошо выспались.',
    'Сохраняйте привычный режим сна.',
  ],
};

/** Полные советы для экрана «Подробнее» */
export const FULL_SLEEP_ADVICE: Record<SleepRating, string> = {
  poor: `Как улучшить сон и высыпаться

1. Режим сна
Ложитесь и вставайте в одно и то же время каждый день, даже в выходные. Это помогает настроить внутренние часы.

2. Подготовка ко сну
• За 1–2 часа до сна избегайте экранов (телефон, планшет, ТВ) — синий свет мешает засыпанию.
• Создайте расслабляющий ритуал: тёплый душ, чтение, лёгкая растяжка.
• Проветривайте комнату — прохладный воздух (18–20°C) способствует засыпанию.

3. Питание и напитки
• Избегайте кофеина после 14:00 (кофе, чай, энергетики).
• Не ешьте тяжёлую пищу за 2–3 часа до сна.
• Алкоголь ухудшает качество сна — лучше ограничить.

4. Активность
• Регулярная физическая активность днём помогает спать лучше.
• Не тренируйтесь интенсивно за 2–3 часа до сна.

5. Обстановка
• Затемните комнату шторами или маской для сна.
• Убедитесь, что матрас и подушка удобны.
• Минимизируйте шум или используйте беруши.`,
  ok: `Как сделать сон ещё лучше

1. Время отхода ко сну
Попробуйте ложиться на 15–30 минут раньше. Постепенное смещение помогает без стресса для организма.

2. Питание
• Избегайте тяжёлой и острой пищи за 2–3 часа до сна.
• Лёгкий ужин с белком и сложными углеводами может улучшить засыпание.

3. Расслабление
• Вечерний ритуал: чай без кофеина, чтение, медитация или дыхательные упражнения.
• Записывайте мысли перед сном — это помогает «разгрузить» голову.

4. Регулярность
Сохраняйте привычный режим — это ключ к стабильному качеству сна.`,
  good: `Как сохранить хороший сон

1. Режим
Продолжайте ложиться и вставать в одно время. Регулярность — главный фактор качества сна.

2. Привычки
• Сохраняйте вечерний ритуал расслабления.
• Избегайте экранов за час до сна.
• Проветривайте комнату перед сном.

3. Активность и отдых
• Поддерживайте регулярную физическую активность.
• Находите время для отдыха в течение дня — это помогает лучше восстанавливаться ночью.`,
};

export const useSleepStore = create<SleepState>()(
  persist(
    (set, get) => ({
      settings: initialSettings,
      dayRecords: {},
      forceShowSurvey: false,
      lastNightSleepMinutes: null,
      avgSleep7DaysMinutes: null,
      healthAccessGranted: null,

      setSettings: (s) =>
        set((state) => ({
          settings: { ...state.settings, ...s },
        })),

      setSleepRating: (dateKey, rating) =>
        set((state) => ({
          dayRecords: {
            ...state.dayRecords,
            [dateKey]: {
              date: dateKey,
              rating,
              recommendations: RECOMMENDATIONS[rating],
            },
          },
        })),

      getTodayRating: () => {
        const key = formatDateForApi(new Date());
        return get().dayRecords[key]?.rating ?? null;
      },

      getTodayRecommendations: () => {
        const key = formatDateForApi(new Date());
        return get().dayRecords[key]?.recommendations ?? [];
      },

      setLastNightSleep: (minutes) => set({ lastNightSleepMinutes: minutes }),
      setAvgSleep7Days: (minutes) => set({ avgSleep7DaysMinutes: minutes }),
      setHealthAccess: (granted) => set({ healthAccessGranted: granted }),
      requestSurveyShow: () => set({ forceShowSurvey: true }),
      clearForceShowSurvey: () => set({ forceShowSurvey: false }),
    }),
    {
      name: 'sleep-storage',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        settings: state.settings,
        dayRecords: state.dayRecords,
        lastNightSleepMinutes: state.lastNightSleepMinutes,
        avgSleep7DaysMinutes: state.avgSleep7DaysMinutes,
        // forceShowSurvey не персистим
      }),
    }
  )
);

/** Длительность сна по расписанию в минутах */
export function getScheduledSleepMinutes(settings: SleepSettings): number {
  const bedM = settings.bedtimeHour * 60 + settings.bedtimeMinute;
  let wakeM = settings.wakeHour * 60 + settings.wakeMinute;
  if (wakeM <= bedM) wakeM += 24 * 60;
  return wakeM - bedM;
}

/** Форматирование минут в "Xч Yм" */
export function formatSleepDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (m === 0) return `${h}ч`;
  return `${h}ч ${m}м`;
}
