import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { guestRequestUrl, parseGuestRequestToken } from '../request-share-link';

const TOKEN = 'abcDEF_123-abcDEF_123-abcDEF_123';

describe('guest request link', () => {
  it('lives under /r/ and does not carry the request number', () => {
    assert.equal(guestRequestUrl('https://app.tmk-workflow.kz/', TOKEN), `https://app.tmk-workflow.kz/r/${TOKEN}`);
  });

  it('reads the token back only from a guest link', () => {
    assert.equal(parseGuestRequestToken(`https://app.tmk-workflow.kz/r/${TOKEN}`), TOKEN);
    assert.equal(parseGuestRequestToken(`https://app.tmk-workflow.kz/r/${TOKEN}/`), TOKEN);
    for (const url of [
      'https://app.tmk-workflow.kz/?requestId=5',
      'https://app.tmk-workflow.kz/r/5',
      `https://app.tmk-workflow.kz/x/r/${TOKEN}`,
      `workflowmobile://r/${TOKEN}`,
      'not a url',
      '',
    ]) {
      assert.equal(parseGuestRequestToken(url), null, url);
    }
  });
});
