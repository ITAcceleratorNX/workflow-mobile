/**
 * Контракт API опросов (workflow-service, docs/surveys-plan.md, swagger «Survey»). Даты — ISO-строки.
 */

export type SurveyQuestionType = "single_choice" | "multiple_choice" | "rating" | "yes_no" | "text";
export type SurveyStatus = "draft" | "published" | "closed";
/** Опрос глазами клиента: «Пройдено» остаётся и после завершения опроса. */
export type ClientSurveyState = "available" | "completed" | "closed";

export type SurveyErrorCode =
  | "SURVEY_NOT_FOUND"
  | "SURVEY_NOT_DRAFT"
  | "SURVEY_NOT_READY"
  | "SURVEY_NOT_PUBLISHED"
  | "SURVEY_CLOSED"
  | "SURVEY_OFFICE_NOT_FOUND"
  | "SURVEY_ALREADY_COMPLETED"
  | "SURVEY_ANSWERS_INVALID"
  | "SURVEY_ANONYMOUS";

export interface SurveyOption {
  id: number;
  text: string;
}

/** Вопрос для прохождения: варианты — у «Один / Несколько вариантов» и «Да / Нет», подписи — у оценки. */
export interface SurveyQuestion {
  id: number;
  type: SurveyQuestionType;
  text: string;
  scale_min_label: string | null;
  scale_max_label: string | null;
  options: SurveyOption[];
}

// ─── Клиент ────────────────────────────────────────────────────────────────

export interface ClientSurvey {
  id: number;
  title: string;
  description: string | null;
  /** Увидит ли Администратор имя клиента рядом с ответами. */
  is_anonymous: boolean;
  questions_count: number;
  estimated_minutes: number | null;
  published_at: string;
  state: ClientSurveyState;
  completed_at: string | null;
}

/** Вопросы приходят, только пока опрос доступен. */
export interface ClientSurveyDetail extends ClientSurvey {
  questions: SurveyQuestion[];
}

/** Ответ на вопрос: варианты (и «Да / Нет»), оценка 1–5 или текст до 500 символов. */
export type SurveyAnswerInput =
  | { question_id: number; option_ids: number[] }
  | { question_id: number; rating: number }
  | { question_id: number; text: string };

export interface SurveySubmission {
  /** UUID попытки: повтор тех же ответов после обрыва связи не создаёт второй результат. */
  client_request_id: string;
  answers: SurveyAnswerInput[];
}

// ─── Администратор ─────────────────────────────────────────────────────────

export interface AdminSurvey {
  id: number;
  title: string;
  description: string | null;
  status: SurveyStatus;
  is_anonymous: boolean;
  all_offices: boolean;
  offices: { id: number; name: string }[];
  questions_count: number;
  estimated_minutes: number | null;
  responses_count: number;
  created_at: string;
  updated_at: string;
  published_at: string | null;
  closed_at: string | null;
}

export interface AdminSurveyQuestion {
  id: number;
  position: number;
  type: SurveyQuestionType;
  text: string;
  scale_min_label: string | null;
  scale_max_label: string | null;
  options: { id: number; position: number; text: string }[];
}

export interface AdminSurveyDetail extends AdminSurvey {
  questions: AdminSurveyQuestion[];
}

/** Вопрос черновика: варианты — только у «Один / Несколько вариантов», подписи — только у оценки. */
export type SurveyQuestionDraft =
  | { type: "single_choice" | "multiple_choice"; text: string; options: string[] }
  | { type: "rating"; text: string; scale_min_label?: string | null; scale_max_label?: string | null }
  | { type: "yes_no" | "text"; text: string };

/** Черновик целиком: POST создаёт, PUT заменяет сохранённый. */
export interface SurveyDraftInput {
  title: string;
  description?: string | null;
  is_anonymous?: boolean;
  /** «Все офисы» — тогда office_ids пуст. */
  all_offices?: boolean;
  office_ids?: number[];
  questions?: SurveyQuestionDraft[];
}

export interface SurveyRespondent {
  id: number;
  full_name: string;
}

interface QuestionResultBase {
  id: number;
  position: number;
  text: string;
  answered_count: number;
}

export type SurveyQuestionResult =
  | (QuestionResultBase & {
      type: "single_choice" | "multiple_choice" | "yes_no";
      options: { id: number; text: string; count: number; percent: number }[];
    })
  | (QuestionResultBase & {
      type: "rating";
      /** Один знак после запятой; null без ответов. */
      average: number | null;
      scale_min_label: string | null;
      scale_max_label: string | null;
      distribution: { value: number; count: number; percent: number }[];
    })
  | (QuestionResultBase & {
      type: "text";
      /** Новые сверху; автор — только в именном опросе. */
      answers: { text: string; respondent: SurveyRespondent | null }[];
    });

export interface SurveyResults {
  survey: AdminSurvey;
  questions: SurveyQuestionResult[];
}

export type NamedAnswer =
  | { question_id: number; options: SurveyOption[] }
  | { question_id: number; rating: number }
  | { question_id: number; text: string };

export interface NamedResponse {
  id: number;
  /** null — аккаунт удалён, ответы остались. */
  respondent: SurveyRespondent | null;
  submitted_at: string;
  answers: NamedAnswer[];
}

export interface NamedResponsesPage {
  responses: NamedResponse[];
  page: number;
  limit: number;
  total: number;
}
