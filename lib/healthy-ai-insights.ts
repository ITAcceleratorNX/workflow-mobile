/**
 * Healthy — локальный вывод: этап 1 (банк рекомендаций) + этап 2 (персонализация из healthy-insight-signals).
 * Сервер даёт полную картину по синхронизированным дням; офлайн использует синтетические ряды из истории в приложении.
 */
import { formatDateForApi } from '@/lib/dateTimeUtils';
import {
  buildHelpfulHabits,
  buildMetricLinks,
  buildPositiveHighlight,
  buildRationale,
  comparePeriodDynamics,
  computeWindowSignals,
  type InsightSignalRow,
} from '@/lib/healthy-insight-signals';
import type { EnergyLevel, StressLevel } from '@/stores/mood-store';
import type { SleepRating } from '@/stores/sleep-store';

export type HealthyInsightPeriod = 'day' | 'week' | 'month';

export type HealthyMetricId = 'sleep' | 'water' | 'steps' | 'mood' | 'energy' | 'stress';

export interface MoodSlice {
  moodValue: number;
  energy: EnergyLevel;
  stress: StressLevel;
}

export interface HealthyInsightInput {
  period: HealthyInsightPeriod;
  todayKey: string;
  goalSleepMinutes: number;
  lastNightSleepMinutes: number | null;
  avgSleep7DaysMinutes: number | null;
  todaySleepRating: SleepRating | null;
  stepsToday: number;
  stepsGoal: number;
  stepsHistory: { date: string; steps: number }[];
  waterIntakeMl: number;
  waterGoalMl: number;
  moodToday: MoodSlice | null;
  moodRecordsByDate: Record<string, MoodSlice>;
  sleepRatingsByDate: Record<string, SleepRating | undefined>;
}

export type HealthyStatusTone = 'positive' | 'neutral' | 'attention';

export interface HealthyWeakPoint {
  id: HealthyMetricId;
  label: string;
}

export type HealthyDynamicsLabel = 'better' | 'worse' | 'stable';

export interface HealthyInsightResult {
  period: HealthyInsightPeriod;
  lowData: boolean;
  missingHints: string[];
  statusLabel: string;
  statusTone: HealthyStatusTone;
  summary: string;
  weakPoints: HealthyWeakPoint[];
  improved: string[];
  worsened: string[];
  recommendations: string[];
  supportMessage: string;
  weeklyFocus?: string;
  monthlyDynamics?: string;
  strengths: string[];
  weaknessesNarrative: string[];
  patternsLine?: string;
  monthlyFocus?: string;
  dynamicsLabel?: HealthyDynamicsLabel;
  dynamicsSummary?: string;
  vsPreviousPeriod?: string[];
  metricLinks?: string[];
  helpfulHabits?: string[];
  rationale?: string;
  positiveHighlight?: string;
  actionToday?: string;
  metricRatios?: {
    cur: { sleep: number | null; mood: number | null; steps: number | null; stressHigh: number | null };
    prev: { sleep: number | null; mood: number | null; steps: number | null; stressHigh: number | null };
  };
  sparklines?: {
    dates: string[];
    sleep: (number | null)[];
    mood: (number | null)[];
    steps: (number | null)[];
  } | null;
}

/** Банк рекомендаций (продуктовая логика): сон, вода, движение, восстановление, стресс. */
const BANK = {
  sleep: [
    'За час до сна приглушите свет и уберите яркие экраны — так легче переключиться в режим отдыха.',
    'Ложитесь и вставайте примерно в одно время — это поддерживает ритм бодрствования и сна.',
    'Проветривайте спальню перед сном: прохлёжный воздух часто помогает засыпанию.',
  ],
  water: [
    'Добавьте ещё один стакан воды к привычному ритму — маленький шаг, но заметный для самочувствия.',
    'Поставьте воду на видное место: так проще не забывать про глоток между делами.',
  ],
  steps: [
    'Короткая прогулка 10–15 минут уже даёт пользу — можно встроить между встречами.',
    'Поднимитесь на пару остановок раньше или пройдите лестницу — без спешки, в комфортном темпе.',
  ],
  stress: [
    '5 минут спокойного дыхания «вдох на 4 — пауза — выдох на 6» помогают снизить напряжение.',
    'Короткая пауза без экрана: взгляд в окно или лёгкая растяжка — мягкий сброс стресса.',
  ],
  mood_energy: [
    'Запланируйте маленькое приятное дело сегодня — чай в тишине или любимый плейлист.',
    'Сократите на один пункт «обязательное» вечером и оставьте место для восстановления.',
  ],
  recovery: [
    'Дайте себе 20 минут тишины без задач — это тоже вклад в восстановление.',
    'Чередуйте нагрузку и отдых: организму проще держать стабильное самочувствие.',
  ],
} as const;

function daysAgoKey(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return formatDateForApi(d);
}

function keysLastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => daysAgoKey(i));
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[Math.abs(seed) % arr.length];
}

function stressScore(s: StressLevel): number {
  if (s === 'high') return 2;
  if (s === 'medium') return 1;
  return 0;
}

function energyScore(e: EnergyLevel): number {
  if (e === 'high') return 2;
  if (e === 'medium') return 1;
  return 0;
}

function ratingToScore(r: SleepRating | undefined | null): number | null {
  if (!r) return null;
  if (r === 'good') return 2;
  if (r === 'ok') return 1;
  return 0;
}

function sleepMinutesScore(minutes: number | null, goal: number): number | null {
  if (minutes == null || goal <= 0) return null;
  const ratio = minutes / goal;
  if (ratio >= 0.95) return 2;
  if (ratio >= 0.8) return 1;
  return 0;
}

function ratioScore(value: number, goal: number): number | null {
  if (goal <= 0) return null;
  const r = value / goal;
  if (r >= 0.9) return 2;
  if (r >= 0.65) return 1;
  return 0;
}

function weakLabel(id: HealthyMetricId): string {
  const map: Record<HealthyMetricId, string> = {
    sleep: 'Сон ниже цели',
    water: 'Мало жидкости',
    steps: 'Мало движения',
    stress: 'Повышенный стресс',
    mood: 'Настроение ниже обычного',
    energy: 'Мало энергии',
  };
  return map[id];
}

function parseApiDate(key: string): Date {
  const [y, m, d] = key.split('-').map((x) => parseInt(x, 10));
  return new Date(y, m - 1, d);
}

function addDaysLocal(d: Date, n: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

function getInsightPeriodWindows(period: HealthyInsightPeriod, todayKey: string) {
  const end = parseApiDate(todayKey);
  if (period === 'day') {
    const cur = formatDateForApi(end);
    const prev = formatDateForApi(addDaysLocal(end, -1));
    return { current: { start: cur, end: cur }, previous: { start: prev, end: prev } };
  }
  if (period === 'week') {
    const curStart = formatDateForApi(addDaysLocal(end, -6));
    const curEnd = formatDateForApi(end);
    const prevEnd = formatDateForApi(addDaysLocal(end, -7));
    const prevStart = formatDateForApi(addDaysLocal(end, -13));
    return {
      current: { start: curStart, end: curEnd },
      previous: { start: prevStart, end: prevEnd },
    };
  }
  const curStart = formatDateForApi(addDaysLocal(end, -29));
  const curEnd = formatDateForApi(end);
  const prevEnd = formatDateForApi(addDaysLocal(end, -30));
  const prevStart = formatDateForApi(addDaysLocal(end, -59));
  return {
    current: { start: curStart, end: curEnd },
    previous: { start: prevStart, end: prevEnd },
  };
}

function sleepMinutesFromRating(rating: SleepRating | undefined, goal: number): number | null {
  if (!rating || goal <= 0) return null;
  if (rating === 'good') return Math.round(goal * 1);
  if (rating === 'ok') return Math.round(goal * 0.82);
  return Math.round(goal * 0.65);
}

function buildSyntheticRows(input: HealthyInsightInput): InsightSignalRow[] {
  const stepMap = new Map(input.stepsHistory.map((h) => [h.date, h.steps]));
  const anchor = parseApiDate(input.todayKey);
  const rows: InsightSignalRow[] = [];

  for (let i = 59; i >= 0; i -= 1) {
    const d = addDaysLocal(anchor, -i);
    const key = formatDateForApi(d);
    const mood = input.moodRecordsByDate[key];
    const steps = key === input.todayKey ? input.stepsToday : (stepMap.get(key) ?? null);

    let sleep_minutes: number | null = null;
    if (key === input.todayKey) {
      sleep_minutes =
        input.lastNightSleepMinutes ??
        sleepMinutesFromRating(input.todaySleepRating ?? input.sleepRatingsByDate[key], input.goalSleepMinutes);
    } else {
      sleep_minutes =
        sleepMinutesFromRating(input.sleepRatingsByDate[key], input.goalSleepMinutes) ??
        (input.avgSleep7DaysMinutes != null ? input.avgSleep7DaysMinutes : null);
    }

    const water_ml = key === input.todayKey ? input.waterIntakeMl : null;
    const water_goal_ml = key === input.todayKey ? input.waterGoalMl : null;

    let completeness_score = 25;
    if (mood) completeness_score += 25;
    if (steps != null && steps > 200) completeness_score += 25;
    if (sleep_minutes != null) completeness_score += 15;
    if (water_ml != null && water_ml > 0) completeness_score += 10;

    rows.push({
      date: key,
      sleep_minutes,
      water_ml,
      water_goal_ml,
      steps_count: steps,
      mood_value: mood?.moodValue ?? null,
      energy_level: mood?.energy ?? null,
      stress_level: mood?.stress ?? null,
      completeness_score,
    });
  }

  return rows;
}

function enrichInsightWithPersonalization(
  base: HealthyInsightResult,
  input: HealthyInsightInput
): HealthyInsightResult {
  const rows = buildSyntheticRows(input);
  const windows = getInsightPeriodWindows(input.period, input.todayKey);
  const currentRows = rows.filter((r) => r.date >= windows.current.start && r.date <= windows.current.end);
  const previousRows = rows.filter((r) => r.date >= windows.previous.start && r.date <= windows.previous.end);
  const profile = { sleep_goal_minutes: input.goalSleepMinutes, steps_goal: input.stepsGoal };
  const curSignals = computeWindowSignals(currentRows, profile);
  const prevSignals = computeWindowSignals(previousRows, profile);
  const dynamics = comparePeriodDynamics(curSignals, prevSignals, input.period);

  let metricLinks: string[] = [];
  let helpfulHabits: string[] = [];
  if (!base.lowData) {
    const minForLinks = input.period === 'month' ? 10 : input.period === 'week' ? 5 : 4;
    if (currentRows.length >= minForLinks) {
      const sorted = [...currentRows].sort((a, b) => a.date.localeCompare(b.date));
      metricLinks = buildMetricLinks(sorted, profile);
    }
    const minForHabits = input.period === 'month' ? 12 : input.period === 'week' ? 7 : 5;
    if (currentRows.length >= minForHabits) {
      const sorted = [...currentRows].sort((a, b) => a.date.localeCompare(b.date));
      helpfulHabits = buildHelpfulHabits(sorted, profile);
    }
  }

  const rationale = buildRationale({
    period: input.period,
    lowData: base.lowData,
    statusTone: base.statusTone,
    weakPoints: base.weakPoints,
    dynamicsLabel: dynamics.dynamicsLabel,
    dynamicsSummary: dynamics.dynamicsSummary,
  });

  const positiveHighlight = buildPositiveHighlight({
    lowData: base.lowData,
    statusTone: base.statusTone,
    strengths: base.strengths,
    weakPoints: base.weakPoints,
    dynamicsLabel: dynamics.dynamicsLabel,
  });

  const actionToday =
    input.period === 'day' && !base.lowData && base.recommendations[0]
      ? base.recommendations[0]
      : '';

  let monthlyDynamics = base.monthlyDynamics;
  if (input.period === 'month' && !base.lowData && dynamics.dynamicsSummary) {
    monthlyDynamics = [dynamics.dynamicsSummary, base.monthlyDynamics ?? ''].filter(Boolean).join(' ');
  }

  return {
    ...base,
    monthlyDynamics,
    dynamicsLabel: dynamics.dynamicsLabel,
    dynamicsSummary: dynamics.dynamicsSummary,
    vsPreviousPeriod: dynamics.vsPreviousPeriod,
    metricLinks,
    helpfulHabits,
    rationale,
    positiveHighlight,
    actionToday,
  };
}

export function buildHealthyInsight(input: HealthyInsightInput): HealthyInsightResult {
  const seed =
    input.todayKey.split('-').reduce((acc, x) => acc + parseInt(x, 10), 0) +
    (input.stepsToday % 97) +
    Math.round(input.waterIntakeMl % 51);

  let base: HealthyInsightResult;
  if (input.period === 'day') {
    base = buildDay(input, seed);
  } else if (input.period === 'week') {
    base = buildWeek(input, seed);
  } else {
    base = buildMonth(input, seed);
  }
  return enrichInsightWithPersonalization(base, input);
}

function dayDataSignals(input: HealthyInsightInput): {
  count: number;
  missing: string[];
} {
  const missing: string[] = [];
  const hasSleep =
    input.lastNightSleepMinutes != null || input.todaySleepRating != null;
  const hasMood = !!input.moodToday;
  const hasSteps = input.stepsToday > 200;
  const hasWaterLog = input.waterIntakeMl > 0;

  if (!hasSleep) missing.push('оценка сна');
  if (!hasMood) missing.push('настроение и самочувствие');
  if (!hasSteps) missing.push('шаги');
  if (!hasWaterLog) missing.push('вода (хотя бы одна отметка)');

  const count = [hasSleep, hasMood, hasSteps, hasWaterLog].filter(Boolean).length;
  return { count, missing };
}

function buildDay(input: HealthyInsightInput, seed: number): HealthyInsightResult {
  const { count, missing } = dayDataSignals(input);
  const lowData = count < 2;

  const weak: HealthyWeakPoint[] = [];
  const sm = sleepMinutesScore(input.lastNightSleepMinutes, input.goalSleepMinutes);
  if (sm !== null && sm < 1) weak.push({ id: 'sleep', label: weakLabel('sleep') });
  const wm = ratioScore(input.waterIntakeMl, input.waterGoalMl);
  if (wm !== null && wm < 1) weak.push({ id: 'water', label: weakLabel('water') });
  const tm = ratioScore(input.stepsToday, input.stepsGoal);
  if (tm !== null && tm < 1) weak.push({ id: 'steps', label: weakLabel('steps') });

  if (input.moodToday) {
    if (input.moodToday.moodValue < 40) weak.push({ id: 'mood', label: weakLabel('mood') });
    if (input.moodToday.energy === 'low') weak.push({ id: 'energy', label: weakLabel('energy') });
    if (input.moodToday.stress === 'high') weak.push({ id: 'stress', label: weakLabel('stress') });
  }

  const uniqWeak = weak.filter(
    (w, i, a) => a.findIndex((x) => x.id === w.id) === i
  ).slice(0, 2);

  const scores: number[] = [];
  if (sm != null) scores.push(sm);
  if (wm != null) scores.push(wm);
  if (tm != null) scores.push(tm);
  if (input.moodToday) {
    scores.push(input.moodToday.moodValue / 50);
    scores.push(2 - stressScore(input.moodToday.stress));
    scores.push(energyScore(input.moodToday.energy));
  }
  const mean = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 1;

  let statusLabel: string;
  let statusTone: HealthyStatusTone;
  if (lowData) {
    statusLabel = 'Мало данных';
    statusTone = 'neutral';
  } else if (mean >= 1.65 && uniqWeak.length === 0) {
    statusLabel = 'Отличный день';
    statusTone = 'positive';
  } else if (mean < 1.1 || uniqWeak.length >= 2) {
    statusLabel = 'Нужно внимание';
    statusTone = 'attention';
  } else {
    statusLabel = 'В балансе';
    statusTone = 'neutral';
  }

  let summary: string;
  if (lowData) {
    summary =
      'Данных пока недостаточно для точного вывода. Отметьте настроение, шаги или сон — картина станет яснее.';
  } else if (statusTone === 'positive') {
    summary =
      'Показатели в основном в хорошей зоне: вы держите полезный ритм для организма.';
  } else if (uniqWeak.length === 0) {
    summary =
      'День выглядит ровно: без ярких провалов по тем данным, что у нас есть.';
  } else if (uniqWeak.length === 1) {
    summary = `Есть зона внимания: ${uniqWeak[0].label.toLowerCase()}. Остальное выглядит терпимо.`;
  } else {
    summary =
      'Несколько направлений просят бережности — ниже короткие шаги, с которых можно начать.';
  }

  const recs: string[] = [];
  if (lowData) {
    recs.push(
      pick(BANK.recovery, seed),
      pick(BANK.water, seed + 1)
    );
  } else {
    const pool: (keyof typeof BANK)[] = [];
    if (uniqWeak.some((w) => w.id === 'sleep')) pool.push('sleep');
    if (uniqWeak.some((w) => w.id === 'water')) pool.push('water');
    if (uniqWeak.some((w) => w.id === 'steps')) pool.push('steps');
    if (uniqWeak.some((w) => w.id === 'stress')) pool.push('stress');
    if (uniqWeak.some((w) => w.id === 'mood' || w.id === 'energy')) pool.push('mood_energy');
    if (!pool.length) pool.push('recovery');
    recs.push(pick(BANK[pool[0]], seed));
    if (pool[1]) recs.push(pick(BANK[pool[1]], seed + 3));
    else if (statusTone !== 'positive') recs.push(pick(BANK.recovery, seed + 5));
  }

  const support =
    statusTone === 'positive'
      ? 'Хороший темп — продолжайте в том же духе, это уже привычка заботы о себе.'
      : lowData
        ? 'Маленькие отметки каждый день складываются в ясную картину — без спешки.'
        : 'Спокойные шаги важнее рывков: вы движетесь в правильном направлении.';

  return {
    period: 'day',
    lowData,
    missingHints: lowData ? missing.slice(0, 4) : [],
    statusLabel,
    statusTone,
    summary,
    weakPoints: lowData ? [] : uniqWeak,
    improved: [],
    worsened: [],
    recommendations: recs.slice(0, 2),
    supportMessage: support,
    strengths: [],
    weaknessesNarrative: [],
  };
}

function buildWeek(input: HealthyInsightInput, seed: number): HealthyInsightResult {
  const keys = keysLastNDays(7);
  const stepsByDate = new Map<string, number>();
  stepsByDate.set(input.todayKey, input.stepsToday);
  for (const h of input.stepsHistory) stepsByDate.set(h.date, h.steps);
  const stepsVals = keys.map((k) => stepsByDate.get(k) ?? 0);
  const stepsAvg = avg(stepsVals) ?? 0;

  const moodInWeek = keys
    .map((k) => (input.moodRecordsByDate[k] ? { key: k, ...input.moodRecordsByDate[k] } : null))
    .filter(Boolean) as (MoodSlice & { key: string })[];

  const ratingsInWeek = keys
    .map((k) => input.sleepRatingsByDate[k])
    .filter((x): x is SleepRating => !!x);

  const sleepSignal =
    input.avgSleep7DaysMinutes != null
      ? sleepMinutesScore(input.avgSleep7DaysMinutes, input.goalSleepMinutes)
      : null;

  const moodAvg =
    moodInWeek.length > 0 ? avg(moodInWeek.map((m) => m.moodValue)) : null;
  const stressHighDays = moodInWeek.filter((m) => m.stress === 'high').length;
  const energyLowDays = moodInWeek.filter((m) => m.energy === 'low').length;

  const waterOk = ratioScore(input.waterIntakeMl, input.waterGoalMl);

  let dataPoints = 0;
  if (stepsVals.some((s) => s > 200)) dataPoints++;
  if (moodInWeek.length >= 2) dataPoints++;
  if (ratingsInWeek.length >= 2) dataPoints++;
  if (sleepSignal != null) dataPoints++;
  if (waterOk != null) dataPoints++;

  const lowData = dataPoints < 2;

  const missing: string[] = [];
  if (moodInWeek.length < 2) missing.push('настроение (несколько дней подряд)');
  if (!stepsVals.some((s) => s > 200)) missing.push('шаги за неделю');
  if (sleepSignal == null) missing.push('стабильные данные сна за неделю');
  if (ratingsInWeek.length < 2) missing.push('оценки сна');

  const improved: string[] = [];
  const worsened: string[] = [];

  const firstHalf = avg(stepsVals.slice(4, 7));
  const secondHalf = avg(stepsVals.slice(0, 3));
  if (firstHalf != null && secondHalf != null && secondHalf > firstHalf * 1.08) {
    improved.push('Шаги: вторая половина недели активнее.');
  } else if (firstHalf != null && secondHalf != null && firstHalf > secondHalf * 1.08) {
    worsened.push('Шаги: к концу недели активность снизилась.');
  }

  if (moodInWeek.length >= 4) {
    const early = avg(moodInWeek.slice(0, 2).map((m) => m.moodValue));
    const late = avg(moodInWeek.slice(-2).map((m) => m.moodValue));
    if (early != null && late != null) {
      if (late > early + 8) improved.push('Настроение: к концу недели заметнее светлее.');
      if (early > late + 8) worsened.push('Настроение: к концу недели было тяжелее.');
    }
  }

  if (sleepSignal === 2 && ratingsInWeek.filter((r) => r === 'good').length >= 2) {
    improved.push('Сон ближе к цели по недельным данным.');
  } else if (sleepSignal != null && sleepSignal < 1) {
    worsened.push('Сон в среднем ниже желаемого объёма.');
  }

  if (stressHighDays >= 3) worsened.push('Стресс часто был повышенным.');
  if (energyLowDays >= 3) worsened.push('Энергии не хватало несколько дней.');

  const weak: HealthyWeakPoint[] = [];
  if (stepsAvg > 0 && ratioScore(stepsAvg, input.stepsGoal) === 0) {
    weak.push({ id: 'steps', label: weakLabel('steps') });
  }
  if (sleepSignal != null && sleepSignal < 1) weak.push({ id: 'sleep', label: weakLabel('sleep') });
  if (waterOk === 0) weak.push({ id: 'water', label: weakLabel('water') });
  if (stressHighDays >= 2) weak.push({ id: 'stress', label: weakLabel('stress') });
  if (moodAvg != null && moodAvg < 45) weak.push({ id: 'mood', label: weakLabel('mood') });

  const uniqWeak = weak.filter((w, i, a) => a.findIndex((x) => x.id === w.id) === i).slice(0, 2);

  let statusLabel: string;
  let statusTone: HealthyStatusTone;
  if (lowData) {
    statusLabel = 'Мало данных';
    statusTone = 'neutral';
  } else if (worsened.length === 0 && improved.length >= 2 && uniqWeak.length === 0) {
    statusLabel = 'Хорошая неделя';
    statusTone = 'positive';
  } else if (worsened.length >= 2 || uniqWeak.length >= 2) {
    statusLabel = 'Нужно внимание';
    statusTone = 'attention';
  } else {
    statusLabel = 'В балансе';
    statusTone = 'neutral';
  }

  let summary: string;
  if (lowData) {
    summary =
      'За неделю накопилось мало пересекающихся данных. Продолжайте отмечать самочувствие и активность — вывод станет точнее.';
  } else {
    summary =
      improved.length || worsened.length
        ? 'Есть и сильные стороны недели, и зоны, где можно смягчить нагрузку на организм.'
        : 'Неделя выглядит ровно: без резких провалов по доступным метрикам.';
  }

  const recs: string[] = [];
  if (lowData) {
    recs.push(pick(BANK.steps, seed), pick(BANK.water, seed + 2), pick(BANK.sleep, seed + 4));
  } else {
    const keysPool: (keyof typeof BANK)[] = [];
    if (uniqWeak.some((w) => w.id === 'sleep')) keysPool.push('sleep');
    if (uniqWeak.some((w) => w.id === 'water')) keysPool.push('water');
    if (uniqWeak.some((w) => w.id === 'steps')) keysPool.push('steps');
    if (uniqWeak.some((w) => w.id === 'stress')) keysPool.push('stress');
    if (!keysPool.length) keysPool.push('recovery', 'water', 'steps');
    recs.push(pick(BANK[keysPool[0]], seed));
    recs.push(pick(BANK[keysPool[1] ?? 'sleep'], seed + 1));
    recs.push(pick(BANK[keysPool[2] ?? 'stress'], seed + 2));
  }

  const weeklyFocus = lowData
    ? 'Соберите хотя бы 3–4 дня подряд данные по шагам и настроению.'
    : worsened.some((w) => w.includes('Стресс'))
      ? 'Мягкий фокус: стресс-менеджмент и восстановление между делами.'
      : uniqWeak.some((w) => w.id === 'sleep')
        ? 'Фокус недели: стабильный отход ко сну и комфортная обстановка вечером.'
        : 'Фокус недели: поддерживать ритм движения и воды без перегруза.';

  const support =
    statusTone === 'positive'
      ? 'Сильная неделя — закрепите то, что уже работает, без лишних изменений.'
      : 'Неделя — не экзамен. Один спокойный шаг за раз уже меняет картину.';

  return {
    period: 'week',
    lowData,
    missingHints: lowData ? missing : [],
    statusLabel,
    statusTone,
    summary,
    weakPoints: lowData ? [] : uniqWeak,
    improved: lowData ? [] : improved.slice(0, 2),
    worsened: lowData ? [] : worsened.slice(0, 2),
    recommendations: recs.slice(0, 3),
    supportMessage: support,
    weeklyFocus,
    strengths: [],
    weaknessesNarrative: [],
  };
}

function buildMonth(input: HealthyInsightInput, seed: number): HealthyInsightResult {
  const keys30 = keysLastNDays(30);
  const moodMonth = keys30
    .map((k) => input.moodRecordsByDate[k])
    .filter(Boolean) as MoodSlice[];
  const ratingsMonth = keys30
    .map((k) => input.sleepRatingsByDate[k])
    .filter((x): x is SleepRating => !!x);

  const stepsByDate = new Map<string, number>();
  stepsByDate.set(input.todayKey, input.stepsToday);
  for (const h of input.stepsHistory) stepsByDate.set(h.date, h.steps);
  const stepsVals7 = keysLastNDays(7).map((k) => stepsByDate.get(k) ?? 0);
  const stepsActiveDays = stepsVals7.filter((s) => s > 500).length;

  const dataPoints = moodMonth.length + ratingsMonth.length + (input.avgSleep7DaysMinutes != null ? 2 : 0);
  const lowData = moodMonth.length < 5 && ratingsMonth.length < 4;

  const missing: string[] = [];
  if (moodMonth.length < 5) missing.push('заметки о настроении за месяц');
  if (ratingsMonth.length < 4) missing.push('регулярные оценки сна');

  const moodAvg = moodMonth.length ? avg(moodMonth.map((m) => m.moodValue)) : null;
  const stressHighShare =
    moodMonth.length > 0 ? moodMonth.filter((m) => m.stress === 'high').length / moodMonth.length : 0;
  const energyLowShare =
    moodMonth.length > 0 ? moodMonth.filter((m) => m.energy === 'low').length / moodMonth.length : 0;

  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (moodAvg != null && moodAvg >= 55) strengths.push('Настроение в среднем стабильное или тёплое.');
  if (stepsActiveDays >= 5) strengths.push('Движение регулярно появляется в течение недели.');
  if (input.avgSleep7DaysMinutes != null && sleepMinutesScore(input.avgSleep7DaysMinutes, input.goalSleepMinutes) === 2) {
    strengths.push('Сон по последним данным близок к вашей цели.');
  }

  if (stressHighShare > 0.35) weaknesses.push('Стресс нередко поднимался — есть смысл планировать паузы.');
  if (energyLowShare > 0.35) weaknesses.push('Энергия часто была на низком уровне.');
  if (input.avgSleep7DaysMinutes != null && sleepMinutesScore(input.avgSleep7DaysMinutes, input.goalSleepMinutes) === 0) {
    weaknesses.push('Сон в среднем укладывается короче желаемого.');
  }

  let patternsLine: string | undefined;
  if (moodMonth.length >= 8) {
    patternsLine =
      'По настроению виден личный ритм: важнее не один пик, а то, как вы возвращаетесь к себе после нагрузок.';
  } else if (stepsActiveDays >= 1) {
    patternsLine =
      'По шагам доступна картина примерно за неделю — за месяц точнее будет с постоянной синхронизацией.';
  } else {
    patternsLine =
      'Пока мало повторяющихся точек данных, чтобы говорить о устойчивых паттернах.';
  }

  let statusLabel: string;
  let statusTone: HealthyStatusTone;
  if (lowData) {
    statusLabel = 'Мало данных';
    statusTone = 'neutral';
  } else if (strengths.length >= 2 && weaknesses.length === 0) {
    statusLabel = 'Устойчивый месяц';
    statusTone = 'positive';
  } else if (weaknesses.length >= 2) {
    statusLabel = 'Нужно внимание';
    statusTone = 'attention';
  } else {
    statusLabel = 'В балансе';
    statusTone = 'neutral';
  }

  const summary = lowData
    ? 'Для месячного снимка не хватает регулярных отметок. Продолжайте вести дневник самочувствия — анализ станет богаче.'
    : strengths.length > weaknesses.length
      ? 'За месяц прослеживается позитивная опора на привычки, которые вам подходят.'
      : 'Месяц показывает смешанную картину: есть пространство для мягкой подстройки ритма.';

  const recs: string[] = [];
  if (lowData) {
    recs.push(pick(BANK.mood_energy, seed), pick(BANK.sleep, seed + 2), pick(BANK.water, seed + 4));
  } else {
    if (weaknesses.some((w) => w.includes('Стресс'))) recs.push(pick(BANK.stress, seed));
    if (weaknesses.some((w) => w.includes('Энергия'))) recs.push(pick(BANK.mood_energy, seed + 1));
    if (weaknesses.some((w) => w.includes('Сон'))) recs.push(pick(BANK.sleep, seed + 2));
    if (recs.length < 2) recs.push(pick(BANK.recovery, seed + 3));
    if (recs.length < 3) recs.push(pick(BANK.steps, seed + 4));
  }

  const monthlyFocus = lowData
    ? 'Сфокусируйтесь на регулярных коротких отметках — это главный вклад в месячный анализ.'
    : stressHighShare > energyLowShare
      ? 'Фокус месяца: спокойные паузы и стресс-менеджмент в повседневном ритме.'
      : energyLowShare > 0.25
        ? 'Фокус месяца: восстановление и сон, чтобы энергия не «проседала» системно.'
        : 'Фокус месяца: поддерживать воду, сон и движение как базовую «подушку» самочувствия.';

  const support =
    statusTone === 'positive'
      ? 'Хорошая динамика — закрепляйте привычки, которые дают ощущение опоры.'
      : 'Месяц — дистанция; вы уже собираете данные, это само по себе шаг заботы о себе.';

  return {
    period: 'month',
    lowData,
    missingHints: lowData ? missing : [],
    statusLabel,
    statusTone,
    summary,
    weakPoints: [],
    improved: [],
    worsened: [],
    recommendations: recs.slice(0, 3),
    supportMessage: support,
    monthlyDynamics: lowData
      ? undefined
      : 'Динамика по доступным данным спокойная: без резких скачков, с понятными акцентами.',
    strengths: strengths.slice(0, 3),
    weaknessesNarrative: weaknesses.slice(0, 3),
    patternsLine,
    monthlyFocus,
  };
}
