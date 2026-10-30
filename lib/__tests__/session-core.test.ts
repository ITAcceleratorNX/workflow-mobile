import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSession, isSessionToken, tokenExpiresAt, type SessionTokens } from '../session-core';

const NOW = 1_800_000_000_000;

/** JWT без подписи: клиент читает только exp и sid. */
function jwt(claims: Record<string, unknown>): string {
  const part = (v: unknown) => Buffer.from(JSON.stringify(v)).toString('base64url');
  return `${part({ alg: 'HS256' })}.${part(claims)}.sig`;
}

const sessionToken = (sid: number, minutesLeft: number) => jwt({ id: 1, sid, exp: (NOW + minutesLeft * 60_000) / 1000 });

function setup(initial: { token: string | null; refreshToken: string | null }, respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  let state = { ...initial };
  const calls: { url: string; body: unknown; auth?: string }[] = [];
  let ended = 0;
  const session = createSession({
    apiBaseUrl: 'https://api.test',
    now: () => NOW,
    store: {
      read: () => state,
      save: (tokens: SessionTokens) => {
        state = { ...tokens };
      },
      end: () => {
        ended += 1;
        state = { token: null, refreshToken: null };
      },
    },
    fetch: async (url, init) => {
      const headers = init.headers as Record<string, string>;
      calls.push({ url, body: JSON.parse(String(init.body)), auth: headers.Authorization });
      return respond(url, init);
    },
  });
  return { session, calls, state: () => state, ended: () => ended, set: (next: typeof state) => (state = next) };
}

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

describe('session tokens', () => {
  it('reads the expiry and the session of a JWT, and nothing from other strings', () => {
    assert.equal(tokenExpiresAt(sessionToken(7, 10)), NOW + 10 * 60_000);
    assert.equal(isSessionToken(sessionToken(7, 10)), true);
    assert.equal(isSessionToken(jwt({ id: 1, exp: 1 })), false);
    for (const token of ['guest-demo', '', 'a.b.c']) {
      assert.equal(tokenExpiresAt(token), null);
      assert.equal(isSessionToken(token), false);
    }
  });
});

describe('session renewal', () => {
  it('keeps a fresh token without asking the server', async () => {
    const token = sessionToken(1, 10);
    const t = setup({ token, refreshToken: 'r1' }, () => assert.fail('no request expected'));
    assert.equal(await t.session.accessToken(), token);
  });

  it('renews a token that is about to expire and stores the new pair', async () => {
    const renewed = sessionToken(1, 15);
    const t = setup({ token: sessionToken(1, 0.5), refreshToken: 'r1' }, () => json(200, { token: renewed, refresh_token: 'r2' }));
    assert.equal(await t.session.accessToken(), renewed);
    assert.deepEqual(t.calls.map((c) => [c.url, c.body]), [['https://api.test/auth/refresh', { refresh_token: 'r1' }]]);
    assert.deepEqual(t.state(), { token: renewed, refreshToken: 'r2' });
  });

  it('sends one renewal for many requests that got 401 at once', async () => {
    const old = sessionToken(1, -1);
    const renewed = sessionToken(1, 15);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = setup({ token: old, refreshToken: 'r1' }, async () => {
      await gate;
      return json(200, { token: renewed, refresh_token: 'r2' });
    });
    const waiting = Promise.all([1, 2, 3].map(() => t.session.afterUnauthorized(old)));
    release();
    for (const result of await waiting) assert.deepEqual(result, { token: renewed, ended: false });
    assert.equal(t.calls.length, 1);
  });

  it('retries with the token another request already renewed', async () => {
    const renewed = sessionToken(1, 15);
    const t = setup({ token: renewed, refreshToken: 'r2' }, () => assert.fail('no request expected'));
    assert.deepEqual(await t.session.afterUnauthorized(sessionToken(1, -1)), { token: renewed, ended: false });
  });

  it('signs the user out when the server ended the session', async () => {
    const t = setup({ token: sessionToken(1, -1), refreshToken: 'r1' }, () => json(401, { code: 'SESSION_INVALID' }));
    assert.deepEqual(await t.session.afterUnauthorized(t.state().token!), { token: null, ended: true });
    assert.equal(t.ended(), 1);
    assert.equal(await t.session.accessToken(), null);
  });

  it('keeps the user signed in while the network or the server is down', async () => {
    const token = sessionToken(1, 0.5);
    for (const respond of [() => Promise.reject(new TypeError('Network request failed')), () => json(503, {})]) {
      const t = setup({ token, refreshToken: 'r1' }, respond);
      assert.equal(await t.session.accessToken(), token);
      assert.deepEqual(await t.session.afterUnauthorized(token), { token: null, ended: false });
      assert.equal(t.ended(), 0);
      assert.deepEqual(t.state(), { token, refreshToken: 'r1' });
    }
  });

  it('does not bring back a user who signed out while the renewal was in flight', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const t = setup({ token: sessionToken(1, 0.5), refreshToken: 'r1' }, async () => {
      await gate;
      return json(200, { token: sessionToken(1, 15), refresh_token: 'r2' });
    });
    const pending = t.session.accessToken();
    t.set({ token: null, refreshToken: null });
    release();
    assert.equal(await pending, null);
    assert.deepEqual(t.state(), { token: null, refreshToken: null });
  });

  it('moves a sign-in from before sessions to a session using its old token', async () => {
    const legacy = jwt({ id: 1, exp: (NOW + 60 * 60_000) / 1000 });
    const renewed = sessionToken(9, 15);
    const t = setup({ token: legacy, refreshToken: null }, () => json(200, { token: renewed, refresh_token: 'r1' }));
    assert.equal(await t.session.accessToken(), renewed);
    assert.deepEqual(t.calls, [{ url: 'https://api.test/auth/session', body: {}, auth: `Bearer ${legacy}` }]);
    assert.deepEqual(t.state(), { token: renewed, refreshToken: 'r1' });
  });

  it('does not ask again with every request while the server cannot renew', async () => {
    const legacy = jwt({ id: 1, exp: (NOW + 60 * 60_000) / 1000 });
    const t = setup({ token: legacy, refreshToken: null }, () => json(404, {}));
    assert.equal(await t.session.accessToken(), legacy);
    assert.equal(await t.session.accessToken(), legacy);
    assert.equal(t.calls.length, 1);
  });

  it('ends the session on the server at sign-out, and signs out even offline', async () => {
    const t = setup({ token: null, refreshToken: null }, () => json(200, {}));
    await t.session.signOutOnServer('r1');
    assert.deepEqual(t.calls.map((c) => [c.url, c.body]), [['https://api.test/auth/logout', { refresh_token: 'r1' }]]);
    const offline = setup({ token: null, refreshToken: null }, () => Promise.reject(new TypeError('offline')));
    await offline.session.signOutOnServer('r1');
  });
});
