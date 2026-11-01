import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { todayTaskDateKey } from '@/lib/dateTimeUtils';
import {
  containsDay,
  departmentKey,
  filterDepartments,
  monthPeriod,
  periodOfKind,
  shiftPeriod,
  sortTeamMembers,
  teamAsStats,
  type StatsDepartment,
  type StatsPeriod,
  type StatsPeriodKind,
  type TaskStats,
  type TeamMemberStats,
} from '@/lib/task-stats';
import { fetchStatsEmployees, fetchTaskStats, fetchTeamStats } from '@/lib/task-stats-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export type StatsTab = 'my' | 'employees';

type ScopeState = { status: 'loading' } | { status: 'ready'; departments: StatsDepartment[] };

/** Loaded statistics carry the request they answer: the screen shows only those of its own filter. */
type StatsState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; stats: TaskStats; members: TeamMemberStats[] | null }
  | { key: string; status: 'error'; reason: 'forbidden' | 'failed' };

/**
 * «Статистика задач»: own statistics («Моя»), or, for the head of a company or a department,
 * the whole team or an employee («Сотрудники»). They open over the list; the hardware «Назад»
 * returns to it.
 */
export function useTaskStatsScreen() {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const signedIn = Boolean(token) && !isGuest;
  const todayKey = useMemo(() => todayTaskDateKey(), []);
  const invalidation = useUserTasksInvalidateStore((s) => s.version);

  const [tab, setTabState] = useState<StatsTab>('my');
  /** The opened employee, or `team` for «Вся команда». */
  const [employeeId, setEmployeeId] = useState<number | 'team' | null>(null);
  /** With `team`: one department of it (departmentKey), null for the whole team. */
  const [groupKey, setGroupKey] = useState<string | null>(null);
  const [period, setPeriod] = useState<StatsPeriod>(() => monthPeriod(todayKey));
  const [search, setSearch] = useState('');
  const [scope, setScope] = useState<ScopeState>({ status: 'loading' });
  const [state, setState] = useState<StatsState | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    if (!signedIn) return;
    const controller = new AbortController();
    void fetchStatsEmployees(controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      // Without the list (no right, or it failed to load) only «Моя» is offered.
      setScope({ status: 'ready', departments: result.ok ? result.data.departments : [] });
    });
    return () => controller.abort();
  }, [signedIn]);

  const canViewEmployees = scope.status === 'ready' && scope.departments.length > 0;
  const activeTab: StatsTab = tab === 'employees' && canViewEmployees ? 'employees' : 'my';
  const employees = useMemo(() => (scope.status === 'ready' ? scope.departments.flatMap((d) => d.employees) : []), [scope]);
  // Only someone the server listed can be opened.
  const employee = activeTab === 'employees' ? employees.find((e) => e.id === employeeId) ?? null : null;
  const team = activeTab === 'employees' && employeeId === 'team';
  // One department of the team, only one the server listed and only while there are several.
  const canPickDepartment = scope.status === 'ready' && scope.departments.length > 1;
  const teamDepartment: StatsDepartment | null =
    team && canPickDepartment && groupKey ? scope.departments.find((d) => departmentKey(d) === groupKey) ?? null : null;
  const employeeDepartment =
    employee && scope.status === 'ready' ? scope.departments.find((d) => d.employees.some((e) => e.id === employee.id)) ?? null : null;

  const target: number | 'me' | 'team' | null = !signedIn ? null : activeTab === 'my' ? 'me' : team ? 'team' : employee?.id ?? null;
  const requestKey = target == null ? null : `${target}|${teamDepartment ? departmentKey(teamDepartment) : ''}|${period.from}|${period.to}`;

  useEffect(() => {
    if (requestKey == null || target == null) return;
    const controller = new AbortController();
    // Until the answer comes, numbers of another filter are not shown (`view` below); the same filter
    // loaded again keeps its numbers.
    const load =
      target === 'team'
        ? fetchTeamStats(period, teamDepartment, controller.signal).then((result) =>
            result.ok ? { ok: true as const, stats: teamAsStats(result.data), members: sortTeamMembers(result.data.employees) } : result,
          )
        : fetchTaskStats(period, target === 'me' ? null : target, controller.signal).then((result) =>
            result.ok ? { ok: true as const, stats: result.data, members: null } : result,
          );
    void load.then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setState({ key: requestKey, status: 'ready', stats: result.stats, members: result.members });
      else {
        const forbidden = result.status === 403 || result.status === 404;
        setState({ key: requestKey, status: 'error', reason: forbidden ? 'forbidden' : 'failed' });
      }
    });
    return () => controller.abort();
    // A task changed elsewhere (invalidation) or «Повторить» (reloadToken) loads the same filter again.
  }, [requestKey, target, teamDepartment, period, invalidation, reloadToken]);

  // Back on the screen after editing tasks: the numbers may have changed.
  const firstFocus = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (firstFocus.current) {
        firstFocus.current = false;
        return;
      }
      setReloadToken((n) => n + 1);
    }, []),
  );

  // Android «Назад» from an employee returns to the list, not out of the screen.
  useFocusEffect(
    useCallback(() => {
      if (employeeId == null) return;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        setEmployeeId(null);
        setGroupKey(null);
        return true;
      });
      return () => sub.remove();
    }, [employeeId]),
  );

  const current = state && state.key === requestKey ? state : null;
  const view = current ?? (requestKey ? ({ key: requestKey, status: 'loading' } as const) : null);

  const setTab = useCallback((next: StatsTab) => {
    setTabState(next);
    setEmployeeId(null);
    setGroupKey(null);
  }, []);

  const selectEmployee = useCallback((id: number | 'team' | null) => {
    setEmployeeId(id);
    setGroupKey(null);
  }, []);

  /** One department's numbers, in the place of «Вся команда»; they open over the list too. */
  const selectDepartment = useCallback((department: StatsDepartment) => {
    setEmployeeId('team');
    setGroupKey(departmentKey(department));
  }, []);

  const setPeriodKind = useCallback(
    (kind: Exclude<StatsPeriodKind, 'custom'>) => {
      // The week or month of today when it is in view, otherwise of the start of the shown period.
      setPeriod((p) => periodOfKind(kind, containsDay(p, todayKey) ? todayKey : p.from));
    },
    [todayKey],
  );

  const stepPeriod = useCallback((delta: -1 | 1) => setPeriod((p) => shiftPeriod(p, delta)), []);

  return {
    signedIn,
    todayKey,
    tab: activeTab,
    setTab,
    canViewEmployees,
    departments: scope.status === 'ready' ? filterDepartments(scope.departments, search) : [],
    search,
    setSearch,
    employee,
    employeeDepartment,
    team,
    teamDepartment,
    canPickDepartment,
    selectDepartment,
    employeeCount: employees.length,
    selectEmployee,
    period,
    setPeriod,
    setPeriodKind,
    stepPeriod,
    view,
    retry: () => setReloadToken((n) => n + 1),
  };
}

export type UseTaskStatsScreenResult = ReturnType<typeof useTaskStatsScreen>;
