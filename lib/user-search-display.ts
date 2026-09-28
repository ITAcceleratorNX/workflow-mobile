import type { UserSearchItem } from '@/lib/api';
import { employeeSubtitle } from '@/lib/employee-display';

const NO_COMPANY_LABEL = 'компания не указана';

type SearchedUser = Pick<UserSearchItem, 'full_name' | 'company' | 'department' | 'position'>;

/** «Компания · Отдел · Должность»; без компании — «компания не указана · Должность». */
export function formatUserSearchSubtitle(user: Omit<SearchedUser, 'full_name'>): string {
  const companyName = user.company?.name?.trim();
  const context = companyName ? [companyName, user.department?.name] : [NO_COMPANY_LABEL];
  return employeeSubtitle([...context, user.position]) ?? NO_COMPANY_LABEL;
}

/** «Имя — Компания · Отдел · Должность» или «Имя — компания не указана». */
export function formatUserSearchLabel(user: SearchedUser): string {
  const name = user.full_name?.trim() || 'Пользователь';
  return `${name} — ${formatUserSearchSubtitle(user)}`;
}
