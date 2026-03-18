import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useCalendarTasks } from '@/hooks/use-calendar-tasks';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatTimeOnly } from '@/lib/dateTimeUtils';
import { toAppDateKey } from '@/lib/taskDateTime';
import type { CalendarTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

type ViewMode = 'day' | 'week' | 'month';

function getWeekRange(date: Date): { start: Date; end: Date } {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d);
  monday.setDate(diff);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return { start: monday, end: sunday };
}

function getMonthRange(date: Date): { start: Date; end: Date } {
  const start = new Date(date.getFullYear(), date.getMonth(), 1);
  const end = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return { start, end };
}

export function CalendarTab() {
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [viewMode, setViewMode] = useState<ViewMode>('day');

  const { start, end } = useMemo(() => {
    if (viewMode === 'day') {
      return { start: selectedDate, end: selectedDate };
    }
    if (viewMode === 'week') {
      return getWeekRange(selectedDate);
    }
    return getMonthRange(selectedDate);
  }, [selectedDate, viewMode]);

  const { tasks, loading } = useCalendarTasks(start, end);

  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const formatNavLabel = () => {
    const d = selectedDate;
    const today = new Date();
    const dateStr = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (d.toDateString() === today.toDateString()) return `Сегодня – ${dateStr}`;
    return dateStr;
  };

  const prev = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() - 1);
    else if (viewMode === 'week') d.setDate(d.getDate() - 7);
    else d.setMonth(d.getMonth() - 1);
    setSelectedDate(d);
  };

  const next = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(selectedDate);
    if (viewMode === 'day') d.setDate(d.getDate() + 1);
    else if (viewMode === 'week') d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
    setSelectedDate(d);
  };

  const openTaskDetails = useCallback((task: CalendarTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (task?.id == null) return;
    router.push({ pathname: '/client/tasks/details', params: { taskId: String(task.id) } });
  }, [router]);

  const tasksByHour = useMemo(() => {
    const map: Record<number, CalendarTask[]> = {};
    for (let h = 0; h < 24; h++) map[h] = [];
    const dateKey = formatDateForApi(selectedDate);
    for (const t of tasks) {
      const d = new Date(t.scheduled_at);
      if (formatDateForApi(d) !== dateKey) continue;
      const hour = d.getHours();
      if (map[hour]) map[hour].push(t);
    }
    return map;
  }, [tasks, selectedDate]);

  return (
    <View style={styles.container}>
      <View style={[styles.nav, { borderBottomColor: border }]}>
        <Pressable onPress={prev} style={styles.navBtn}>
          <MaterialIcons name="chevron-left" size={24} color={text} />
        </Pressable>
        <ThemedText style={[styles.navLabel, { color: text }]}>{formatNavLabel()}</ThemedText>
        <Pressable onPress={next} style={styles.navBtn}>
          <MaterialIcons name="chevron-right" size={24} color={text} />
        </Pressable>
      </View>

      <View style={[styles.modeRow, { borderBottomColor: border }]}>
        {(['day', 'week', 'month'] as const).map((mode) => (
          <Pressable
            key={mode}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              setViewMode(mode);
            }}
            style={[
              styles.modeBtn,
              viewMode === mode && { backgroundColor: primary },
            ]}
          >
            <ThemedText
              style={[
                styles.modeText,
                { color: viewMode === mode ? '#FFFFFF' : textMuted },
              ]}
            >
              {mode === 'day' ? 'День' : mode === 'week' ? 'Неделя' : 'Месяц'}
            </ThemedText>
          </Pressable>
        ))}
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : viewMode === 'day' ? (
        <ScrollView style={styles.grid} showsVerticalScrollIndicator={false}>
          {HOURS.map((hour) => (
            <View key={hour} style={[styles.hourRow, { borderBottomColor: border }]}>
              <ThemedText style={[styles.hourLabel, { color: textMuted }]}>
                {hour.toString().padStart(2, '0')}:00
              </ThemedText>
              <View style={styles.hourContent}>
                {tasksByHour[hour]?.map((task) => {
                  const creatorId = (task as any).creator_id as number | undefined;
                  const isTeam = !!currentUserId && typeof creatorId === 'number' && creatorId !== currentUserId;
                  return (
                    <Pressable
                      key={task.id}
                      onPress={() => openTaskDetails(task)}
                      style={[styles.taskChip, { backgroundColor: `${primary}80` }]}
                    >
                      <ThemedText style={styles.taskChipTitle} numberOfLines={1}>
                        {task.title}
                      </ThemedText>
                      <View style={styles.taskChipMeta}>
                        <ThemedText style={[styles.taskChipTime, { color: textMuted }]}>
                          {formatTimeOnly(task.scheduled_at)}
                        </ThemedText>
                        {isTeam && <ThemedText style={styles.teamBadge}>Командный</ThemedText>}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      ) : viewMode === 'week' ? (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {tasks
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
            .map((task) => {
              const creatorId = (task as any).creator_id as number | undefined;
              const isTeam = !!currentUserId && typeof creatorId === 'number' && creatorId !== currentUserId;
              return (
                <Pressable
                  key={task.id}
                  onPress={() => openTaskDetails(task)}
                  style={[styles.weekTask, { backgroundColor: cardBg, borderColor: border }]}
                >
                  <ThemedText style={[styles.weekTaskTitle, { color: text }]} numberOfLines={1}>
                    {task.title}
                  </ThemedText>
                  <ThemedText style={[styles.weekTaskTime, { color: textMuted }]}>
                    {formatTimeOnly(task.scheduled_at)} • {toAppDateKey(task.scheduled_at)}
                  </ThemedText>
                  {isTeam && (
                    <View style={[styles.teamPill, { borderColor: border }]}>
                      <ThemedText style={[styles.teamPillText, { color: textMuted }]}>Командный</ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          {tasks.length === 0 && (
            <ThemedText style={[styles.empty, { color: textMuted }]}>Нет задач на эту неделю</ThemedText>
          )}
        </ScrollView>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {tasks
            .sort((a, b) => new Date(a.scheduled_at).getTime() - new Date(b.scheduled_at).getTime())
            .map((task) => {
              const creatorId = (task as any).creator_id as number | undefined;
              const isTeam = !!currentUserId && typeof creatorId === 'number' && creatorId !== currentUserId;
              return (
                <Pressable
                  key={task.id}
                  onPress={() => openTaskDetails(task)}
                  style={[styles.weekTask, { backgroundColor: cardBg, borderColor: border }]}
                >
                  <ThemedText style={[styles.weekTaskTitle, { color: text }]} numberOfLines={1}>
                    {task.title}
                  </ThemedText>
                  <ThemedText style={[styles.weekTaskTime, { color: textMuted }]}>
                    {formatTimeOnly(task.scheduled_at)} • {toAppDateKey(task.scheduled_at)}
                  </ThemedText>
                  {isTeam && (
                    <View style={[styles.teamPill, { borderColor: border }]}>
                      <ThemedText style={[styles.teamPillText, { color: textMuted }]}>Командный</ThemedText>
                    </View>
                  )}
                </Pressable>
              );
            })}
          {tasks.length === 0 && (
            <ThemedText style={[styles.empty, { color: textMuted }]}>Нет задач на этот месяц</ThemedText>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  nav: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
  },
  navBtn: {
    padding: 8,
  },
  navLabel: {
    fontSize: 15,
    fontWeight: '600',
  },
  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
  },
  modeBtn: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 8,
  },
  modeText: {
    fontSize: 13,
    fontWeight: '500',
  },
  loader: {
    paddingVertical: 40,
    alignItems: 'center',
  },
  grid: {
    flex: 1,
  },
  hourRow: {
    flexDirection: 'row',
    minHeight: 48,
    borderBottomWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  hourLabel: {
    width: 44,
    fontSize: 12,
  },
  hourContent: {
    flex: 1,
    gap: 4,
  },
  taskChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  taskChipTitle: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '500',
  },
  taskChipTime: {
    fontSize: 11,
    marginTop: 2,
  },
  taskChipMeta: {
    marginTop: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  teamBadge: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.25)',
    overflow: 'hidden',
  },
  list: {
    flex: 1,
    padding: 12,
  },
  weekTask: {
    padding: 12,
    borderRadius: 10,
    marginBottom: 8,
    borderWidth: 1,
  },
  weekTaskTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  weekTaskTime: {
    fontSize: 12,
    marginTop: 4,
  },
  teamPill: {
    marginTop: 8,
    alignSelf: 'flex-start',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  teamPillText: {
    fontSize: 12,
    fontWeight: '700',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 24,
    fontSize: 14,
  },
});
