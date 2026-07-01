import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import * as Updates from 'expo-updates';

type UpdateState = 'idle' | 'checking' | 'available' | 'downloading' | 'applying';

/**
 * Проверяет наличие OTA-обновления (EAS Update) при запуске и при возврате
 * приложения на передний план. Ничего не делает, если expo-updates
 * не настроен (например, в Expo Go или локальной сборке без EAS Update).
 */
export function useAppUpdate() {
  const [state, setState] = useState<UpdateState>('idle');
  const checkingRef = useRef(false);

  const checkForUpdate = useCallback(async () => {
    if (!Updates.isEnabled || checkingRef.current) return;
    checkingRef.current = true;
    setState('checking');
    try {
      const result = await Updates.checkForUpdateAsync();
      setState(result.isAvailable ? 'available' : 'idle');
    } catch {
      setState('idle');
    } finally {
      checkingRef.current = false;
    }
  }, []);

  useEffect(() => {
    checkForUpdate();

    const subscription = AppState.addEventListener(
      'change',
      (next: AppStateStatus) => {
        if (next === 'active') checkForUpdate();
      }
    );

    return () => subscription.remove();
  }, [checkForUpdate]);

  const applyUpdate = useCallback(async () => {
    if (state !== 'available') return;
    setState('downloading');
    try {
      await Updates.fetchUpdateAsync();
      setState('applying');
      await Updates.reloadAsync();
    } catch {
      setState('available');
    }
  }, [state]);

  return {
    isAvailable: state === 'available',
    isApplying: state === 'downloading' || state === 'applying',
    applyUpdate,
  };
}
