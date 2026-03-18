/**
 * Shared deadline logic: expiring (48h before), overdue.
 * Single source of truth for deadline status (DRY).
 */

export type TaskDeadlineStatus = 'normal' | 'expiring' | 'overdue';

const EXPIRING_HOURS = 48;

/**
 * Get deadline as Date (deadline_to + deadline_time).
 * Returns null if no deadline.
 */
export function getDeadlineTimestamp(
  deadlineTo: string | null | undefined,
  deadlineTime: string | null | undefined
): Date | null {
  if (!deadlineTo) return null;
  const d = new Date(deadlineTo + 'T00:00:00.000Z');
  if (deadlineTime && /^\d{1,2}:\d{2}$/.test(deadlineTime)) {
    const [h, m] = deadlineTime.split(':').map(Number);
    d.setUTCHours(h, m, 0, 0);
  } else {
    d.setUTCHours(23, 59, 59, 999);
  }
  return d;
}

/**
 * Compute deadline status: normal, expiring (48h before), or overdue.
 * Per TZ: overdue from 17:00:01; expiring = 48h before deadline.
 */
export function getDeadlineStatus(
  deadlineTo: string | null | undefined,
  deadlineTime: string | null | undefined
): TaskDeadlineStatus | null {
  const deadline = getDeadlineTimestamp(deadlineTo, deadlineTime);
  if (!deadline) return null;

  const now = new Date();

  // Overdue: deadline has passed (strictly after deadline time + 1 second)
  const oneSecAfter = new Date(deadline.getTime() + 1000);
  if (now >= oneSecAfter) return 'overdue';

  // Expiring: within 48 hours before deadline
  const fortyEightHoursBefore = new Date(deadline.getTime() - EXPIRING_HOURS * 60 * 60 * 1000);
  if (now >= fortyEightHoursBefore) return 'expiring';

  return 'normal';
}

/**
 * Check if task is overdue (has deadline and it passed).
 */
export function isOverdue(
  deadlineTo: string | null | undefined,
  deadlineTime: string | null | undefined
): boolean {
  return getDeadlineStatus(deadlineTo, deadlineTime) === 'overdue';
}

/**
 * Check if task is expiring (within 48h of deadline).
 */
export function isExpiring(
  deadlineTo: string | null | undefined,
  deadlineTime: string | null | undefined
): boolean {
  return getDeadlineStatus(deadlineTo, deadlineTime) === 'expiring';
}
