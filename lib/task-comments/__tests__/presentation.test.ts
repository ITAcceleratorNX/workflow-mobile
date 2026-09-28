import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatTaskTime } from '@/lib/dateTimeUtils';

import {
  authorInitial,
  commentAccessibilityLabel,
  commentMeta,
  commentState,
  DELETED_COMMENT_TEXT,
  failureText,
  formatCommentMoment,
  mentionSegments,
  ownCommentActions,
} from '../presentation';
import type { TaskCommentMention } from '../types';
import { comment, serverFailure, tombstone } from './fakes';

// Устройство в UTC: подписи дней обязаны считаться по Asia/Almaty, а не по часам устройства.
process.env.TZ = 'UTC';

const mention = (start: number, end: number, label: string, userId: number | null = 9): TaskCommentMention => ({
  user_id: userId,
  start,
  end,
  label,
});

describe('text with mentions', () => {
  it('splits the text into plain parts and mentions by UTF-16 offsets', () => {
    const text = 'Привет, @Петров и @Анна!';
    const segments = mentionSegments(text, [mention(18, 23, 'Анна', 4), mention(8, 15, 'Петров')]);
    assert.deepEqual(
      segments.map((segment) => [segment.text, segment.mention?.user_id ?? null]),
      [
        ['Привет, ', null],
        ['@Петров', 9],
        [' и ', null],
        ['@Анна', 4],
        ['!', null],
      ]
    );
  });

  it('counts an emoji as two units, keeps mentions side by side and of a deleted account', () => {
    const text = '👍@Анна@Пётр';
    const segments = mentionSegments(text, [mention(2, 7, 'Анна', null), mention(7, 12, 'Пётр')]);
    assert.deepEqual(
      segments.map((segment) => segment.text),
      ['👍', '@Анна', '@Пётр']
    );
    assert.equal(segments[1].mention?.user_id, null);
  });

  it('leaves as plain text a range out of the text or overlapping the previous one', () => {
    const text = '@Анна текст';
    const segments = mentionSegments(text, [mention(0, 5, 'Анна'), mention(3, 8, 'на тек'), mention(6, 40, 'x')]);
    assert.deepEqual(
      segments.map((segment) => [segment.text, segment.mention !== null]),
      [
        ['@Анна', true],
        [' текст', false],
      ]
    );
    assert.equal(segments.map((segment) => segment.text).join(''), text);
  });

  it('gives the text as it is without mentions and nothing for an empty text', () => {
    assert.deepEqual(mentionSegments('Просто текст', []), [{ text: 'Просто текст', mention: null }]);
    assert.deepEqual(mentionSegments('', []), []);
  });
});

describe('date and time of a comment', () => {
  const now = new Date('2026-09-26T08:00:00Z');

  it('names today and yesterday and gives the date otherwise, in the app time zone', () => {
    const today = '2026-09-26T05:30:00Z';
    const yesterday = '2026-09-25T08:00:00Z';
    const earlier = '2026-09-20T08:00:00Z';
    const lastYear = '2025-12-31T08:00:00Z';
    assert.equal(formatCommentMoment(today, now), `Сегодня, ${formatTaskTime(today)}`);
    assert.equal(formatCommentMoment(yesterday, now), `Вчера, ${formatTaskTime(yesterday)}`);
    assert.equal(formatCommentMoment(earlier, now), `20.09.2026, ${formatTaskTime(earlier)}`);
    assert.equal(formatCommentMoment(lastYear, now), `31.12.2025, ${formatTaskTime(lastYear)}`);
  });

  it('counts days in Almaty: late evening in UTC is already today there', () => {
    const nightInUtc = '2026-09-25T20:30:00Z';
    assert.equal(formatCommentMoment(nightInUtc, now), `Сегодня, ${formatTaskTime(nightInUtc)}`);
  });

  it('shows nothing for a date it cannot read', () => {
    assert.equal(formatCommentMoment('не дата', now), '');
  });
});

describe('author and screen reader', () => {
  it('takes the first letter of the name for the avatar, an emoji whole', () => {
    assert.equal(authorInitial('иванова Анна'), 'И');
    assert.equal(authorInitial('  Петров'), 'П');
    assert.equal(authorInitial('😀 Смайл'), '😀');
    assert.equal(authorInitial('   '), '?');
  });

  it('reads the author, the time, the edited mark and the text, or that the comment is deleted', () => {
    const edited = comment(1, { text: 'Готово', edited_at: '2026-09-26T09:00:00Z' });
    assert.equal(commentAccessibilityLabel(edited, 'Сегодня, 14:00'), 'Иванов Иван, Сегодня, 14:00, изменено: Готово');
    assert.equal(commentAccessibilityLabel(tombstone(edited), 'Сегодня, 14:00'), 'Иванов Иван, Сегодня, 14:00: комментарий удалён');
  });
});

describe('why a write failed', () => {
  it('prefers the field errors to the general message', () => {
    const refused = serverFailure(409, 'MENTION_NOT_AVAILABLE', 'Упоминание недоступно');
    assert.equal(failureText(refused), 'Упоминание недоступно');
    refused.details = [
      { field: 'mentions.0', message: 'Имя изменилось: выберите человека заново' },
      { field: 'mentions.2', message: 'Нельзя упомянуть себя' },
    ];
    assert.equal(failureText(refused), 'Имя изменилось: выберите человека заново. Нельзя упомянуть себя');
  });
});

describe('edited, deleted and own comments', () => {
  const edited = comment(1, { edited_at: '2026-09-26T09:00:00Z', version: 2 });

  it('marks an edited comment, and a deleted one only as deleted', () => {
    assert.deepEqual(commentState(comment(1)), { deleted: false, edited: false });
    assert.deepEqual(commentState(edited), { deleted: false, edited: true });
    assert.deepEqual(commentState(tombstone(edited)), { deleted: true, edited: false });
    assert.deepEqual(commentState(comment(1, { text: null })), { deleted: true, edited: false });
    assert.equal(DELETED_COMMENT_TEXT, 'Комментарий удалён');
  });

  it('shows the time, «изменено» and what is being done with the comment right now', () => {
    assert.equal(commentMeta(comment(1), 'Сегодня, 14:00'), 'Сегодня, 14:00');
    assert.equal(commentMeta(edited, 'Сегодня, 14:00'), 'Сегодня, 14:00 · изменено');
    assert.equal(commentMeta(edited, 'Сегодня, 14:00', 'edit'), 'Сегодня, 14:00 · изменено · сохраняется…');
    assert.equal(commentMeta(tombstone(edited), 'Вчера, 09:30'), 'Вчера, 09:30');
    assert.equal(commentMeta(comment(1), 'Вчера, 09:30', 'delete'), 'Вчера, 09:30 · удаляется…');
  });

  it('lets a person edit and delete only their own live comment, as far as the server allows', () => {
    const own = comment(1, { author: { id: 7, full_name: 'Иванов Иван' } });
    assert.deepEqual(ownCommentActions(own, 7), { edit: true, remove: true });
    assert.deepEqual(ownCommentActions(own, 8), { edit: false, remove: false }, 'Someone else’s comment, whatever the rights say');
    assert.deepEqual(ownCommentActions(own, null), { edit: false, remove: false });
    const ofDeletedAccount = comment(1, { author: { id: null, full_name: 'Бывший сотрудник' } });
    assert.deepEqual(ownCommentActions(ofDeletedAccount, null), { edit: false, remove: false }, 'Nobody owns a deleted account’s comment');
    const deletedWithRights = { ...tombstone(own), permissions: { can_edit: true, can_delete: true } };
    assert.deepEqual(ownCommentActions(deletedWithRights, 7), { edit: false, remove: false }, 'A deleted comment has nothing to change');
    const readOnly = comment(1, { permissions: { can_edit: false, can_delete: false } });
    assert.deepEqual(ownCommentActions(readOnly, 7), { edit: false, remove: false }, 'A retained reader changes nothing');
    assert.deepEqual(ownCommentActions(comment(1, { permissions: { can_edit: false, can_delete: true } }), 7), { edit: false, remove: true });
  });
});
