/**
 * Ошибка вызова `request` из `lib/api`: прежнее сообщение для экрана и данные, по которым код
 * решает, что делать дальше. Поля кроме `ok` и `error` необязательны: прежние экраны читают
 * только `error` и работают как раньше.
 */
export interface RequestFailure {
  ok: false;
  /** Сообщение для экрана — то же, что `request` возвращал всегда. */
  error: string;
  /** HTTP-статус; нет, если ответа не было: нет сети, таймаут или отмена. */
  status?: number;
  /** Машинный код API с ответом `{ code, message, details }`, например комментариев к задачам. */
  code?: string;
  /** Ошибки полей такого API. */
  details?: { field: string; message: string }[];
  /** Через сколько секунд повторить — `Retry-After` ответа 429. */
  retryAfterSeconds?: number;
  /** Запрос отменил сам вызывающий через `AbortSignal`. */
  aborted?: true;
}

const FALLBACK_MESSAGE = 'Произошла ошибка';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

function fieldErrors(details: unknown): { field: string; message: string }[] {
  if (!Array.isArray(details)) return [];
  return details.flatMap((detail) =>
    isRecord(detail) && typeof detail.field === 'string' && typeof detail.message === 'string'
      ? [{ field: detail.field, message: detail.message }]
      : []
  );
}

/** Секунды из `Retry-After`; дату вместо секунд не разбираем. */
function retryAfterSeconds(header: string | null): number | undefined {
  if (header == null || !/^\d+$/.test(header.trim())) return undefined;
  return Number(header.trim());
}

/**
 * Ошибка ответа со статусом вне 2xx, кроме 401: его `request` обрабатывает сам.
 * Сообщение выбирается так же, как `request` выбирал его всегда: `error`, `message`,
 * первая ошибка поля, иначе общий текст.
 */
export function failureFromResponse(status: number, body: unknown, retryAfter: string | null): RequestFailure {
  const data = isRecord(body) ? body : {};
  const firstDetail = Array.isArray(data.details) && isRecord(data.details[0]) ? data.details[0].message : undefined;
  const failure: RequestFailure = {
    ok: false,
    error: (data.error || data.message || firstDetail || FALLBACK_MESSAGE) as string,
    status,
  };
  if (typeof data.code === 'string') failure.code = data.code;
  const details = fieldErrors(data.details);
  if (details.length) failure.details = details;
  const seconds = retryAfterSeconds(retryAfter);
  if (seconds !== undefined) failure.retryAfterSeconds = seconds;
  return failure;
}
