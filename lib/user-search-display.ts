import type { UserSearchItem } from '@/lib/api';

const NO_COMPANY_LABEL = 'компания не указана';

/** «Имя — Компания» или «Имя — компания не указана». */
export function formatUserSearchLabel(user: Pick<UserSearchItem, 'full_name' | 'company'>): string {
  const name = user.full_name?.trim() || 'Пользователь';
  const companyName = user.company?.name?.trim();
  if (companyName) return `${name} — ${companyName}`;
  return `${name} — ${NO_COMPANY_LABEL}`;
}

/** Подпись компании для вторичной строки в списке. */
export function formatUserSearchCompanySubtitle(
  user: Pick<UserSearchItem, 'company'>
): string {
  const companyName = user.company?.name?.trim();
  return companyName || NO_COMPANY_LABEL;
}
