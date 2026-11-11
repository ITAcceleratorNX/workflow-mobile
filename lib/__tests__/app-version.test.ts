import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  appVersionFor,
  blockingMinVersion,
  fetchMinAppVersion,
  installedAppVersion,
  isUpdateRequired,
  openAppStore,
  playStoreIntentUrl,
  storeUrl,
  storeWebUrl,
} from '../app-version';

describe('forced app update', () => {
  it('compares the version the store sees, not a stale common one', () => {
    const config = { version: '1.0.0', ios: { version: '1.0.7' } };
    assert.equal(appVersionFor('ios', config), '1.0.7');
    assert.equal(appVersionFor('android', config), '1.0.0');
    assert.equal(appVersionFor('android', { version: '1.0.7', android: { version: '1.0.8' } }), '1.0.8');
    assert.equal(appVersionFor('web', config), '1.0.0');
    assert.equal(appVersionFor('ios', null), null);
    assert.equal(isUpdateRequired(appVersionFor('ios', config), '1.0.7'), false, 'An updated iPhone is let in');
  });

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

  it('compares the installed binary, not a stale config or Expo Go', () => {
    assert.equal(installedAppVersion('android', { version: '1.0.0' }, '1.0.8', false), '1.0.8');
    assert.equal(installedAppVersion('android', { version: '1.0.8' }, '  ', false), '1.0.8');
    assert.equal(installedAppVersion('android', { version: '1.0.8' }, '2.32.10', true), '1.0.8', 'Expo Go version is ignored');
    assert.equal(installedAppVersion('ios', { version: '1.0.0', ios: { version: '1.1.1' } }, null, false), '1.1.1');
  });

  it('does not require a version the platform store has not published', () => {
    const androidBehind = { minVersion: '1.1.1', storeVersion: '1.0.8' };
    assert.equal(blockingMinVersion(androidBehind), '1.0.8');
    assert.equal(isUpdateRequired('1.0.8', blockingMinVersion(androidBehind)), false, 'Reinstalling Play 1.0.8 must not stay blocked');
    assert.equal(isUpdateRequired('1.0.7', blockingMinVersion(androidBehind)), true, 'Older than Play still goes to the store');
    assert.equal(blockingMinVersion({ minVersion: '1.1.1', storeVersion: '1.1.1' }), '1.1.1');
    assert.equal(blockingMinVersion({ minVersion: '1.1.1', storeVersion: null }), '1.1.1');
    assert.equal(blockingMinVersion({ minVersion: null, storeVersion: '1.0.8' }), null);
  });

  it('opens Google Play itself, then the web page if the Play app does not open', async () => {
    assert.equal(storeUrl('ios'), 'itms-apps://apps.apple.com/app/id6759451937');
    assert.equal(storeUrl('android'), 'https://play.google.com/store/apps/details?id=com.workflow.kz');
    assert.equal(storeWebUrl('ios'), 'https://apps.apple.com/app/id6759451937');
    assert.equal(storeWebUrl('android'), 'https://play.google.com/store/apps/details?id=com.workflow.kz');
    assert.match(playStoreIntentUrl(), /package=com\.android\.vending/);

    const opened: string[] = [];
    await openAppStore('android', async (url) => {
      opened.push(url);
      if (url.startsWith('intent:')) throw new Error('Play app missing');
    });
    assert.deepEqual(opened, [playStoreIntentUrl(), storeWebUrl('android')]);

    const ios: string[] = [];
    await openAppStore('ios', async (url) => {
      ios.push(url);
    });
    assert.deepEqual(ios, [storeUrl('ios')]);
  });

  it('reads the minimal version from the backend, and lets the user in on any failure', async () => {
    const reply = (status: number, body: unknown) =>
      (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch;

    assert.equal(await fetchMinAppVersion(reply(200, { min_version: '1.0.7' })), '1.0.7');
    assert.equal(await fetchMinAppVersion(reply(200, { min_version: null })), null);
    assert.equal(
      await fetchMinAppVersion(reply(200, {
        min_version: '1.0.8',
        android: { min_version: '1.1.1', store_version: '1.0.8' },
        ios: { min_version: '1.1.1', store_version: '1.1.1' },
      }), 'android'),
      '1.0.8',
      'Android is not asked for a build Play does not have',
    );
    assert.equal(
      await fetchMinAppVersion(reply(200, {
        min_version: '1.0.8',
        ios: { min_version: '1.1.1', store_version: '1.1.1' },
      }), 'ios'),
      '1.1.1',
    );
    assert.equal(await fetchMinAppVersion(reply(404, { error: 'Not found' })), null, 'Backend without the endpoint');
    assert.equal(await fetchMinAppVersion(reply(500, {})), null);
    const offline = (async () => {
      throw new TypeError('Network request failed');
    }) as unknown as typeof fetch;
    assert.equal(await fetchMinAppVersion(offline), null);
  });
});
