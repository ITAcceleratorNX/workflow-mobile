import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { describeTaskEvent, recipientSnapshotLabel, type TaskEvent } from '../task-history';

const at = '2026-09-28T10:20:00.000Z';
const aliya = { id: 1, full_name: 'Алия' };
const ivan = { id: 2, full_name: 'Иван Иванов' };
const sergey = { id: 3, full_name: 'Сергей' };

function event(action: TaskEvent['action'], actor: TaskEvent['actor'], details: TaskEvent['details'] = null): TaskEvent {
  return { id: 1, action, created_at: at, actor, details };
}

describe('task history lines', () => {
  it('reads like the example of the spec: created, transferred, responsible, completed', () => {
    const lines = [
      event('created', aliya, { to: { type: 'user', ...ivan } }),
      event('transferred', { id: 2, full_name: 'Иван' }, {
        from: { type: 'user', ...ivan },
        to: { type: 'department', id: 5, name: 'Финансы', company: { id: 9, name: 'TMK' } },
      }),
      event('responsible_assigned', sergey, { from: null, to: sergey }),
      event('completed', sergey, { responsible_id: 3 }),
    ].map(describeTaskEvent);
    assert.deepEqual(lines, [
      'Алия создал(а) задачу → Иван Иванов',
      'Иван передал(а) задачу → Отдел Финансы',
      'Сергей назначен(а) ответственным',
      'Сергей завершил(а) задачу',
    ]);
  });

  it('names every kind of recipient', () => {
    assert.equal(recipientSnapshotLabel({ type: 'company', id: 1, name: 'Extra' }), 'Компания Extra');
    assert.equal(recipientSnapshotLabel({ type: 'team', id: 1, name: 'Дизайн' }), 'Команда Дизайн');
    assert.equal(recipientSnapshotLabel({ type: 'personal' }), 'без исполнителя');
    const users = (n: number) => ({
      type: 'users' as const,
      company: { id: 1, name: 'TMK' },
      users: Array.from({ length: n }, (_, i) => ({ id: i + 1, full_name: `Сотрудник ${i + 1}` })),
    });
    assert.equal(recipientSnapshotLabel(users(2)), 'Сотрудник 1, Сотрудник 2');
    assert.equal(recipientSnapshotLabel(users(5)), 'Сотрудник 1, Сотрудник 2 и ещё 3');
    assert.equal(recipientSnapshotLabel(null), 'получатель');
  });

  it('shows a task created before the journal without a recipient', () => {
    assert.equal(describeTaskEvent({ ...event('created', aliya), id: 0 }), 'Алия создал(а) задачу');
    assert.equal(describeTaskEvent(event('created', aliya, { to: { type: 'personal' } })), 'Алия создал(а) задачу');
  });

  it('tells apart how a responsible was removed', () => {
    assert.equal(
      describeTaskEvent(event('responsible_removed', aliya, { from: sergey, reason: 'transfer' })),
      'Ответственный снят при передаче: Сергей',
    );
    assert.equal(describeTaskEvent(event('responsible_removed', aliya, { from: sergey })), 'Алия снял(а) ответственного: Сергей');
    assert.equal(
      describeTaskEvent(event('responsible_removed', null, { from: sergey, reason: 'not_participant' })),
      'Ответственный снят: Сергей больше не участник задачи',
    );
    assert.equal(
      describeTaskEvent(event('responsible_changed', aliya, { from: sergey, to: ivan })),
      'Алия сменил(а) ответственного: Сергей → Иван Иванов',
    );
    assert.equal(describeTaskEvent(event('responsible_assigned', aliya, { to: sergey })), 'Алия назначил(а) ответственным: Сергей');
    assert.equal(describeTaskEvent(event('reopened', aliya)), 'Алия вернул(а) задачу в работу');
  });
});
