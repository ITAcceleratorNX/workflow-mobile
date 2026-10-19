/** Как на бэкенде (UpdateNotificationEmailDto): длиннее сервер не примет. */
export const NOTIFICATION_EMAIL_MAX_LENGTH = 255;

/** Простая проверка формата; точную делает сервер. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type NotificationEmailParseResult =
  | { ok: true; value: string | null }
  | { ok: false; error: string };

/** Значение поля → тело запроса: пробелы по краям отбрасываются, пустая строка — null (очистить). */
export function parseNotificationEmail(input: string): NotificationEmailParseResult {
  const value = input.trim();
  if (!value) return { ok: true, value: null };
  if (value.length > NOTIFICATION_EMAIL_MAX_LENGTH) {
    return { ok: false, error: `Email не длиннее ${NOTIFICATION_EMAIL_MAX_LENGTH} символов` };
  }
  if (!EMAIL_PATTERN.test(value)) return { ok: false, error: 'Некорректный email' };
  return { ok: true, value };
}
