import type { CommentDraft, MentionInput, TaskComment } from './types';

const timeOf = (iso: string) => {
  const ms = Date.parse(iso);
  return Number.isNaN(ms) ? 0 : ms;
};

/**
 * Порядок ленты: время создания, затем ID. Сервер различает микросекунды, а в ответе — миллисекунды,
 * поэтому комментарии одной миллисекунды упорядочены по ID. На полноту ленты это не влияет:
 * страницы склеиваются по ID, курсоры выдаёт сервер.
 */
export function compareComments(a: TaskComment, b: TaskComment): number {
  const byTime = timeOf(a.created_at) - timeOf(b.created_at);
  if (byTime !== 0) return byTime;
  if (a.id.length !== b.id.length) return a.id.length - b.id.length;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/**
 * Комментарии обоих списков, каждый ID один раз, в порядке ленты. Из двух версий одного комментария
 * остаётся более новая: версия только растёт, поэтому запоздалый ответ не откатит правку или удаление.
 * При равной версии берётся пришедшая: права и имя автора меняются без новой версии.
 */
export function mergeComments(current: readonly TaskComment[], incoming: readonly TaskComment[]): TaskComment[] {
  const byId = new Map<string, TaskComment>();
  for (const comment of current) byId.set(comment.id, comment);
  for (const comment of incoming) {
    const known = byId.get(comment.id);
    if (!known || comment.version >= known.version) byId.set(comment.id, comment);
  }
  return [...byId.values()].sort(compareComments);
}

/**
 * Лента после того, как перечитаны самые новые комментарии, — `fresh`, в порядке ленты.
 * Прочитанное заменяет свой диапазон, более новые версии из `current` сохраняются. Загруженные
 * комментарии новее самого старого прочитанного остаются: их записали после начала чтения.
 * Загруженные старше него отбрасываются: чтение остановилось раньше, и между ними и прочитанным
 * мог остаться пропуск.
 */
export function applyFresh(current: readonly TaskComment[], fresh: readonly TaskComment[]): TaskComment[] {
  if (!fresh.length) return [...current];
  const oldestRead = fresh[0];
  return mergeComments(current.filter((comment) => compareComments(comment, oldestRead) >= 0), fresh);
}

const mentionsKey = (mentions: readonly MentionInput[]) =>
  [...mentions]
    .sort((a, b) => a.start - b.start)
    .map((mention) => `${mention.user_id}:${mention.start}:${mention.end}`)
    .join(',');

/** Одно и то же содержимое: текст и упоминания, порядок упоминаний в массиве не важен. */
export function sameDraft(a: CommentDraft, b: CommentDraft): boolean {
  return a.text === b.text && mentionsKey(a.mentions) === mentionsKey(b.mentions);
}

/** Живой комментарий уже содержит этот черновик. */
export function holdsDraft(comment: TaskComment, draft: CommentDraft): boolean {
  return comment.deleted_at === null && comment.text !== null && sameDraft({ text: comment.text, mentions: comment.mentions }, draft);
}
