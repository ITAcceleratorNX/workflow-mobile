import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatRequestActionBadge,
  hasRequestActionCount,
  isRequestStateMutation,
  notifyRequestStateChanged,
  subscribeRequestStateChanged,
} from '../request-action-count';

describe('request action count', () => {
  it('hides the requests badge entirely when nothing waits for the user', () => {
    for (const count of [0, -1, null, undefined, Number.NaN]) {
      assert.equal(formatRequestActionBadge(count), null, String(count));
    }
    assert.equal(formatRequestActionBadge(1), '1');
    assert.equal(formatRequestActionBadge(99), '99');
    assert.equal(formatRequestActionBadge(100), '99+');
  });

  it('exists for the admin, department head, executor and client, not the manager or the demo', () => {
    for (const role of ['admin-worker', 'department-head', 'executor', 'client']) {
      assert.equal(hasRequestActionCount(role, 'token'), true, role);
    }
    assert.equal(hasRequestActionCount('manager', 'token'), false);
    assert.equal(hasRequestActionCount('client', 'guest-demo'), false);
    assert.equal(hasRequestActionCount('client', null), false);
    assert.equal(hasRequestActionCount(null, 'token'), false);
  });

  it('refreshes only after actions that move a request; opening one does not', () => {
    const moves: [string, string][] = [
      ['POST', '/request-groups'],
      ['PATCH', '/request-groups/12'],
      ['PATCH', '/request-groups/12/take'],
      ['DELETE', '/request-groups/12'],
      ['POST', '/request-executors/5/assign'],
      ['PUT', '/request-executors/5/change'],
      ['PATCH', '/requests/5/execute'],
      ['PATCH', '/requests/5/complete'],
      ['PUT', '/requests/5'],
      ['POST', '/ratings'],
      ['patch', 'requests/5/admin-start?x=1'],
    ];
    for (const [method, path] of moves) {
      assert.equal(isRequestStateMutation(method, path), true, `${method} ${path}`);
    }
    const stills: [string | undefined, string | undefined][] = [
      ['GET', '/request-groups/12'],
      ['GET', '/request-groups/action-count'],
      [undefined, '/requests/5'],
      ['POST', '/request-logs'],
      ['POST', '/requestsx'],
      ['POST', '/user-tasks'],
      ['POST', undefined],
    ];
    for (const [method, path] of stills) {
      assert.equal(isRequestStateMutation(method, path), false, `${method} ${path}`);
    }
  });

  it('tells every subscriber about a change until it unsubscribes', () => {
    let calls = 0;
    const unsubscribe = subscribeRequestStateChanged(() => {
      calls += 1;
    });
    notifyRequestStateChanged();
    unsubscribe();
    notifyRequestStateChanged();
    assert.equal(calls, 1);
  });
});
