import type { ClientSurvey, SurveyQuestion } from "./types";

/**
 * Слова экранов опросов (Figma «workflow», клиент Mobile и Desktop): одни на мобильную и десктопную
 * вёрстку. Модуль чистый, без импортов значений — тесты подключают его напрямую.
 */

const PLURAL = new Intl.PluralRules("ru-RU");

/** 1 вопрос, 2 вопроса, 5 вопросов: формы [один, несколько, много]. */
export function pluralRu(count: number, [one, few, many]: readonly [string, string, string]): string {
  const category = PLURAL.select(count);
  if (category === "one") return one;
  return category === "few" ? few : many;
}

/** «5 вопросов» */
export const questionsCountLabel = (count: number) => `${count} ${pluralRu(count, ["вопрос", "вопроса", "вопросов"])}`;

/** «~2 минуты» — карточка списка и вступление. */
export const durationLabel = (minutes: number) => `~${minutes} ${pluralRu(minutes, ["минута", "минуты", "минут"])}`;

/** «около 2 минут» — баннер Desktop: после «около» родительный падеж. */
export const durationAboutLabel = (minutes: number) => `около ${minutes} ${pluralRu(minutes, ["минуты", "минут", "минут"])}`;

/** «Удобство раздела «Задачи» · 2 мин» — карточка «Новый опрос» на главной. */
export const homeCardSubtitle = (survey: Pick<ClientSurvey, "title" | "estimated_minutes">) =>
  survey.estimated_minutes == null ? survey.title : `${survey.title} · ${survey.estimated_minutes} мин`;

/** «5 вопросов · около 2 минут · правильных ответов нет» — баннер «Новый опрос» на Desktop. */
export function bannerSummary(survey: Pick<ClientSurvey, "questions_count" | "estimated_minutes">): string {
  const parts = [questionsCountLabel(survey.questions_count)];
  if (survey.estimated_minutes != null) parts.push(durationAboutLabel(survey.estimated_minutes));
  return [...parts, "правильных ответов нет"].join(" · ");
}

const MONTHS_GENITIVE = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

/**
 * «Пройдено сегодня. Спасибо за ответы!» или «Пройдено 21 октября. …» — карточка пройденного опроса.
 * Даты — ключи YYYY-MM-DD в часовом поясе приложения; год пишется, если он не текущий.
 */
export function completedLabel(completedDateKey: string, todayKey: string): string {
  if (completedDateKey === todayKey) return "Пройдено сегодня. Спасибо за ответы!";
  const [year, month, day] = completedDateKey.split("-").map(Number);
  const yearPart = String(year) === todayKey.slice(0, 4) ? "" : ` ${year}`;
  return `Пройдено ${day} ${MONTHS_GENITIVE[month - 1]}${yearPart}. Спасибо за ответы!`;
}

/** Подписи крайних значений оценки, когда Администратор их не задал, — как в макете. */
export const DEFAULT_SCALE_LABELS = Object.freeze({ min: "Совсем неудобно", max: "Очень удобно" });

type ScaleQuestion = Pick<SurveyQuestion, "scale_min_label" | "scale_max_label">;

export function scaleLabels(question: ScaleQuestion): { min: string; max: string } {
  return {
    min: question.scale_min_label ?? DEFAULT_SCALE_LABELS.min,
    max: question.scale_max_label ?? DEFAULT_SCALE_LABELS.max,
  };
}

const lowerFirst = (text: string) => text.charAt(0).toLocaleLowerCase("ru-RU") + text.slice(1);

/** Подсказка под текстом вопроса — по типу, как в макетах. */
export function questionHint(question: Pick<SurveyQuestion, "type"> & ScaleQuestion): string {
  switch (question.type) {
    case "single_choice":
      return "Выберите один вариант";
    case "multiple_choice":
      return "Можно выбрать несколько вариантов";
    case "yes_no":
      return "Выберите один ответ";
    case "text":
      return "Напишите ответ своими словами";
    case "rating": {
      const { min, max } = scaleLabels(question);
      return `1 — ${lowerFirst(min)}, 5 — ${lowerFirst(max)}`;
    }
  }
}

/** «2 из 5»: Desktop пишет так, Mobile — «Вопрос 2 из 5». index — с нуля. */
export const questionCounter = (index: number, total: number) => `${index + 1} из ${total}`;
