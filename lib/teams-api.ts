import { request } from './api';
import { useTeamsInvalidateStore } from '@/stores/teams-invalidate-store';

export interface TeamUserRef {
  id: number;
  full_name: string;
}

export interface Team {
  id: number;
  name: string;
  leader_id: number;
  created_by: number;
  created_at: string;
  updated_at: string;
  leader?: TeamUserRef;
  teamCreator?: TeamUserRef;
  members?: TeamUserRef[];
}

export interface TeamsListResponse {
  teams: Team[];
}

function unwrapTeamPayload(raw: unknown): Team {
  if (raw && typeof raw === 'object' && 'team' in raw) {
    const t = (raw as { team?: Team }).team;
    if (t) return t;
  }
  return raw as Team;
}

/** API/Sequelize может отдать fullName или без имени — приводим к full_name для UI. */
function normalizeUserRef(u: unknown): TeamUserRef | null {
  if (!u || typeof u !== 'object') return null;
  const o = u as Record<string, unknown>;
  const id = Number(o.id);
  if (!Number.isFinite(id)) return null;
  const raw =
    (typeof o.full_name === 'string' && o.full_name.trim()) ||
    (typeof o.fullName === 'string' && o.fullName.trim()) ||
    '';
  return { id, full_name: raw || `Пользователь #${id}` };
}

function normalizeTeam(team: Team): Team {
  const out = { ...team };
  if (team.leader != null) {
    out.leader =
      normalizeUserRef(team.leader) ?? {
        id: team.leader_id,
        full_name: `Пользователь #${team.leader_id}`,
      };
  }
  if (team.members != null) {
    out.members = team.members.map(
      (m) =>
        normalizeUserRef(m) ?? {
          id: m.id,
          full_name: `Пользователь #${m.id}`,
        }
    );
  }
  return out;
}

export async function getTeams(): Promise<
  { ok: true; data: TeamsListResponse } | { ok: false; error: string }
> {
  const result = await request<TeamsListResponse>('/teams');
  if (!result.ok) return { ok: false, error: result.error };
  return {
    ok: true,
    data: {
      teams: (result.data.teams ?? []).map((t) => normalizeTeam(t)),
    },
  };
}

export async function getTeam(
  id: number
): Promise<{ ok: true; data: Team } | { ok: false; error: string }> {
  const result = await request<{ team: Team }>(`/teams/${id}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: normalizeTeam(unwrapTeamPayload(result.data)) };
}

export async function createTeam(body: {
  name: string;
  leader_id: number;
  member_ids: number[];
}): Promise<{ ok: true; data: Team } | { ok: false; error: string }> {
  const result = await request<{ team: Team }>('/teams', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: normalizeTeam(unwrapTeamPayload(result.data)) };
}

export async function updateTeam(
  id: number,
  body: Partial<{
    name: string;
    leader_id: number;
    member_ids: number[];
  }>
): Promise<{ ok: true; data: Team } | { ok: false; error: string }> {
  const result = await request<{ team: Team }>(`/teams/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: normalizeTeam(unwrapTeamPayload(result.data)) };
}

export async function deleteTeam(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<undefined>(`/teams/${id}`, { method: 'DELETE' });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Вызвать после create/update/delete команды, чтобы `useTeams` подтянул список. */
export function bumpTeamsCache() {
  useTeamsInvalidateStore.getState().bump();
}
