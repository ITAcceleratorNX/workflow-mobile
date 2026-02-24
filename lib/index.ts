/**
 * API и конфигурация приложения.
 * - config: базовый URL бэкенда
 * - api: офисы, категории, создание заявки на регистрацию
 * - auth: отправка и проверка SMS-кода верификации
 * - registration: константы и утилиты для экрана регистрации
 */

export { config } from './config';
export {
  getOffices,
  getServiceCategoriesPublic,
  createRegistrationRequest,
  type Office,
  type ServiceCategory,
  type CreateRegistrationRequestBody,
} from './api';
export {
  sendVerificationCode,
  verifyCode,
  type VerificationPurpose,
  type VerificationResult,
} from './auth';
export {
  REGISTRATION_ROLES,
  PHONE_REGEX,
  INITIAL_REGISTRATION_FORM,
  formatPhone,
} from './registration';
