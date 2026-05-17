/**
 * Разбор полей настроения из AsyncStorage (Zustand persist mood-storage).
 * Отдельный модуль без zustand — для фоновых задач и миграций.
 */

export const MOOD_PERSIST_VERSION = 2;

export type EnergyLevelV = 'full' | 'good' | 'low' | 'depleted';
export type StressLevelV = 'calm' | 'neutral' | 'tense' | 'overloaded';

/** При fileVersion меньше MOOD_PERSIST_VERSION в файле только legacy low|medium|high. */
export function parseEnergyFromMoodFile(raw: unknown, fileVersion: number): EnergyLevelV {
  const v = typeof raw === 'string' ? raw : '';
  if (fileVersion >= MOOD_PERSIST_VERSION) {
    if (v === 'full' || v === 'good' || v === 'low' || v === 'depleted') return v;
    return 'good';
  }
  if (v === 'high') return 'full';
  if (v === 'medium') return 'good';
  if (v === 'low') return 'depleted';
  return 'good';
}

export function parseStressFromMoodFile(raw: unknown, fileVersion: number): StressLevelV {
  const v = typeof raw === 'string' ? raw : '';
  if (fileVersion >= MOOD_PERSIST_VERSION) {
    if (v === 'calm' || v === 'neutral' || v === 'tense' || v === 'overloaded') return v;
    return 'neutral';
  }
  if (v === 'high') return 'overloaded';
  if (v === 'medium') return 'neutral';
  if (v === 'low') return 'calm';
  return 'neutral';
}

export function isEnergyComfortable(e: unknown): boolean {
  const x = typeof e === 'string' ? e : '';
  return x === 'full' || x === 'good' || x === 'high' || x === 'medium';
}

export function isEnergyLowLevel(e: unknown): boolean {
  const x = typeof e === 'string' ? e : '';
  return x === 'low' || x === 'depleted';
}

export function isStressElevated(s: unknown): boolean {
  const x = typeof s === 'string' ? s : '';
  return x === 'tense' || x === 'overloaded' || x === 'high';
}
