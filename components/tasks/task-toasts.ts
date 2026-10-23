import type { useToast } from '@/context/toast-context';

type ShowToast = ReturnType<typeof useToast>['show'];

/** Figma «Тост · успешн»: a short confirmation with a close button. */
export function toastTaskCompleted(show: ShowToast) {
  show({ variant: 'success', title: 'Задача выполнена', duration: 3000 });
}

/**
 * Figma «Ошибка удаления»: the task stays where it was; a lost connection says so and offers
 * «Повторить», any other failure shows the server's reason.
 */
export function toastTaskDeleteFailed(show: ShowToast, failure: { error: string; network: boolean }, retry: () => void) {
  show({
    variant: 'error',
    title: 'Не удалось удалить задачу',
    description: failure.network ? 'Нет соединения с интернетом. Задача осталась на месте.' : failure.error,
    icon: failure.network ? 'wifi-off' : undefined,
    duration: 8000,
    action: { label: 'Повторить', onPress: retry },
  });
}

/** Any other failed change of a task, with the server's reason. */
export function toastTaskError(show: ShowToast, title: string, description: string) {
  show({ variant: 'error', title, description, duration: 5000 });
}
