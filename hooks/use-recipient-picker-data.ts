import { useEffect, useMemo, useState } from 'react';

import { useTaskRecipients } from '@/hooks/use-task-recipients';
import { useTeams } from '@/hooks/use-teams';
import { searchUsersForAssign } from '@/lib/api';
import { employeeSubtitle } from '@/lib/employee-display';
import { getRecentRecipients, type RecentRecipient } from '@/lib/task-recipients-api';
import {
  recentOption,
  searchRecipients,
  type RecipientOption,
  type RecipientSearchResult,
} from '@/lib/task-recipient-search';
import { useAuthStore } from '@/stores/auth-store';

const LEGACY_SEARCH_DEBOUNCE_MS = 300;

/**
 * Data of the «Исполнитель» picker, loaded when it opens: the recipient directory, the user's
 * teams and «Недавние». A user outside the org structure searches people on the server instead.
 */
export function useRecipientPickerData(query: string, { includeTeams }: { includeTeams: boolean }) {
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { directory, loading: directoryLoading, error, reload } = useTaskRecipients();
  const { teams, loading: teamsLoading } = useTeams();
  const [recent, setRecent] = useState<RecentRecipient[] | null>(null);
  const [legacy, setLegacy] = useState<{ query: string; options: RecipientOption[] } | null>(null);
  const outsideOrg = directory != null && directory.my_company == null;

  useEffect(() => {
    let cancelled = false;
    void getRecentRecipients().then((res) => {
      if (!cancelled) setRecent(res.ok ? res.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const q = query.trim();
    if (!outsideOrg || q.length < 2) return;
    const timer = setTimeout(() => {
      void searchUsersForAssign(q).then((res) => {
        const options = (res.ok ? res.data : [])
          .filter((user) => user.id !== currentUserId)
          .map<RecipientOption>((user) => ({
            key: `user:${user.id}`,
            kind: 'user',
            title: user.full_name,
            subtitle: employeeSubtitle([user.company?.name, user.department?.name, user.position]),
            selection: { type: 'legacy_user', user: { id: user.id, full_name: user.full_name } },
          }));
        setLegacy({ query: q, options });
      });
    }, LEGACY_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query, outsideOrg, currentUserId]);

  const results = useMemo<RecipientSearchResult>(() => {
    const found = searchRecipients(query, { directory, teams, currentUserId, includeTeams });
    if (outsideOrg && legacy?.query === query.trim()) return { ...found, users: legacy.options };
    return found;
  }, [query, directory, teams, currentUserId, includeTeams, outsideOrg, legacy]);

  const recentOptions = useMemo(
    () => (recent ?? []).filter((item) => includeTeams || item.type !== 'team').map(recentOption),
    [recent, includeTeams]
  );

  const searching =
    query.trim().length > 0 && (directoryLoading || (includeTeams && teamsLoading) || (outsideOrg && legacy?.query !== query.trim()));

  return {
    results,
    recentOptions,
    recentLoading: recent == null,
    searching,
    error,
    reload,
    /** Legacy search needs two letters; the hint says so. */
    needsMoreLetters: outsideOrg && query.trim().length === 1,
  };
}
