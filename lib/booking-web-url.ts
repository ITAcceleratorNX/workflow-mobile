import { config } from '@/lib/config';

/**
 * Публичная страница подтверждения брони в браузере (сканирование QR без приложения).
 * При деплое статики из `booking-web/` URL вида: `{origin}/confirm?id={bookingId}`.
 *
 * Приоритет: EXPO_PUBLIC_BOOKING_WEB_URL (без завершающего слэша), иначе webAppBaseUrl из config.
 */
export function getBookingConfirmationWebUrl(bookingId: number): string {
  const explicit =
    typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_BOOKING_WEB_URL
      ? String(process.env.EXPO_PUBLIC_BOOKING_WEB_URL).replace(/\/$/, '')
      : '';
  const base = explicit || config.webAppBaseUrl.replace(/\/$/, '');
  return `${base}/confirm?id=${bookingId}`;
}
