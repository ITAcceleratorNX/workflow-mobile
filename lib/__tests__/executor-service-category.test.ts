import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { isExecutorServiceCategory } from '../../constants/requests';

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
