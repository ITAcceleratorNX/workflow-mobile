import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { formatDateForApi } from '@/lib/dateTimeUtils';
import { useSleepStore } from '@/stores/sleep-store';

export function useSleepSurvey() {
  const [visible, setVisible] = useState(false);

  const forceShowSurvey = useSleepStore((s) => s.forceShowSurvey);
  const clearForceShowSurvey = useSleepStore((s) => s.clearForceShowSurvey);

  const checkAndShow = useCallback(() => {
    const state = useSleepStore.getState();
    const dateKey = formatDateForApi(new Date());
    const rating = state.dayRecords[dateKey]?.rating;
    if (rating) return;

    const { wakeHour, wakeMinute } = state.settings;
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const wakeMinutes = wakeHour * 60 + wakeMinute;

    // Показываем после времени пробуждения или после 12:00 в течение дня
    const show = currentMinutes >= wakeMinutes || now.getHours() >= 12;
    if (show) setVisible(true);
  }, []);

  useEffect(() => {
    if (forceShowSurvey) {
      setVisible(true);
      clearForceShowSurvey();
    }
  }, [forceShowSurvey, clearForceShowSurvey]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state: AppStateStatus) => {
      if (state === 'active') checkAndShow();
    });
    return () => sub.remove();
  }, [checkAndShow]);

  useEffect(() => {
    const t = setTimeout(checkAndShow, 500);
    return () => clearTimeout(t);
  }, [checkAndShow]);

  const show = useCallback(() => setVisible(true), []);
  const hide = useCallback(() => setVisible(false), []);

  return { visible, show, hide };
}
