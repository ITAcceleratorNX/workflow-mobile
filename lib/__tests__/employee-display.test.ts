import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { employeeSubtitle, matchesEveryWord, positionForSave } from '../employee-display';
import { formatUserSearchLabel } from '../user-search-display';

describe('employee search in the pickers', () => {
  const accountant = ['Иванова Алёна', 'Главный бухгалтер'];

  it('finds by position like by name, ignoring case and ё', () => {
    assert.equal(matchesEveryWord('бухгалтер', accountant), true);
    assert.equal(matchesEveryWord('БУХГАЛТЕР', accountant), true);
    assert.equal(matchesEveryWord('алена', accountant), true);
    assert.equal(matchesEveryWord('  главный   бухг ', accountant), true, 'Several words, any spacing');
  });

  it('needs every word, taken from the name or the position', () => {
    assert.equal(matchesEveryWord('иванова бухгалтер', accountant), true);
    assert.equal(matchesEveryWord('бухгалтер продаж', accountant), false);
  });

  it('matches everyone on an empty query and nobody without a position by position', () => {
    assert.equal(matchesEveryWord('   ', accountant), true);
    assert.equal(matchesEveryWord('бухгалтер', ['Петров Пётр', null]), false);
  });
});

describe('employee subtitle', () => {
  it('shows company, department and position of an external employee', () => {
    assert.equal(
      employeeSubtitle(['Extra Space', 'Коммерческий отдел', 'Sales Manager']),
      'Extra Space · Коммерческий отдел · Sales Manager'
    );
  });

  it('never shows an empty position, and nothing when there is nothing to show', () => {
    assert.equal(employeeSubtitle([null, 'Финансы', '  ']), 'Финансы');
    assert.equal(employeeSubtitle([null, undefined, '']), null);
  });

  it('labels a searched user with the company, the department and the position', () => {
    const company = { id: 1, name: 'Extra Space' };
    const department = { id: 2, name: 'Коммерческий отдел' };
    assert.equal(
      formatUserSearchLabel({ full_name: 'Иван Иванов', company, department, position: 'Sales Manager' }),
      'Иван Иванов — Extra Space · Коммерческий отдел · Sales Manager'
    );
    assert.equal(formatUserSearchLabel({ full_name: 'Иван Иванов', company, position: null }), 'Иван Иванов — Extra Space');
    assert.equal(
      formatUserSearchLabel({ full_name: 'Иван Иванов', company: null, position: 'Бухгалтер' }),
      'Иван Иванов — компания не указана · Бухгалтер'
    );
  });
});

describe('position in the profile', () => {
  it('keeps the text without edge spaces; an empty field clears the position', () => {
    assert.equal(positionForSave('  Project Manager '), 'Project Manager');
    assert.equal(positionForSave('   '), null);
    assert.equal(positionForSave(''), null);
  });
});
