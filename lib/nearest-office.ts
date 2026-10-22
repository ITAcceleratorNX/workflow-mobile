import type { Office } from './api';

export interface Coordinates {
  lat: number;
  lon: number;
}

/**
 * Дальше этого офис не считается «рядом»: пользователь не в нём, и рекомендовать его нельзя.
 * Офисы в городе в нескольких километрах друг от друга, точность геолокации в здании — десятки метров.
 */
export const NEARBY_OFFICE_RADIUS_M = 1000;

/**
 * - `nearby` — ближайший офис в радиусе {@link NEARBY_OFFICE_RADIUS_M}, его можно выбрать;
 * - `far` — офисы с координатами есть, но все дальше радиуса: рекомендации нет;
 * - `no_coordinates` — ни у одного офиса нет координат, сравнивать не с чем.
 *
 * Офисы без координат не участвуют: «ближайший» считается только среди офисов на карте,
 * поэтому без радиуса единственный офис с координатами рекомендовался бы всем.
 */
export type NearestOffice =
  | { kind: 'nearby'; office: Office; distanceMeters: number }
  | { kind: 'far'; office: Office; distanceMeters: number }
  | { kind: 'no_coordinates' };

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(a: Coordinates, b: Coordinates): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRadians(b.lat - a.lat);
  const dLon = toRadians(b.lon - a.lon);
  const lat1 = toRadians(a.lat);
  const lat2 = toRadians(b.lat);

  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);

  const h =
    sinDLat * sinDLat +
    Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;

  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

/** Координата офиса из API: число или строка; пустое и `null` — координаты нет. */
function coordinate(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function findNearestOffice(offices: Office[], coords: Coordinates): NearestOffice {
  let best: { office: Office; distanceMeters: number } | null = null;

  for (const office of offices) {
    const lat = coordinate(office.lat);
    const lon = coordinate(office.lon);
    if (lat == null || lon == null) continue;
    const d = distanceMeters(coords, { lat, lon });
    if (!best || d < best.distanceMeters) best = { office, distanceMeters: d };
  }

  if (!best) return { kind: 'no_coordinates' };
  return best.distanceMeters <= NEARBY_OFFICE_RADIUS_M ? { kind: 'nearby', ...best } : { kind: 'far', ...best };
}

/** «120 м», «1,5 км». */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.max(10, Math.round(meters / 10) * 10)} м`;
  return `${(meters / 1000).toFixed(1).replace('.', ',')} км`;
}

/** Уведомление после «Определить ближайший офис»; ручной выбор офиса остаётся в любом случае. */
export function nearestOfficeNotice(result: NearestOffice): {
  title: string;
  description: string;
  variant: 'success' | 'default';
} {
  switch (result.kind) {
    case 'nearby':
      return {
        title: 'Ближайший офис',
        description: `${result.office.name} — около ${formatDistance(result.distanceMeters)} от вас`,
        variant: 'success',
      };
    case 'far':
      return {
        title: 'Рядом нет офиса',
        description: `Не нашли офис в радиусе ${formatDistance(NEARBY_OFFICE_RADIUS_M)} от вас. Выберите офис вручную.`,
        variant: 'default',
      };
    case 'no_coordinates':
      return {
        title: 'Не удалось определить офис',
        description: 'У офисов не указано расположение на карте. Выберите офис вручную.',
        variant: 'default',
      };
  }
}
