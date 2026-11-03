import assert from 'node:assert/strict';
import test from 'node:test';

import { createSurveysApi } from '../lib/surveys/api.ts';

/** A transport that records the requests and answers each with the next prepared response, else an empty list. */
function recordingTransport(responses = []) {
  const calls = [];
  const transport = async (path, init = {}) => {
    calls.push({ path, ...init });
    return responses.shift() ?? { ok: true, data: { surveys: [] } };
  };
  return { calls, transport };
}

test('asks the client endpoints and unwraps the list', async () => {
  const survey = { id: 7, state: 'available' };
  const { calls, transport } = recordingTransport([{ ok: true, data: { surveys: [survey] } }]);
  const api = createSurveysApi(transport);

  assert.deepEqual(await api.listSurveys(), { ok: true, data: [survey] });
  await api.getSurvey(7);
  const submission = { client_request_id: '0b6f2c56-3f1d-4c2e-9a51-8d1f4f0b7c11', answers: [{ question_id: 3, rating: 4 }] };
  await api.submitAnswers(7, submission);

  assert.deepEqual(calls.map(({ path, method, body }) => [path, method, body]), [
    ['/surveys', undefined, undefined],
    ['/surveys/7', undefined, undefined],
    ['/surveys/7/responses', 'POST', submission],
  ]);
});

test('asks the admin endpoints with the right method, body and query', async () => {
  const { calls, transport } = recordingTransport();
  const api = createSurveysApi(transport);
  const draft = { title: 'Опрос', office_ids: [1], questions: [{ type: 'yes_no', text: 'Да или нет?' }] };

  await api.listAdminSurveys('published');
  await api.listAdminSurveys();
  await api.getAdminSurvey(5);
  await api.createSurvey(draft);
  await api.updateSurvey(5, draft);
  await api.deleteSurvey(5);
  await api.publishSurvey(5);
  await api.closeSurvey(5);
  await api.getResults(5);
  await api.getNamedResponses(5, { page: 2, limit: 20 });

  assert.deepEqual(calls.map(({ path, method, body, params }) => [path, method ?? 'GET', body, params]), [
    ['/surveys/admin', 'GET', undefined, { status: 'published' }],
    ['/surveys/admin', 'GET', undefined, undefined],
    ['/surveys/admin/5', 'GET', undefined, undefined],
    ['/surveys/admin', 'POST', draft, undefined],
    ['/surveys/admin/5', 'PUT', draft, undefined],
    ['/surveys/admin/5', 'DELETE', undefined, undefined],
    ['/surveys/admin/5/publish', 'POST', undefined, undefined],
    ['/surveys/admin/5/close', 'POST', undefined, undefined],
    ['/surveys/admin/5/results', 'GET', undefined, undefined],
    ['/surveys/admin/5/responses', 'GET', undefined, { page: '2', limit: '20' }],
  ]);
});

test('passes failures through with their code and fields', async () => {
  const failure = { ok: false, error: 'Опрос не готов к публикации', status: 409, code: 'SURVEY_NOT_READY', details: [{ field: 'questions', message: 'Добавьте хотя бы один вопрос' }] };
  const { transport } = recordingTransport([failure, { ok: false, error: 'Нет соединения с сервером' }]);
  const api = createSurveysApi(transport);
  assert.deepEqual(await api.publishSurvey(5), failure);
  assert.deepEqual(await api.listSurveys(), { ok: false, error: 'Нет соединения с сервером' }, 'a failed list is not unwrapped');
});

test('lets a load be cancelled through the signal', async () => {
  const { calls, transport } = recordingTransport();
  const controller = new AbortController();
  await createSurveysApi(transport).getResults(5, controller.signal);
  assert.equal(calls[0].signal, controller.signal);
});
