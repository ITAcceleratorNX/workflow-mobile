import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  canSeeOfficeBookings,
  getBookingStatusText,
  isOfficeScopedBookings,
  officeBookingsTabLabel,
} from '../office-bookings';

describe('office bookings', () => {
  it('opens office bookings to the administrator, the office manager and the head only', () => {
    assert.equal(canSeeOfficeBookings('admin-worker'), true);
    assert.equal(canSeeOfficeBookings('department-head'), true);
    assert.equal(canSeeOfficeBookings('manager'), true);
    assert.equal(canSeeOfficeBookings('client'), false);
    assert.equal(canSeeOfficeBookings('executor'), false);
    assert.equal(canSeeOfficeBookings(null), false);
  });

  it('limits only the office manager to their office', () => {
    assert.equal(isOfficeScopedBookings('department-head'), true);
    assert.equal(isOfficeScopedBookings('admin-worker'), false);
    assert.equal(officeBookingsTabLabel('department-head'), 'Брони офиса');
    assert.equal(officeBookingsTabLabel('admin-worker'), 'Все брони');
  });

  it('names active, completed and cancelled statuses', () => {
    assert.equal(getBookingStatusText('scheduled'), 'Запланировано');
    assert.equal(getBookingStatusText('completed'), 'Завершено');
    assert.equal(getBookingStatusText('cancelled'), 'Отменено');
    assert.equal(getBookingStatusText('auto_cancelled'), 'Отменено');
  });
});
