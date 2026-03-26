import { usePushNotifications } from '@/hooks/use-push-notifications';

/** Должен рендериться внутри ToastProvider — хук показывает тосты при ошибках API с пуша. */
export function PushNotificationsHost(): null {
  usePushNotifications();
  return null;
}
