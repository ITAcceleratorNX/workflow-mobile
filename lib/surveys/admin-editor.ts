import type {
  AdminSurveyDetail,
  SurveyDraftInput,
  SurveyQuestionDraft,
  SurveyQuestionType,
} from './types';

export type EditableSurveyOption = { key: string; text: string };
export type EditableSurveyQuestion = {
  key: string;
  type: SurveyQuestionType;
  text: string;
  options: EditableSurveyOption[];
  scaleMinLabel?: string | null;
  scaleMaxLabel?: string | null;
};

export type SurveyEditorDraft = {
  title: string;
  description: string;
  isAnonymous: boolean;
  allOffices: boolean;
  officeIds: number[];
  questions: EditableSurveyQuestion[];
};

export const SURVEY_QUESTION_TYPES: readonly { value: SurveyQuestionType; label: string }[] = [
  { value: 'single_choice', label: 'Один вариант' },
  { value: 'multiple_choice', label: 'Несколько вариантов' },
  { value: 'text', label: 'Открытый ответ' },
  { value: 'rating', label: 'Оценка 1–5' },
  { value: 'yes_no', label: 'Да / Нет' },
];

const VISIBLE = /[^\p{White_Space}\p{Control}\p{Default_Ignorable_Code_Point}]/u;
const visible = (text: string) => VISIBLE.test(text.trim());
const characterCount = (text: string) => [...text].length;

export function questionTypeLabel(type: SurveyQuestionType): string {
  return SURVEY_QUESTION_TYPES.find((item) => item.value === type)?.label ?? type;
}

export function newEditableQuestion(type: SurveyQuestionType, key: string): EditableSurveyQuestion {
  return {
    key,
    type,
    text: '',
    options: type === 'single_choice' || type === 'multiple_choice'
      ? [
          { key: `${key}-option-1`, text: '' },
          { key: `${key}-option-2`, text: '' },
        ]
      : [],
  };
}

export function surveyEditorFromDetail(survey: AdminSurveyDetail): SurveyEditorDraft {
  return {
    title: survey.title,
    description: survey.description ?? '',
    isAnonymous: survey.is_anonymous,
    allOffices: survey.all_offices,
    officeIds: survey.offices.map((office) => office.id),
    questions: survey.questions.map((question) => ({
      key: `question-${question.id}`,
      type: question.type,
      text: question.text,
      scaleMinLabel: question.scale_min_label,
      scaleMaxLabel: question.scale_max_label,
      options: question.options.map((option) => ({
        key: `question-${question.id}-option-${option.id}`,
        text: option.text,
      })),
    })),
  };
}

export function questionIsValid(question: EditableSurveyQuestion): boolean {
  if (!visible(question.text) || characterCount(question.text.trim()) > 500) return false;
  if (question.type !== 'single_choice' && question.type !== 'multiple_choice') return true;
  if (question.options.length < 2 || question.options.length > 20) return false;
  const normalized = question.options.map((option) => option.text.trim());
  if (normalized.some((option) => !visible(option) || characterCount(option) > 200)) return false;
  return new Set(normalized.map((option) => option.toLocaleLowerCase('ru'))).size === normalized.length;
}

export function surveyCanPublish(draft: SurveyEditorDraft): boolean {
  return Boolean(
    visible(draft.title) &&
    characterCount(draft.title.trim()) <= 255 &&
    characterCount(draft.description.trim()) <= 1000 &&
    draft.questions.length > 0 &&
    draft.questions.length <= 50 &&
    draft.questions.every(questionIsValid) &&
    draft.officeIds.length <= 200 &&
    (draft.allOffices || draft.officeIds.length > 0),
  );
}

export function surveyEstimatedMinutes(questions: readonly EditableSurveyQuestion[]): number | null {
  if (questions.length === 0) return null;
  const secondsByType: Record<SurveyQuestionType, number> = {
    single_choice: 15,
    multiple_choice: 20,
    rating: 10,
    yes_no: 10,
    text: 60,
  };
  const seconds = questions.reduce((total, question) => total + secondsByType[question.type], 0);
  return Math.max(1, Math.ceil(seconds / 60));
}

export function surveyDraftInput(draft: SurveyEditorDraft): SurveyDraftInput {
  const questions: SurveyQuestionDraft[] = draft.questions.map((question) => {
    if (question.type === 'single_choice' || question.type === 'multiple_choice') {
      return {
        type: question.type,
        text: question.text.trim(),
        options: question.options.map((option) => option.text.trim()),
      };
    }
    if (question.type === 'rating') {
      return {
        type: question.type,
        text: question.text.trim(),
        scale_min_label: question.scaleMinLabel ?? null,
        scale_max_label: question.scaleMaxLabel ?? null,
      };
    }
    return { type: question.type, text: question.text.trim() };
  });
  return {
    title: draft.title.trim(),
    description: draft.description.trim() || null,
    is_anonymous: draft.isAnonymous,
    all_offices: draft.allOffices,
    office_ids: draft.allOffices ? [] : [...draft.officeIds],
    questions,
  };
}
