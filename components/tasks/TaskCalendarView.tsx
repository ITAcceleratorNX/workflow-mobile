import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { TaskListItem } from '@/components/tasks/TaskListItem';
import { SectionCaption } from '@/components/ui/list-group';
import { MonthGrid } from '@/components/ui/month-grid';
import { useCalendarTasks } from '@/hooks/use-calendar-tasks';
import { useProductUi } from '@/hooks/use-product-ui';
import { toAppDateKey } from '@/lib/dateTimeUtils';
import { monthOfKey, monthRange, monthTitle, sameMonth, shiftMonth, type MonthRef } from '@/lib/month-grid';
import { formatDayShort, formatDayTitle, isTaskOverdue } from '@/lib/task-due';
import type { CalendarTask, UserTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';

type TaskCalendarViewProps = {
  month: MonthRef;
  onMonthChange: (month: MonthRef) => void;
  day: string;
  onDayChange: (dateKey: string) => void;
  todayKey: string;
  onOpenTask: (task: UserTask) => void;
};

const noonUtc = (dateKey: string) => new Date(`${dateKey}T12:00:00.000Z`);

/** Calendar mode (Figma «Задачи — режим календаря»): the month with marks, then the tasks of the day. */
export function TaskCalendarView({ month, onMonthChange, day, onDayChange, todayKey, onOpenTask }: TaskCalendarViewProps) {
  const ui = useProductUi();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const range = useMemo(() => monthRange(month), [month]);
  const start = useMemo(() => noonUtc(range.start), [range.start]);
  const end = useMemo(() => noonUtc(range.end), [range.end]);
  const { tasks, loading, error, refresh, toggleComplete } = useCalendarTasks(start, end);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();
    for (const task of tasks) {
      const key = toAppDateKey(task.scheduled_at);
      map.set(key, [...(map.get(key) ?? []), task]);
    }
    for (const list of map.values()) list.sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at));
    return map;
  }, [tasks]);
  const dayTasks = byDay.get(day) ?? [];

  const selectDay = (key: string) => {
    void Haptics.selectionAsync();
    onDayChange(key);
    const target = monthOfKey(key);
    if (!sameMonth(target, month)) onMonthChange(target);
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: ui.fg() }]}>
          Задачи
        </Text>
        <View style={styles.monthNav}>
          <Pressable onPress={() => onMonthChange(shiftMonth(month, -1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Предыдущий месяц">
            <MaterialIcons name="chevron-left" size={22} color={ui.fg(0.6)} />
          </Pressable>
          <Text style={[styles.monthTitle, { color: ui.fg() }]}>{monthTitle(month)}</Text>
          <Pressable onPress={() => onMonthChange(shiftMonth(month, 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Следующий месяц">
            <MaterialIcons name="chevron-right" size={22} color={ui.fg(0.6)} />
          </Pressable>
        </View>
      </View>

      <View style={[styles.month, { backgroundColor: ui.surface }]}>
        <MonthGrid
          month={month}
          rowGap={2}
          renderDay={(cell) => {
            const selected = cell.key === day;
            const open = (byDay.get(cell.key) ?? []).filter((task) => !task.completed);
            const overdue = open.some((task) => isTaskOverdue(task));
            const today = cell.key === todayKey;
            return (
              <Pressable
                onPress={() => selectDay(cell.key)}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                accessibilityLabel={`${formatDayShort(cell.key)}${today ? ', сегодня' : ''}${open.length ? ', есть задачи' : ''}`}
                style={[styles.day, selected && { backgroundColor: ui.accent }]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    { color: selected ? ui.onAccent : today ? ui.accent : ui.fg() },
                    (selected || today) && styles.dayLabelStrong,
                  ]}
                >
                  {cell.day}
                </Text>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: !open.length ? 'transparent' : selected ? ui.onAccent : overdue ? ui.danger : ui.accent },
                  ]}
                />
              </Pressable>
            );
          }}
        />
      </View>

      <SectionCaption>{formatDayTitle(day)}</SectionCaption>
      {loading && dayTasks.length === 0 ? (
        <ActivityIndicator color={ui.accent} style={styles.state} />
      ) : error && dayTasks.length === 0 ? (
        <View style={styles.errorBox}>
          <Text style={[styles.stateText, { color: ui.fg(0.7) }]}>{error}</Text>
          <Pressable onPress={() => void refresh()} accessibilityRole="button" hitSlop={8}>
            <Text style={[styles.retry, { color: ui.accent }]}>Повторить</Text>
          </Pressable>
        </View>
      ) : dayTasks.length === 0 ? (
        <Text style={[styles.stateText, { color: ui.fg(0.5) }]}>Задач на этот день нет</Text>
      ) : (
        <View style={styles.list}>
          {dayTasks.map((task) => (
            <TaskListItem
              key={task.id}
              task={task}
              todayKey={todayKey}
              currentUserId={currentUserId}
              onToggle={() => void toggleComplete(task)}
              onOpen={onOpenTask}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '700' },
  monthNav: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  monthTitle: { fontSize: 15, fontWeight: '600', minWidth: 110, textAlign: 'center' },
  month: { borderRadius: 16, paddingTop: 10, paddingBottom: 8, paddingHorizontal: 6 },
  day: { width: '100%', maxWidth: 50, height: 33, borderRadius: 10, alignItems: 'center', justifyContent: 'center', gap: 2, paddingTop: 2 },
  dayLabel: { fontSize: 15, lineHeight: 18 },
  dayLabelStrong: { fontWeight: '600' },
  dot: { width: 4, height: 4, borderRadius: 2 },
  list: { gap: 8 },
  state: { paddingVertical: 20 },
  stateText: { fontSize: 14, paddingVertical: 12 },
  errorBox: { alignItems: 'flex-start', gap: 6 },
  retry: { fontSize: 14, fontWeight: '600' },
});
