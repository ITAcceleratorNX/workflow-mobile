import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeFailure, TASK_COMMENT_ERROR_CODES, type TaskCommentFailureKind } from '../errors';

const kindOf = (status: number, code?: string) => describeFailure({ ok: false, error: 'Сообщение сервера', status, code }).kind;

describe('failures of the comment API', () => {
  it('tells lost access, a version conflict and a lost network apart', () => {
    assert.equal(kindOf(404, 'TASK_NOT_FOUND'), 'unavailable');
    assert.equal(kindOf(403, 'COMMENT_WRITE_FORBIDDEN'), 'read_only');
    assert.equal(kindOf(409, 'COMMENT_VERSION_CONFLICT'), 'stale');
    assert.equal(describeFailure({ ok: false, error: 'Network request failed' }).kind, 'offline');
  });

  it('gives every code of the contract its kind', () => {
    const expected: Record<(typeof TASK_COMMENT_ERROR_CODES)[number], [number, TaskCommentFailureKind]> = {
      VALIDATION_ERROR: [400, 'rejected'],
      INVALID_CURSOR: [400, 'stale'],
      UNAUTHENTICATED: [401, 'unauthenticated'],
      COMMENT_WRITE_FORBIDDEN: [403, 'read_only'],
      COMMENT_NOT_OWNED: [403, 'forbidden'],
      MODULE_FORBIDDEN: [403, 'forbidden'],
      TASK_NOT_FOUND: [404, 'unavailable'],
      COMMENT_NOT_FOUND: [404, 'stale'],
      COMMENT_VERSION_CONFLICT: [409, 'stale'],
      COMMENT_DELETED: [409, 'stale'],
      MENTION_NOT_AVAILABLE: [409, 'rejected'],
      IDEMPOTENCY_CONFLICT: [409, 'rejected'],
      PAYLOAD_TOO_LARGE: [413, 'rejected'],
      RATE_LIMITED: [429, 'rate_limited'],
      INTERNAL_ERROR: [500, 'server'],
    };
    for (const code of TASK_COMMENT_ERROR_CODES) {
      const [status, kind] = expected[code];
      const failure = describeFailure({ ok: false, error: 'Сообщение сервера', status, code });
      assert.deepEqual([failure.kind, failure.code, failure.message], [kind, code, 'Сообщение сервера'], code);
    }
  });

  it('recognizes an older server or a proxy by the missing code and uses its own words', () => {
    const missing = describeFailure({ ok: false, error: 'Произошла ошибка', status: 404 });
    assert.deepEqual([missing.kind, missing.code, missing.message], ['unsupported', null, 'Комментарии пока недоступны']);
    assert.equal(kindOf(502), 'server');
    assert.equal(describeFailure({ ok: false, error: 'Произошла ошибка', status: 502 }).message, 'Не удалось выполнить запрос. Повторите позже');
    assert.equal(kindOf(409, 'SOMETHING_NEW'), 'stale');
    assert.equal(kindOf(403, 'toString'), 'forbidden');
    assert.equal(describeFailure({ ok: false, error: 'Сессия истекла. Войдите снова.', status: 401 }).message, 'Сессия истекла. Войдите снова.');
  });

  it('describes a lost network in plain words, not the platform’s', () => {
    const failure = describeFailure({ ok: false, error: 'Network request failed' });
    assert.deepEqual(
      { kind: failure.kind, status: failure.status, message: failure.message },
      { kind: 'offline', status: null, message: 'Нет соединения с сервером. Проверьте интернет и повторите' }
    );
  });

  it('keeps a cancellation apart from failures', () => {
    assert.equal(describeFailure({ ok: false, error: 'Запрос отменён', aborted: true }).kind, 'cancelled');
  });

  it('passes on the field errors and the retry delay', () => {
    const failure = describeFailure({
      ok: false,
      error: 'Упоминание недоступно',
      status: 409,
      code: 'MENTION_NOT_AVAILABLE',
      details: [{ field: 'mentions.0', message: 'Имя изменилось: выберите человека заново' }],
    });
    assert.deepEqual(failure.details, [{ field: 'mentions.0', message: 'Имя изменилось: выберите человека заново' }]);
    assert.equal(describeFailure({ ok: false, error: 'Подождите', status: 429, code: 'RATE_LIMITED', retryAfterSeconds: 12 }).retryAfterSeconds, 12);
  });
});
