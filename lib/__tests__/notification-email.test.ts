import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { NOTIFICATION_EMAIL_MAX_LENGTH, parseNotificationEmail } from '../notification-email';

describe('admin notification email', () => {
  it('sends a trimmed address', () => {
    assert.deepEqual(parseNotificationEmail('  admin@kcell.kz '), { ok: true, value: 'admin@kcell.kz' });
    assert.deepEqual(parseNotificationEmail('Ops.Team+requests@mail.co.kz'), {
      ok: true,
      value: 'Ops.Team+requests@mail.co.kz',
    });
  });

  it('clears the address when the field is empty', () => {
    assert.deepEqual(parseNotificationEmail(''), { ok: true, value: null });
    assert.deepEqual(parseNotificationEmail('   '), { ok: true, value: null });
  });

  it('rejects what is not an email before the request', () => {
    for (const input of ['admin', 'admin@', '@kcell.kz', 'admin@kcell', 'ad min@kcell.kz', 'a@b@kcell.kz']) {
      assert.deepEqual(parseNotificationEmail(input), { ok: false, error: 'Некорректный email' }, input);
    }
  });

  it('rejects an address longer than the server accepts', () => {
    const local = 'a'.repeat(NOTIFICATION_EMAIL_MAX_LENGTH);
    const result = parseNotificationEmail(`${local}@kcell.kz`);
    assert.equal(result.ok, false);
  });
});
