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
