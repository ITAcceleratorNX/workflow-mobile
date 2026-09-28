import {
  addCalendarDaysToDateKey,
  formatDateOnly,
  formatTaskTime,
  toAppDateKey,
} from '@/lib/dateTimeUtils';

import type { TaskCommentFailure } from './errors';
import type { TaskComment, TaskCommentMention } from './types';

export interface TextSegment {
  text: string;
  /** Упоминание, которое этот кусок показывает; null — обычный текст. */
  mention: TaskCommentMention | null;
}

/**
 * Текст комментария по кускам: обычный текст и упоминания. Диапазоны — UTF-16, как индексы строк JS.
 * Диапазон вне текста или пересекающийся с предыдущим пропускается: его кусок останется обычным текстом.
 */
export function mentionSegments(text: string, mentions: readonly TaskCommentMention[]): TextSegment[] {
  const segments: TextSegment[] = [];
  let position = 0;
  for (const mention of [...mentions].sort((a, b) => a.start - b.start)) {
    if (mention.start < position || mention.end <= mention.start || mention.end > text.length) continue;
    if (mention.start > position) segments.push({ text: text.slice(position, mention.start), mention: null });
    segments.push({ text: text.slice(mention.start, mention.end), mention });
    position = mention.end;
  }
  if (position < text.length) segments.push({ text: text.slice(position), mention: null });
  return segments;
}

/** Дата и время комментария в часовом поясе приложения: «Сегодня, 14:05», «Вчера, 09:30», «24.09.2026, 18:00». */
export function formatCommentMoment(iso: string, now: Date = new Date()): string {
  const time = formatTaskTime(iso);
  const day = toAppDateKey(iso);
  if (!day || !time) return '';
  const today = toAppDateKey(now);
  if (day === today) return `Сегодня, ${time}`;
  if (day === addCalendarDaysToDateKey(today, -1)) return `Вчера, ${time}`;
  return `${formatDateOnly(iso)}, ${time}`;
}

/** Первая буква имени для аватара; эмодзи и суррогатные пары не разрываются. */
export function authorInitial(fullName: string): string {
  const [first] = Array.from(fullName.trim());
  return first ? first.toUpperCase() : '?';
}

/** Что остаётся в ленте на месте удалённого комментария. */
export const DELETED_COMMENT_TEXT = 'Комментарий удалён';

/** Удалён ли комментарий и изменён ли. У удалённого метки «изменено» нет: текста больше нет. */
export function commentState(comment: TaskComment): { deleted: boolean; edited: boolean } {
  const deleted = comment.deleted_at !== null || comment.text === null;
  return { deleted, edited: !deleted && comment.edited_at !== null };
}

const CHANGING_LABEL = { edit: 'сохраняется…', delete: 'удаляется…' } as const;

/** Строка под комментарием: «Сегодня, 14:05 · изменено · сохраняется…». */
export function commentMeta(comment: TaskComment, moment: string, changing: 'edit' | 'delete' | null = null): string {
  const { edited } = commentState(comment);
  return [moment, edited ? 'изменено' : null, changing ? CHANGING_LABEL[changing] : null].filter(Boolean).join(' · ');
}

/**
 * Что человек может сделать с комментарием: только со своим и не удалённым и только то, что
 * разрешил сервер. Чужой комментарий действий не открывает, даже если права пришли в ответе.
 */
export function ownCommentActions(comment: TaskComment, currentUserId: number | null): { edit: boolean; remove: boolean } {
  const own = currentUserId !== null && comment.author.id === currentUserId && !commentState(comment).deleted;
  return { edit: own && comment.permissions.can_edit, remove: own && comment.permissions.can_delete };
}

/** Что прочитает экранный диктор: автор, время, метка «изменено» и текст — или что комментарий удалён. */
export function commentAccessibilityLabel(comment: TaskComment, moment: string): string {
  const { deleted, edited } = commentState(comment);
  const when = edited ? `${moment}, изменено` : moment;
  return `${comment.author.full_name}, ${when}: ${deleted ? DELETED_COMMENT_TEXT.toLowerCase() : comment.text}`;
}

/**
 * Почему запись не прошла, словами для человека: ошибки полей точнее общего текста — например,
 * «Имя изменилось: выберите человека заново» вместо «Упоминание недоступно».
 */
export function failureText(failure: TaskCommentFailure): string {
  return failure.details.length ? failure.details.map((detail) => detail.message).join('. ') : failure.message;
}
