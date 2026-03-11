/**
 * Утилиты для уведомлений: парсинг ID заявок из контента (как в kcell-service-front).
 */

/** Сегмент контента: текст или кликабельный ID заявки */
export type ContentSegment =
  | { type: 'text'; value: string }
  | { type: 'requestId'; value: string; requestGroupId: number };

/** Один паттерн: № 123, № 123/1, заявка № 123, подзаявка № 123/1 */
const REQUEST_ID_REGEX = /(?:заявк[аи]\s*|подзаявк[аи]\s*)?№\s*(\d+)(?:\/(\d+))?/gi;

/**
 * Извлекает ID заявок из контента уведомления.
 * Поддерживает: "№ 123", "№ 123/1", "заявка № 123", "подзаявка № 123/1".
 * @returns массив уникальных строк вида "123" или "123/1"
 */
export function parseRequestIdsFromContent(content: string): string[] {
  if (!content) return [];
  const found = new Set<string>();
  let match;
  const re = new RegExp(REQUEST_ID_REGEX.source, REQUEST_ID_REGEX.flags);
  while ((match = re.exec(content)) !== null) {
    const full = match[2] != null ? `${match[1]}/${match[2]}` : match[1];
    found.add(full);
  }
  return Array.from(found);
}

/**
 * Разбивает контент на сегменты: обычный текст и кликабельные ID заявок.
 * Для перехода в приложении используем requestGroupId (первое число: 123 из "123/1").
 */
export function getContentSegmentsWithRequestIds(content: string): ContentSegment[] {
  if (!content) return [];
  const segments: ContentSegment[] = [];
  let lastIndex = 0;
  const re = new RegExp(REQUEST_ID_REGEX.source, REQUEST_ID_REGEX.flags);
  let match;
  while ((match = re.exec(content)) !== null) {
    const groupId = match[1];
    const subId = match[2];
    const requestGroupId = parseInt(groupId, 10);
    if (!Number.isFinite(requestGroupId)) continue;
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    segments.push({
      type: 'requestId',
      value: subId != null ? `${groupId}/${subId}` : groupId,
      requestGroupId,
    });
    lastIndex = re.lastIndex;
  }
  if (lastIndex < content.length) {
    segments.push({ type: 'text', value: content.slice(lastIndex) });
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: content }];
}
