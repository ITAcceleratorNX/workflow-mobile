import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { fetchMinAppVersion, isUpdateRequired, storeUrl, storeWebUrl } from '../app-version';

describe('forced app update', () => {
  it('requires an update only when the app is older than the minimal version', () => {
    assert.equal(isUpdateRequired('1.0.6', '1.0.7'), true);
    assert.equal(isUpdateRequired('1.0.9', '1.0.10'), true, 'Numbers, not strings: 9 < 10');
    assert.equal(isUpdateRequired('1.9.9', '2.0.0'), true);
    assert.equal(isUpdateRequired('1.0.7', '1.0.7'), false);
    assert.equal(isUpdateRequired('1.0.8', '1.0.7'), false);
    assert.equal(isUpdateRequired('2.0.0', '1.10.10'), false);
  });

  it('never blocks when a version is missing or unreadable', () => {
    for (const [current, min] of [
      [null, '1.0.7'],
      ['1.0.6', null],
      [undefined, undefined],
      ['1.0', '1.0.7'],
      ['1.0.6', 'latest'],
    ] as const) {
      assert.equal(isUpdateRequired(current, min), false, `${current} / ${min}`);
    }
  });

  it('opens the store of the platform', () => {
    assert.equal(storeUrl('ios'), 'itms-apps://apps.apple.com/app/id6759451937');
    assert.equal(storeUrl('android'), 'market://details?id=com.workflow.kz');
    assert.equal(storeWebUrl('ios'), 'https://apps.apple.com/app/id6759451937');
    assert.equal(storeWebUrl('android'), 'https://play.google.com/store/apps/details?id=com.workflow.kz');
  });

  it('reads the minimal version from the backend, and lets the user in on any failure', async () => {
    const reply = (status: number, body: unknown) =>
      (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

    assert.equal(await fetchMinAppVersion(reply(200, { min_version: '1.0.7' })), '1.0.7');
    assert.equal(await fetchMinAppVersion(reply(200, { min_version: null })), null);
    assert.equal(await fetchMinAppVersion(reply(404, { error: 'Not found' })), null, 'Backend without the endpoint');
    assert.equal(await fetchMinAppVersion(reply(500, {})), null);
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    assert.equal(await fetchMinAppVersion(offline), null);
  });
});
