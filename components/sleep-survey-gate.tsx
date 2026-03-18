import { useSleepSurvey } from '@/hooks/use-sleep-survey';
import { useAuthStore } from '@/stores/auth-store';

import { SleepSurveyOverlay } from './sleep-survey-overlay';

/**
 * Показывает опрос оценки сна при входе в приложение утром (только для клиентов).
 */
export function SleepSurveyGate() {
  const role = useAuthStore((s) => s.role ?? s.user?.role);
  const isClient = role?.toLowerCase() === 'client';
  const { visible, hide } = useSleepSurvey();

  if (!isClient) return null;

  return <SleepSurveyOverlay visible={visible} onClose={hide} />;
}
