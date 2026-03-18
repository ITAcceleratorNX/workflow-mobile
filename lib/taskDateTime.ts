import type { DateInput } from '@/lib/dateTimeUtils';

const APP_TIMEZONE = 'Asia/Almaty';

function toDate(value: DateInput): Date | null {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Returns YYYY-MM-DD in Asia/Almaty for a given ISO/date.
 * Useful when a UTC ISO crosses day boundary in local timezone.
 */
export function toAppDateKey(value: DateInput): string {
  const date = toDate(value);
  if (!date) return '';
  try {
    const fmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // en-CA yields YYYY-MM-DD
    return fmt.format(date);
  } catch {
    // Fallback: device-local calendar day
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}

function getOffsetMinutesInAppTz(utcDate: Date): number {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(utcDate);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
    const y = Number(get('year'));
    const m = Number(get('month'));
    const d = Number(get('day'));
    const hh = Number(get('hour'));
    const mm = Number(get('minute'));
    const ss = Number(get('second'));

    const asUtcMs = Date.UTC(y, m - 1, d, hh, mm, ss);
    return Math.round((asUtcMs - utcDate.getTime()) / 60000);
  } catch {
    // Fallback: assume Asia/Almaty is UTC+6 without DST
    return 6 * 60;
  }
}

/**
 * Build a UTC ISO string from an app-local dateKey (YYYY-MM-DD) and time (HH:mm),
 * interpreting them as Asia/Almaty local time.
 */
export function toUtcIsoFromAppDateTime(dateKey: string, time: string): string {
  const [yS, mS, dS] = (dateKey || '').split('-');
  const [hhS, mmS] = (time || '').split(':');
  const y = Number(yS);
  const m = Number(mS);
  const d = Number(dS);
  const hh = Number(hhS);
  const mm = Number(mmS);
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d) || !Number.isFinite(hh) || !Number.isFinite(mm)) {
    return new Date().toISOString();
  }

  // Guess: treat desired local components as if they were UTC, then compute timezone offset at that instant.
  const guessUtc = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offsetMin = getOffsetMinutesInAppTz(guessUtc);
  const utcMs = Date.UTC(y, m - 1, d, hh, mm, 0) - offsetMin * 60000;
  return new Date(utcMs).toISOString();
}

