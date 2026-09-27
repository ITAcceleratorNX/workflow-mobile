import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo } from 'react';
import { AppState } from 'react-native';
import { useStore } from 'zustand';

import { EMPTY_DRAFT } from '@/lib/task-comments/composer';
import { localFailure } from '@/lib/task-comments/errors';
import { EMPTY_FEED, feedStatus, type TaskCommentsStatus, type WriteOutcome } from '@/lib/task-comments/store';
import type { CommentDraft } from '@/lib/task-comments/types';
import { useAuthStore } from '@/stores/auth-store';
import { taskComments } from '@/stores/task-comments-store';

const isTaskId = (taskId: number | null): taskId is number =>
  taskId !== null && Number.isSafeInteger(taskId) && taskId > 0;

const unavailable = (): Promise<WriteOutcome> =>
  Promise.resolve({ ok: false, failure: localFailure('unauthenticated', 'Войдите, чтобы писать комментарии') });

/**
 * Комментарии задачи для её карточки.
 *
 * Лента загружается при открытии карточки и перечитывается при возврате в неё, при возврате
 * приложения из фона и после своих изменений. Она хранится по задаче и пользователю: выход,
 * смена пользователя и демо-режим её не показывают. Права — `canComment` и `permissions`
 * комментариев — приходят с сервера и проверяются им при каждом запросе.
 */
export function useTaskComments(taskId: number | null) {
  const signedIn = useAuthStore((state) => Boolean(state.token) && !state.isGuest);
  const id = signedIn && isTaskId(taskId) ? taskId : null;
  const feed = useStore(taskComments.store, (state) => (id === null ? EMPTY_FEED : state.feeds[id] ?? EMPTY_FEED));

  useEffect(() => (id === null ? undefined : taskComments.retain(id)), [id]);

  useFocusEffect(
    useCallback(() => {
      if (id === null) return undefined;
      void taskComments.refresh(id);
      const subscription = AppState.addEventListener('change', (state) => {
        if (state === 'active') void taskComments.refresh(id);
      });
      return () => subscription.remove();
    }, [id])
  );

  const actions = useMemo(
    () => ({
      refresh: () => (id === null ? Promise.resolve() : taskComments.refresh(id)),
      loadOlder: () => (id === null ? Promise.resolve() : taskComments.loadOlder(id)),
      send: (draft: CommentDraft) => (id === null ? unavailable() : taskComments.send(id, draft)),
      retry: (localId: string) => (id === null ? unavailable() : taskComments.retry(id, localId)),
      discard: (localId: string) => (id === null ? null : taskComments.discard(id, localId)),
      edit: (commentId: string, draft: CommentDraft) =>
        id === null ? unavailable() : taskComments.edit(id, commentId, draft),
      remove: (commentId: string) => (id === null ? unavailable() : taskComments.remove(id, commentId)),
      /** Недописанное сообщение без подписки: для действий, которым нужно лишь прочитать его. */
      peekDraft: () => (id === null ? EMPTY_DRAFT : taskComments.store.getState().drafts[id] ?? EMPTY_DRAFT),
      setDraft: (draft: CommentDraft) => {
        if (id !== null) taskComments.setDraft(id, draft);
      },
    }),
    [id]
  );

  const status: TaskCommentsStatus | 'disabled' = id === null ? 'disabled' : feedStatus(feed);
  return {
    status,
    items: feed.items,
    pending: feed.pending,
    canComment: id !== null && feed.canComment,
    hasOlder: feed.hasOlder,
    historyLimited: feed.historyLimited,
    refreshing: feed.loaded && feed.reading === 'latest',
    loadingOlder: feed.reading === 'older',
    readError: feed.readError,
    changing: feed.changing,
    ...actions,
  };
}

/**
 * Недописанное новое сообщение задачи для поля ввода. Подписка отдельная от ленты: набор текста
 * не перерисовывает карточку и список.
 */
export function useCommentDraft(taskId: number) {
  const draft = useStore(taskComments.store, (state) => state.drafts[taskId] ?? EMPTY_DRAFT);
  const setDraft = useCallback((next: CommentDraft) => taskComments.setDraft(taskId, next), [taskId]);
  return [draft, setDraft] as const;
}
