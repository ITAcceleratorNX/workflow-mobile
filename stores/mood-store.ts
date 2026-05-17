import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import {
  MOOD_PERSIST_VERSION,
  parseEnergyFromMoodFile,
  parseStressFromMoodFile,
  type EnergyLevelV,
  type StressLevelV,
} from '@/lib/mood-persist-parse';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import { persistStorage } from '@/lib/storage';

export type EnergyLevel = EnergyLevelV;
export type StressLevel = StressLevelV;

export {
  isEnergyComfortable,
  isEnergyLowLevel,
  isStressElevated,
  parseEnergyFromMoodFile,
  parseStressFromMoodFile,
} from '@/lib/mood-persist-parse';

export interface MoodRecord {
  date: string;
  moodValue: number;
  energy: EnergyLevelV;
  stress: StressLevelV;
  recommendation?: string;
}

function migrateRecords(records: unknown): Record<string, MoodRecord> {
  if (!records || typeof records !== 'object') return {};
  const out: Record<string, MoodRecord> = {};
  for (const [key, val] of Object.entries(records as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const r = val as Partial<MoodRecord>;
    out[key] = {
      date: typeof r.date === 'string' ? r.date : key,
      moodValue: typeof r.moodValue === 'number' ? r.moodValue : 55,
      energy: parseEnergyFromMoodFile(r.energy, 0),
      stress: parseStressFromMoodFile(r.stress, 0),
      recommendation: typeof r.recommendation === 'string' ? r.recommendation : undefined,
    };
  }
  return out;
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
      version: MOOD_PERSIST_VERSION,
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({ records: state.records }),
      migrate: (persistedState, fromVersion) => {
        if (fromVersion >= MOOD_PERSIST_VERSION) {
          return persistedState as { records: Record<string, MoodRecord> };
        }
        const p = persistedState as { records?: unknown };
        return {
          records: migrateRecords(p.records),
        };
      },
    }
  )
);
