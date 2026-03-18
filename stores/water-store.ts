import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import { formatDateForApi } from '@/lib/dateTimeUtils';
import { persistStorage } from '@/lib/storage';
import {
  calculateWaterGoal,
  type WaterGoalInput,
} from '@/lib/water-utils';

export { WATER_PORTIONS } from '@/lib/water-utils';

export interface WaterDayRecord {
  date: string;
  intakeMl: number;
  goalMl: number;
}

interface WaterState {
  /** Потребление за сегодня (мл) */
  intakeTodayMl: number;
  /** Дата последнего обновления (YYYY-MM-DD) */
  lastDate: string | null;
  /** Ручная цель (мл), null = авто по активности */
  manualGoalMl: number | null;
  /** Вода из Apple Health за сегодня (мл) */
  healthWaterTodayMl: number | null;

  /** Добавить воду (мл) */
  addWater: (ml: number, dateKey: string) => void;
  /** Установить ручную цель (null = авто) */
  setManualGoal: (ml: number | null) => void;
  /** Установить данные из Apple Health */
  setHealthWaterToday: (ml: number | null) => void;
  /** Получить цель на сегодня (с учётом авто-расчёта) */
  getTodayGoalMl: (input: Omit<WaterGoalInput, 'healthWaterTodayMl'>) => number;
  /** Сбросить потребление при смене дня */
  ensureDateSync: (dateKey: string) => void;
}

export const useWaterStore = create<WaterState>()(
  persist(
    (set, get) => ({
      intakeTodayMl: 0,
      lastDate: null,
      manualGoalMl: null,
      healthWaterTodayMl: null,

      addWater: (ml, dateKey) => {
        const state = get();
        const today = formatDateForApi(new Date());
        if (dateKey !== today) return;

        set({
          intakeTodayMl: state.intakeTodayMl + ml,
          lastDate: today,
        });
      },

      setManualGoal: (ml) => set({ manualGoalMl: ml }),

      setHealthWaterToday: (ml) => set({ healthWaterTodayMl: ml }),

      getTodayGoalMl: (input) => {
        const { manualGoalMl, healthWaterTodayMl } = get();
        if (manualGoalMl != null && manualGoalMl > 0) return manualGoalMl;
        return calculateWaterGoal({
          ...input,
          healthWaterTodayMl,
        });
      },

      ensureDateSync: (dateKey) => {
        const { lastDate } = get();
        if (lastDate && lastDate !== dateKey) {
          set({ intakeTodayMl: 0, lastDate: dateKey });
        }
      },
    }),
    {
      name: 'water-storage',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        intakeTodayMl: state.intakeTodayMl,
        lastDate: state.lastDate,
        manualGoalMl: state.manualGoalMl,
      }),
    }
  )
);

/** Сбрасывает потребление при смене дня */
export function resetWaterForNewDay(store: { getState: () => WaterState; setState: (s: Partial<WaterState>) => void }) {
  const today = formatDateForApi(new Date());
  const state = store.getState();
  if (state.lastDate && state.lastDate !== today) {
    store.setState({ intakeTodayMl: 0, lastDate: today });
  }
}

