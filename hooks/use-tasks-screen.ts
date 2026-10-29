import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';

import { useCurrentTaskDay } from '@/hooks/use-current-task-day';
import { useTaskCounts } from '@/hooks/use-task-counts';
import { useTaskSortPreference } from '@/hooks/use-task-sort-preference';
import { useTodoList, type UseTodoListQuery } from '@/hooks/use-todo-list';
import { addCalendarDaysToDateKey, todayTaskDateKey } from '@/lib/dateTimeUtils';
import { monthOfKey, type MonthRef } from '@/lib/month-grid';
import { formatDayHeading, formatDueDay, pluralTasks, pluralUnfinished } from '@/lib/task-due';
import { sortableTaskView, taskSortQuery, type TaskSort } from '@/lib/task-list-sort';
import type { TaskMainView } from '@/lib/task-views';

export type TaskLayoutMode = 'list' | 'calendar';
export type StripDay = { key: string; dayNumber: number; weekdayLabel: string };

export const TASK_VIEW_TABS: readonly { value: TaskMainView; label: string }[] = [
  { value: 'inbox', label: 'Входящие' },
  { value: 'today', label: 'Сегодня' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'completed', label: 'Выполненные' },
];

/** «Предстоящие» — days from tomorrow; «Выполненные» — the same span back from today. */
const STRIP_DAYS = 180;
const WEEKDAY_SHORT_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_SHORT_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

/** Texts of an empty list; «Сегодня» follows the design, the others keep the earlier copy. */
const EMPTY_COPY: Record<TaskMainView, { title: string; subtitle: string }> = {
  inbox: { title: 'Входящие пусты', subtitle: 'Здесь появятся все невыполненные задачи — с датой и без' },
  today: {
    title: 'На сегодня задач нет',
    subtitle: 'Здесь появятся задачи со сроком на сегодня.\nВсе незавершённые — во «Входящих».',
  },
  upcoming: { title: 'Нет предстоящих задач', subtitle: 'Запланируйте задачу на будущие дни' },
  completed: { title: 'Нет выполненных за этот день', subtitle: 'Выберите другую дату в полосе календаря выше' },
};

const first = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

function parseMainView(params: { tab?: string | string[]; filter?: string | string[]; date?: string | string[] }): TaskMainView {
  const tab = first(params.tab);
  if (tab === 'inbox' || tab === 'today' || tab === 'upcoming' || tab === 'completed') return tab;
  if (first(params.filter) === 'today' || first(params.date) === 'today') return 'today';
  return 'inbox';
}

function stripDay(key: string): StripDay {
  const [year, month, day] = key.split('-').map((part) => parseInt(part, 10));
  return { key, dayNumber: day, weekdayLabel: WEEKDAY_SHORT_RU[new Date(Date.UTC(year, month - 1, day)).getUTCDay()] };
}

function monthLabel(key: string): string {
  const [year, month] = key.split('-').map((part) => parseInt(part, 10));
  return `${MONTH_SHORT_RU[month - 1]}. ${year}`;
}

/** State of the tasks screen: tab, layout, order, badges, the day strips, the calendar and the composer. */
export function useTasksScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tab?: string; filter?: string; date?: string; view?: string }>();
  const mainView = parseMainView(params);
  const layoutMode: TaskLayoutMode = first(params.view) === 'calendar' ? 'calendar' : 'list';

  const todayKey = useCurrentTaskDay();
  const tomorrowKey = useMemo(() => addCalendarDaysToDateKey(todayKey, 1), [todayKey]);
  const { counts, reload: reloadCounts } = useTaskCounts(todayKey);
  const { sorts, setSort } = useTaskSortPreference();
  const sortableView = sortableTaskView(mainView);
  const taskSort: TaskSort | null = sortableView ? sorts[sortableView] : null;

  const [upcomingDate, setUpcomingDate] = useState<string | null>(null);
  const [upcomingVisibleDateKey, setUpcomingVisibleDateKey] = useState<string | null>(null);
  const [completedDateKey, setCompletedDateKey] = useState<string>(todayTaskDateKey);
  const [completedVisibleDateKey, setCompletedVisibleDateKey] = useState<string | null>(null);
  const [calendarMonth, setCalendarMonth] = useState<MonthRef>(() => monthOfKey(todayTaskDateKey()));
  const [calendarDay, setCalendarDay] = useState<string>(todayTaskDateKey);
  const [composer, setComposer] = useState<{ open: boolean; dateKey: string | null }>({ open: false, dateKey: null });
  const [menuOpen, setMenuOpen] = useState(false);
  const [teamsOpen, setTeamsOpen] = useState(false);

  const todoListQuery = useMemo((): UseTodoListQuery => {
    if (layoutMode === 'calendar') return { view: 'inbox', enabled: false };
    switch (mainView) {
      case 'today':
        return { view: 'list_today', today: todayKey, light: true, ...taskSortQuery(sorts.today) };
      case 'upcoming': {
        const day = upcomingDate ?? tomorrowKey;
        return { view: 'list_upcoming', today: todayKey, fromDate: day, toDate: day, light: true, ...taskSortQuery(sorts.upcoming) };
      }
      case 'completed':
        return { view: 'list_completed', completedOn: completedDateKey, light: true };
      default:
        return { view: 'inbox', light: true, ...taskSortQuery(sorts.inbox) };
    }
  }, [layoutMode, mainView, todayKey, upcomingDate, tomorrowKey, completedDateKey, sorts]);

  const todo = useTodoList(todoListQuery);
  const { refresh: refreshList } = todo;
  /** «Повторить» of a failed list and pull-to-refresh also bring back the tab badges. */
  const retry = useCallback(() => {
    reloadCounts();
    void refreshList();
  }, [reloadCounts, refreshList]);

  const upcomingStripDays = useMemo(
    () => Array.from({ length: STRIP_DAYS + 1 }, (_, index) => stripDay(addCalendarDaysToDateKey(todayKey, index + 1))),
    [todayKey]
  );
  const completedStripDays = useMemo(
    () => Array.from({ length: STRIP_DAYS + 1 }, (_, index) => stripDay(addCalendarDaysToDateKey(todayKey, index - STRIP_DAYS))),
    [todayKey]
  );

  /** «9 незавершённых» / «Ср, 21 октября · 2 задачи» next to the sort button. */
  const listCaption = useMemo(() => {
    if (todo.loading && todo.tasks.length === 0) return null;
    if (mainView === 'inbox') return pluralUnfinished(todo.total);
    if (mainView === 'today') return `${formatDayHeading(todayKey)} · ${pluralTasks(todo.total)}`;
    return null;
  }, [mainView, todo.loading, todo.tasks.length, todo.total, todayKey]);

  /** «Завтра», «28 окт» — the caption over the list of «Предстоящие». */
  const listTitle = mainView === 'upcoming' && todo.tasks.length ? formatDueDay(upcomingDate ?? tomorrowKey, todayKey) : null;

  const setMainView = useCallback((view: TaskMainView) => router.setParams({ tab: view, filter: undefined, date: undefined }), [router]);
  const setLayoutMode = useCallback((mode: TaskLayoutMode) => router.setParams({ view: mode }), [router]);
  const setTaskSort = useCallback(
    (sort: TaskSort) => {
      if (sortableView) setSort(sortableView, sort);
    },
    [sortableView, setSort]
  );

  /** «Новая задача»: the day of the calendar or of «Предстоящие» becomes its «Срок». */
  const openComposer = useCallback(() => {
    const contextDay = layoutMode === 'calendar' ? calendarDay : mainView === 'upcoming' ? upcomingDate ?? tomorrowKey : null;
    setComposer({ open: true, dateKey: contextDay && contextDay >= todayKey ? contextDay : null });
  }, [layoutMode, calendarDay, mainView, upcomingDate, tomorrowKey, todayKey]);
  const closeComposer = useCallback(() => setComposer((current) => ({ ...current, open: false })), []);

  const openTaskStats = useCallback(() => {
    setMenuOpen(false);
    router.push('/client/tasks/stats');
  }, [router]);
  const openTeams = useCallback(() => {
    setMenuOpen(false);
    setTeamsOpen(true);
  }, []);

  return {
    tabs: TASK_VIEW_TABS,
    counts,
    mainView,
    setMainView,
    layoutMode,
    setLayoutMode,
    taskSort,
    setTaskSort,
    todayKey,
    listCaption,
    listTitle,
    emptyCopy: EMPTY_COPY[mainView],
    todo,
    retry,
    upcomingDate: upcomingDate ?? tomorrowKey,
    setUpcomingDate,
    setUpcomingVisibleDateKey,
    upcomingStripDays,
    upcomingMonthLabel: monthLabel(upcomingVisibleDateKey ?? upcomingDate ?? tomorrowKey),
    completedDateKey,
    setCompletedDateKey,
    setCompletedVisibleDateKey,
    completedStripDays,
    completedMonthLabel: monthLabel(completedVisibleDateKey ?? completedDateKey),
    calendarMonth,
    setCalendarMonth,
    calendarDay,
    setCalendarDay,
    composer,
    openComposer,
    closeComposer,
    menuOpen,
    setMenuOpen,
    teamsOpen,
    setTeamsOpen,
    openTaskStats,
    openTeams,
  };
}

export type UseTasksScreenResult = ReturnType<typeof useTasksScreen>;
