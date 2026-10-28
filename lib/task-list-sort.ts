/** Order of the «Входящие», «Сегодня» and «Предстоящие» lists: a field and a direction, sorted by the server. */

import type { TaskMainView } from '@/lib/task-views';

export type TaskSortField = 'deadline' | 'created_at' | 'priority';
export type TaskSortDirection = 'asc' | 'desc';
export type TaskSort = { field: TaskSortField; direction: TaskSortDirection };

export const DEFAULT_TASK_SORT: TaskSort = { field: 'deadline', direction: 'asc' };

/** Tabs with a chosen order; «Выполненные» keep the server's order. */
export const SORTABLE_TASK_VIEWS = ['inbox', 'today', 'upcoming'] as const;
export type SortableTaskView = (typeof SORTABLE_TASK_VIEWS)[number];

export function sortableTaskView(view: TaskMainView): SortableTaskView | null {
  return (SORTABLE_TASK_VIEWS as readonly TaskMainView[]).includes(view) ? (view as SortableTaskView) : null;
}

export const TASK_SORT_FIELDS: readonly { value: TaskSortField; label: string; short: string }[] = [
  { value: 'deadline', label: 'Сроку выполнения', short: 'По сроку' },
  { value: 'created_at', label: 'Дате создания', short: 'По дате' },
  { value: 'priority', label: 'Приоритету', short: 'По приоритету' },
];

export const TASK_SORT_DIRECTIONS: readonly { value: TaskSortDirection; label: string }[] = [
  { value: 'asc', label: 'По возрастанию' },
  { value: 'desc', label: 'По убыванию' },
];

/** Query parameters of GET /user-tasks. */
export function taskSortQuery(sort: TaskSort): { sortBy: TaskSortField; sortDirection: TaskSortDirection } {
  return { sortBy: sort.field, sortDirection: sort.direction };
}

/** «По сроку» — the caption of the sort button. */
export function taskSortLabel(sort: TaskSort): string {
  return TASK_SORT_FIELDS.find((item) => item.value === sort.field)?.short ?? TASK_SORT_FIELDS[0].short;
}

/** A stored sort, or the default when the value is missing or from another version. */
export function parseTaskSort(raw: unknown): TaskSort {
  const value = raw as Partial<TaskSort> | null;
  const field = TASK_SORT_FIELDS.find((item) => item.value === value?.field)?.value;
  const direction = TASK_SORT_DIRECTIONS.find((item) => item.value === value?.direction)?.value;
  return field && direction ? { field, direction } : DEFAULT_TASK_SORT;
}
