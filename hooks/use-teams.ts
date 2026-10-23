import { useAsyncResource } from '@/hooks/use-async-resource';
import { useCallback, useEffect, useRef } from 'react';

import { getTeams, type Team } from '@/lib/teams-api';
import { useAuthStore } from '@/stores/auth-store';
import { useTeamsInvalidateStore } from '@/stores/teams-invalidate-store';

export function useTeams() {

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useTeamsInvalidateStore((s) => s.version);

  const load = useCallback(async () => {
    const res = await getTeams();
    if (!res.ok) throw new Error(res.error);
    return res.data.teams;
  }, []);
  const { data: teams, loading, error, refresh } = useAsyncResource<Team[]>(load, [], !!token && !isGuest, token);

  const previousVersion = useRef(version);
  useEffect(() => {
    if (previousVersion.current === version) return;
    previousVersion.current = version;
    void refresh();
  }, [version, refresh]);

  return {
    teams,
    loading,
    error,
    refresh,
  };
}
