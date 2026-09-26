import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { newRequestId } from '../request-id';

/** The check of the server: a UUID of version 4. */
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('retry key', () => {
  it('is a UUID of version 4 whatever the random bytes are', () => {
    assert.equal(newRequestId((bytes) => bytes.fill(0xff)), 'ffffffff-ffff-4fff-bfff-ffffffffffff');
    assert.equal(newRequestId((bytes) => bytes.fill(0)), '00000000-0000-4000-8000-000000000000');
  });

  it('is new every time', () => {
    const keys = new Set(Array.from({ length: 1000 }, () => newRequestId()));
    assert.equal(keys.size, 1000);
    for (const key of keys) assert.match(key, UUID_V4);
  });

  it('does without the platform’s crypto', () => {
    const own = Object.getOwnPropertyDescriptor(globalThis, 'crypto');
    Object.defineProperty(globalThis, 'crypto', { value: undefined, configurable: true, writable: true });
    try {
      const keys = new Set(Array.from({ length: 100 }, () => newRequestId()));
      assert.equal(keys.size, 100);
      for (const key of keys) assert.match(key, UUID_V4);
    } finally {
      if (own) Object.defineProperty(globalThis, 'crypto', own);
    }
  });
});
