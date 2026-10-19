import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  formatExecutorSpecialty,
  formatServiceCategoryDisplayName,
  formatServiceCategoryName,
  getServiceCategoryVisualMeta,
  isExecutorServiceCategory,
} from '../../constants/requests';

describe('executor service categories', () => {
  it('does not offer the administration category to executors', () => {
    for (const name of ['Администрация', 'администрация офиса', 'Административные вопросы', 'Administrative']) {
      assert.equal(isExecutorServiceCategory(name), false, name);
    }
  });

  it('keeps service categories available to executors', () => {
    for (const name of ['КТО', 'Клининг', 'Cleaning', 'Техническое обслуживание', 'Электрика']) {
      assert.equal(isExecutorServiceCategory(name), true, name);
    }
  });
});

describe('tech direction names', () => {
  it('shows the former «КТО» category as «Техника»', () => {
    for (const name of ['КТО', ' кто ', 'KTO']) {
      assert.equal(formatServiceCategoryName(name), 'Техника', name);
      assert.equal(formatServiceCategoryDisplayName(name), 'Техника', name);
      assert.equal(getServiceCategoryVisualMeta(name).title, 'Техника', name);
    }
    assert.equal(formatServiceCategoryName('КТО (3 этаж)'), 'Техника (3 этаж)');
    assert.equal(formatServiceCategoryName('Офис / KTO'), 'Офис / Техника');
    assert.equal(
      formatServiceCategoryDisplayName('Ремонт КТО и прочие работы по офису'),
      'Ремонт Техника и прочие работы по офису'
    );
  });

  it('keeps other category names as the administrator named them', () => {
    assert.equal(formatServiceCategoryName('Техническое обслуживание'), 'Техническое обслуживание');
    assert.equal(formatServiceCategoryName(' Электрика '), 'Электрика');
    assert.equal(formatServiceCategoryName('ЭКТОР'), 'ЭКТОР');
    assert.equal(formatServiceCategoryName(null), '');
  });

  it('calls a tech executor «Техник»', () => {
    for (const specialty of ['КТО', 'кто', 'KTO', 'Техника', ' техника ']) {
      assert.equal(formatExecutorSpecialty(specialty), 'Техник', specialty);
    }
    assert.equal(formatExecutorSpecialty('Старший КТО'), 'Старший Техник');
    assert.equal(formatExecutorSpecialty('электрик'), 'электрик');
    assert.equal(formatExecutorSpecialty('Клининг'), 'Клининг');
    assert.equal(formatExecutorSpecialty(undefined), '');
  });
});
