import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canRateWork,
  canClientRespond,
  canConfirmWork,
  canDeleteRequests,
  canRejectRequest,
  canSeeRejectionDetails,
  clientConfirmationDeadline,
  CLIENT_CONFIRMATION_WINDOW_MS,
  isRejectedRequest,
} from '../request-permissions';
import { getRejectionMeta } from '../request-rejection';

describe('request permissions', () => {
  it('lets only the manager delete requests', () => {
    assert.equal(canDeleteRequests('manager'), true);
    for (const role of ['client', 'admin-worker', 'department-head', 'executor', null, undefined]) {
      assert.equal(canDeleteRequests(role), false, String(role));
    }
  });

  it('lets the admin reject only a new request nobody has taken yet', () => {
    const fresh = { status: 'in_progress', taken_by_admin_id: null };
    assert.equal(canRejectRequest('admin-worker', fresh), true);
    assert.equal(canRejectRequest('admin-worker', { status: 'in_progress' }), true);
    assert.equal(canRejectRequest('admin-worker', { status: 'in_progress', taken_by_admin_id: 7 }), false);
    for (const status of ['awaiting_assignment', 'assigned', 'execution', 'completed', 'rejected']) {
      assert.equal(canRejectRequest('admin-worker', { status }), false, status);
    }
    for (const role of ['manager', 'department-head', 'client', 'executor']) {
      assert.equal(canRejectRequest(role, fresh), false, role);
    }
  });

  it('shows who rejected and the history to the admin and the manager only', () => {
    assert.equal(canSeeRejectionDetails('admin-worker'), true);
    assert.equal(canSeeRejectionDetails('manager'), true);
    assert.equal(canSeeRejectionDetails('client'), false);
    assert.equal(canSeeRejectionDetails('department-head'), false);
    assert.equal(isRejectedRequest({ status: 'rejected' }), true);
    assert.equal(isRejectedRequest({ status: 'in_progress' }), false);
  });
});

describe('rejection meta', () => {
  const history = [
    { action_type: 'created', created_at: '2026-10-01T08:00:00Z', user: { full_name: 'Клиент' } },
    { action_type: 'rejected', created_at: '2026-10-01T09:00:00Z', user: { full_name: 'Старый админ' } },
    { action_type: 'rejected', created_at: '2026-10-02T09:00:00Z', user: { full_name: 'Админ' } },
  ];

  it('prefers the fields stored on the request group', () => {
    assert.deepEqual(
      getRejectionMeta({ rejectedBy: { full_name: 'Иванов' }, rejected_at: '2026-10-03T10:00:00Z' }, history),
      { rejectedByName: 'Иванов', rejectedAt: '2026-10-03T10:00:00Z' }
    );
  });

  it('falls back to the latest rejected log entry', () => {
    assert.deepEqual(getRejectionMeta({ rejectedBy: null, rejected_at: null }, history), {
      rejectedByName: 'Админ',
      rejectedAt: '2026-10-02T09:00:00Z',
    });
    assert.deepEqual(getRejectionMeta({}, null), { rejectedByName: undefined, rejectedAt: undefined });
  });
});

describe('client confirmation', () => {
  it('lets the admin confirm work only while the request is under review', () => {
    assert.equal(canConfirmWork('admin-worker', { status: 'awaiting_admin_review' }), true);
    assert.equal(
      canConfirmWork('admin-worker', { status: 'awaiting_admin_review', work_done_at: null }),
      true
    );
    for (const status of ['execution', 'awaiting_confirmation', 'completed', 'in_progress']) {
      assert.equal(
        canConfirmWork('admin-worker', { status, work_done_at: '2026-10-01T10:00:00Z' }),
        false,
        status
      );
    }
    for (const role of ['department-head', 'manager', 'executor', 'client']) {
      assert.equal(canConfirmWork(role, { status: 'awaiting_admin_review' }), false, role);
    }
  });

  it('lets only the author answer while the request awaits confirmation', () => {
    const waiting = { status: 'awaiting_confirmation', client_id: 5 };
    assert.equal(canClientRespond(5, waiting), true);
    assert.equal(canClientRespond(6, waiting), false);
    assert.equal(canClientRespond(null, waiting), false);
    assert.equal(canClientRespond(5, { ...waiting, status: 'execution' }), false);
    assert.equal(canClientRespond(5, { ...waiting, status: 'completed' }), false);
  });

  it('lets the client rate only a closed request', () => {
    assert.equal(canRateWork({ status: 'completed' }), true);
    assert.equal(canRateWork({ status: 'awaiting_confirmation' }), false);
    assert.equal(canRateWork({ status: 'execution' }), false);
  });

  it('gives the author 24 hours from the confirmation request', () => {
    const at = '2026-10-01T10:00:00.000Z';
    assert.equal(
      clientConfirmationDeadline({ status: 'awaiting_confirmation', confirmation_requested_at: at })?.getTime(),
      new Date(at).getTime() + CLIENT_CONFIRMATION_WINDOW_MS
    );
    assert.equal(clientConfirmationDeadline({ status: 'awaiting_confirmation' }), null);
    assert.equal(clientConfirmationDeadline({ status: 'awaiting_confirmation', confirmation_requested_at: 'nope' }), null);
    assert.equal(clientConfirmationDeadline({ status: 'execution', confirmation_requested_at: at }), null);
  });
});
