/**
 * «Статистика задач»: the period filter and the words of the screens (ТЗ «Статистика задач
 * сотрудников», Figma «Статистика Задачника»). Every number comes from the server
 * (GET /user-tasks/stats); this module only chooses periods and phrases, so it stays pure.
 */

export type StatsPeriodKind = "week" | "month" | "custom";
export type StatsPeriod = { kind: StatsPeriodKind; from: string; to: string };
export type TaskPriority = "high" | "medium" | "low";

export type TaskStats = {
  employee: { id: number; full_name: string; position: string | null; department_name: string | null } | null;
  period: { from: string; to: string; as_of: string; ended: boolean };
  total: number;
  completed: number;
  not_completed: number;
  /** null when no task is due in the period: the percentage is not computed. */
  completion_percent: number | null;
  completed_on_time: number;
  completed_late: number;
  overdue: number;
  on_track: number;
  completed_in_period: number;
  without_due: number;
  daily: { date: string; completed: number }[];
  priorities: { priority: TaskPriority; total: number; completed: number }[];
};

export type StatsEmployee = { id: number; full_name: string; position: string | null };
export type StatsDepartment = {
  company_id: number;
  company_name: string;
  department_id: number | null;
  department_name: string;
  employees: StatsEmployee[];
};
export type StatsEmployeesScope = { can_view_employees: boolean; departments: StatsDepartment[] };

/** Fewer tasks than this make every task swing the percentage (Figma «Мало данных»). */
export const SMALL_SAMPLE = 5;

const MONTHS = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
const MONTHS_GENITIVE = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"];
const MONTHS_LOCATIVE = ["январе", "феврале", "марте", "апреле", "мае", "июне", "июле", "августе", "сентябре", "октябре", "ноябре", "декабре"];
const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
const WEEKDAYS_MON_FIRST = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

const pad = (value: number) => String(value).padStart(2, "0");

function parts(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map((part) => parseInt(part, 10));
  return { year, month: month - 1, day };
}

function keyOf(year: number, month: number, day: number): string {
  const date = new Date(Date.UTC(year, month, day));
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

function addDays(dateKey: string, days: number): string {
  const { year, month, day } = parts(dateKey);
  return keyOf(year, month, day + days);
}

/** The week (Monday to Sunday) holding the day. */
export function weekPeriod(dateKey: string): StatsPeriod {
  const { year, month, day } = parts(dateKey);
  const weekday = (new Date(Date.UTC(year, month, day)).getUTCDay() + 6) % 7;
  const from = addDays(dateKey, -weekday);
  return { kind: "week", from, to: addDays(from, 6) };
}

export function monthPeriod(dateKey: string): StatsPeriod {
  const { year, month } = parts(dateKey);
  return { kind: "month", from: keyOf(year, month, 1), to: keyOf(year, month + 1, 0) };
}

/** The same kind of period that holds the day, or the chosen dates as they are. */
export function periodOfKind(kind: StatsPeriodKind, dateKey: string): StatsPeriod {
  return kind === "month" ? monthPeriod(dateKey) : weekPeriod(dateKey);
}

/** The previous (−1) or the next (+1) week or month. Own dates do not move. */
export function shiftPeriod(period: StatsPeriod, delta: -1 | 1): StatsPeriod {
  if (period.kind === "week") return weekPeriod(addDays(period.from, 7 * delta));
  if (period.kind === "month") {
    const { year, month } = parts(period.from);
    return monthPeriod(keyOf(year, month + delta, 1));
  }
  return period;
}

/** Own dates: the earlier day first, whatever order they were picked in. */
export function customPeriod(a: string, b: string): StatsPeriod {
  return a <= b ? { kind: "custom", from: a, to: b } : { kind: "custom", from: b, to: a };
}

export function containsDay(period: StatsPeriod, dateKey: string): boolean {
  return period.from <= dateKey && dateKey <= period.to;
}

export function periodLengthDays(period: StatsPeriod): number {
  const { year: y1, month: m1, day: d1 } = parts(period.from);
  const { year: y2, month: m2, day: d2 } = parts(period.to);
  return Math.round((Date.UTC(y2, m2, d2) - Date.UTC(y1, m1, d1)) / 86_400_000) + 1;
}

/** «1–31 октября», «26 октября – 1 ноября», «28 декабря 2026 – 3 января 2027». */
export function rangeLabel({ from, to }: Pick<StatsPeriod, "from" | "to">): string {
  const a = parts(from);
  const b = parts(to);
  if (from === to) return `${a.day} ${MONTHS_GENITIVE[a.month]}`;
  if (a.year !== b.year) {
    return `${a.day} ${MONTHS_GENITIVE[a.month]} ${a.year} – ${b.day} ${MONTHS_GENITIVE[b.month]} ${b.year}`;
  }
  if (a.month === b.month) return `${a.day}–${b.day} ${MONTHS_GENITIVE[a.month]}`;
  return `${a.day} ${MONTHS_GENITIVE[a.month]} – ${b.day} ${MONTHS_GENITIVE[b.month]}`;
}

/** «26 окт – 1 ноя». */
export function shortRangeLabel({ from, to }: Pick<StatsPeriod, "from" | "to">): string {
  const a = parts(from);
  const b = parts(to);
  if (a.month === b.month && a.year === b.year) return `${a.day}–${b.day} ${MONTHS_SHORT[a.month]}`;
  return `${a.day} ${MONTHS_SHORT[a.month]} – ${b.day} ${MONTHS_SHORT[b.month]}`;
}

/** «01.10.2026». */
export function numericDate(dateKey: string): string {
  const { year, month, day } = parts(dateKey);
  return `${pad(day)}.${pad(month + 1)}.${year}`;
}

/** «1 октября» for the date fields of «Свои даты». */
export function dayMonthLabel(dateKey: string): string {
  const { month, day } = parts(dateKey);
  return `${day} ${MONTHS_GENITIVE[month]}`;
}

/** The title of the period switch: «Октябрь 2026», «26 окт – 1 ноя», «1–15 октября». */
export function periodTitle(period: StatsPeriod): string {
  if (period.kind === "month") {
    const { year, month } = parts(period.from);
    return `${MONTHS[month]} ${year}`;
  }
  if (period.kind === "week") return shortRangeLabel(period);
  return rangeLabel(period);
}

/** Where the tasks fall, in a sentence: «в октябре», «на этой неделе», «с 1 по 15 октября». */
export function periodPhrase(period: StatsPeriod, todayKey: string): string {
  if (period.kind === "month") return `в ${MONTHS_LOCATIVE[parts(period.from).month]}`;
  if (period.kind === "week" && containsDay(period, todayKey)) return "на этой неделе";
  if (period.from === period.to) return dayMonthLabel(period.from);
  const a = parts(period.from);
  const b = parts(period.to);
  return a.month === b.month && a.year === b.year
    ? `с ${a.day} по ${b.day} ${MONTHS_GENITIVE[b.month]}`
    : `с ${dayMonthLabel(period.from)} по ${dayMonthLabel(period.to)}`;
}

/** «Нет задач за эту неделю» / «за этот месяц» / «за этот период». */
export function emptyTitle(period: StatsPeriod): string {
  if (period.kind === "week") return "Нет задач за эту неделю";
  if (period.kind === "month") return "Нет задач за этот месяц";
  return "Нет задач за этот период";
}

/** The checkpoint of the numbers: «на текущий момент», or «на 30 сентября» for a period already over. */
export function asOfLabel(period: Pick<StatsPeriod, "to">, todayKey: string): string {
  return period.to < todayKey ? `на ${dayMonthLabel(period.to)}` : "на текущий момент";
}

/** «Выполнено за период»: where the completions were counted. */
export function completedInPeriodHint(period: StatsPeriod, todayKey: string): string {
  if (period.kind === "month") {
    return `Завершены ${periodPhrase(period, todayKey)}, даже если срок в другом месяце. Это не «Выполнено» выше`;
  }
  if (period.kind === "week" && containsDay(period, todayKey)) {
    return "Завершены на этой неделе, даже если срок вне её";
  }
  return `Завершены ${periodPhrase(period, todayKey)}, даже если срок вне этих дат. Это не «Выполнено» выше`;
}

/** Russian plural: 1 задача, 2 задачи, 5 задач. */
export function plural(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

/**
 * What the screen shows:
 * - `empty`: nothing due, completed or open without «Срок» — no numbers, no charts;
 * - `noDue`: no task due in the period, the percentage is «Не рассчитывается»;
 * - `data`: the percentage and the indicators, 0% included.
 */
export type StatsContent = "empty" | "noDue" | "data";

export function statsContent(stats: TaskStats): StatsContent {
  if (stats.total > 0) return "data";
  return stats.completed_in_period > 0 || stats.without_due > 0 ? "noDue" : "empty";
}

/** Share of a bar, 0…1, never NaN. */
export function share(part: number, whole: number): number {
  return whole > 0 ? Math.min(1, Math.max(0, part / whole)) : 0;
}

export type ChartTick = { index: number; label: string };

/**
 * Labels under «Динамика выполнения»: weekdays for a week, the 1st/8th/15th/22nd and the last day
 * of a month, the ends and the middle of own dates. `withMonth` adds «окт» to the ends (desktop).
 */
export function chartTicks(period: StatsPeriod, days: number, withMonth = false): ChartTick[] {
  if (days <= 0) return [];
  const label = (index: number, edge: boolean) => {
    const { month, day } = parts(addDays(period.from, index));
    return edge && withMonth ? `${day} ${MONTHS_SHORT[month]}` : String(day);
  };
  if (period.kind === "week" && days === 7) {
    return WEEKDAYS_MON_FIRST.map((name, index) => ({ index, label: name }));
  }
  if (period.kind === "month") {
    const ticks = [0, 7, 14, 21].filter((index) => index < days - 3).map((index) => ({ index, label: label(index, index === 0) }));
    return [...ticks, { index: days - 1, label: label(days - 1, true) }];
  }
  if (days === 1) return [{ index: 0, label: label(0, true) }];
  const middle = Math.floor((days - 1) / 2);
  const ticks = [{ index: 0, label: label(0, true) }];
  if (days > 4) ticks.push({ index: middle, label: label(middle, false) });
  ticks.push({ index: days - 1, label: label(days - 1, true) });
  return ticks;
}

/** «АН» for «Айгерим Нурланова». */
export function initials(fullName: string): string {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join("");
}

/** Employees whose name or position holds the query, departments without matches dropped. */
export function filterDepartments(departments: StatsDepartment[], query: string): StatsDepartment[] {
  const needle = query.trim().toLocaleLowerCase("ru");
  if (!needle) return departments;
  return departments
    .map((department) => ({
      ...department,
      employees: department.employees.filter((employee) =>
        `${employee.full_name} ${employee.position ?? ""}`.toLocaleLowerCase("ru").includes(needle),
      ),
    }))
    .filter((department) => department.employees.length > 0);
}
