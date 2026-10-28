import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

import { todayTaskDateKey } from '@/lib/dateTimeUtils';
import {
  containsDay,
  filterDepartments,
  monthPeriod,
  periodOfKind,
  shiftPeriod,
  type StatsDepartment,
  type StatsPeriod,
  type StatsPeriodKind,
  type TaskStats,
} from '@/lib/task-stats';
import { fetchStatsEmployees, fetchTaskStats } from '@/lib/task-stats-api';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';

export type StatsTab = 'my' | 'employees';

type ScopeState = { status: 'loading' } | { status: 'ready'; departments: StatsDepartment[] };

/** Loaded statistics carry the request they answer: the screen shows only those of its own filter. */
type StatsState =
  | { key: string; status: 'loading' }
  | { key: string; status: 'ready'; stats: TaskStats }
  | { key: string; status: 'error'; reason: 'forbidden' | 'failed' };

/**
 * «Статистика задач»: own statistics («Моя»), or, for the head of a company or a department,
 * an employee's («Сотрудники»). The employee opens over the list; the hardware «Назад» returns to it.
 */
export function useTaskStatsScreen() {
  const token = useAuthStore((s) => s.token);
  const isGuest = useAuthStore((s) => s.isGuest);
  const signedIn = Boolean(token) && !isGuest;
  const todayKey = useMemo(() => todayTaskDateKey(), []);
  const invalidation = useUserTasksInvalidateStore((s) => s.version);

  const [tab, setTabState] = useState<StatsTab>('my');
  const [employeeId, setEmployeeId] = useState<number | null>(null);
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
  const employeeDepartment =
    employee && scope.status === 'ready' ? scope.departments.find((d) => d.employees.some((e) => e.id === employee.id)) ?? null : null;

  const target: number | 'me' | null = !signedIn ? null : activeTab === 'my' ? 'me' : employee?.id ?? null;
  const requestKey = target == null ? null : `${target}|${period.from}|${period.to}`;

  useEffect(() => {
    if (requestKey == null || target == null) return;
    const controller = new AbortController();
    // Until the answer comes, numbers of another filter are not shown (`view` below); the same filter
    // loaded again keeps its numbers.
    void fetchTaskStats(period, target === 'me' ? null : target, controller.signal).then((result) => {
      if (controller.signal.aborted) return;
      if (result.ok) setState({ key: requestKey, status: 'ready', stats: result.data });
      else {
        const forbidden = result.status === 403 || result.status === 404;
        setState({ key: requestKey, status: 'error', reason: forbidden ? 'forbidden' : 'failed' });
      }
    });
    return () => controller.abort();
    // A task changed elsewhere (invalidation) or «Повторить» (reloadToken) loads the same filter again.
  }, [requestKey, target, period, invalidation, reloadToken]);

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
    selectEmployee: setEmployeeId,
    period,
    setPeriod,
    setPeriodKind,
    stepPeriod,
    view,
    retry: () => setReloadToken((n) => n + 1),
  };
}

export type UseTaskStatsScreenResult = ReturnType<typeof useTaskStatsScreen>;
