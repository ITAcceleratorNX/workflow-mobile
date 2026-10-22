import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calendarResultFromUrl, calendarResultNotice, lastSyncedLabel } from '../task-calendar';

describe('task calendar screen', () => {
  it('reads the result from the return link', () => {
    assert.equal(calendarResultFromUrl('workflowmobile://calendar-settings?calendar=google_connected'), 'google_connected');
    assert.equal(calendarResultFromUrl('workflowmobile://calendar-settings?x=1&calendar=google_denied#'), 'google_denied');
    assert.equal(calendarResultFromUrl('workflowmobile://calendar-settings'), null);
    assert.equal(calendarResultFromUrl(null), null);
  });

  it('has a message for every result the server returns', () => {
    for (const result of ['google_connected', 'google_denied', 'google_scope_missing', 'google_failed', 'google_unavailable', 'google_invalid_state']) {
      assert.equal(calendarResultNotice(result)?.tone, result === 'google_connected' ? 'success' : 'error', result);
    }
    assert.equal(calendarResultNotice('unknown'), null);
  });

  it('shows the last sync in Almaty time', () => {
    assert.equal(lastSyncedLabel('2026-10-21T21:09:55.575Z'), 'Синхронизировано 22 октября в 02:09');
    assert.equal(lastSyncedLabel(null), null);
  });
});
