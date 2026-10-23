import { useCallback, useEffect, useState } from 'react';

import { DEFAULT_TASK_SORT, parseTaskSort, type TaskSort } from '@/lib/task-list-sort';
import { persistStorage } from '@/lib/storage';

export type SortableTaskView = 'inbox' | 'today';

const STORAGE_KEY = 'workflow.tasks.sort.v1';
type StoredSorts = Record<SortableTaskView, TaskSort>;
const DEFAULTS: StoredSorts = { inbox: DEFAULT_TASK_SORT, today: DEFAULT_TASK_SORT };

/** The order chosen for each of «Входящие» and «Сегодня», remembered on this device. */
export function useTaskSortPreference() {
  const [sorts, setSorts] = useState<StoredSorts>(DEFAULTS);

  useEffect(() => {
    let cancelled = false;
    void persistStorage.getItem(STORAGE_KEY).then((raw) => {
      if (cancelled || !raw) return;
      try {
        const stored = JSON.parse(raw) as Partial<StoredSorts>;
        setSorts({ inbox: parseTaskSort(stored.inbox), today: parseTaskSort(stored.today) });
      } catch {
        // A damaged value: keep the defaults.
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const setSort = useCallback((view: SortableTaskView, sort: TaskSort) => {
    setSorts((previous) => {
      const next = { ...previous, [view]: sort };
      void persistStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { sorts, setSort };
}
