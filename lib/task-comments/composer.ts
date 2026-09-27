import type { TaskCommentFailure } from './errors';
import type { CommentDraft, MentionInput, TaskComment } from './types';

/** Пределы контракта: длина текста в кодовых точках и число упоминаний. */
export const MAX_TEXT_CODE_POINTS = 5000;
export const MAX_MENTIONS = 20;
/** С какой длины показывать счётчик символов. */
export const COUNTER_FROM = 4500;

export const EMPTY_DRAFT: CommentDraft = Object.freeze({ text: '', mentions: [] as MentionInput[] });

/**
 * Черновик после изменения текста. Что изменилось, видно из сравнения прежнего и нового текста:
 * набранный или стёртый символ, вставка, замена выделенного. Упоминания до и после изменения
 * сохраняют человека и сдвигаются; упоминание, которого изменение коснулось, становится
 * обычным текстом — его текст больше не имя.
 */
export function applyTextChange(draft: CommentDraft, text: string): CommentDraft {
  const before = draft.text;
  if (before === text) return draft;
  const shortest = Math.min(before.length, text.length);
  let prefix = 0;
  while (prefix < shortest && before.charCodeAt(prefix) === text.charCodeAt(prefix)) prefix += 1;
  let suffix = 0;
  while (
    suffix < shortest &&
    before.charCodeAt(before.length - 1 - suffix) === text.charCodeAt(text.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  const shift = text.length - before.length;
  // Одно и то же изменение объясняется несколькими местами, если рядом одинаковые символы:
  // из «@Анна и @Пётр» стёрли «@Анна и » или «Анна и @». Берём место, которое сохраняет больше упоминаний.
  const ambiguous = Math.max(0, prefix + suffix - shortest);
  let kept: MentionInput[] | null = null;
  for (let start = prefix; start >= prefix - ambiguous; start -= 1) {
    const changedEnd = before.length - Math.min(suffix, shortest - start);
    const mentions = draft.mentions.flatMap((mention) => {
      if (mention.end <= start) return [mention];
      if (mention.start >= changedEnd) return [{ ...mention, start: mention.start + shift, end: mention.end + shift }];
      return [];
    });
    if (kept === null || mentions.length > kept.length) kept = mentions;
  }
  return { text, mentions: kept ?? [] };
}

/**
 * Где курсор после изменения текста — в конце вставленного. Платформы сообщают курсор отдельно и в
 * разном порядке с текстом, а веб при наборе не сообщает вовсе; точное значение уточнит событие выделения.
 */
export function caretAfterChange(before: string, after: string): number {
  const shortest = Math.min(before.length, after.length);
  let prefix = 0;
  while (prefix < shortest && before.charCodeAt(prefix) === after.charCodeAt(prefix)) prefix += 1;
  let suffix = 0;
  while (
    suffix < shortest - prefix &&
    before.charCodeAt(before.length - 1 - suffix) === after.charCodeAt(after.length - 1 - suffix)
  ) {
    suffix += 1;
  }
  return after.length - suffix;
}

export interface MentionQuery {
  /** Где стоит @. */
  start: number;
  /** Курсор: конец набранного запроса. */
  end: number;
  /** Что набрано после @. */
  query: string;
}

/** Длиннее запрос не считается упоминанием: человек пишет дальше обычный текст. */
const QUERY_MAX_LENGTH = 50;
const QUERY_MAX_SPACES = 3;
/** После чего @ начинает упоминание, а не часть слова или адреса почты. */
const BEFORE_MENTION = /[\s([{«"'„“]/;

/**
 * Упоминание, которое набирается у курсора: от @ в начале слова до курсора, в одну строку,
 * не внутри уже выбранного упоминания. ФИО состоит из слов, поэтому пробелы в запросе допустимы.
 */
export function mentionQueryAt(draft: CommentDraft, cursor: number): MentionQuery | null {
  const { text } = draft;
  if (cursor < 1 || cursor > text.length) return null;
  const at = text.lastIndexOf('@', cursor - 1);
  if (at === -1 || (at > 0 && !BEFORE_MENTION.test(text[at - 1]))) return null;
  const query = text.slice(at + 1, cursor);
  if (query.length > QUERY_MAX_LENGTH || /[\r\n]/.test(query) || /^\s/.test(query)) return null;
  if ((query.match(/\s+/g) ?? []).length > QUERY_MAX_SPACES) return null;
  if (draft.mentions.some((mention) => at < mention.end && cursor > mention.start)) return null;
  return { start: at, end: cursor, query };
}

/**
 * Выбранный человек вместо набранного запроса: «@ФИО» и пробел, упоминание привязано к его ID.
 * Подпись — текущее ФИО из поиска: сервер сверит её с именем в тексте.
 */
export function insertMention(
  draft: CommentDraft,
  query: MentionQuery,
  person: { id: number; full_name: string }
): { draft: CommentDraft; cursor: number } {
  const token = `@${person.full_name}`;
  const after = draft.text.slice(query.end);
  // Пробел нужен, если дальше слово или конец текста; перед пробелом и знаком препинания — нет.
  const spacer = /^[\s.,!?;:)\]}»"']/.test(after) ? '' : ' ';
  const text = draft.text.slice(0, query.start) + token + spacer + after;
  const shift = token.length + spacer.length - (query.end - query.start);
  const mentions = draft.mentions
    .map((mention) => (mention.start >= query.end ? { ...mention, start: mention.start + shift, end: mention.end + shift } : mention))
    .concat({ user_id: person.id, start: query.start, end: query.start + token.length })
    .sort((a, b) => a.start - b.start);
  // Курсор — после пробела за упоминанием, вставленного или уже стоявшего; перед знаком препинания.
  const skipped = spacer || /^\s/.test(after) ? 1 : 0;
  return { draft: { text, mentions }, cursor: query.start + token.length + skipped };
}

/** Видимое содержимое: не пробелы, не управляющие и не невидимые символы форматирования. */
const VISIBLE = /[^\s\u0000-\u001f\u007f-\u009f\u00ad\u200b-\u200f\u2028-\u202e\u2060-\u206f\ufeff]/;

export interface ComposerCheck {
  /** Длина в кодовых точках: эмодзи — один символ, как считает сервер. */
  length: number;
  blank: boolean;
  tooLong: boolean;
  tooManyMentions: boolean;
  canSend: boolean;
}

export function checkDraft(draft: CommentDraft): ComposerCheck {
  const length = Array.from(draft.text).length;
  const blank = !VISIBLE.test(draft.text);
  const tooLong = length > MAX_TEXT_CODE_POINTS;
  const tooManyMentions = draft.mentions.length > MAX_MENTIONS;
  return { length, blank, tooLong, tooManyMentions, canSend: !blank && !tooLong && !tooManyMentions };
}

/** Черновик правки своего комментария: его текст и упоминания, в том числе сохранённые прежние. */
export function draftFromComment(comment: TaskComment): CommentDraft {
  return {
    text: comment.text ?? '',
    mentions: comment.mentions.map(({ user_id: userId, start, end }) => ({ user_id: userId, start, end })),
  };
}

/**
 * Текст правки как новое сообщение. Упоминание удалённой учётной записи можно только сохранить
 * в прежнем комментарии, поэтому в новом оно остаётся обычным текстом.
 */
export function asNewMessage(draft: CommentDraft): CommentDraft {
  return { text: draft.text, mentions: draft.mentions.filter((mention) => mention.user_id !== null) };
}

/**
 * Черновик без упоминаний, которые сервер отклонил: в ошибке поле `mentions.<номер в запросе>`
 * или его часть (`mentions.0.end`). Их текст остаётся, человека можно выбрать заново.
 */
export function withoutRejectedMentions(draft: CommentDraft, failure: TaskCommentFailure): CommentDraft {
  const rejected = new Set(
    failure.details.flatMap((detail) => {
      const match = /^mentions\.(\d+)(?:\.|$)/.exec(detail.field);
      return match ? [Number(match[1])] : [];
    })
  );
  if (!rejected.size) return draft;
  return { text: draft.text, mentions: draft.mentions.filter((_, index) => !rejected.has(index)) };
}
