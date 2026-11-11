import { useEffect, useState } from 'react';
import { AppState, Platform, type AppStateStatus } from 'react-native';
import * as Application from 'expo-application';
import Constants, { ExecutionEnvironment } from 'expo-constants';

import { fetchMinAppVersion, installedAppVersion, isUpdateRequired } from '@/lib/app-version';

/**
 * Обязательно ли обновить приложение из стора: версия установленного билда старше
 * минимума этой платформы с бэкенда. Проверяется при запуске и при возврате
 * приложения на передний план. При любой ошибке — не блокирует.
 */
export function useRequiredUpdate() {
  const [required, setRequired] = useState(false);

  useEffect(() => {
    let active = true;
    const current = installedAppVersion(
      Platform.OS,
      Constants.expoConfig,
      Application.nativeApplicationVersion,
      Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
    );
    const check = () =>
      fetchMinAppVersion(fetch, Platform.OS).then((min) => {
        if (active) setRequired(isUpdateRequired(current, min));
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
