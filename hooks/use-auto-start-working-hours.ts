import { useEffect, useRef } from 'react';

import { getOfficeById } from '@/lib/api';
import { useActivityTrackerStore } from '@/stores/activity-tracker-store';
import { useAuthStore } from '@/stores/auth-store';

const AUTO_START_CHECK_INTERVAL_MS = 30 * 1000; // 30 сек как на фронте
const INITIAL_DELAY_MS = 3000;
const OFFICE_CACHE_MS = 5 * 60 * 1000; // 5 мин кэш

const DEFAULT_START = '08:00:00';
const DEFAULT_END = '18:00:00';

function isWithinWorkingHours(
  startStr: string,
  endStr: string
): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes() + Math.floor(now.getSeconds() / 60);

  const [startH, startM, startS] = startStr.split(':').map(Number);
  const [endH, endM, endS] = endStr.split(':').map(Number);
  const startTimeMinutes = startH * 60 + startM + Math.floor((startS ?? 0) / 60);
  const endTimeMinutes = endH * 60 + endM + Math.floor((endS ?? 0) / 60);

  return currentMinutes >= startTimeMinutes && currentMinutes <= endTimeMinutes;
}

/**
 * Автозапуск трекера в рабочие часы офиса и автоостановка после окончания.
 * Работает только для роли client с указанным office_id.
 */
export function useAutoStartWorkingHours() {
  const officeId = useAuthStore((s) => s.user?.office_id);
  const role = useAuthStore((s) => s.role);

  const isTracking = useActivityTrackerStore((s) => s.isTracking);
  const manualStart = useActivityTrackerStore((s) => s.manualStart);
  const autoStartInWorkingHours = useActivityTrackerStore((s) => s.autoStartInWorkingHours);
  const requestStartTracking = useActivityTrackerStore((s) => s.requestStartTracking);
  const requestStopTracking = useActivityTrackerStore((s) => s.requestStopTracking);
  const resetStatistics = useActivityTrackerStore((s) => s.resetStatistics);

  const officeInfoRef = useRef<{ start: string; end: string } | null>(null);
  const lastOfficeLoadRef = useRef<number>(0);
  const isCheckingRef = useRef(false);
  const isStartingRef = useRef(false);
  const isStoppingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (role !== 'client' || !officeId) return;

    const loadOfficeInfo = async (force = false): Promise<{ start: string; end: string } | null> => {
      const now = Date.now();
      if (!force && officeInfoRef.current && now - lastOfficeLoadRef.current < OFFICE_CACHE_MS) {
        return officeInfoRef.current;
      }
      try {
        const res = await getOfficeById(officeId);
        if (res.ok) {
          const start = res.data.working_hours_start ?? DEFAULT_START;
          const end = res.data.working_hours_end ?? DEFAULT_END;
          officeInfoRef.current = { start, end };
          lastOfficeLoadRef.current = now;
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

    const checkAndAutoStart = async () => {
      if (isCheckingRef.current || !mountedRef.current) return;
      const state = useActivityTrackerStore.getState();
      if (state.isTracking || isStartingRef.current) return;
      if (!state.autoStartInWorkingHours) return;

      isCheckingRef.current = true;
      await loadOfficeInfo();
      const info = officeInfoRef.current;
      isCheckingRef.current = false;

      if (!info || !isWithinWorkingHours(info.start, info.end)) return;
      if (state.manualStart) return;

      isStartingRef.current = true;
      useActivityTrackerStore.getState().requestStartTracking(false);
      isStartingRef.current = false;
    };

    const initialTimeout = setTimeout(() => {
      if (mountedRef.current) {
        const state = useActivityTrackerStore.getState();
        if (!state.manualStart && !state.isTracking && !isStartingRef.current) {
          checkAndAutoStart();
        }
      }
    }, INITIAL_DELAY_MS);

    const intervalId = setInterval(async () => {
      if (!mountedRef.current || isCheckingRef.current) return;

      const state = useActivityTrackerStore.getState();
      await loadOfficeInfo();
      const info = officeInfoRef.current;
      const within = info ? isWithinWorkingHours(info.start, info.end) : false;

      if (!within) {
        if (state.isTracking && !state.manualStart && !isStoppingRef.current) {
          isStoppingRef.current = true;
          useActivityTrackerStore.getState().requestStopTracking(false);
          useActivityTrackerStore.getState().resetStatistics();
          isStoppingRef.current = false;
        }
        return;
      }

      if (
        !state.isTracking &&
        !state.manualStart &&
        !isStartingRef.current &&
        state.autoStartInWorkingHours
      ) {
        isStartingRef.current = true;
        useActivityTrackerStore.getState().requestStartTracking(false);
        isStartingRef.current = false;
      }
    }, AUTO_START_CHECK_INTERVAL_MS);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(intervalId);
    };
  }, [
    role,
    officeId,
    isTracking,
    manualStart,
    autoStartInWorkingHours,
    requestStartTracking,
    requestStopTracking,
    resetStatistics,
  ]);
}
