import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskCalendarView } from '@/components/tasks/TaskCalendarView';
import { TaskComposer } from '@/components/tasks/TaskComposer';
import { TaskDayStrip } from '@/components/tasks/TaskDayStrip';
import { TaskListItem } from '@/components/tasks/TaskListItem';
import { TaskMoreMenu } from '@/components/tasks/TaskMoreMenu';
import { TaskSortPicker } from '@/components/tasks/TaskSortPicker';
import { TeamsInboxPanel } from '@/components/tasks/TeamsInboxPanel';
import { Button } from '@/components/ui/button';
import { ChipTabs } from '@/components/ui/chip-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { SectionCaption } from '@/components/ui/list-group';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { useProductUi } from '@/hooks/use-product-ui';
import { useTasksScreen, type TaskLayoutMode } from '@/hooks/use-tasks-screen';
import type { TaskMainView } from '@/lib/task-views';
import type { UserTask } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';

const FAB_SIZE = 56;
const LAYOUT_OPTIONS = [
  { value: 'list' as const, icon: 'format-list-bulleted' as const, accessibilityLabel: 'Список' },
  { value: 'calendar' as const, icon: 'calendar-month' as const, accessibilityLabel: 'Календарь' },
];
const EMPTY_ICONS: Record<TaskMainView, React.ComponentProps<typeof MaterialIcons>['name']> = {
  inbox: 'inbox',
  today: 'wb-sunny',
  upcoming: 'event',
  completed: 'check-circle-outline',
};

/** Tasks screen (Figma «Задачи — Входящие / Сегодня / режим календаря»). */
export default function TasksScreen() {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const page = useTasksScreen();
  const { todo, mainView, layoutMode, openComposer, setMainView } = page;
  const { toggleComplete, loadMore } = todo;
  const params = useLocalSearchParams<{ compose?: string }>();
  const paramCompose = Array.isArray(params.compose) ? params.compose[0] : params.compose;
  const fabBottom = Math.max(insets.bottom, 16) + 8;

  useEffect(() => {
    if (paramCompose !== '1') return;
    setMainView('today');
    openComposer();
    router.setParams({ compose: '' });
  }, [openComposer, paramCompose, router, setMainView]);

  const openTask = useCallback(
    (task: UserTask) => {
      if (task.id > 0) router.push({ pathname: '/client/tasks/details', params: { taskId: String(task.id) } });
    },
    [router]
  );
  const toggle = useCallback((task: UserTask) => void toggleComplete(task), [toggleComplete]);

  const header = (
    <View style={styles.listHeader}>
      <Text accessibilityRole="header" style={[styles.title, { color: ui.fg() }]}>
        Задачи
      </Text>
      <ChipTabs
        accessibilityLabel="Списки задач"
        value={mainView}
        onChange={page.setMainView}
        tabs={page.tabs.map((tab) => ({ ...tab, count: tab.value === 'completed' ? null : page.counts?.[tab.value] ?? null }))}
      />
      {page.taskSort ? (
        <View style={styles.captionRow}>
          <Text style={[styles.caption, { color: ui.fg(0.5) }]} numberOfLines={1} accessibilityLiveRegion="polite">
            {page.listCaption ?? ''}
          </Text>
          <TaskSortPicker value={page.taskSort} onChange={page.setTaskSort} />
        </View>
      ) : null}
      {mainView === 'upcoming' ? (
        <TaskDayStrip
          accessibilityLabel="День предстоящих задач"
          days={page.upcomingStripDays}
          selected={page.upcomingDate}
          onSelect={page.setUpcomingDate}
          onVisibleChange={page.setUpcomingVisibleDateKey}
          monthLabel={page.upcomingMonthLabel}
        />
      ) : null}
      {mainView === 'completed' ? (
        <TaskDayStrip
          accessibilityLabel="День выполненных задач"
          days={page.completedStripDays}
          selected={page.completedDateKey}
          onSelect={page.setCompletedDateKey}
          onVisibleChange={page.setCompletedVisibleDateKey}
          monthLabel={page.completedMonthLabel}
        />
      ) : null}
      {page.listTitle ? <SectionCaption>{page.listTitle}</SectionCaption> : null}
      {todo.error && todo.tasks.length > 0 ? (
        <View accessibilityRole="alert" style={[styles.errorBanner, { backgroundColor: ui.dangerSoft, borderColor: `${ui.danger}99` }]}>
          <MaterialIcons name="error-outline" size={20} color={ui.danger} />
          <Text style={[styles.errorBannerText, { color: ui.fg(0.8) }]}>
            {todo.error}
            {'\n'}
            <Text style={{ color: ui.fg(0.6) }}>Показаны данные последней успешной загрузки.</Text>
          </Text>
          <Pressable onPress={page.retry} accessibilityRole="button" style={[styles.errorRetry, { backgroundColor: ui.fg(0.12) }]}>
            <Text style={[styles.errorRetryLabel, { color: ui.fg() }]}>Повторить</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );

  const empty = todo.loading ? (
    <View style={styles.skeletons} accessibilityLabel="Загружаем задачи">
      {[0, 1, 2, 3].map((index) => (
        <View key={index} style={[styles.skeleton, { backgroundColor: ui.surface }]} />
      ))}
    </View>
  ) : todo.error ? (
    <EmptyState
      style={styles.empty}
      icon="error-outline"
      title="Не удалось загрузить задачи"
      description={todo.error}
      action={<Button title="Повторить" onPress={page.retry} variant="accent-outline" size="compact" />}
    />
  ) : (
    <EmptyState
      style={styles.empty}
      icon={EMPTY_ICONS[mainView]}
      title={page.emptyCopy.title}
      description={page.emptyCopy.subtitle}
      action={
        mainView === 'today' ? <Button title="Открыть входящие" onPress={() => page.setMainView('inbox')} variant="accent-outline" size="compact" /> : undefined
      }
    />
  );

  return (
    <View style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 12 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityRole="button" accessibilityLabel="Назад" style={styles.back}>
          <MaterialIcons name="chevron-left" size={28} color={ui.accent} />
          <Text style={[styles.backLabel, { color: ui.accent }]}>Назад</Text>
        </Pressable>
        <View style={styles.topActions}>
          <SegmentedControl<TaskLayoutMode>
            accessibilityLabel="Вид задач"
            value={layoutMode}
            onChange={page.setLayoutMode}
            options={LAYOUT_OPTIONS}
            optionStyle={styles.layoutOption}
          />
          <TaskMoreMenu open={page.menuOpen} onOpenChange={page.setMenuOpen} onOpenStats={page.openTaskStats} onOpenTeams={page.openTeams} />
        </View>
      </View>

      {layoutMode === 'calendar' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: fabBottom + FAB_SIZE + 16 }]}>
          <TaskCalendarView
            month={page.calendarMonth}
            onMonthChange={page.setCalendarMonth}
            day={page.calendarDay}
            onDayChange={page.setCalendarDay}
            todayKey={page.todayKey}
            onOpenTask={openTask}
          />
        </ScrollView>
      ) : (
        <FlatList
          data={todo.tasks}
          keyExtractor={(task) => String(task.id)}
          renderItem={({ item }) => (
            <TaskListItem task={item} todayKey={page.todayKey} currentUserId={currentUserId} onToggle={toggle} onOpen={openTask} />
          )}
          ItemSeparatorComponent={Separator}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={todo.loadingMore ? <ActivityIndicator color={ui.accent} style={styles.footer} /> : null}
          onEndReached={() => {
            if (todo.hasMore && !todo.loadingMore) void loadMore();
          }}
          onEndReachedThreshold={0.35}
          refreshControl={<RefreshControl refreshing={false} onRefresh={page.retry} tintColor={ui.accent} />}
          contentContainerStyle={[styles.content, { paddingBottom: fabBottom + FAB_SIZE + 16 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      <Pressable
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          page.openComposer();
        }}
        accessibilityRole="button"
        accessibilityLabel="Новая задача"
        style={({ pressed }) => [styles.fab, { backgroundColor: ui.accent, bottom: fabBottom }, pressed && styles.fabPressed]}
      >
        <MaterialIcons name="add" size={30} color={ui.onAccent} />
      </Pressable>

      <TaskComposer
        visible={page.composer.open}
        onClose={page.closeComposer}
        dateKey={page.composer.dateKey}
        todayKey={page.todayKey}
        onCreate={todo.addTask}
      />
      {page.teamsOpen ? <TeamsInboxPanel onClose={() => page.setTeamsOpen(false)} /> : null}
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 10, paddingRight: 12, minHeight: 44 },
  back: { flexDirection: 'row', alignItems: 'center' },
  backLabel: { fontSize: 18 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  layoutOption: { width: 38, paddingHorizontal: 0 },
  content: { paddingHorizontal: 16, paddingTop: 14, flexGrow: 1 },
  listHeader: { gap: 14, paddingBottom: 14 },
  title: { fontSize: 26, lineHeight: 31, fontWeight: '700' },
  captionRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  caption: { flex: 1, fontSize: 13 },
  separator: { height: 8 },
  skeletons: { gap: 8 },
  skeleton: { height: 64, borderRadius: 16, opacity: 0.6 },
  empty: { paddingTop: 76 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 16, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 14 },
  errorBannerText: { flex: 1, fontSize: 13 },
  errorRetry: { borderRadius: 10, paddingVertical: 7, paddingHorizontal: 12 },
  errorRetryLabel: { fontSize: 14, fontWeight: '600' },
  footer: { paddingVertical: 16 },
  fab: {
    position: 'absolute',
    right: 16,
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
  },
  fabPressed: { transform: [{ scale: 0.95 }] },
});
