import { createTaskComments, type CommentSession } from '@/lib/task-comments/store';
import { userTaskCommentsApi } from '@/lib/user-task-comments-api';
import { useAuthStore } from '@/stores/auth-store';

/**
 * Кэш комментариев принадлежит вошедшей учётной записи. Демо-режим — не учётная запись:
 * его токен сервер не принимает, комментариев в нём нет.
 */
const authSession: CommentSession = {
  current() {
    const { token, isGuest, user } = useAuthStore.getState();
    return token && !isGuest && user ? String(user.id) : null;
  },
  subscribe: (listener) => useAuthStore.subscribe(listener),
};

/** Комментарии задач: ленты, неотправленные сообщения и правки. Выход и смена пользователя очищают всё. */
export const taskComments = createTaskComments({ api: userTaskCommentsApi, session: authSession });
