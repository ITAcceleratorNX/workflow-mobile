import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatTaskTime } from '@/lib/dateTimeUtils';

import {
  authorInitial,
  commentAccessibilityLabel,
  failureText,
  formatCommentMoment,
  mentionSegments,
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
