export type TaskSortField = "created_at" | "deadline" | "priority";
export type TaskSortDirection = "asc" | "desc";
export type TaskSortValue = "default" | "created_at_desc" | "created_at_asc" | "deadline_asc" | "deadline_desc" | "priority_desc" | "priority_asc";

export const TASK_SORT_OPTIONS: { value: TaskSortValue; label: string; field?: TaskSortField; direction?: TaskSortDirection }[] = [
  { value: "default", label: "Обычный порядок" },
  { value: "created_at_desc", label: "Дата создания: сначала новые", field: "created_at", direction: "desc" },
  { value: "created_at_asc", label: "Дата создания: сначала старые", field: "created_at", direction: "asc" },
  { value: "deadline_asc", label: "Срок: сначала ранние", field: "deadline", direction: "asc" },
  { value: "deadline_desc", label: "Срок: сначала поздние", field: "deadline", direction: "desc" },
  { value: "priority_desc", label: "Приоритет: сначала высокий", field: "priority", direction: "desc" },
  { value: "priority_asc", label: "Приоритет: сначала низкий", field: "priority", direction: "asc" },
];

export function taskSortQuery(value: TaskSortValue): { sortBy?: TaskSortField; sortDirection?: TaskSortDirection } {
  const option = TASK_SORT_OPTIONS.find((item) => item.value === value);
  return option?.field ? { sortBy: option.field, sortDirection: option.direction } : {};
}
