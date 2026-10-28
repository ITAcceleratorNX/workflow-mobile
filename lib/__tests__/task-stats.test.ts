import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  asOfLabel,
  chartTicks,
  customPeriod,
  monthPeriod,
  periodPhrase,
  periodTitle,
  shiftPeriod,
  statsContent,
  weekPeriod,
  type TaskStats,
} from '../task-stats';

const TODAY = '2026-10-28';
const sample = (fields: Partial<TaskStats>): TaskStats => ({
  employee: null,
  period: { from: '2026-10-01', to: '2026-10-31', as_of: '', ended: false },
  total: 0, completed: 0, not_completed: 0, completion_percent: null, completed_on_time: 0, completed_late: 0,
  overdue: 0, on_track: 0, completed_in_period: 0, without_due: 0, daily: [], priorities: [], ...fields,
});

describe('task stats periods', () => {
  it('weeks run Monday to Sunday and step by whole weeks and months', () => {
    assert.deepEqual(weekPeriod(TODAY), { kind: 'week', from: '2026-10-26', to: '2026-11-01' });
    assert.deepEqual(shiftPeriod(monthPeriod('2026-12-15'), 1), { kind: 'month', from: '2027-01-01', to: '2027-01-31' });
    assert.deepEqual(customPeriod('2026-10-15', '2026-10-01'), { kind: 'custom', from: '2026-10-01', to: '2026-10-15' });
  });

  it('names the period as the screens do', () => {
    assert.equal(periodTitle(monthPeriod(TODAY)), 'Октябрь 2026');
    assert.equal(periodTitle(weekPeriod(TODAY)), '26 окт – 1 ноя');
    assert.equal(periodPhrase(monthPeriod(TODAY), TODAY), 'в октябре');
    assert.equal(asOfLabel(monthPeriod('2026-09-10'), TODAY), 'на 30 сентября');
    assert.deepEqual(chartTicks(monthPeriod(TODAY), 31).map((t) => t.label), ['1', '8', '15', '22', '31']);
  });

  it('chooses the screen state without computing a percentage itself', () => {
    assert.equal(statsContent(sample({})), 'empty');
    assert.equal(statsContent(sample({ without_due: 2 })), 'noDue');
    assert.equal(statsContent(sample({ total: 5, not_completed: 5, completion_percent: 0 })), 'data');
  });
});
