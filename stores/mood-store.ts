import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import { formatDateForApi } from '@/lib/dateTimeUtils';
import { persistStorage } from '@/lib/storage';

export type EnergyLevel = 'low' | 'medium' | 'high';
export type StressLevel = 'low' | 'medium' | 'high';

export interface MoodRecord {
  date: string;
  moodValue: number;
  energy: EnergyLevel;
  stress: StressLevel;
  recommendation?: string;
}

interface MoodState {
  records: Record<string, MoodRecord>;

  setMood: (dateKey: string, data: Omit<MoodRecord, 'date'>) => void;
  getTodayMood: () => MoodRecord | null;
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set, get) => ({
      records: {},

      setMood: (dateKey, data) =>
        set((s) => ({
          records: {
            ...s.records,
            [dateKey]: { ...data, date: dateKey },
          },
        })),

      getTodayMood: () => {
        const key = formatDateForApi(new Date());
        return get().records[key] ?? null;
      },
    }),
    {
      name: 'mood-storage',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({ records: state.records }),
    }
  )
);
