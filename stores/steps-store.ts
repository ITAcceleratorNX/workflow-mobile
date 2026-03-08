import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';
import { calculateStepGoal } from '@/lib/steps-utils';

export interface StepsDayRecord {
  date: string;
  steps: number;
}

export interface StepsNotificationFlags {
  fiftyPercentSentToday: boolean;
  almostGoalSentToday: boolean;
  noActivityCountToday: number;
  lastNoActivitySentAt: number;
}

export interface StepsSettings {
  heightCm: number | null;
  weightKg: number | null;
  /** Рекомендованная цель (пересчитывается по кнопке «Сохранить») */
  goalSteps: number | null;
  stepsNotificationsEnabled: boolean;
  /** Интервал «нет активности», часы (дефолт 2) */
  noActivityIntervalHours: number;
}

const MAX_HISTORY_DAYS = 7;
const DEFAULT_NO_ACTIVITY_HOURS = 2;
const MAX_NO_ACTIVITY_NOTIFICATIONS_PER_DAY = 3;

interface StepsState {
  /** Шаги за текущий день (дата в lastStepsDate) */
  stepsToday: number;
  /** Дата последнего обновления шагов (YYYY-MM-DD) */
  lastStepsDate: string | null;
  /** История за последние 7 дней (дата → шаги) */
  history: StepsDayRecord[];
  /** Доступность шагомера (устанавливается хуком usePedometer) */
  pedometerAvailable: boolean | null;
  /** Идёт загрузка/проверка шагомера */
  pedometerLoading: boolean;
  settings: StepsSettings;
  /** Для проверки «нет активности»: значение шагов при последней проверке */
  lastStepsValueForActivity: number;
  /** Время последней проверки активности (ms) */
  lastStepsValueForActivityAt: number;
  notificationFlags: StepsNotificationFlags;
  /** Сбрасывать флаги уведомлений при смене дня */
  resetNotificationFlagsForNewDay: (dateKey: string) => void;
  setStepsToday: (steps: number, dateKey: string) => void;
  setHistory: (history: StepsDayRecord[]) => void;
  setPedometerStatus: (available: boolean | null, loading: boolean) => void;
  setSettings: (settings: Partial<StepsSettings>) => void;
  recalculateAndSaveGoal: () => void;
  setLastStepsValueForActivity: (steps: number) => void;
  setNotificationFlags: (flags: Partial<StepsNotificationFlags>) => void;
  markFiftyPercentSent: () => void;
  markAlmostGoalSent: () => void;
  markNoActivitySent: () => void;
  canSendNoActivity: () => boolean;
}

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const initialFlags: StepsNotificationFlags = {
  fiftyPercentSentToday: false,
  almostGoalSentToday: false,
  noActivityCountToday: 0,
  lastNoActivitySentAt: 0,
};

const initialSettings: StepsSettings = {
  heightCm: null,
  weightKg: null,
  goalSteps: null,
  stepsNotificationsEnabled: true,
  noActivityIntervalHours: DEFAULT_NO_ACTIVITY_HOURS,
};

export const useStepsStore = create<StepsState>()(
  persist(
    (set, get) => ({
      stepsToday: 0,
      lastStepsDate: null,
      history: [],
      pedometerAvailable: null,
      pedometerLoading: true,
      settings: initialSettings,
      lastStepsValueForActivity: 0,
      lastStepsValueForActivityAt: 0,
      notificationFlags: initialFlags,

      resetNotificationFlagsForNewDay: (dateKey: string) => {
        const current = get().notificationFlags;
        const lastDate = get().lastStepsDate;
        if (lastDate && lastDate !== dateKey) {
          set({
            notificationFlags: {
              ...initialFlags,
            },
          });
        }
      },

      setStepsToday: (steps: number, dateKey: string) => {
        const state = get();
        const prevDate = state.lastStepsDate;
        let history = state.history;

        if (prevDate && prevDate !== dateKey) {
          const prevSteps = state.stepsToday;
          if (prevSteps > 0) {
            const newRecord: StepsDayRecord = { date: prevDate, steps: prevSteps };
            history = [newRecord, ...history].slice(0, MAX_HISTORY_DAYS);
          }
          set({
            notificationFlags: { ...initialFlags },
          });
        }

        set({
          stepsToday: steps,
          lastStepsDate: dateKey,
          history,
        });
      },

      setHistory: (history: StepsDayRecord[]) =>
        set({ history: history.slice(0, MAX_HISTORY_DAYS) }),

      setPedometerStatus: (pedometerAvailable, pedometerLoading) =>
        set({ pedometerAvailable, pedometerLoading }),

      setSettings: (settings: Partial<StepsSettings>) =>
        set((s) => ({
          settings: { ...s.settings, ...settings },
        })),

      recalculateAndSaveGoal: () => {
        const { settings } = get();
        let { heightCm, weightKg } = settings;
        if (heightCm == null || weightKg == null) return;
        heightCm = Math.max(100, Math.min(250, heightCm));
        weightKg = Math.max(30, Math.min(300, weightKg));
        const goal = calculateStepGoal(heightCm, weightKg);
        set((s) => ({
          settings: {
            ...s.settings,
            heightCm,
            weightKg,
            goalSteps: goal,
          },
        }));
      },

      setLastStepsValueForActivity: (steps: number) =>
        set({
          lastStepsValueForActivity: steps,
          lastStepsValueForActivityAt: Date.now(),
        }),

      setNotificationFlags: (flags: Partial<StepsNotificationFlags>) =>
        set((s) => ({
          notificationFlags: { ...s.notificationFlags, ...flags },
        })),

      markFiftyPercentSent: () =>
        set((s) => ({
          notificationFlags: {
            ...s.notificationFlags,
            fiftyPercentSentToday: true,
          },
        })),

      markAlmostGoalSent: () =>
        set((s) => ({
          notificationFlags: {
            ...s.notificationFlags,
            almostGoalSentToday: true,
          },
        })),

      markNoActivitySent: () =>
        set((s) => ({
          notificationFlags: {
            ...s.notificationFlags,
            noActivityCountToday: s.notificationFlags.noActivityCountToday + 1,
            lastNoActivitySentAt: Date.now(),
          },
        })),

      canSendNoActivity: () => {
        const { notificationFlags } = get();
        return (
          notificationFlags.noActivityCountToday < MAX_NO_ACTIVITY_NOTIFICATIONS_PER_DAY
        );
      },
    }),
    {
      name: 'steps-storage',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        stepsToday: state.stepsToday,
        lastStepsDate: state.lastStepsDate,
        history: state.history,
        settings: state.settings,
        notificationFlags: state.notificationFlags,
        // pedometerAvailable / pedometerLoading не персистим — определяются при запуске
      }),
    }
  )
);
