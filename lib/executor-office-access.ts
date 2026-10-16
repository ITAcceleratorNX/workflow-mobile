/**
 * Настройка «Офис» Исполнителя: один, несколько выбранных офисов или «Все офисы».
 * Определяет, на заявки каких офисов Исполнителя можно назначить. Основной офис
 * (users.office_id) по-прежнему задаёт категории услуг и Офис-менеджера.
 */
export interface ExecutorOfficeAccess {
  all_offices: boolean;
  office_ids: number[];
}

function toPositiveInt(value: unknown): number | null {
  const n = typeof value === 'string' ? Number(value) : value;
  return typeof n === 'number' && Number.isInteger(n) && n > 0 ? n : null;
}

/**
 * Читает настройку из пользователя API (`user.executor.all_offices`,
 * `user.executor.executorOffices[].office_id`) или из Исполнителя (`office_access`).
 * Без выбранных офисов (Исполнитель создан до настройки) открыт основной офис.
 */
export function readExecutorOfficeAccess(
  raw: unknown,
  primaryOfficeId?: number | null,
): ExecutorOfficeAccess | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  const source =
    o.office_access && typeof o.office_access === 'object'
      ? (o.office_access as Record<string, unknown>)
      : o.executor && typeof o.executor === 'object'
        ? (o.executor as Record<string, unknown>)
        : null;
  if (!source) return null;

  if (source.all_offices === true) return { all_offices: true, office_ids: [] };

  const list = Array.isArray(source.office_ids)
    ? source.office_ids
    : Array.isArray(source.executorOffices)
      ? source.executorOffices.map((row) =>
          row && typeof row === 'object' ? (row as Record<string, unknown>).office_id : row,
        )
      : [];
  const ids: number[] = [];
  for (const value of list) {
    const id = toPositiveInt(value);
    if (id != null && !ids.includes(id)) ids.push(id);
  }
  const primary = toPositiveInt(primaryOfficeId ?? null);
  if (ids.length === 0 && primary != null) ids.push(primary);
  return { all_offices: false, office_ids: ids.sort((a, b) => a - b) };
}

/** Переключает офис в выборе. При «Все офисы» выбор отдельного офиса снимает этот режим. */
export function toggleExecutorOffice(
  access: ExecutorOfficeAccess,
  officeId: number,
): ExecutorOfficeAccess {
  if (access.all_offices) return { all_offices: false, office_ids: [officeId] };
  const has = access.office_ids.includes(officeId);
  const office_ids = has
    ? access.office_ids.filter((id) => id !== officeId)
    : [...access.office_ids, officeId].sort((a, b) => a - b);
  return { all_offices: false, office_ids };
}

export function isExecutorOfficeAccessValid(access: ExecutorOfficeAccess): boolean {
  return access.all_offices || access.office_ids.length > 0;
}

export function sameExecutorOfficeAccess(
  a: ExecutorOfficeAccess | null | undefined,
  b: ExecutorOfficeAccess | null | undefined,
): boolean {
  if (!a || !b) return a === b;
  if (a.all_offices !== b.all_offices) return false;
  if (a.all_offices) return true;
  const sa = [...a.office_ids].sort((x, y) => x - y);
  const sb = [...b.office_ids].sort((x, y) => x - y);
  return sa.length === sb.length && sa.every((id, i) => id === sb[i]);
}

/** Подпись для карточки: «Все офисы», название офиса или «N офисов». */
export function formatExecutorOfficeAccess(
  access: ExecutorOfficeAccess | null | undefined,
  offices: { id: number; name: string }[],
): string {
  if (!access) return '';
  if (access.all_offices) return 'Все офисы';
  const names = access.office_ids
    .map((id) => offices.find((o) => Number(o.id) === id)?.name)
    .filter((n): n is string => Boolean(n));
  if (names.length === 0) return '';
  if (names.length <= 2) return names.join(', ');
  const n = names.length;
  const mod10 = n % 10;
  const mod100 = n % 100;
  const word =
    mod10 === 1 && mod100 !== 11
      ? 'офис'
      : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
        ? 'офиса'
        : 'офисов';
  return `${n} ${word}`;
}

/** Открыт ли Исполнителю офис заявки. */
export function executorAccessCoversOffice(
  access: ExecutorOfficeAccess | null | undefined,
  officeId: number | null | undefined,
): boolean {
  if (!access || officeId == null) return false;
  return access.all_offices || access.office_ids.includes(Number(officeId));
}
