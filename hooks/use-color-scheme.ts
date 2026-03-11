import { useSyncExternalStore } from 'react';

export type AppColorScheme = 'light' | 'dark';

let currentScheme: AppColorScheme = 'light';
const listeners = new Set<() => void>();

export function setAppColorScheme(next: AppColorScheme) {
  if (next === currentScheme) return;
  currentScheme = next;
  listeners.forEach((listener) => listener());
}

export function useColorScheme(): AppColorScheme {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => currentScheme,
    () => currentScheme
  );
}
