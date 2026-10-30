import { test } from "node:test";
import assert from "node:assert/strict";
import {
  appendToComment,
  bookingWeek,
  busyIntervals,
  checkBookingTime,
  equipmentIconKey,
  formatBookingDay,
  formatDuration,
  freeSegments,
  maskTimeInput,
  officeHours,
  suggestFreeSlots,
  toIso,
  type TimeCheck,
} from "../booking-flow";

const reasonOf = (check: TimeCheck) => (check.ok ? "ok" : check.reason);
const messageOf = (check: TimeCheck) => (check.ok ? "" : check.message);

const hours = { start: 8 * 60, end: 18 * 60 };
const busy = [{ start: 12 * 60, end: 13 * 60 }, { start: 15 * 60 + 30, end: 16 * 60 + 30 }];

test("masks the time input as HH:MM", () => {
  assert.equal(maskTimeInput("1"), "1");
  assert.equal(maskTimeInput("10"), "10");
  assert.equal(maskTimeInput("101"), "10:1");
  assert.equal(maskTimeInput("10:15"), "10:15");
  assert.equal(maskTimeInput("101599"), "10:15");
});

test("checks duration, step, office hours and busy time like the backend", () => {
  assert.deepEqual(checkBookingTime({ from: "10:15", to: "11:45", hours, busy }), { ok: true, duration: 90 });
  assert.equal(reasonOf(checkBookingTime({ from: "10:15", to: "11:", hours, busy })), "incomplete");
  assert.equal(reasonOf(checkBookingTime({ from: "10:10", to: "11:00", hours, busy })), "step");
  assert.equal(reasonOf(checkBookingTime({ from: "11:00", to: "10:00", hours, busy })), "order");
  // Без верхней границы: несколько часов и весь рабочий день, если время свободно.
  assert.deepEqual(checkBookingTime({ from: "08:00", to: "12:00", hours, busy }), { ok: true, duration: 240 });
  assert.deepEqual(checkBookingTime({ from: "08:00", to: "18:00", hours, busy: [] }), { ok: true, duration: 600 });
  assert.equal(reasonOf(checkBookingTime({ from: "09:00", to: "14:00", hours, busy })), "busy");
  assert.equal(reasonOf(checkBookingTime({ from: "07:30", to: "08:30", hours, busy })), "hours");
  assert.equal(reasonOf(checkBookingTime({ from: "09:00", to: "09:30", hours, busy, nowMinutes: 10 * 60 })), "past");
  const taken = checkBookingTime({ from: "11:30", to: "12:30", hours, busy });
  assert.equal(reasonOf(taken), "busy");
  assert.equal(messageOf(taken), "12:00–13:00 уже занято");
  // Встык к занятому — можно.
  assert.equal(checkBookingTime({ from: "13:00", to: "14:00", hours, busy }).ok, true);
});

test("suggests free windows next to a taken time (as in the design)", () => {
  assert.deepEqual(suggestFreeSlots({ start: 11 * 60 + 30, end: 12 * 60 + 30, hours, busy }), [
    { start: 11 * 60 + 30, end: 12 * 60 },
    { start: 13 * 60, end: 14 * 60 },
  ]);
  // Начало внутри занятого: конец предыдущего свободного отрезка и следующий.
  assert.deepEqual(suggestFreeSlots({ start: 12 * 60 + 15, end: 12 * 60 + 45, hours, busy }), [
    { start: 11 * 60 + 30, end: 12 * 60 },
    { start: 13 * 60, end: 13 * 60 + 30 },
  ]);
  assert.deepEqual(freeSegments(hours, busy, 12 * 60 + 40), [
    { start: 13 * 60, end: 15 * 60 + 30 },
    { start: 16 * 60 + 30, end: 18 * 60 },
  ]);
});

test("builds the booking week with weekends and past days disabled", () => {
  // 2026-10-21 (среда), 10:00 по Алматы.
  const week = bookingWeek(new Date("2026-10-21T10:00:00+05:00"));
  assert.deepEqual(week.map((d) => `${d.weekday} ${d.day} ${d.disabled ? "-" : "+"}`), [
    "Пн 19 -", "Вт 20 -", "Ср 21 +", "Чт 22 +", "Пт 23 +", "Сб 24 -", "Вс 25 -",
  ]);
  assert.equal(bookingWeek(new Date("2026-10-21T10:00:00+05:00"), 1)[0].date, "2026-10-26");
  assert.equal(formatBookingDay("2026-10-21"), "Ср, 21 октября");
});

test("reads busy intervals and office hours in Almaty time", () => {
  assert.deepEqual(
    busyIntervals("2026-10-21", [{ start_time: "2026-10-21T07:00:00.000Z", end_time: "2026-10-21T08:00:00.000Z" }]),
    [{ start: 12 * 60, end: 13 * 60 }],
  );
  assert.deepEqual(officeHours({ working_hours_start: "09:30:00", working_hours_end: "17:00:00" }), { start: 570, end: 1020 });
  assert.deepEqual(officeHours(null), { start: 480, end: 1080 });
  assert.equal(toIso("2026-10-21", 10 * 60 + 15), "2026-10-21T05:15:00.000Z");
  assert.equal(formatDuration(90), "1 ч 30 мин");
  assert.equal(formatDuration(30), "30 мин");
  assert.equal(formatDuration(120), "2 ч");
});

test("adds quick wishes to the comment once and maps equipment icons", () => {
  assert.equal(appendToComment("", "Вода"), "Вода");
  assert.equal(appendToComment("Вода", "Доп. стулья"), "Вода, доп. стулья");
  assert.equal(appendToComment("Вода, доп. стулья", "Доп. стулья"), "Вода, доп. стулья");
  assert.equal(equipmentIconKey("ТВ 65″"), "screen");
  assert.equal(equipmentIconKey("Видеосвязь"), "video");
  assert.equal(equipmentIconKey("Маркерная доска"), "board");
  assert.equal(equipmentIconKey("Кофемашина"), "custom");
});
