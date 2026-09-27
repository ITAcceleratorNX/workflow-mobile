import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  applyTextChange,
  asNewMessage,
  caretAfterChange,
  checkDraft,
  draftFromComment,
  insertMention,
  MAX_MENTIONS,
  MAX_TEXT_CODE_POINTS,
  mentionQueryAt,
  withoutRejectedMentions,
} from '../composer';
import type { CommentDraft } from '../types';
import { comment, serverFailure } from './fakes';

const draft = (text: string, mentions: [number | null, number, number][] = []): CommentDraft => ({
  text,
  mentions: mentions.map(([userId, start, end]) => ({ user_id: userId, start, end })),
});
const ranges = (value: CommentDraft) => value.mentions.map((mention) => [mention.user_id, mention.start, mention.end]);
const slices = (value: CommentDraft) => value.mentions.map((mention) => value.text.slice(mention.start, mention.end));

describe('mentions while the text is edited', () => {
  it('moves a mention when text is typed or pasted before it and keeps it when typed after', () => {
    const start = draft('@Анна, привет', [[4, 0, 5]]);
    const typedBefore = applyTextChange(start, 'Да, @Анна, привет');
    assert.deepEqual(ranges(typedBefore), [[4, 4, 9]]);
    assert.deepEqual(slices(typedBefore), ['@Анна']);

    assert.deepEqual(ranges(applyTextChange(start, '@Анна, привет!')), [[4, 0, 5]]);
    assert.deepEqual(ranges(applyTextChange(draft('@Анна', [[4, 0, 5]]), '@Анна,')), [[4, 0, 5]], 'typed right after it');

    const pasted = applyTextChange(draft('текст @Пётр', [[2, 6, 11]]), 'очень длинный текст @Пётр');
    assert.deepEqual(slices(pasted), ['@Пётр']);
  });

  it('turns a mention into plain text once its name is changed, keeping the others', () => {
    const start = draft('@Анна и @Пётр', [[4, 0, 5], [2, 8, 13]]);
    assert.deepEqual(ranges(applyTextChange(start, '@Аннна и @Пётр')), [[2, 9, 14]]);
    const cut = applyTextChange(start, '@Пётр');
    assert.deepEqual(ranges(cut), [[2, 0, 5]]);
    assert.deepEqual(slices(cut), ['@Пётр']);
  });

  it('counts an emoji as two UTF-16 units, as the server does for offsets', () => {
    const shifted = applyTextChange(draft('@Пётр', [[2, 0, 5]]), '👍 @Пётр');
    assert.deepEqual(ranges(shifted), [[2, 3, 8]]);
    assert.deepEqual(slices(shifted), ['@Пётр']);
  });

  it('keeps the same draft when the text did not change', () => {
    const start = draft('@Анна', [[4, 0, 5]]);
    assert.equal(applyTextChange(start, '@Анна'), start);
  });
});

describe('the cursor after a change', () => {
  it('stands at the end of what was typed, pasted or erased', () => {
    assert.equal(caretAfterChange('Привет, ', 'Привет, @'), 9);
    assert.equal(caretAfterChange('Привет мир', 'Привет, мир'), 7);
    assert.equal(caretAfterChange('текст @Пётр', 'очень длинный текст @Пётр'), 14);
    assert.equal(caretAfterChange('@Анна и @Пётр', '@Пётр'), 1);
    assert.equal(caretAfterChange('', 'Ок'), 2);
  });
});

describe('the @ query at the cursor', () => {
  it('starts at an @ at the beginning of a word and may hold the words of a full name', () => {
    assert.deepEqual(mentionQueryAt(draft('Привет @Ива'), 11), { start: 7, end: 11, query: 'Ива' });
    assert.deepEqual(mentionQueryAt(draft('@'), 1), { start: 0, end: 1, query: '' });
    assert.deepEqual(mentionQueryAt(draft('(@Иванов Иван'), 13), { start: 1, end: 13, query: 'Иванов Иван' });
  });

  it('is not an address, a new line, a leading space, a long sentence or an existing mention', () => {
    assert.equal(mentionQueryAt(draft('mail@test'), 9), null);
    assert.equal(mentionQueryAt(draft('@Иван\nпривет'), 12), null);
    assert.equal(mentionQueryAt(draft('@ Иван'), 6), null);
    assert.equal(mentionQueryAt(draft('@раз два три четыре пять'), 24), null);
    assert.equal(mentionQueryAt(draft(`@${'а'.repeat(50)}`), 51)?.query.length, 50);
    assert.equal(mentionQueryAt(draft(`@${'а'.repeat(51)}`), 52), null);
    assert.equal(mentionQueryAt(draft('@Анна', [[4, 0, 5]]), 5), null);
    assert.equal(mentionQueryAt(draft('@Анна текст', [[4, 0, 5]]), 2), null);
    assert.equal(mentionQueryAt(draft('Привет'), 0), null);
  });
});

describe('choosing a person', () => {
  it('writes @full name and a space, binds it to the person and puts the cursor after it', () => {
    const query = mentionQueryAt(draft('Привет @Пе'), 10);
    assert.ok(query);
    const { draft: next, cursor } = insertMention(draft('Привет @Пе'), query, { id: 2, full_name: 'Петров Пётр' });
    assert.equal(next.text, 'Привет @Петров Пётр ');
    assert.deepEqual(ranges(next), [[2, 7, 19]]);
    assert.equal(cursor, 20);
  });

  it('adds no second space before the one already there and puts the cursor after it', () => {
    const start = draft('Привет @Пе мир');
    const query = mentionQueryAt(start, 10);
    assert.ok(query);
    const { draft: next, cursor } = insertMention(start, query, { id: 2, full_name: 'Петров Пётр' });
    assert.equal(next.text, 'Привет @Петров Пётр мир');
    assert.equal(cursor, 20);
  });

  it('moves the mentions after it and adds no space before punctuation', () => {
    const start = draft('@Пе, @Анна', [[4, 5, 10]]);
    const query = mentionQueryAt(start, 3);
    assert.ok(query);
    const { draft: next, cursor } = insertMention(start, query, { id: 2, full_name: 'Петров Пётр' });
    assert.equal(next.text, '@Петров Пётр, @Анна');
    assert.deepEqual(ranges(next), [[2, 0, 12], [4, 14, 19]]);
    assert.deepEqual(slices(next), ['@Петров Пётр', '@Анна']);
    assert.equal(cursor, 12);
  });
});

describe('what can be sent', () => {
  it('needs visible text within the limits', () => {
    assert.equal(checkDraft(draft('')).canSend, false);
    assert.equal(checkDraft(draft(' \n\t')).blank, true);
    assert.equal(checkDraft(draft('\u200b\ufeff')).blank, true);
    assert.equal(checkDraft(draft('Ок')).canSend, true);
  });

  it('counts length in code points: an emoji is one character', () => {
    const atLimit = checkDraft(draft('😀'.repeat(MAX_TEXT_CODE_POINTS)));
    assert.deepEqual([atLimit.length, atLimit.tooLong, atLimit.canSend], [MAX_TEXT_CODE_POINTS, false, true]);
    assert.equal(checkDraft(draft('😀'.repeat(MAX_TEXT_CODE_POINTS + 1))).tooLong, true);
  });

  it('allows no more mentions than the server takes', () => {
    const text = '@А '.repeat(MAX_MENTIONS + 1);
    const many = draft(text, Array.from({ length: MAX_MENTIONS + 1 }, (_, index): [number, number, number] => [index + 1, index * 3, index * 3 + 2]));
    assert.equal(checkDraft(many).tooManyMentions, true);
    assert.equal(checkDraft({ ...many, mentions: many.mentions.slice(0, MAX_MENTIONS) }).canSend, true);
  });
});

describe('drafts of edits and failed messages', () => {
  it('edits a comment with its mentions, those of deleted accounts too, which a new message cannot keep', () => {
    const own = comment(1, {
      text: '@Анна и @Бывший',
      mentions: [
        { user_id: 4, start: 0, end: 5, label: 'Анна' },
        { user_id: null, start: 8, end: 15, label: 'Бывший' },
      ],
    });
    const edit = draftFromComment(own);
    assert.deepEqual(ranges(edit), [[4, 0, 5], [null, 8, 15]]);
    assert.deepEqual(ranges(asNewMessage(edit)), [[4, 0, 5]]);
  });

  it('drops the mentions the server refused, by their number in the request', () => {
    const sent = draft('@Анна и @Пётр', [[4, 0, 5], [2, 8, 13]]);
    const refused = serverFailure(409, 'MENTION_NOT_AVAILABLE');
    refused.details = [{ field: 'mentions.1', message: 'Этого человека нельзя упомянуть в задаче' }];
    assert.deepEqual(ranges(withoutRejectedMentions(sent, refused)), [[4, 0, 5]]);
    assert.equal(withoutRejectedMentions(sent, serverFailure(409, 'MENTION_NOT_AVAILABLE')), sent);
  });

  it('drops a mention with a malformed part too, but nothing for a problem of the text', () => {
    const sent = draft('@Анна и @Пётр', [[4, 0, 5], [2, 8, 13]]);
    const invalid = serverFailure(400, 'VALIDATION_ERROR');
    invalid.details = [
      { field: 'mentions.0.end', message: 'Неверный конец упоминания' },
      { field: 'text', message: 'Слишком длинный текст' },
    ];
    assert.deepEqual(ranges(withoutRejectedMentions(sent, invalid)), [[2, 8, 13]]);
    invalid.details = [{ field: 'mentions', message: 'Слишком много упоминаний' }];
    assert.equal(withoutRejectedMentions(sent, invalid), sent);
  });
});
