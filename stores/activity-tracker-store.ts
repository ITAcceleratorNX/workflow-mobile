import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { createJSONStorage } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

interface Statistics {
  totalSittingTime: number;
  totalStandingTime: number;
  standUpCount: number;
  currentPosture: 'sitting' | 'standing' | 'unknown';
  lastStandUpTime: number | null;
  intervals: Array<{
    start: number;
    end: number;
    duration: number;
    type: 'sitting' | 'standing';
  }>;
}

interface HealthReminderSettings {
  enabled: boolean;
  sittingIntervalMinutes: number;
  disableDuringMeetings: boolean;
  lastReminderTime: number | null;
}

interface ActivityTrackerState {
  isTracking: boolean;
  statistics: Statistics;
  startTime: number | null;
  postureStartTime: number | null;
  lastPosture: 'sitting' | 'standing' | 'unknown';
  manualStart: boolean;
  healthReminders: HealthReminderSettings;
  autoStartInWorkingHours: boolean;

  // Actions
  setIsTracking: (isTracking: boolean) => void;
  setStatistics: (statistics: Statistics | ((prev: Statistics) => Statistics)) => void;
  setStartTime: (startTime: number | null) => void;
  setPostureStartTime: (postureStartTime: number | null) => void;
  setLastPosture: (posture: 'sitting' | 'standing' | 'unknown') => void;
  setManualStart: (manual: boolean) => void;
  resetStatistics: () => void;
  updateStatistics: (updater: (prev: Statistics) => Statistics) => void;
  setHealthReminders: (settings: Partial<HealthReminderSettings>) => void;
  setAutoStartInWorkingHours: (enabled: boolean) => void;

  // Control methods
  requestStartTracking: (isManual: boolean) => void;
  requestStopTracking: (isManual: boolean) => void;
}

const initialStatistics: Statistics = {
  totalSittingTime: 0,
  totalStandingTime: 0,
  standUpCount: 0,
  currentPosture: 'unknown',
  lastStandUpTime: null,
  intervals: [],
};

const initialHealthReminders: HealthReminderSettings = {
  enabled: true,
  sittingIntervalMinutes: 60,
  disableDuringMeetings: true,
  lastReminderTime: null,
};

export const useActivityTrackerStore = create<ActivityTrackerState>()(
  persist(
    (set) => ({
      isTracking: false,
      statistics: initialStatistics,
      startTime: null,
      postureStartTime: null,
      lastPosture: 'unknown',
      manualStart: false,
      healthReminders: initialHealthReminders,
      autoStartInWorkingHours: true,

      setIsTracking: (isTracking) => set({ isTracking }),

      setStatistics: (statistics) =>
        set((state) => ({
          statistics:
            typeof statistics === 'function'
              ? statistics(state.statistics)
              : statistics,
        })),

      setStartTime: (startTime) => set({ startTime }),

      setPostureStartTime: (postureStartTime) => set({ postureStartTime }),

      setLastPosture: (lastPosture) => set({ lastPosture }),

      setManualStart: (manualStart) => set({ manualStart }),

      resetStatistics: () =>
        set({
          statistics: initialStatistics,
          startTime: null,
          postureStartTime: null,
          lastPosture: 'unknown',
        }),

      updateStatistics: (updater) =>
        set((state) => ({
          statistics: updater(state.statistics),
        })),

      setHealthReminders: (settings) =>
        set((state) => ({
          healthReminders: {
            ...state.healthReminders,
            ...settings,
          },
        })),

      setAutoStartInWorkingHours: (enabled) =>
        set({ autoStartInWorkingHours: enabled }),

      requestStartTracking: (isManual) => {
        set({
          isTracking: true,
          manualStart: isManual,
          startTime: Date.now(),
          postureStartTime: null,
          lastPosture: 'unknown',
        });
      },

      requestStopTracking: (isManual) => {
        set((state) => ({
          isTracking: false,
          manualStart: isManual ? false : state.manualStart,
        }));
      },
    }),
    {
      name: 'activity-tracker-storage',
      storage: createJSONStorage(() => persistStorage),
      partialize: (state) => ({
        isTracking: state.isTracking,
        statistics: state.statistics,
        startTime: state.startTime,
        postureStartTime: state.postureStartTime,
        lastPosture: state.lastPosture,
        manualStart: state.manualStart,
        healthReminders: state.healthReminders,
        autoStartInWorkingHours: state.autoStartInWorkingHours,
      }),
    }
  )
);
