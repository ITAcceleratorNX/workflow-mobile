import { addCalendarDaysToDateKey, toAppDateKey, toUtcIsoFromAppDateTime } from "./dateTimeUtils";

/** Next calendar midnight in the application's timezone, independent of the device timezone. */
export function millisecondsUntilNextTaskDay(now: Date): number {
  const tomorrow = addCalendarDaysToDateKey(toAppDateKey(now), 1);
  return Math.max(1, Date.parse(toUtcIsoFromAppDateTime(tomorrow, "00:00")) - now.getTime());
}
