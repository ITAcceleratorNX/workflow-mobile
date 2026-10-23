import { useAsyncResource } from '@/hooks/use-async-resource';
import { useCallback, useEffect, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

type UpdateState = 'idle' | 'downloading' | 'applying';

/**
 * Проверяет наличие OTA-обновления (EAS Update) при запуске и при возврате
 * приложения на передний план. Ничего не делает, если expo-updates
 * не настроен (например, в Expo Go или локальной сборке без EAS Update).
 */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>('idle');
  const fetchAvailableUpdate = useCallback(async () => {
    try { return (await Updates.checkForUpdateAsync()).isAvailable; }
    catch { return false; }
  }, []);
  const { data: available, refresh: checkForUpdate } = useAsyncResource(fetchAvailableUpdate, false, Updates.isEnabled);

  useEffect(() => {
    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') checkForUpdate();
      }
    );

    return () => subscription.remove();
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    if (!available || state !== 'idle') return;
    setState('downloading');
    try {
      await Updates.fetchUpdateAsync();
      setState('applying');
      await Updates.reloadAsync();
    } catch {
      setState('idle');
    }
  }, [state, available]);

  return {
    isAvailable: available && state === 'idle',
    isApplying: state === 'downloading' || state === 'applying',
    applyUpdate,
  };
}
