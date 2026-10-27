import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  WIDGET_HREFS,
  WIDGET_URLS,
  buildWidgetTimeline,
  canOpenWidgetDestination,
  isWidgetAppHref,
  parseWidgetLink,
  pickNearestTask,
  snapshotWhenRefreshFailed,
  type WidgetTask,
  type WorkflowWidgetSnapshot,
} from '../widgets/model';

function task(partial: Partial<WidgetTask> & Pick<WidgetTask, 'id' | 'title'>): WidgetTask {
  return {
    completed: false,
    scheduledAt: null,
    deadlineTo: null,
    deadlineTime: null,
    inbox: false,
    priority: 'medium',
    ...partial,
  };
}

/** 27 октября 2026, 10:00 в Алматы. */
const MORNING = new Date('2026-10-27T05:00:00.000Z');

describe('nearest workflow task', () => {
  it('picks the task closest to now and prefers one that has not started', () => {
    const tasks = [
      task({ id: 1, title: 'Утро', scheduledAt: '2026-10-27T04:00:00.000Z' }),
      task({ id: 2, title: 'День', scheduledAt: '2026-10-27T06:00:00.000Z' }),
      task({ id: 3, title: 'Вечер', scheduledAt: '2026-10-27T10:00:00.000Z' }),
    ];
    assert.equal(pickNearestTask(tasks, MORNING)?.id, 2);
  });

  it('keeps a past task while it is still closer than the next one', () => {
    const tasks = [
      task({ id: 1, title: 'Утро', scheduledAt: '2026-10-27T04:00:00.000Z' }),
      task({ id: 2, title: 'Вечер', scheduledAt: '2026-10-27T10:00:00.000Z' }),
    ];
    assert.equal(pickNearestTask(tasks, new Date('2026-10-27T06:30:00.000Z'))?.id, 1);
    assert.equal(pickNearestTask(tasks, new Date('2026-10-27T07:30:00.000Z'))?.id, 2);
  });

  it('ignores completed tasks and tasks of another day', () => {
    const tasks = [
      task({ id: 1, title: 'Готово', completed: true, scheduledAt: '2026-10-27T05:10:00.000Z' }),
      task({ id: 2, title: 'Завтра', scheduledAt: '2026-10-28T05:00:00.000Z' }),
      task({ id: 3, title: 'Вчера', scheduledAt: '2026-10-26T05:00:00.000Z' }),
    ];
    assert.equal(pickNearestTask(tasks, MORNING), null);
  });

  it('uses the inbox deadline as today when there is no schedule', () => {
    const tasks = [
      task({
        id: 7,
        title: 'Срок',
        inbox: true,
        deadlineTo: '2026-10-27',
        deadlineTime: '11:30',
        priority: 'low',
      }),
    ];
    const nearest = pickNearestTask(tasks, MORNING);
    assert.equal(nearest?.id, 7);
  });

  it('orders tasks without a time by priority', () => {
    const tasks = [
      task({ id: 1, title: 'Обычная', inbox: true, deadlineTo: '2026-10-27', priority: 'low' }),
      task({ id: 2, title: 'Срочная', inbox: true, deadlineTo: '2026-10-27', priority: 'high' }),
    ];
    assert.equal(pickNearestTask(tasks, MORNING)?.id, 2);
  });

  it('switches the timeline at the midpoint and clears it at the next midnight', () => {
    const tasks = [
      task({ id: 1, title: 'Утро', scheduledAt: '2026-10-27T04:00:00.000Z' }),
      task({ id: 2, title: 'Вечер', scheduledAt: '2026-10-27T10:00:00.000Z' }),
    ];
    const timeline = buildWidgetTimeline(tasks, MORNING, 4, '2026-10-27T05:00:00.000Z');
    assert.equal(timeline[0]?.snapshot.taskId, 1);
    assert.equal(timeline[0]?.snapshot.eyebrow, '09:00');
    assert.equal(timeline[1]?.snapshot.taskId, 2);
    assert.equal(timeline[1]?.at, '2026-10-27T07:00:00.000Z');
    assert.equal(timeline.at(-1)?.snapshot.kind, 'empty');
    assert.equal(timeline.at(-1)?.at, '2026-10-27T19:00:00.000Z');
  });
});

describe('widget offline and auth', () => {
  const cached: WorkflowWidgetSnapshot = {
    kind: 'task',
    eyebrow: '10:00',
    title: 'Созвон',
    subtitle: '',
    inline: '10:00 Созвон',
    url: WIDGET_URLS.task(9),
    taskId: 9,
    dayKey: '2026-10-27',
    userId: 4,
    stale: false,
    fetchedAt: '2026-10-27T05:00:00.000Z',
  };

  it('keeps today task when the network fails', () => {
    const next = snapshotWhenRefreshFailed(cached, 4, MORNING);
    assert.equal(next.kind, 'task');
    assert.equal(next.taskId, 9);
    assert.equal(next.stale, true);
    assert.equal(next.subtitle, 'Нет сети');
  });

  it('does not show yesterday or another user after a failed refresh', () => {
    assert.equal(snapshotWhenRefreshFailed({ ...cached, dayKey: '2026-10-26' }, 4, MORNING).kind, 'offline');
    assert.equal(snapshotWhenRefreshFailed(cached, 8, MORNING).kind, 'offline');
    assert.equal(snapshotWhenRefreshFailed(null, 4, MORNING).kind, 'offline');
  });

  it('opens the task, the form, or login', () => {
    assert.equal(parseWidgetLink(WIDGET_URLS.task(12))?.href, WIDGET_HREFS.task(12));
    assert.equal(parseWidgetLink(WIDGET_URLS.createTask)?.href, WIDGET_HREFS.createTask);
    assert.equal(parseWidgetLink(WIDGET_URLS.createRequest)?.href, WIDGET_HREFS.createRequest);
    assert.equal(parseWidgetLink(WIDGET_URLS.tasks)?.href, WIDGET_HREFS.tasks);
    assert.equal(parseWidgetLink('https://app.tmk-workflow.kz?requestId=1'), null);
    assert.equal(parseWidgetLink('workflowmobile://widget/task/0'), null);
    assert.equal(canOpenWidgetDestination({ token: 'jwt', isGuest: false }), true);
    assert.equal(canOpenWidgetDestination({ token: null, isGuest: false }), false);
    assert.equal(canOpenWidgetDestination({ token: 'guest-demo', isGuest: true }), false);
    assert.equal(isWidgetAppHref(WIDGET_HREFS.createTask), true);
    assert.equal(isWidgetAppHref(WIDGET_HREFS.task(3)), true);
    assert.equal(isWidgetAppHref('/(tabs)'), false);
  });
});
