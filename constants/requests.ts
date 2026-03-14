/**
 * Централизованные константы и хелперы для заявок (requests).
 */

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершено',
  in_progress: 'В обработке',
  awaiting_assignment: 'Ожидает назначения',
  execution: 'Исполнение',
  assigned: 'Назначена',
  rejected: 'Отклонено',
  cancelled: 'Отменено',
};

export const TYPE_LABELS: Record<string, string> = {
  urgent: 'Экстренная',
  planned: 'Плановая',
  normal: 'Обычная',
};

export const REQUEST_TYPE_OPTIONS = [
  { value: 'normal', label: 'Обычная' },
  { value: 'urgent', label: 'Экстренная' },
  { value: 'planned', label: 'Плановая' },
];

/** Опции типа для формы создания (с повторяющейся) */
export const REQUEST_TYPE_OPTIONS_FOR_CREATE = [
  ...REQUEST_TYPE_OPTIONS,
  { value: 'recurring', label: 'Повторяющаяся' },
];

export const SLA_OPTIONS = [
  { value: '1h', label: '1 час' },
  { value: '4h', label: '4 часа' },
  { value: '8h', label: '8 часов' },
  { value: '1d', label: '1 день' },
  { value: '3d', label: '3 дня' },
  { value: '1w', label: '1 неделя' },
];

export const COMPLEXITY_OPTIONS = [
  { value: 'simple', label: 'Простая' },
  { value: 'medium', label: 'Средняя' },
  { value: 'complex', label: 'Сложная' },
];

export function getStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getTypeLabel(type: string): string {
  return TYPE_LABELS[type] ?? 'Обычная';
}
