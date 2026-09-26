import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { applyFresh, compareComments, holdsDraft, mergeComments, sameDraft } from '../feed';
import { comment, range, tombstone } from './fakes';

const ids = (items: { id: string }[]) => items.map((item) => item.id);

describe('order of the feed', () => {
  it('goes by creation time, then by id as a number', () => {
    const sameMoment = '2026-09-26T10:00:00.123Z';
    const items = [
      comment(10, { created_at: sameMoment }),
      comment(9, { created_at: sameMoment }),
      comment(3, { created_at: '2026-09-26T10:00:00.124Z' }),
      comment(100, { created_at: '2026-09-26T09:59:59.999Z' }),
    ];
    assert.deepEqual(ids([...items].sort(compareComments)), ['100', '9', '10', '3']);
  });
});

describe('merging pages', () => {
  it('keeps each comment once, in order, whatever order the pages came in', () => {
    assert.deepEqual(ids(mergeComments(range(5, 8), [...range(1, 6)].reverse())), ids(range(1, 8)));
  });

  it('keeps the newer version of a comment, so a late answer does not roll back an edit or a deletion', () => {
    const edited = comment(1, { text: 'Изменён', version: 2 });
    const deleted = tombstone(edited);
    assert.equal(mergeComments([edited], [comment(1)])[0].text, 'Изменён');
    assert.equal(mergeComments([deleted], [edited])[0].text, null);
    assert.equal(mergeComments([comment(1)], [deleted])[0].text, null);
  });

  it('takes the incoming copy of the same version: rights and the author’s name change without one', () => {
    const renamed = comment(1, { author: { id: 7, full_name: 'Иванова Анна' }, permissions: { can_edit: false, can_delete: false } });
    const [merged] = mergeComments([comment(1)], [renamed]);
    assert.equal(merged.author.full_name, 'Иванова Анна');
    assert.equal(merged.permissions.can_edit, false);
  });
});

describe('applying a re-read', () => {
  it('replaces the range it read and keeps comments written after the read began', () => {
    const current = [...range(1, 5), comment(9)];
    const fresh = [comment(1), comment(2, { text: 'Изменён', version: 2 }), ...range(3, 6)];
    const applied = applyFresh(current, fresh);
    assert.deepEqual(ids(applied), ['1', '2', '3', '4', '5', '6', '9']);
    assert.equal(applied[1].text, 'Изменён');
  });

  it('drops loaded comments older than what was read: between them a gap could stay', () => {
    assert.deepEqual(ids(applyFresh(range(1, 4), range(11, 14))), ids(range(11, 14)));
  });

  it('keeps everything when nothing was read', () => {
    assert.deepEqual(ids(applyFresh([comment(9)], [])), ['9']);
  });
});

describe('comparing content', () => {
  it('sees the same text and mentions, in any order of the mentions', () => {
    const a = { text: '@А и @Б', mentions: [{ user_id: 1, start: 0, end: 2 }, { user_id: 2, start: 5, end: 7 }] };
    const b = { text: '@А и @Б', mentions: [{ user_id: 2, start: 5, end: 7 }, { user_id: 1, start: 0, end: 2 }] };
    assert.equal(sameDraft(a, b), true);
    assert.equal(sameDraft(a, { ...b, mentions: [{ user_id: 1, start: 0, end: 2 }] }), false);
    assert.equal(sameDraft(a, { ...a, text: '@А и @В' }), false);
  });

  it('finds the draft in a live comment, never in a deleted one', () => {
    const live = comment(1, { text: '@А', mentions: [{ user_id: 1, start: 0, end: 2, label: 'А' }] });
    const draft = { text: '@А', mentions: [{ user_id: 1, start: 0, end: 2 }] };
    assert.equal(holdsDraft(live, draft), true);
    assert.equal(holdsDraft(tombstone(live), { text: '', mentions: [] }), false);
  });
});
