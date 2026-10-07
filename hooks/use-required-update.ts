import { useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import Constants from 'expo-constants';

import { fetchMinAppVersion, isUpdateRequired } from '@/lib/app-version';

/**
 * Обязательно ли обновить приложение из стора: версия приложения старше
 * минимальной с бэкенда (MIN_APP_VERSION). Проверяется при запуске и при
 * возврате приложения на передний план. При любой ошибке — не блокирует.
 */
export function useRequiredUpdate() {
  const [required, setRequired] = useState(false);

  useEffect(() => {
    let active = true;
    const check = () =>
      fetchMinAppVersion().then((min) => {
        if (active) setRequired(isUpdateRequired(Constants.expoConfig?.version, min));
      });

    check();
    const subscription = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') check();
    });
    return () => {
      active = false;
      subscription.remove();
    };
  }, []);

  return required;
}
