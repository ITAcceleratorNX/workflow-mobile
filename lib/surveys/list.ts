import type { ClientSurvey } from "./types";

/**
 * Что показывает список опросов клиента. Сервер отдаёт доступные первыми (новые сверху), потом
 * пройденные; решения про точку и карточку — здесь, одни для Mobile и Desktop.
 */

export const availableSurveys = (surveys: readonly ClientSurvey[]) => surveys.filter((survey) => survey.state === "available");

export const completedSurveys = (surveys: readonly ClientSurvey[]) => surveys.filter((survey) => survey.state === "completed");

/** Точка на вкладке «Опросы»: есть доступный опрос, который клиент ещё не прошёл. */
export const hasAvailableSurveys = (surveys: readonly ClientSurvey[]) => surveys.some((survey) => survey.state === "available");

/** Опрос для карточки «Новый опрос» на главной и баннера Desktop — самый новый из доступных. */
export const latestAvailableSurvey = (surveys: readonly ClientSurvey[]) =>
  surveys.find((survey) => survey.state === "available") ?? null;
