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

/** Что прочитает экранный диктор: автор, время, метка «изменено» и текст — или что комментарий удалён. */
export function commentAccessibilityLabel(comment: TaskComment, moment: string): string {
  const when = comment.edited_at && comment.deleted_at === null ? `${moment}, изменено` : moment;
  const body = comment.deleted_at !== null || comment.text === null ? 'комментарий удалён' : comment.text;
  return `${comment.author.full_name}, ${when}: ${body}`;
}

/**
 * Почему запись не прошла, словами для человека: ошибки полей точнее общего текста — например,
 * «Имя изменилось: выберите человека заново» вместо «Упоминание недоступно».
 */
export function failureText(failure: TaskCommentFailure): string {
  return failure.details.length ? failure.details.map((detail) => detail.message).join('. ') : failure.message;
}
