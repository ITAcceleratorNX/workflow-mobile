/**
 * Типы API комментариев к пользовательским задачам — контракт task-comments.v1 из workflow-service
 * (docs/task-comments-contract.md, docs/contracts/task-comments.openapi.yaml).
 */

export interface TaskCommentAuthor {
  /** null, если учётная запись удалена; тогда `full_name` — подпись на момент записи. */
  id: number | null;
  full_name: string;
}

export interface TaskCommentMention {
  /** null, если упомянутая учётная запись удалена. */
  user_id: number | null;
  /** Полуинтервал `[start, end)` в UTF-16 code units: `@` и имя. */
  start: number;
  end: number;
  /** Подпись, сохранённая сервером. */
  label: string;
}

export interface TaskComment {
  /** BIGINT десятичной строкой. */
  id: string;
  task_id: number;
  author: TaskCommentAuthor;
  /** null у удалённого комментария: его текст больше не приходит никому. */
  text: string | null;
  /** Пусто у удалённого комментария. */
  mentions: TaskCommentMention[];
  created_at: string;
  updated_at: string;
  /** Метка «изменено». */
  edited_at: string | null;
  deleted_at: string | null;
  /** Растёт с каждым изменением и удалением. */
  version: number;
  /** Можно ли текущему пользователю изменить и удалить комментарий — решает сервер. */
  permissions: { can_edit: boolean; can_delete: boolean };
}

/** Упоминание в отправляемом тексте. `user_id: null` — только сохранённое упоминание удалённой учётной записи при правке. */
export interface MentionInput {
  user_id: number | null;
  start: number;
  end: number;
}

/** Текст и упоминания нового или изменённого комментария. */
export interface CommentDraft {
  text: string;
  mentions: MentionInput[];
}

export interface CommentPage {
  /** По времени создания: сначала старые. */
  items: TaskComment[];
  /** Курсор более старых комментариев; null, если их нет. */
  next_cursor: string | null;
  has_more: boolean;
  /** Можно ли текущему пользователю писать в задачу. */
  permissions: { can_comment: boolean };
}

export interface MentionCandidate {
  id: number;
  full_name: string;
  position: string | null;
}

export interface MentionCandidatePage {
  items: MentionCandidate[];
  next_cursor: string | null;
  has_more: boolean;
}
