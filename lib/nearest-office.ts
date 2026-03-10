import type { Office } from './api';

export interface Coordinates {
  lat: number;
  lon: number;
}

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

export function findNearestOffice(
  offices: Office[],
  coords: Coordinates
): Office | null {
  if (!offices.length) return null;

  // Поддерживаем и number, и string координаты из API
  const candidates = offices
    .map((o) => {
      const lat = o.lat != null ? Number(o.lat) : NaN;
      const lon = o.lon != null ? Number(o.lon) : NaN;
      if (Number.isNaN(lat) || Number.isNaN(lon)) return null;
      return { office: o, lat, lon };
    })
    .filter((x): x is { office: Office; lat: number; lon: number } => x !== null);

  // Если ни у одного офиса нет валидных координат — хотя бы вернём первый как fallback
  if (candidates.length === 0) {
    return offices[0] ?? null;
  }

  let best: Office | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const { office, lat, lon } of candidates) {
    const d = distanceMeters(coords, { lat, lon });
    if (d < bestDistance) {
      bestDistance = d;
      best = office;
    }
  }

  return best;
}


