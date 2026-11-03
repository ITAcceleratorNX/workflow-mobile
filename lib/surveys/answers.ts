import type { SurveyAnswerInput, SurveyQuestion } from "./types";

/**
 * Ответы клиента до отправки: черновик по вопросам, проверка «есть ли допустимый ответ» и то, что
 * уходит на сервер. Правила те же, что у backend (services/surveys/surveySubmission.js), — сервер
 * не откажет в ответах, которые экран пропустил.
 */

export const ANSWER_TEXT_LIMIT = 500;

// Видимый символ: не пробел, не управляющий, не невидимый (ZWSP, ZWJ…) — как на сервере.
const VISIBLE = /[^\p{White_Space}\p{Control}\p{Default_Ignorable_Code_Point}]/u;

export type AnswerDraft = { optionIds: number[] } | { rating: number } | { text: string };
/** Черновик ответов по id вопроса. */
export type AnswersDraft = Readonly<Record<number, AnswerDraft>>;

/** Символы так, как их считает сервер (кодовые точки): счётчик «86 / 500». */
export const answerTextLength = (text: string) => [...text].length;

/**
 * Ответ после нажатия на вариант: «Один вариант» и «Да / Нет» заменяют выбор, «Несколько вариантов»
 * переключает вариант; варианты — в своём порядке.
 */
export function chooseOption(question: SurveyQuestion, answer: AnswerDraft | undefined, optionId: number): AnswerDraft {
  if (question.type !== "multiple_choice") return { optionIds: [optionId] };
  const chosen = new Set(answer && "optionIds" in answer ? answer.optionIds : []);
  if (chosen.has(optionId)) chosen.delete(optionId);
  else chosen.add(optionId);
  return { optionIds: question.options.map((option) => option.id).filter((id) => chosen.has(id)) };
}

/** Есть ли у вопроса ответ, который примет сервер: «Далее» и «Отправить» ждут его — ответы обязательны. */
export function isAnswered(question: SurveyQuestion, answer: AnswerDraft | undefined): answer is AnswerDraft {
  if (!answer) return false;
  switch (question.type) {
    case "rating":
      return "rating" in answer && Number.isInteger(answer.rating) && answer.rating >= 1 && answer.rating <= 5;
    case "text":
      return "text" in answer && VISIBLE.test(answer.text) && answerTextLength(answer.text.trim()) <= ANSWER_TEXT_LIMIT;
    case "multiple_choice":
      return "optionIds" in answer && answer.optionIds.length > 0;
    default:
      return "optionIds" in answer && answer.optionIds.length === 1;
  }
}

/** Первый вопрос без ответа — куда вернуть клиента; -1, если ответы есть на все. */
export function firstUnanswered(questions: SurveyQuestion[], answers: AnswersDraft): number {
  return questions.findIndex((question) => !isAnswered(question, answers[question.id]));
}

/** Ответы для отправки в порядке вопросов; null, пока не на все вопросы есть ответ. */
export function submissionAnswers(questions: SurveyQuestion[], answers: AnswersDraft): SurveyAnswerInput[] | null {
  const result: SurveyAnswerInput[] = [];
  for (const question of questions) {
    const answer = answers[question.id];
    if (!isAnswered(question, answer)) return null;
    if ("rating" in answer) result.push({ question_id: question.id, rating: answer.rating });
    else if ("text" in answer) result.push({ question_id: question.id, text: answer.text.trim() });
    else result.push({ question_id: question.id, option_ids: answer.optionIds });
  }
  return result;
}

/**
 * Что показать после «Отправить»: `completed` — ответы сохранены (и при повторе той же попытки);
 * `already-completed` — опрос уже пройден другой попыткой; `closed` — опрос завершили; `unavailable` —
 * опрос больше не доступен клиенту; `failed` — не удалось отправить, ответы остаются для повтора.
 */
export type SubmitOutcome = "completed" | "already-completed" | "closed" | "unavailable" | "failed";

export function submitOutcome(result: { ok: true } | { ok: false; code?: string }): SubmitOutcome {
  if (result.ok) return "completed";
  switch (result.code) {
    case "SURVEY_ALREADY_COMPLETED":
      return "already-completed";
    case "SURVEY_CLOSED":
      return "closed";
    case "SURVEY_NOT_FOUND":
      return "unavailable";
    default:
      return "failed";
  }
}
