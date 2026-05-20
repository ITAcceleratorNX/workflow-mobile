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

/** Три основных направления сервисных заявок (названия для пользователя). */
export type ServiceCategoryKind = 'cleaning' | 'admin' | 'tech' | 'other';

const SERVICE_CATEGORY_DESCRIPTION: Record<
  Exclude<ServiceCategoryKind, 'other'>,
  string
> = {
  admin: 'офисные вопросы и поддержка',
  cleaning: 'уборка, чистота, мусор',
  tech: 'поломки, ремонт, оборудование',
};

/**
 * Классификация названия категории из API (синонимы: администрация, КТО, cleaning и т.д.).
 */
export function classifyServiceCategory(
  apiCategoryName: string | undefined | null
): ServiceCategoryKind {
  const t = apiCategoryName?.trim() ?? '';
  if (!t) return 'other';
  const lower = t.toLowerCase();

  if (lower.includes('клининг') || lower.includes('cleaning')) {
    return 'cleaning';
  }
  if (
    lower.includes('административ') ||
    lower.includes('administrativ') ||
    lower.includes('администрация')
  ) {
    return 'admin';
  }
  if (
    lower === 'кто' ||
    lower === 'kto' ||
    lower === 'cto' ||
    lower.includes('техник') ||
    lower.includes('техобслуж') ||
    lower.includes('техническое обслуживание') ||
    (lower.includes('кто') && lower.length <= 24)
  ) {
    return 'tech';
  }

  return 'other';
}

/**
 * Единый короткий заголовок направления для карточек, деталей и селектов:
 * «Админ», «Клининг», «Техника» и синонимы из API.
 */
export function formatServiceCategoryDisplayName(
  apiCategoryName: string | undefined | null
): string {
  const kind = classifyServiceCategory(apiCategoryName);
  switch (kind) {
    case 'cleaning':
      return 'Клининг';
    case 'admin':
      return 'Админ';
    case 'tech':
      return 'Техника';
    default: {
      const t = apiCategoryName?.trim() ?? '';
      return t || 'Не указано';
    }
  }
}

/** Имя глифа MaterialIcons для блока выбора категории на экране создания заявки. */
export type ServiceCategoryCardIcon =
  | 'assignment-ind'
  | 'cleaning-services'
  | 'handyman'
  | 'category';

export type ServiceCategoryVisualMeta = {
  title: string;
  description: string | null;
  icon: ServiceCategoryCardIcon;
};

/**
 * Заголовок, подпись и иконка для визуального блока категории (экран создания заявки).
 */
export function getServiceCategoryVisualMeta(
  apiCategoryName: string | undefined | null
): ServiceCategoryVisualMeta {
  const kind = classifyServiceCategory(apiCategoryName);
  const raw = apiCategoryName?.trim() ?? '';

  switch (kind) {
    case 'cleaning':
      return {
        title: 'Клининг',
        description: SERVICE_CATEGORY_DESCRIPTION.cleaning,
        icon: 'cleaning-services',
      };
    case 'admin':
      return {
        title: 'Админ',
        description: SERVICE_CATEGORY_DESCRIPTION.admin,
        icon: 'assignment-ind',
      };
    case 'tech':
      return {
        title: 'Техника',
        description: SERVICE_CATEGORY_DESCRIPTION.tech,
        icon: 'handyman',
      };
    default:
      return {
        title: raw || 'Категория',
        description: null,
        icon: 'category',
      };
  }
}

export const LONG_TERM_LABEL = 'Долгосрочная';

/** Заявка помечена как долгосрочная (не для повторяющихся). */
export function isLongTermRequestGroup(request: {
  request_type?: string;
  requests?: Array<{ is_long_term?: boolean }>;
}): boolean {
  if (request.request_type === 'recurring') return false;
  return (request.requests ?? []).some((req) => req.is_long_term);
}
