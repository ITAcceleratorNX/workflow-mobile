/**
 * Утилиты для шагомера: цель по шагам, длина шага, километры.
 * Clean: чистые функции, без зависимостей от UI/API.
 */

const GOAL_BASE = 5500;
const GOAL_WEIGHT_REF = 70;
const GOAL_HEIGHT_REF = 190;
const GOAL_STEP = 15;
const GOAL_MIN = 4000;
const GOAL_MAX = 11000;
const ROUND_TO = 100;

/**
 * Рекомендованная цель шагов в день по формуле:
 * Цель = 5500 + 15×(Вес−70) + 15×(190−Рост)
 * Округление до 100, границы 4000–11000.
 */
export function calculateStepGoal(heightCm: number, weightKg: number): number {
  const weightDelta = (weightKg - GOAL_WEIGHT_REF) * GOAL_STEP;
  const heightDelta = (GOAL_HEIGHT_REF - heightCm) * GOAL_STEP;
  let goal = GOAL_BASE + weightDelta + heightDelta;
  goal = Math.round(goal / ROUND_TO) * ROUND_TO;
  return Math.max(GOAL_MIN, Math.min(GOAL_MAX, goal));
}

/**
 * Длина шага в метрах по росту (приблизительно).
 * Модель: ~0.415 × рост в метрах (типичная доля для ходьбы).
 */
export function stepLengthMetersFromHeight(heightCm: number): number {
  if (heightCm <= 0) return 0.7; // fallback
  return (heightCm / 100) * 0.415;
}

/**
 * Километры по шагам и длине шага (приблизительно).
 */
export function stepsToKm(steps: number, stepLengthM: number): number {
  if (steps <= 0 || stepLengthM <= 0) return 0;
  const meters = steps * stepLengthM;
  return Math.round((meters / 1000) * 100) / 100;
}

export { toDateKey } from '@/lib/dateTimeUtils';

/**
 * Начало календарного дня в локальной таймзоне.
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}
