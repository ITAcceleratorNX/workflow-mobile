import { requireOptionalNativeModule } from 'expo-modules-core';

import type { WidgetTimelineEntry } from './model';

type WorkflowWidgetsNative = {
  setTimeline(json: string): Promise<void>;
};

const native = requireOptionalNativeModule<WorkflowWidgetsNative>('WorkflowWidgets');

export function publishWidgetTimeline(entries: WidgetTimelineEntry[]): void {
  if (!native || entries.length === 0) return;
  const payload = {
    entries: entries.map((entry) => ({
      at: Date.parse(entry.at),
      eyebrow: entry.snapshot.eyebrow,
      title: entry.snapshot.title,
      subtitle: entry.snapshot.subtitle,
      url: entry.snapshot.url,
    })),
  };
  void native.setTimeline(JSON.stringify(payload)).catch((error: unknown) => {
    console.warn('[widgets] не удалось обновить виджет Android', error);
  });
}

export function publishWidgetActions(): void {}
