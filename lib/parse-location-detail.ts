/**
 * Разбирает `location_detail` из API (формат создания заявки) на отдельные поля.
 * Пример: «Блок: А, Местонахождение: 2 этаж, Помещение: Санузел М»
 */
export interface ParsedLocationFields {
  block?: string;
  floor?: string;
  room?: string;
  extra?: string;
}

const PREFIX_TO_FIELD: Record<string, keyof Omit<ParsedLocationFields, 'extra'>> = {
  Блок: 'block',
  Местонахождение: 'floor',
  Этаж: 'floor',
  Помещение: 'room',
  Кабинет: 'room',
};

export function parseLocationDetail(detail: string | undefined | null): ParsedLocationFields {
  const trimmed = detail?.trim();
  if (!trimmed) return {};

  const result: ParsedLocationFields = {};
  const unparsed: string[] = [];

  for (const part of trimmed.split(/,\s*/)) {
    const segment = part.trim();
    if (!segment) continue;

    const colonIdx = segment.indexOf(':');
    if (colonIdx > 0) {
      const key = segment.slice(0, colonIdx).trim();
      const value = segment.slice(colonIdx + 1).trim();
      const field = PREFIX_TO_FIELD[key];
      if (field && value) {
        result[field] = value;
      } else if (value || segment) {
        unparsed.push(segment);
      }
    } else {
      unparsed.push(segment);
    }
  }

  if (unparsed.length > 0) {
    result.extra = unparsed.join(', ');
  }

  return result;
}
