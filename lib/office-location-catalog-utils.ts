/** Строка каталога локаций офиса (с бэкенда). */
export interface OfficeLocationCatalogRow {
  id: number;
  office_id: number;
  block: string;
  floor_zone: string;
  room: string;
  sort_order?: number;
  is_active?: boolean;
}

function activeRows(rows: OfficeLocationCatalogRow[]): OfficeLocationCatalogRow[] {
  return rows.filter((r) => r.is_active !== false);
}

export function getBlocksFromCatalog(rows: OfficeLocationCatalogRow[]): string[] {
  const blocks = activeRows(rows).map((r) => r.block);
  return Array.from(new Set(blocks));
}

export function getFloorZonesForBlock(rows: OfficeLocationCatalogRow[], block: string): string[] {
  const zones = activeRows(rows)
    .filter((r) => r.block === block)
    .map((r) => r.floor_zone);
  return Array.from(new Set(zones)).filter((z) => z !== '');
}

export function getRoomsForFloorZone(
  rows: OfficeLocationCatalogRow[],
  block: string,
  floorZone: string
): string[] {
  const rooms = activeRows(rows)
    .filter(
      (r) => r.block === block && (r.floor_zone === floorZone || floorZone === '')
    )
    .map((r) => r.room);
  return Array.from(new Set(rooms)).filter((room) => room !== '');
}

export function hasFloorZonesForBlock(rows: OfficeLocationCatalogRow[], block: string): boolean {
  return activeRows(rows).some(
    (r) => r.block === block && r.floor_zone !== ''
  );
}

export function hasRoomsForFloorZone(
  rows: OfficeLocationCatalogRow[],
  block: string,
  floorZone: string
): boolean {
  return activeRows(rows).some(
    (r) =>
      r.block === block &&
      r.floor_zone === floorZone &&
      r.room !== ''
  );
}

export function formatLocationBlockLabel(block: string): string {
  const trimmed = block?.trim();
  return trimmed ? `Блок ${trimmed}` : 'Без блока';
}

export function locationCatalogSearchHaystack(row: OfficeLocationCatalogRow): string {
  return [row.block, row.floor_zone, row.room, String(row.sort_order ?? '')]
    .join(' ')
    .toLowerCase();
}

export type LocationCatalogSection = {
  blockKey: string;
  blockLabel: string;
  data: OfficeLocationCatalogRow[];
};

export type LocationVisibilityFilter = 'all' | 'active' | 'hidden';

export type LocationCatalogSort = 'order' | 'room' | 'block';

export type BlockFilterOption = {
  key: string;
  label: string;
  count: number;
};

export type FloorFilterOption = {
  key: string;
  label: string;
  count: number;
};

export function getBlockFilterOptions(rows: OfficeLocationCatalogRow[]): BlockFilterOption[] {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = row.block?.trim() ?? '';
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b, 'ru');
    })
    .map(([key, count]) => ({
      key,
      label: formatLocationBlockLabel(key),
      count,
    }));
}

export function getFloorFilterOptions(
  rows: OfficeLocationCatalogRow[],
  blockKey: string | null
): FloorFilterOption[] {
  if (blockKey == null) return [];
  const counts = new Map<string, number>();
  for (const row of rows) {
    const rowBlock = row.block?.trim() ?? '';
    if (rowBlock !== blockKey) continue;
    const floor = row.floor_zone?.trim() ?? '';
    counts.set(floor, (counts.get(floor) ?? 0) + 1);
  }
  return Array.from(counts.entries())
    .sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b, 'ru');
    })
    .map(([key, count]) => ({
      key,
      label: key || 'Без этажа',
      count,
    }));
}

function sortLocationRows(a: OfficeLocationCatalogRow, b: OfficeLocationCatalogRow, sort: LocationCatalogSort) {
  if (sort === 'room') {
    const roomCmp = (a.room ?? '').localeCompare(b.room ?? '', 'ru');
    if (roomCmp !== 0) return roomCmp;
  } else if (sort === 'block') {
    const blockCmp = (a.block ?? '').localeCompare(b.block ?? '', 'ru');
    if (blockCmp !== 0) return blockCmp;
  }
  const orderDiff = (a.sort_order ?? 0) - (b.sort_order ?? 0);
  if (orderDiff !== 0) return orderDiff;
  const blockCmp = (a.block ?? '').localeCompare(b.block ?? '', 'ru');
  if (blockCmp !== 0) return blockCmp;
  const floorCmp = (a.floor_zone ?? '').localeCompare(b.floor_zone ?? '', 'ru');
  if (floorCmp !== 0) return floorCmp;
  return (a.room ?? '').localeCompare(b.room ?? '', 'ru');
}

export function buildLocationCatalogSections(
  rows: OfficeLocationCatalogRow[],
  options: {
    searchQuery?: string;
    visibility?: LocationVisibilityFilter;
    blockKey?: string | null;
    floorKey?: string | null;
    sortBy?: LocationCatalogSort;
  } = {}
): LocationCatalogSection[] {
  const query = (options.searchQuery ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
  const visibility = options.visibility ?? 'all';
  const sortBy = options.sortBy ?? 'order';

  let list = [...rows];

  if (visibility === 'active') {
    list = list.filter((r) => r.is_active !== false);
  } else if (visibility === 'hidden') {
    list = list.filter((r) => r.is_active === false);
  }

  if (options.blockKey != null) {
    list = list.filter((r) => (r.block?.trim() ?? '') === options.blockKey);
  }

  if (options.floorKey != null && options.blockKey != null) {
    list = list.filter((r) => (r.floor_zone?.trim() ?? '') === options.floorKey);
  }

  if (query) {
    list = list.filter((r) => locationCatalogSearchHaystack(r).includes(query));
  }

  list.sort((a, b) => sortLocationRows(a, b, sortBy));

  const byBlock = new Map<string, OfficeLocationCatalogRow[]>();
  for (const item of list) {
    const key = item.block?.trim() || '';
    if (!byBlock.has(key)) byBlock.set(key, []);
    byBlock.get(key)!.push(item);
  }

  return Array.from(byBlock.entries())
    .sort(([a], [b]) => {
      if (!a && b) return 1;
      if (a && !b) return -1;
      return a.localeCompare(b, 'ru');
    })
    .map(([blockKey, data]) => ({
      blockKey,
      blockLabel: formatLocationBlockLabel(blockKey),
      data,
    }));
}

export function countLocationCatalogStats(rows: OfficeLocationCatalogRow[]) {
  const active = rows.filter((r) => r.is_active !== false).length;
  const hidden = rows.length - active;
  const blocks = new Set(rows.map((r) => r.block?.trim() || '').filter(Boolean)).size;
  return { total: rows.length, active, hidden, blocks };
}
