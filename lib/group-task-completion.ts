import { Alert } from 'react-native';

import type { GroupTaskFields } from '@/lib/user-tasks-api';

type ToggleSource = GroupTaskFields & { completed: boolean };

export function isGroupTask(task: GroupTaskFields | null | undefined): boolean {
  return Boolean(task?.assignment_type);
}

/** Почему текущий пользователь не может переключить общий статус (null — может). */
export function groupToggleBlockedReason(task: ToggleSource): string | null {
  if (!isGroupTask(task) || !task.group_permissions) return null;
  if (task.completed) {
    return task.group_permissions.can_reopen
      ? null
      : 'Вернуть задачу в работу может автор или ответственный, который её завершил.';
  }
  if (task.group_permissions.can_complete) return null;
  if (task.responsible?.full_name) {
    return `Завершить задачу может только ответственный: ${task.responsible.full_name}.`;
  }
  return 'Завершить групповую задачу может только её участник.';
}

/**
 * Перед переключением галочки групповой задачи: объяснить запрет или подтвердить
 * завершение для всех участников. «Отмена» не меняет статус ни у кого.
 * Для обычных задач сразу true.
 */
export function confirmGroupTaskToggle(task: ToggleSource): Promise<boolean> {
  if (!isGroupTask(task)) return Promise.resolve(true);
  const blocked = groupToggleBlockedReason(task);
  if (blocked) {
    Alert.alert('Групповая задача', blocked);
    return Promise.resolve(false);
  }
  if (task.completed) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      'Групповая задача',
      'Завершить задачу для всех участников?',
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Завершить', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}

/** Подтверждение массового назначения компании / отдела перед созданием задачи. */
export function confirmMassAssignment(message: string | null): Promise<boolean> {
  if (!message) return Promise.resolve(true);
  return new Promise((resolve) => {
    Alert.alert(
      'Назначение',
      message,
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Продолжить', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) }
    );
  });
}
