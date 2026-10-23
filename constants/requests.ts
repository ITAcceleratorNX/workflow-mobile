/**
 * Централизованные константы и хелперы для заявок (requests).
 */

import type { ThemeColorName } from '@/constants/theme';

export const STATUS_LABELS: Record<string, string> = {
  completed: 'Завершено',
  in_progress: 'В обработке',
  awaiting_assignment: 'Ожидает назначения',
  execution: 'Исполнение',
  awaiting_admin_review: 'На проверке',
  awaiting_confirmation: 'Ожидает подтверждения',
  assigned: 'Назначена',
  rejected: 'Отклонена',
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

/** Цвета бейджа статуса (семантические токены темы). */
export function getStatusBadgeTheme(status: string): {
  bg: ThemeColorName;
  text: ThemeColorName;
} {
  switch (status) {
    case 'completed':
      return { bg: 'successSoft', text: 'success' };
    case 'rejected':
    case 'cancelled':
      return { bg: 'dangerSoft', text: 'danger' };
    case 'in_progress':
    case 'execution':
    case 'assigned':
    case 'awaiting_assignment':
      return { bg: 'infoSoft', text: 'info' };
    case 'awaiting_admin_review':
    case 'awaiting_confirmation':
      return { bg: 'warningSoft', text: 'warning' };
    default:
      return { bg: 'surfaceElevated', text: 'textSecondary' };
  }
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

/** Прежнее название технического направления — аббревиатура «КТО» (в БД её заменила миграция). */
const LEGACY_TECH_NAMES = ['кто', 'kto'];
const LEGACY_TECH_ABBREVIATION = /(^|[^0-9A-Za-zА-Яа-яЁё])(?:КТО|KTO)(?=$|[^0-9A-Za-zА-Яа-яЁё])/g;

function replaceLegacyTechName(text: string | undefined | null, replacement: string): string {
  const t = text?.trim() ?? '';
  if (LEGACY_TECH_NAMES.includes(t.toLowerCase())) return replacement;
  return t.replace(LEGACY_TECH_ABBREVIATION, `$1${replacement}`);
}

/**
 * Название категории, как его завёл администратор, но без аббревиатуры «КТО» — для
 * справочников и управления, где категории различаются по собственному названию.
 */
export function formatServiceCategoryName(apiCategoryName: string | undefined | null): string {
  return replaceLegacyTechName(apiCategoryName, 'Техника');
}

/** Специальность Исполнителя: у технического направления — «Техник». */
export function formatExecutorSpecialty(specialty: string | undefined | null): string {
  const t = replaceLegacyTechName(specialty, 'Техник');
  return t.toLowerCase() === 'техника' ? 'Техник' : t;
}

/**
 * Категорию можно назначить Исполнителю. «Администрация» — направление заявок
 * Офис-менеджера: Исполнителю её не назначают (бэк отклонит такой выбор).
 */
export function isExecutorServiceCategory(apiCategoryName: string | undefined | null): boolean {
  return classifyServiceCategory(apiCategoryName) !== 'admin';
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
    default:
      return formatServiceCategoryName(apiCategoryName) || 'Не указано';
  }
}

/**
 * Административная заявка: её ведёт офис-менеджер, администратор только
 * наблюдает (не подтверждает, не перенаправляет, не назначает исполнителя).
 * Признак — все подзаявки в админ-категориях; смешанная заявка идёт обычным
 * сервисным маршрутом через администратора.
 */
export function isAdministrativeRequestGroup(request: {
  requests?: { category?: { name?: string } | null }[] | null;
}): boolean {
  const subRequests = request.requests ?? [];
  if (subRequests.length === 0) return false;
  return subRequests.every(
    (sub) => classifyServiceCategory(sub?.category?.name) === 'admin'
  );
}

/** Минимальный вид категории офиса для подбора соответствия. */
export interface OfficeServiceCategory {
  id: number;
  name: string;
}

/**
 * Категории привязаны к офису (service_categories.office_id), поэтому при смене
 * офиса у заявки прежний category_id остаётся чужим: исполнители подбираются по
 * офису категории, и дальнейший флоу уходит в старый офис.
 * Подбирает категорию нового офиса: сначала по точному названию, затем по
 * направлению (Техника / Клининг / Админ). Без совпадения — undefined: категорию
 * выбирает администратор.
 */
export function matchServiceCategoryInOffice(
  sourceCategoryName: string | undefined | null,
  officeCategories: OfficeServiceCategory[]
): number | undefined {
  const source = sourceCategoryName?.trim();
  if (!source || officeCategories.length === 0) return undefined;

  const lower = source.toLowerCase();
  const byName = officeCategories.find((c) => c.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;

  const kind = classifyServiceCategory(source);
  if (kind === 'other') return undefined;

  return officeCategories.find((c) => classifyServiceCategory(c.name) === kind)?.id;
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
        title: formatServiceCategoryName(apiCategoryName) || 'Категория',
        description: null,
        icon: 'category',
      };
  }
}

export const LONG_TERM_LABEL = 'Долгосрочная';

/** Заявка помечена как долгосрочная (не для повторяющихся). */
export function isLongTermRequestGroup(request: {
  request_type?: string;
  requests?: { is_long_term?: boolean }[];
}): boolean {
  if (request.request_type === 'recurring') return false;
  return (request.requests ?? []).some((req) => req.is_long_term);
}
