import type { RequestFailure } from '@/lib/api-errors';

import type {
  AdminSurvey,
  AdminSurveyDetail,
  ClientSurvey,
  ClientSurveyDetail,
  NamedResponsesPage,
  SurveyDraftInput,
  SurveyResults,
  SurveyStatus,
  SurveySubmission,
} from './types';

export type ApiResponse<T> = { ok: true; data: T } | RequestFailure;
export type SurveyRequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; params?: Record<string, string> };
export type ApiTransport = <T>(path: string, options?: SurveyRequestOptions) => Promise<ApiResponse<T>>;

async function surveysOf<T>(response: Promise<ApiResponse<{ surveys: T[] }>>): Promise<ApiResponse<T[]>> {
  const result = await response;
  return result.ok ? { ok: true, data: result.data.surveys } : result;
}

/** Клиент и администратор работают с одним контрактом `/api/surveys`. */
export function createSurveysApi(transport: ApiTransport) {
  return {
    listSurveys: (signal?: AbortSignal) => surveysOf(transport<{ surveys: ClientSurvey[] }>('/surveys', { signal })),
    getSurvey: (surveyId: number, signal?: AbortSignal) => transport<ClientSurveyDetail>(`/surveys/${surveyId}`, { signal }),
    /** 201 — сохранено, 200 — эта попытка уже была сохранена: оба результата означают «Пройдено». */
    submitAnswers: (surveyId: number, submission: SurveySubmission) =>
      transport<ClientSurvey>(`/surveys/${surveyId}/responses`, { method: 'POST', body: submission }),

    listAdminSurveys: (status?: SurveyStatus, signal?: AbortSignal) =>
      surveysOf(transport<{ surveys: AdminSurvey[] }>('/surveys/admin', { params: status ? { status } : undefined, signal })),
    getAdminSurvey: (surveyId: number, signal?: AbortSignal) => transport<AdminSurveyDetail>(`/surveys/admin/${surveyId}`, { signal }),
    createSurvey: (draft: SurveyDraftInput) =>
      transport<AdminSurveyDetail>('/surveys/admin', { method: 'POST', body: draft }),
    updateSurvey: (surveyId: number, draft: SurveyDraftInput) =>
      transport<AdminSurveyDetail>(`/surveys/admin/${surveyId}`, { method: 'PUT', body: draft }),
    deleteSurvey: (surveyId: number) => transport<null>(`/surveys/admin/${surveyId}`, { method: 'DELETE' }),
    publishSurvey: (surveyId: number) => transport<AdminSurveyDetail>(`/surveys/admin/${surveyId}/publish`, { method: 'POST' }),
    closeSurvey: (surveyId: number) => transport<AdminSurveyDetail>(`/surveys/admin/${surveyId}/close`, { method: 'POST' }),
    getResults: (surveyId: number, signal?: AbortSignal) => transport<SurveyResults>(`/surveys/admin/${surveyId}/results`, { signal }),
    getNamedResponses: (surveyId: number, page: { page: number; limit: number }, signal?: AbortSignal) =>
      transport<NamedResponsesPage>(`/surveys/admin/${surveyId}/responses`, {
        params: { page: String(page.page), limit: String(page.limit) },
        signal,
      }),
  };
}

export type SurveysApi = ReturnType<typeof createSurveysApi>;
