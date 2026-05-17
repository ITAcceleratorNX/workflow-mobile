/**
 * Бэкенд /healthy/sync принимает только energy_level и stress_level: low | medium | high | null.
 * В UI и persist хранятся продуктовые значения (full/good/depleted, calm/neutral/tense/overloaded).
 */
import type { EnergyLevelV, StressLevelV } from '@/lib/mood-persist-parse';

export type HealthyApiStressEnergyLevel = 'low' | 'medium' | 'high';

/** Уровень энергии: низкая → low, средняя → medium, высокая → high. */
export function moodEnergyToApiLevel(
  energy: EnergyLevelV | HealthyApiStressEnergyLevel | null | undefined
): HealthyApiStressEnergyLevel | null {
  if (energy == null) return null;
  switch (energy) {
    case 'full':
    case 'high':
      return 'high';
    case 'good':
    case 'medium':
      return 'medium';
    case 'low':
    case 'depleted':
      return 'low';
    default:
      return null;
  }
}

/**
 * Уровень напряжения/стресса по шкале сервера: low = спокойно, high = сильное напряжение.
 * `tense` считается повышенным стрессом (как isStressElevated в приложении).
 */
export function moodStressToApiLevel(
  stress: StressLevelV | HealthyApiStressEnergyLevel | null | undefined
): HealthyApiStressEnergyLevel | null {
  if (stress == null) return null;
  switch (stress) {
    case 'calm':
    case 'low':
      return 'low';
    case 'neutral':
    case 'medium':
      return 'medium';
    case 'tense':
    case 'overloaded':
    case 'high':
      return 'high';
    default:
      return null;
  }
}
