import { requireOptionalNativeModule } from 'expo-modules-core';

import type { NearestTaskWidgetProps } from '@/widgets/NearestTaskWidget';

import type { WidgetTimelineEntry } from './model';

type TimelineWidget<T extends object> = {
  updateTimeline(entries: { date: Date; props: T }[]): void;
  updateSnapshot(props: T): void;
};

type ActionWidget = TimelineWidget<{ ready: boolean }>;

type WidgetHandles = {
  nearest: TimelineWidget<NearestTaskWidgetProps>;
  createTask: ActionWidget;
  createRequest: ActionWidget;
};

let widgets: WidgetHandles | null | undefined;

function getWidgets(): WidgetHandles | null {
  if (widgets !== undefined) return widgets;
  if (!requireOptionalNativeModule('ExpoWidgets')) {
    widgets = null;
    return null;
  }
  try {
    widgets = {
      nearest: require('@/widgets/NearestTaskWidget').default as TimelineWidget<NearestTaskWidgetProps>,
      createTask: require('@/widgets/CreateTaskWidget').default as ActionWidget,
      createRequest: require('@/widgets/CreateRequestWidget').default as ActionWidget,
    };
  } catch (error) {
    console.warn('[widgets] iOS-виджеты ещё не вшиты в сборку', error);
    widgets = null;
  }
  return widgets;
}

export function publishWidgetTimeline(entries: WidgetTimelineEntry[]): void {
  const handles = getWidgets();
  if (!handles || entries.length === 0) return;
  handles.nearest.updateTimeline(
    entries.map((entry) => ({
      date: new Date(entry.at),
      props: {
        eyebrow: entry.snapshot.eyebrow,
        title: entry.snapshot.title,
        inline: entry.snapshot.inline,
        url: entry.snapshot.url,
      },
    }))
  );
}

export function publishWidgetActions(): void {
  const handles = getWidgets();
  if (!handles) return;
  handles.createTask.updateSnapshot({ ready: true });
  handles.createRequest.updateSnapshot({ ready: true });
}
