/**
 * Расчёт нормы воды в день (мл).
 * Учитывает: рост, вес, шаги, качество сна.
 * Apple Health — при наличии данных можно подставлять вместо ручного ввода.
 */

const BASE_ML_PER_KG = 30;
const ML_PER_CM_OVER_150 = 12; // доп. мл за каждый см роста свыше 150
const HEIGHT_REF_CM = 150;
const DEFAULT_BASE_ML = 2000;
const MIN_GOAL_ML = 1500;
const MAX_GOAL_ML = 4000;
const STEPS_THRESHOLD = 5000;
const ML_PER_STEP_OVER_THRESHOLD = 0.1;
const MAX_ACTIVITY_BONUS_ML = 500;
const POOR_SLEEP_BONUS_ML = 200;

export interface WaterGoalInput {
  /** Рост в см (из настроек шагов / Apple Health) */
  heightCm: number | null;
  /** Вес в кг (из настроек шагов / Apple Health) */
  weightKg: number | null;
  /** Шаги за сегодня */
  stepsToday: number;
  /** Оценка сна: poor = не выспался, ok = можно и лучше, good = выспался */
  sleepRating: 'poor' | 'ok' | 'good' | null;
  /** Вода из Apple Health за сегодня (мл), если есть — используем как доп. источник */
  healthWaterTodayMl: number | null;
}

/**
 * Рассчитывает рекомендуемую норму воды на день.
 * База: 30 мл/кг веса + 12 мл за каждый см роста свыше 150 см, или 2 л по умолчанию.
 * Бонус за активность: +0.1 мл за каждый шаг свыше 5000 (макс +500 мл).
 * Бонус за плохой сон: +200 мл (обезвоживание ухудшает восстановление).
 */
export function calculateWaterGoal(input: WaterGoalInput): number {
  let base = DEFAULT_BASE_ML;

  if (input.weightKg != null && input.weightKg > 0) {
    base = Math.round(input.weightKg * BASE_ML_PER_KG);
    if (input.heightCm != null && input.heightCm > HEIGHT_REF_CM) {
      const heightBonus = Math.round((input.heightCm - HEIGHT_REF_CM) * ML_PER_CM_OVER_150);
      base += heightBonus;
    }
  }

  let activityBonus = 0;
  if (input.stepsToday > STEPS_THRESHOLD) {
    const extraSteps = input.stepsToday - STEPS_THRESHOLD;
    activityBonus = Math.min(
      MAX_ACTIVITY_BONUS_ML,
      Math.floor(extraSteps * ML_PER_STEP_OVER_THRESHOLD)
    );
  }

  const sleepBonus =
    input.sleepRating === 'poor' ? POOR_SLEEP_BONUS_ML : 0;

  let goal = base + activityBonus + sleepBonus;
  goal = Math.max(MIN_GOAL_ML, Math.min(MAX_GOAL_ML, goal));

  return goal;
}

/** Стандартные порции воды (мл) */
export const WATER_PORTIONS = [100, 150, 200, 250, 300, 500] as const;
