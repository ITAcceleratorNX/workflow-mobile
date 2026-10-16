import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  executorAccessCoversOffice,
  formatExecutorOfficeAccess,
  isExecutorOfficeAccessValid,
  readExecutorOfficeAccess,
  sameExecutorOfficeAccess,
  toggleExecutorOffice,
} from '../executor-office-access';

const offices = [
  { id: 1, name: 'Савановю' },
  { id: 2, name: 'Байтерек' },
  { id: 3, name: 'Нурлы' },
];

describe('executor office access', () => {
  it('reads the access from a user of the API and from an executor of the list', () => {
    assert.deepEqual(
      readExecutorOfficeAccess(
        { executor: { all_offices: false, executorOffices: [{ office_id: 3 }, { office_id: 1 }] } },
        1
      ),
      { all_offices: false, office_ids: [1, 3] }
    );
    assert.deepEqual(readExecutorOfficeAccess({ executor: { all_offices: true, executorOffices: [] } }, 1), {
      all_offices: true,
      office_ids: [],
    });
    assert.deepEqual(readExecutorOfficeAccess({ office_access: { all_offices: false, office_ids: [2] } }), {
      all_offices: false,
      office_ids: [2],
    });
  });

  it('keeps the own office of an executor without a saved choice', () => {
    assert.deepEqual(readExecutorOfficeAccess({ executor: { all_offices: false, executorOffices: [] } }, 2), {
      all_offices: false,
      office_ids: [2],
    });
    assert.equal(readExecutorOfficeAccess({ role: 'client' }, 2), null);
  });

  it('toggles several offices; a single office leaves «All offices»', () => {
    let access = { all_offices: false, office_ids: [1] };
    access = toggleExecutorOffice(access, 3);
    assert.deepEqual(access, { all_offices: false, office_ids: [1, 3] });
    access = toggleExecutorOffice(access, 1);
    assert.deepEqual(access, { all_offices: false, office_ids: [3] });
    assert.deepEqual(toggleExecutorOffice({ all_offices: true, office_ids: [] }, 2), {
      all_offices: false,
      office_ids: [2],
    });
  });

  it('refuses an empty choice and compares choices regardless of order', () => {
    assert.equal(isExecutorOfficeAccessValid({ all_offices: false, office_ids: [] }), false);
    assert.equal(isExecutorOfficeAccessValid({ all_offices: true, office_ids: [] }), true);
    assert.equal(
      sameExecutorOfficeAccess({ all_offices: false, office_ids: [2, 1] }, { all_offices: false, office_ids: [1, 2] }),
      true
    );
    assert.equal(
      sameExecutorOfficeAccess({ all_offices: true, office_ids: [] }, { all_offices: false, office_ids: [1] }),
      false
    );
  });

  it('labels the choice and covers offices created later with «All offices»', () => {
    assert.equal(formatExecutorOfficeAccess({ all_offices: true, office_ids: [] }, offices), 'Все офисы');
    assert.equal(formatExecutorOfficeAccess({ all_offices: false, office_ids: [1, 2] }, offices), 'Савановю, Байтерек');
    assert.equal(formatExecutorOfficeAccess({ all_offices: false, office_ids: [1, 2, 3] }, offices), '3 офиса');
    assert.equal(executorAccessCoversOffice({ all_offices: true, office_ids: [] }, 99), true);
    assert.equal(executorAccessCoversOffice({ all_offices: false, office_ids: [1, 3] }, 2), false);
  });
});
