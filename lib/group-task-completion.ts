import { Alert } from 'react-native';

import type { GroupTaskFields } from '@/lib/user-tasks-api';

type ToggleSource = GroupTaskFields & { completed: boolean };

export function isGroupTask(task: GroupTaskFields | null | undefined): boolean {
  return Boolean(task?.assignment_type);
}

/** Задача передана и осталась у пользователя только для просмотра. */
export function isReadOnlyTask(task: Pick<GroupTaskFields, 'task_permissions'> | null | undefined): boolean {
  return task?.task_permissions?.read_only === true;
}

/** Почему текущий пользователь не может переключить статус задачи (null — может). */
export function taskToggleBlockedReason(task: ToggleSource): string | null {
  if (isReadOnlyTask(task)) {
    return 'Задача передана другому получателю. Вы можете её просматривать, но не менять статус.';
  }
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
 * Перед переключением галочки: объяснить запрет (задача только для просмотра, правило групповой
 * задачи) или подтвердить завершение групповой задачи для всех участников. «Отмена» не меняет
 * статус ни у кого. Для обычной задачи с правами сразу true.
 */
export function confirmTaskToggle(task: ToggleSource): Promise<boolean> {
  const blocked = taskToggleBlockedReason(task);
  if (blocked) {
    Alert.alert(isGroupTask(task) ? 'Групповая задача' : 'Только просмотр', blocked);
    return Promise.resolve(false);
  }
  if (!isGroupTask(task)) return Promise.resolve(true);
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

/** «Передать задачу: Отдел Финансы?» — «Отмена» не меняет ни получателя, ни задачу. */
export function confirmTaskTransfer(recipientLabel: string): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(
      'Передача задачи',
      `Передать задачу: ${recipientLabel}?`,
      [
        { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Передать', onPress: () => resolve(true) },
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
