/**
 * Координаты офиса в форме администратора. Те же правила, что в kcell-service-front
 * `lib/office-management-utils.ts` и на бэкенде: широта и долгота только парой.
 */

/** Широта и долгота офиса, как они набраны в форме. */
export type OfficeCoordinatesInput = { lat: string; lon: string };

const LIMITS = { lat: { label: 'Широта', max: 90 }, lon: { label: 'Долгота', max: 180 } } as const;

type CoordinateValue = number | string | null | undefined;

/** Поля формы из офиса: API отдаёт NUMERIC строкой или числом, пусто — координат нет. */
export function officeCoordinatesInput(office: { lat?: CoordinateValue; lon?: CoordinateValue }): OfficeCoordinatesInput {
  return { lat: office.lat == null ? '' : String(office.lat), lon: office.lon == null ? '' : String(office.lon) };
}

export function hasOfficeCoordinates(office: { lat?: CoordinateValue; lon?: CoordinateValue }): boolean {
  return office.lat != null && office.lon != null && office.lat !== '' && office.lon !== '';
}

function parseCoordinate(
  field: keyof OfficeCoordinatesInput,
  text: string
): { ok: true; value: number | null } | { ok: false; error: string } {
  const t = text.trim().replace(',', '.');
  if (t === '') return { ok: true, value: null };
  const { label, max } = LIMITS[field];
  const n = Number(t);
  if (!Number.isFinite(n) || Math.abs(n) > max) return { ok: false, error: `${label} — число от −${max} до ${max}` };
  return { ok: true, value: n };
}

/**
 * Координаты из формы — только парой. Обе пустые — координат нет, и офис не участвует
 * в «Определить ближайший офис».
 */
export function parseOfficeCoordinates(
  input: OfficeCoordinatesInput
): { ok: true; lat: number | null; lon: number | null } | { ok: false; error: string } {
  const lat = parseCoordinate('lat', input.lat);
  if (!lat.ok) return lat;
  const lon = parseCoordinate('lon', input.lon);
  if (!lon.ok) return lon;
  if ((lat.value === null) !== (lon.value === null)) {
    return { ok: false, error: 'Укажите широту и долготу вместе или очистите обе' };
  }
  return { ok: true, lat: lat.value, lon: lon.value };
}

/**
 * «43.214868, 76.872067» — так точку копируют Google Maps и 2ГИС: широта и долгота одной строкой.
 * Оба числа с точкой: «43,2» в одном поле — это десятичная запятая, а не пара.
 */
export function splitCoordinatesPair(text: string): OfficeCoordinatesInput | null {
  const m = /^\s*(-?\d{1,3}\.\d+)\s*[,;\s]\s*(-?\d{1,3}\.\d+)\s*$/.exec(text);
  return m ? { lat: m[1], lon: m[2] } : null;
}

/** Точка на карте — администратор проверяет, что координаты указывают на здание офиса. */
export function coordinatesMapUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lon}`;
}
