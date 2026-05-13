/**
 * Утилиты, общие для всех фоновых синк-задач.
 * Не импортируй React, zustand-сторы или контексты — этот модуль
 * выполняется когда UI может быть не поднят.
 */
import { Pedometer } from 'expo-sensors';

import { startOfDay } from '@/lib/steps-utils';

/**
 * Парсит persist-обёртку Zustand из AsyncStorage.
 * Zustand сохраняет данные как { state: ... } или напрямую как объект.
 */
export function parsePersisted<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state?: T } | T;
    return (
      parsed && typeof parsed === 'object' && 'state' in parsed
        ? parsed.state
        : parsed
    ) as T;
  } catch {
    return null;
  }
}

/**
 * Читает количество шагов за сегодня из педометра.
 * Используется в фоновых задачах на iOS (где шагомер всегда доступен).
 * На Android педометр в фоне может не работать — возвращает 0.
 */
export async function fetchStepsTodayFromPedometer(): Promise<number> {
  try {
    const start = startOfDay(new Date());
    const result = await Pedometer.getStepCountAsync(start, new Date());
    return result?.steps ?? 0;
  } catch {
    return 0;
  }
}
