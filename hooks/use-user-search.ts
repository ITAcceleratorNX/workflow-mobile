import { useEffect, useMemo } from 'react';
import { searchUsersForAssign, type SearchUsersForAssignOptions, type UserSearchItem } from '@/lib/api';
import { useScopedState } from './use-scoped-state';

export function useUserSearch(query: string, options: SearchUsersForAssignOptions, enabled = true, excludeUserId?: number | null) {
  const term = query.trim();
  const optionsKey = JSON.stringify(options);
  const stableOptions = useMemo(() => JSON.parse(optionsKey) as SearchUsersForAssignOptions, [optionsKey]);
  const canSearch = enabled && term.length >= 2;
  const key = JSON.stringify([term, optionsKey, canSearch, excludeUserId]);
  const [state, setState] = useScopedState<{ results: UserSearchItem[]; searching: boolean }>(key, { results: [], searching: canSearch });

  useEffect(() => {
    if (!canSearch) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const response = await searchUsersForAssign(term, stableOptions);
        if (cancelled) return;
        const results = response.ok ? response.data.filter((user) => user.id !== excludeUserId) : [];
        setState({ results, searching: false });
      } catch {
        if (!cancelled) setState({ results: [], searching: false });
      }
    }, 300);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [term, stableOptions, canSearch, excludeUserId, setState]);

  return state;
}
