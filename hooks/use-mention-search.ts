import { useEffect, useMemo, useSyncExternalStore } from 'react';

import { createMentionSearch } from '@/lib/task-comments/mention-search';
import { userTaskCommentsApi } from '@/lib/user-task-comments-api';

/**
 * Поиск кандидатов для @ в задаче. Пока список открыт, поиск живёт; закрытие списка отменяет
 * ожидание и запрос, и запоздалый ответ никуда не попадает.
 */
export function useMentionSearch(taskId: number) {
  const search = useMemo(() => createMentionSearch({ api: userTaskCommentsApi, taskId }), [taskId]);
  const state = useSyncExternalStore(search.subscribe, search.getState, search.getState);
  useEffect(() => () => search.reset(), [search]);
  return { state, search };
}
