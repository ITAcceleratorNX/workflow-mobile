/**
 * Константы и утилиты для экрана регистрации.
 */

export const REGISTRATION_ROLES = [
  { value: 'client', label: 'Клиент' },
  { value: 'executor', label: 'Исполнитель' },
] as const;

export const PHONE_REGEX = /^\+7 \d{3} \d{3} \d{2} \d{2}$/;

export const INITIAL_REGISTRATION_FORM = {
  phone: '',
  full_name: '',
  office_id: '',
  role: '',
  service_category_id: '',
  password: '',
  confirm_password: '',
};

export function formatPhone(value: string): string {
  let numbers = value.replace(/\D/g, '');
  if (numbers.startsWith('8')) numbers = '7' + numbers.slice(1);
  if (!numbers.startsWith('7')) numbers = '7' + numbers;
  numbers = numbers.slice(0, 11);
  if (numbers.length <= 1) return '+7 ';
  if (numbers.length <= 4) return `+7 ${numbers.slice(1)}`;
  if (numbers.length <= 7)
    return `+7 ${numbers.slice(1, 4)} ${numbers.slice(4)}`;
  if (numbers.length <= 9)
    return `+7 ${numbers.slice(1, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7)}`;
  return `+7 ${numbers.slice(1, 4)} ${numbers.slice(4, 7)} ${numbers.slice(7, 9)} ${numbers.slice(9, 11)}`;
}
