import { request } from '@/lib/api';
import { createSurveysApi } from '@/lib/surveys/api';

/** Готовый API-клиент, использующий авторизацию и обработку ошибок приложения. */
export const surveysApi = createSurveysApi((path, options = {}) => {
  const { body, ...init } = options;
  return request(path, {
    ...init,
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
});

export { createSurveysApi } from '@/lib/surveys/api';
export type { SurveysApi } from '@/lib/surveys/api';
