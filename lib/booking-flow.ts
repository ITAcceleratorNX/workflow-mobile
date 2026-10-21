/**
 * Логика сценария брони переговорной (web), без React: даты недели, время по маске ЧЧ:ММ,
 * проверки длительности / часов офиса / занятости и подсказки свободных окон.
 * Правила — как на бэкенде: 15–120 минут с шагом 15, будни, часы офиса, время Алматы (+05:00).
 */

export const BOOKING_STEP_MINUTES = 15;
export const BOOKING_MIN_MINUTES = 15;
export const BOOKING_MAX_MINUTES = 120;
export const BOOKING_COMMENT_MAX = 300;
export const BOOKING_UTC_OFFSET = "+05:00";
const OFFSET_MS = 5 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

const DEFAULT_OPEN = 8 * 60;
const DEFAULT_CLOSE = 18 * 60;

export const COMMENT_QUICK_ADDS = ["Вода", "Доп. стулья", "Проектор"] as const;

export interface Interval {
  start: number;
  end: number;
}

/** "08:00:00" | "8:00" → минуты от начала дня; null, если строка не время. */
export function parseTime(value: string | null | undefined): number | null {
  const match = /^(\d{1,2}):(\d{2})/.exec(String(value ?? "").trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

/** Маска ввода времени: оставляет до 4 цифр и ставит двоеточие — «1015» → «10:15». */
export function maskTimeInput(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h} ч ${m} мин`;
  return h ? `${h} ч` : `${m} мин`;
}

export function officeHours(office?: { working_hours_start?: string | null; working_hours_end?: string | null } | null): Interval {
  return {
    start: parseTime(office?.working_hours_start) ?? DEFAULT_OPEN,
    end: parseTime(office?.working_hours_end) ?? DEFAULT_CLOSE,
  };
}

/** Календарный день брони (YYYY-MM-DD) момента `date` по времени Алматы. */
export function almatyDay(date: Date | number): string {
  return new Date(new Date(date).getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/** Минуты от начала дня по Алматы. */
export function almatyMinutes(value: string | Date | number): number {
  const local = new Date(new Date(value).getTime() + OFFSET_MS);
  return local.getUTCHours() * 60 + local.getUTCMinutes();
}

/** ISO-строка момента: день брони + минуты по Алматы. */
export function toIso(day: string, minutes: number): string {
  return new Date(`${day}T${formatTime(minutes)}:00${BOOKING_UTC_OFFSET}`).toISOString();
}

const WEEKDAY_SHORT = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const WEEKDAY_LONG = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"];
const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

export interface BookingDay {
  date: string;
  weekday: string;
  day: number;
  /** Прошедший день или выходной — бронировать нельзя. */
  disabled: boolean;
}

function weekdayOf(day: string): number {
  return new Date(`${day}T12:00:00Z`).getUTCDay();
}

/** Неделя Пн–Вс, сдвинутая на `weekOffset` от текущей; выходные и прошедшие дни недоступны. */
export function bookingWeek(now: Date | number, weekOffset = 0): BookingDay[] {
  const today = almatyDay(now);
  const todayWeekday = weekdayOf(today);
  const monday = new Date(Date.parse(`${today}T12:00:00Z`) - ((todayWeekday + 6) % 7) * DAY_MS + weekOffset * 7 * DAY_MS);
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(monday.getTime() + i * DAY_MS).toISOString().slice(0, 10);
    const weekday = weekdayOf(date);
    return {
      date,
      weekday: WEEKDAY_SHORT[weekday],
      day: Number(date.slice(8, 10)),
      disabled: date < today || weekday === 0 || weekday === 6,
    };
  });
}

/** Первый день недели, который можно выбрать (или null, если вся неделя недоступна). */
export function firstBookableDay(week: BookingDay[]): string | null {
  return week.find((d) => !d.disabled)?.date ?? null;
}

/** «Ср, 21 октября». */
export function formatBookingDay(day: string): string {
  const [, month, date] = day.split("-").map(Number);
  return `${WEEKDAY_LONG[weekdayOf(day)]}, ${date} ${MONTHS_GENITIVE[month - 1]}`;
}

/** Занятые интервалы дня (минуты по Алматы) из броней ответа доступности, по возрастанию. */
export function busyIntervals(day: string, bookings: { start_time: string | Date; end_time: string | Date }[]): Interval[] {
  return bookings
    .map((b) => {
      const startDay = almatyDay(new Date(b.start_time));
      const endDay = almatyDay(new Date(b.end_time));
      return {
        start: startDay < day ? 0 : almatyMinutes(b.start_time),
        end: endDay > day ? 24 * 60 : almatyMinutes(b.end_time),
      };
    })
    .filter((i) => i.end > i.start)
    .sort((a, b) => a.start - b.start);
}

export type TimeCheck =
  | { ok: true; duration: number }
  | { ok: false; reason: "incomplete" | "format" | "step" | "order" | "min" | "max" | "hours" | "past"; message: string }
  | { ok: false; reason: "busy"; message: string; conflicts: Interval[] };

/**
 * Проверка выбранного времени. `nowMinutes` — текущее время, если выбран сегодняшний день
 * (раньше него начать нельзя).
 */
export function checkBookingTime(params: {
  from: string;
  to: string;
  hours: Interval;
  busy: Interval[];
  nowMinutes?: number | null;
}): TimeCheck {
  const { from, to, hours, busy, nowMinutes } = params;
  if (from.length < 5 || to.length < 5) {
    return { ok: false, reason: "incomplete", message: to.length < 5 ? "Введите время окончания" : "Введите время начала" };
  }
  const start = parseTime(from);
  const end = parseTime(to);
  if (start === null || end === null) return { ok: false, reason: "format", message: "Время в формате ЧЧ:ММ" };
  if (start % BOOKING_STEP_MINUTES || end % BOOKING_STEP_MINUTES) {
    return { ok: false, reason: "step", message: "Время с шагом 15 минут: :00, :15, :30, :45" };
  }
  if (end <= start) return { ok: false, reason: "order", message: "Окончание должно быть позже начала" };
  const duration = end - start;
  if (duration < BOOKING_MIN_MINUTES) return { ok: false, reason: "min", message: "Минимум 15 минут" };
  if (duration > BOOKING_MAX_MINUTES) return { ok: false, reason: "max", message: "Максимум 2 часа" };
  if (start < hours.start || end > hours.end) {
    return { ok: false, reason: "hours", message: `Офис работает ${formatTime(hours.start)}–${formatTime(hours.end)}` };
  }
  if (nowMinutes != null && start < nowMinutes) {
    return { ok: false, reason: "past", message: "Это время уже прошло" };
  }
  const conflicts = busy.filter((b) => b.start < end && b.end > start);
  if (conflicts.length) {
    return {
      ok: false,
      reason: "busy",
      message: `${conflicts.map((c) => `${formatTime(c.start)}–${formatTime(c.end)}`).join(", ")} уже занято`,
      conflicts,
    };
  }
  return { ok: true, duration };
}

/** Свободные отрезки дня внутри часов офиса (с учётом «сейчас» для сегодняшнего дня). */
export function freeSegments(hours: Interval, busy: Interval[], nowMinutes?: number | null): Interval[] {
  const segments: Interval[] = [];
  let cursor = hours.start;
  if (nowMinutes != null) {
    cursor = Math.max(cursor, Math.ceil(nowMinutes / BOOKING_STEP_MINUTES) * BOOKING_STEP_MINUTES);
  }
  for (const b of busy) {
    if (b.end <= cursor) continue;
    if (b.start > cursor) segments.push({ start: cursor, end: Math.min(b.start, hours.end) });
    cursor = Math.max(cursor, b.end);
    if (cursor >= hours.end) break;
  }
  if (cursor < hours.end) segments.push({ start: cursor, end: hours.end });
  return segments.filter((s) => s.end - s.start >= BOOKING_MIN_MINUTES);
}

/**
 * «Свободно рядом» (до двух окон, не длиннее запрошенной длительности и 2 часов):
 * 1) если начало свободно — от начала до ближайшей занятости, иначе конец предыдущего свободного отрезка;
 * 2) первый свободный отрезок после начала.
 */
export function suggestFreeSlots(params: {
  start: number;
  end: number;
  hours: Interval;
  busy: Interval[];
  nowMinutes?: number | null;
}): Interval[] {
  const { start, end, hours, busy, nowMinutes } = params;
  const wanted = Math.min(Math.max(end - start, BOOKING_MIN_MINUTES), BOOKING_MAX_MINUTES);
  const segments = freeSegments(hours, busy, nowMinutes);
  const result: Interval[] = [];
  const containing = segments.find((s) => s.start <= start && start < s.end);
  if (containing) {
    const slot = { start, end: Math.min(containing.end, start + wanted) };
    if (slot.end - slot.start >= BOOKING_MIN_MINUTES) result.push(slot);
  } else {
    const before = [...segments].reverse().find((s) => s.end <= start);
    if (before) result.push({ start: Math.max(before.start, before.end - wanted), end: before.end });
  }
  const after = segments.find((s) => s.start > start);
  if (after) result.push({ start: after.start, end: Math.min(after.end, after.start + wanted) });
  return result.filter((slot) => slot.end - slot.start >= BOOKING_MIN_MINUTES).slice(0, 2);
}

/** Добавить быструю фразу в комментарий (через запятую), не превышая лимит. */
export function appendToComment(comment: string, phrase: string): string {
  const trimmed = comment.trim();
  if (trimmed.toLowerCase().includes(phrase.toLowerCase())) return comment;
  const next = trimmed ? `${trimmed.replace(/[,.;]$/, "")}, ${phrase.toLowerCase()}` : phrase;
  return next.slice(0, BOOKING_COMMENT_MAX);
}

/** Готовые пункты оборудования (Администратор отмечает их у переговорной). */
export const EQUIPMENT_PRESETS = [
  "Проектор",
  "ТВ / экран",
  "Видеосвязь",
  "Маркерная доска",
  "Флипчарт",
  "Колонки и микрофон",
  "Розетки",
  "Кондиционер",
] as const;

export const EQUIPMENT_CUSTOM_MAX = 30;

export type EquipmentIconKey =
  | "projector" | "screen" | "video" | "board" | "flipchart" | "audio" | "power" | "climate" | "custom";

/** Иконка пункта оборудования по названию (свои пункты — звёздочка). */
export function equipmentIconKey(name: string): EquipmentIconKey {
  const n = name.toLowerCase();
  if (n.includes("проектор")) return "projector";
  if (n.includes("видео")) return "video";
  if (n.includes("тв") || n.includes("экран") || n.includes("телевизор") || n.includes("монитор")) return "screen";
  if (n.includes("флипчарт")) return "flipchart";
  if (n.includes("доск")) return "board";
  if (n.includes("колонк") || n.includes("микрофон") || n.includes("звук")) return "audio";
  if (n.includes("розетк")) return "power";
  if (n.includes("кондиционер") || n.includes("климат")) return "climate";
  return "custom";
}

export function isPresetEquipment(name: string): boolean {
  return EQUIPMENT_PRESETS.some((p) => p.toLowerCase() === name.trim().toLowerCase());
}
