import { useCallback, useEffect, useRef, useState } from 'react';

import { getTeams, type Team } from '@/lib/teams-api';
import { useAuthStore } from '@/stores/auth-store';
import { useTeamsInvalidateStore } from '@/stores/teams-invalidate-store';

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const version = useTeamsInvalidateStore((s) => s.version);

  const refresh = useCallback(async () => {
    if (!token || isGuest) {
      setTeams([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const res = await getTeams();
    setLoading(false);

    if (res.ok) {
      setTeams(res.data.teams);
    } else {
      setError(res.error);
    }
  }, [token, isGuest]);

  const silentRefresh = useCallback(async () => {
    if (!token || isGuest) return;
    const res = await getTeams();
    if (!res.ok) return;
    setTeams(res.data.teams);
  }, [token, isGuest]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const skipVersionSyncRef = useRef(true);
  useEffect(() => {
    if (skipVersionSyncRef.current) {
      skipVersionSyncRef.current = false;
      return;
    }
    if (version === 0) return;
    silentRefresh();
  }, [version, silentRefresh]);

  return {
    teams,
    loading,
    error,
    refresh,
  };
}
