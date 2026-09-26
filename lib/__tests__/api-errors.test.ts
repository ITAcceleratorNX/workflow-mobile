import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { failureFromResponse } from '../api-errors';

/** How `request` chose the message before the machine-readable fields were added. */
function legacyMessage(data: any): string {
  return (
    data?.error ||
    data?.message ||
    (Array.isArray(data?.details) && data.details[0]?.message) ||
    'Произошла ошибка'
  );
}

describe('failure of an HTTP response', () => {
  it('keeps the message every screen showed before', () => {
    const bodies: unknown[] = [
      { error: 'Неверный телефон' },
      { message: 'Нет прав' },
      { error: 'Первое поле', message: 'Второе поле', details: [{ message: 'Третье поле' }] },
      { message: 'Второе поле', details: [{ message: 'Третье поле' }] },
      { error: '', message: 'Второе поле' },
      { details: [{ message: 'Поле обязательно' }] },
      { details: [null] },
      { details: ['строка'] },
      { details: 'не массив' },
      { code: 'COMMENT_DELETED', message: 'Комментарий удалён' },
      {},
      [],
      null,
      'Bad gateway',
    ];
    for (const body of bodies) {
      assert.equal(failureFromResponse(400, body, null).error, legacyMessage(body), JSON.stringify(body));
    }
  });

  it('adds the status, the code and the field errors an API sends', () => {
    assert.deepEqual(failureFromResponse(400, { error: 'Неверный телефон' }, null), {
      ok: false,
      error: 'Неверный телефон',
      status: 400,
    });
    assert.deepEqual(
      failureFromResponse(
        409,
        {
          code: 'MENTION_NOT_AVAILABLE',
          message: 'Упоминание недоступно',
          details: [{ field: 'mentions.1', message: 'Нельзя упомянуть себя' }, { oops: true }],
        },
        null
      ),
      {
        ok: false,
        error: 'Упоминание недоступно',
        status: 409,
        code: 'MENTION_NOT_AVAILABLE',
        details: [{ field: 'mentions.1', message: 'Нельзя упомянуть себя' }],
      }
    );
  });

  it('reads the retry delay in seconds and ignores any other form', () => {
    assert.equal(failureFromResponse(429, { code: 'RATE_LIMITED', message: 'Подождите' }, '30').retryAfterSeconds, 30);
    assert.equal(failureFromResponse(429, {}, ' 5 ').retryAfterSeconds, 5);
    assert.equal(failureFromResponse(429, {}, 'Wed, 21 Oct 2026 07:28:00 GMT').retryAfterSeconds, undefined);
    assert.equal(failureFromResponse(429, {}, '-1').retryAfterSeconds, undefined);
    assert.equal(failureFromResponse(500, {}, null).retryAfterSeconds, undefined);
  });
});
