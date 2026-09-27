import { useCallback, useEffect, useState } from 'react';

import { getTaskRecipients, type RecipientDirectory } from '@/lib/task-recipients-api';
import { useAuthStore } from '@/stores/auth-store';

const EMPTY: RecipientDirectory = { my_company: null, available_companies: [] };

/**
 * Справочник получателей для поля «Исполнитель». Компонент выбора монтируется при каждом
 * открытии, поэтому список всегда свежий: доступ через группы взаимодействия мог измениться.
 */
export function useTaskRecipients() {
  const [state, setState] = useState<{ directory: RecipientDirectory | null; error: string | null }>({
    directory: null,
    error: null,
  });
  const [attempt, setAttempt] = useState(0);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);

  useEffect(() => {
    let cancelled = false;
    const load = token && !isGuest ? getTaskRecipients() : Promise.resolve({ ok: true as const, data: EMPTY });
    void load.then((res) => {
      if (cancelled) return;
      setState(res.ok ? { directory: res.data, error: null } : { directory: null, error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [token, isGuest, attempt]);

  const reload = useCallback(() => {
    setState({ directory: null, error: null });
    setAttempt((n) => n + 1);
  }, []);

  return {
    directory: state.directory,
    error: state.error,
    loading: state.directory == null && state.error == null,
    reload,
  };
}
