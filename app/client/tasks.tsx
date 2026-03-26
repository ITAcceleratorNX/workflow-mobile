import { useMemo, useState, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  SectionList,
  Pressable,
  ActivityIndicator,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { UserTaskRow } from '@/components/tasks/UserTaskRow';
import { TaskAddSheet } from '@/components/tasks/TaskAddSheet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoList } from '@/hooks/use-todo-list';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateForApi } from '@/lib/dateTimeUtils';
import type { UserTask } from '@/lib/user-tasks-api';
import { CalendarTab } from '@/components/tasks/CalendarTab';
import {
  type TaskMainView,
  getCompletedTasks,
  getInboxTasks,
  getTodaySections,
  getUpcomingSections,
} from '@/lib/task-views';

const VIEW_TABS: { value: TaskMainView; label: string }[] = [
  { value: 'inbox', label: 'Входящие' },
  { value: 'today', label: 'Сегодня' },
  { value: 'upcoming', label: 'Предстоящие' },
  { value: 'completed', label: 'Выполненные' },
];

type TaskSectionRow = { title: string; data: UserTask[] };

function parseMainView(params: {
  tab?: string | string[];
  filter?: string | string[];
  date?: string | string[];
}): TaskMainView {
  const t = Array.isArray(params.tab) ? params.tab[0] : params.tab;
  if (t === 'inbox' || t === 'today' || t === 'upcoming' || t === 'completed') return t;
  const filter = Array.isArray(params.filter) ? params.filter[0] : params.filter;
  const date = Array.isArray(params.date) ? params.date[0] : params.date;
  if (filter === 'today' || date === 'today') return 'today';
  if (filter === 'overdue') return 'today';
  if (filter === 'all') return 'inbox';
  /** Без явного tab/filter — по умолчанию входящие (без даты у новой задачи). */
  return 'inbox';
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const params = useLocalSearchParams<{
    tab?: string;
    filter?: string;
    date?: string;
    view?: 'list' | 'calendar';
  }>();
  const paramTab = params.tab;
  const paramFilter = params.filter;
  const paramDate = params.date;
  const paramView = params.view;

  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { tasks, toggleComplete, loading: loadingTasks, addTask } = useTodoList();
  const [mainView, setMainView] = useState<TaskMainView>(() =>
    parseMainView({ tab: paramTab, filter: paramFilter, date: paramDate })
  );
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(paramView === 'calendar' ? 'calendar' : 'list');

  const [addSheetOpen, setAddSheetOpen] = useState(false);

  useEffect(() => {
    setMainView(parseMainView({ tab: paramTab, filter: paramFilter, date: paramDate }));
  }, [paramTab, paramFilter, paramDate]);

  useEffect(() => {
    if (paramView === 'calendar') setViewMode('calendar');
    if (paramView === 'list') setViewMode('list');
  }, [paramView]);

  const todayKey = formatDateForApi(new Date());
  const tomorrowKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateForApi(d);
  }, []);

  const sections = useMemo((): TaskSectionRow[] => {
    if (mainView === 'completed') {
      const done = getCompletedTasks(tasks);
      if (done.length === 0) return [];
      return [{ title: '', data: done }];
    }
    if (mainView === 'inbox') {
      const inbox = getInboxTasks(tasks);
      if (inbox.length === 0) return [];
      return [{ title: 'Входящие', data: inbox }];
    }
    if (mainView === 'today') {
      return getTodaySections(tasks, todayKey).map((s) => ({
        title: s.title,
        data: s.tasks,
      }));
    }
    return getUpcomingSections(tasks, todayKey).map((s) => ({
      title: s.title,
      data: s.tasks,
    }));
  }, [tasks, mainView, todayKey]);

  const openAddSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddSheetOpen(true);
  }, []);

  const renderItem = useCallback(
    ({ item }: { item: UserTask }) => (
      <UserTaskRow
        item={item}
        todayKey={todayKey}
        onToggle={() => toggleComplete(item)}
        onPressRow={() => {
          if (item?.id == null) return;
          router.push({ pathname: '/client/tasks/details', params: { taskId: String(item.id) } });
        }}
        textColor={headerText}
        textMuted={headerSubtitle}
        primary={primary}
        borderColor={border}
        cardBackground={cardBg}
        isTeam={!!currentUserId && item.creator_id !== currentUserId}
      />
    ),
    [toggleComplete, headerText, headerSubtitle, primary, border, cardBg, currentUserId, todayKey, router]
  );

  const emptyCopy = useMemo(() => {
    if (mainView === 'completed') {
      return {
        title: 'Нет выполненных задач',
        subtitle: 'Завершённые задачи появятся здесь',
        icon: 'check-circle-outline' as const,
      };
    }
    if (mainView === 'inbox') {
      return {
        title: 'Входящие пусты',
        subtitle: 'Добавьте задачу без даты — потом назначите день',
        icon: 'inbox' as const,
      };
    }
    if (mainView === 'today') {
      return {
        title: 'На сегодня всё сделано',
        subtitle: 'Нет просроченных и запланированных на сегодня задач',
        icon: 'inbox' as const,
      };
    }
    return {
      title: 'Нет предстоящих задач',
      subtitle: 'Запланируйте задачу на будущие дни',
      icon: 'inbox' as const,
    };
  }, [mainView]);

  const ListEmpty = (
    <View style={styles.empty}>
      <MaterialIcons name={emptyCopy.icon} size={48} color={headerSubtitle} />
      <ThemedText style={[styles.emptyTitle, { color: headerText }]}>{emptyCopy.title}</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: headerSubtitle }]}>{emptyCopy.subtitle}</ThemedText>
    </View>
  );

  const headerViewToggle = (
    <View style={[styles.viewToggle, { borderColor: border, backgroundColor: cardBg }]}>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setViewMode('list');
        }}
        style={[styles.viewBtn, viewMode === 'list' && { backgroundColor: `${primary}25` }]}
        hitSlop={8}
      >
        <MaterialIcons name="format-list-bulleted" size={20} color={viewMode === 'list' ? primary : headerSubtitle} />
      </Pressable>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          setViewMode('calendar');
        }}
        style={[styles.viewBtn, viewMode === 'calendar' && { backgroundColor: `${primary}25` }]}
        hitSlop={8}
      >
        <MaterialIcons name="calendar-month" size={20} color={viewMode === 'calendar' ? primary : headerSubtitle} />
      </Pressable>
    </View>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Задачи" inlineTitle hideBackLabel rightSlot={headerViewToggle} />

      {viewMode === 'list' && (
        <View style={styles.topBar}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterPillsScroll}
            contentContainerStyle={styles.filterPillsContent}
            keyboardShouldPersistTaps="handled"
          >
            {VIEW_TABS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setMainView(opt.value);
                  router.setParams({ tab: opt.value });
                }}
                style={[
                  styles.pill,
                  {
                    borderColor: border,
                    backgroundColor: opt.value === mainView ? `${primary}25` : 'transparent',
                  },
                ]}
              >
                <ThemedText
                  style={{
                    color: opt.value === mainView ? primary : headerSubtitle,
                    fontSize: 13,
                    fontWeight: '600',
                  }}
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      )}

      {viewMode === 'calendar' ? (
        <View style={styles.calendarWrap}>
          <CalendarTab />
        </View>
      ) : loadingTasks ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <View style={styles.listWithFab}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
          >
            <SectionList<UserTask, TaskSectionRow>
              sections={sections}
              keyExtractor={(item) => {
                if (item?.id != null) return String(item.id);
                const created = (item as any)?.created_at ?? '';
                const title = (item as any)?.title ?? '';
                return `tmp-${created}-${title}`;
              }}
              renderItem={renderItem}
              renderSectionHeader={({ section: { title } }) =>
                title ? (
                  <ThemedText style={[styles.sectionHeader, { color: headerSubtitle }]}>{title}</ThemedText>
                ) : null
              }
              stickySectionHeadersEnabled={false}
              contentContainerStyle={[styles.listContent, { paddingBottom: 88 }]}
              ListEmptyComponent={ListEmpty}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            />
          </KeyboardAvoidingView>
          <Pressable
            onPress={openAddSheet}
            accessibilityLabel="Добавить задачу"
            style={[
              styles.listFab,
              {
                backgroundColor: primary,
                bottom: Math.max(insets.bottom, 16) + 8,
              },
            ]}
          >
            <MaterialIcons name="add" size={28} color="#fff" />
          </Pressable>
        </View>
      )}
      <TaskAddSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        mainView={mainView}
        todayKey={todayKey}
        tomorrowKey={tomorrowKey}
        addTask={addTask}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  filterPillsScroll: {
    width: '100%',
  },
  filterPillsContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 2,
    paddingRight: 8,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  viewToggle: {
    flexDirection: 'row',
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  viewBtn: {
    width: 38,
    height: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listWithFab: { flex: 1 },
  listFab: {
    position: 'absolute',
    right: 16,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  listContent: { paddingHorizontal: 16, paddingTop: 12, flexGrow: 1 },
  sectionHeader: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginTop: 8,
    marginBottom: 6,
  },
  calendarWrap: {
    flex: 1,
    paddingTop: 8,
  },
  loader: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40,
  },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 },
});
