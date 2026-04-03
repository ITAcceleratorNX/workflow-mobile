import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  ScrollView,
  StyleSheet,
  View,
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
import { TeamsInboxPanel } from '@/components/tasks/TeamsInboxPanel';
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
type CalendarStripDay = { key: string; dayNumber: number; weekdayLabel: string };

const WEEKDAY_SHORT_RU = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const MONTH_SHORT_RU = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const UPCOMING_CALENDAR_DAYS_BACK = 0;
const UPCOMING_CALENDAR_DAYS_FORWARD = 180;
const UPCOMING_DAY_ITEM_WIDTH = 50;

function addDays(base: Date, amount: number): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + amount);
  return d;
}

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
    view?: 'list' | 'calendar' | 'board';
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(() =>
    paramView === 'calendar' ? 'calendar' : 'list'
  );
  const [upcomingDate, setUpcomingDate] = useState<string | null>(null);
  const [upcomingVisibleDateKey, setUpcomingVisibleDateKey] = useState<string | null>(null);
  const upcomingScrollRef = useRef<ScrollView | null>(null);

  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [teamsPanelOpen, setTeamsPanelOpen] = useState(false);
  const [displayMenuOpen, setDisplayMenuOpen] = useState(false);

  useEffect(() => {
    setMainView(parseMainView({ tab: paramTab, filter: paramFilter, date: paramDate }));
  }, [paramTab, paramFilter, paramDate]);

  useEffect(() => {
    if (paramView === 'calendar') setViewMode('calendar');
    else setViewMode('list');
    if (paramView === 'board') {
      router.setParams({ view: 'list' });
    }
  }, [paramView, router]);

  const todayKey = formatDateForApi(new Date());
  const tomorrowKey = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return formatDateForApi(d);
  }, []);

  useEffect(() => {
    if (upcomingDate) return;
    setUpcomingDate(tomorrowKey);
  }, [upcomingDate, tomorrowKey]);

  useEffect(() => {
    if (upcomingVisibleDateKey) return;
    setUpcomingVisibleDateKey(upcomingDate ?? tomorrowKey);
  }, [upcomingVisibleDateKey, upcomingDate, tomorrowKey]);

  const upcomingStripDays = useMemo((): CalendarStripDay[] => {
    const start = addDays(new Date(`${todayKey}T12:00:00`), -UPCOMING_CALENDAR_DAYS_BACK);
    return Array.from({ length: UPCOMING_CALENDAR_DAYS_BACK + UPCOMING_CALENDAR_DAYS_FORWARD + 1 }, (_, idx) => {
      const d = addDays(start, idx);
      return {
        key: formatDateForApi(d),
        dayNumber: d.getDate(),
        weekdayLabel: WEEKDAY_SHORT_RU[d.getDay()],
      };
    });
  }, [todayKey]);

  useEffect(() => {
    if (mainView !== 'upcoming') return;
    const activeKey = upcomingDate ?? tomorrowKey;
    const idx = upcomingStripDays.findIndex((d) => d.key === activeKey);
    if (idx < 0) return;
    const x = Math.max(0, idx * UPCOMING_DAY_ITEM_WIDTH - 80);
    requestAnimationFrame(() => {
      upcomingScrollRef.current?.scrollTo({ x, animated: false });
    });
    setUpcomingVisibleDateKey(activeKey);
  }, [mainView, upcomingDate, tomorrowKey, upcomingStripDays]);

  const upcomingMonthLabel = useMemo(() => {
    const selected = new Date(`${upcomingVisibleDateKey ?? upcomingDate ?? tomorrowKey}T12:00:00`);
    return `${MONTH_SHORT_RU[selected.getMonth()]}. ${selected.getFullYear()}`;
  }, [upcomingVisibleDateKey, upcomingDate, tomorrowKey]);

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
    const allUpcoming = getUpcomingSections(tasks, todayKey);
    if (!upcomingDate) {
      return allUpcoming.map((s) => ({
        title: s.title,
        data: s.tasks,
      }));
    }
    /** Все дни от выбранной даты в полосе календаря и дальше (не только один день). */
    return allUpcoming
      .filter((s) => {
        const dayKey = s.id.startsWith('day-') ? s.id.slice('day-'.length) : s.id;
        return dayKey >= upcomingDate;
      })
      .map((s) => ({ title: s.title, data: s.tasks }));
  }, [tasks, mainView, todayKey, upcomingDate]);

  const openAddSheet = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setAddSheetOpen(true);
  }, []);

  const openTeamsPanel = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTeamsPanelOpen(true);
  }, []);

  const openDisplayMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayMenuOpen(true);
  }, []);

  const closeDisplayMenu = useCallback(() => {
    setDisplayMenuOpen(false);
  }, []);

  const applyLayout = useCallback(
    (mode: 'list' | 'calendar') => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setViewMode(mode);
      router.setParams({ view: mode });
      setDisplayMenuOpen(false);
    },
    [router]
  );

  const openTeamsFromDisplayMenu = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setDisplayMenuOpen(false);
    setTeamsPanelOpen(true);
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
        isTeam={item.team_id != null}
        currentUserId={currentUserId}
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

  const headerRight = (
    <Pressable
      onPress={openDisplayMenu}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel="Вид, календарь и команды"
      style={({ pressed }) => [styles.moreMenuBtn, pressed && { opacity: 0.65 }]}
    >
      <MaterialIcons name="more-horiz" size={26} color={primary} />
    </Pressable>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Задачи" inlineTitle hideBackLabel rightSlot={headerRight} />

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
          {mainView === 'upcoming' && (
            <View style={styles.upcomingCalendarInline}>
              <View style={styles.upcomingCalendarHeader}>
                <ThemedText style={[styles.upcomingMonthTitle, { color: headerText }]}>
                  {upcomingMonthLabel}
                </ThemedText>
              </View>
              <ScrollView
                ref={upcomingScrollRef}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.upcomingStripRow}
                keyboardShouldPersistTaps="handled"
                onScroll={(e) => {
                  const x = e.nativeEvent.contentOffset.x;
                  const idx = Math.max(
                    0,
                    Math.min(
                      upcomingStripDays.length - 1,
                      Math.round((x + 60) / UPCOMING_DAY_ITEM_WIDTH)
                    )
                  );
                  const visibleKey = upcomingStripDays[idx]?.key ?? null;
                  if (visibleKey && visibleKey !== upcomingVisibleDateKey) {
                    setUpcomingVisibleDateKey(visibleKey);
                  }
                }}
                scrollEventThrottle={16}
              >
                {upcomingStripDays.map((d) => {
                  const isSelected = d.key === upcomingDate;
                  return (
                    <Pressable
                      key={d.key}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setUpcomingDate(d.key);
                      }}
                      style={styles.upcomingDayCell}
                    >
                      <ThemedText style={[styles.upcomingWeekday, { color: isSelected ? primary : headerSubtitle }]}>
                        {d.weekdayLabel}
                      </ThemedText>
                      <View
                        style={[
                          styles.upcomingDayCircle,
                          isSelected && { backgroundColor: primary },
                        ]}
                      >
                        <ThemedText style={{ color: isSelected ? '#fff' : headerText, fontWeight: isSelected ? '700' : '500' }}>
                          {d.dayNumber}
                        </ThemedText>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </View>
          )}
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

      <Modal
        visible={displayMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={closeDisplayMenu}
      >
        <View style={styles.displayModalRoot}>
          <Pressable style={styles.displayModalBackdrop} onPress={closeDisplayMenu} />
          <View
            style={[
              styles.displaySheet,
              {
                backgroundColor: background,
                paddingBottom: Math.max(insets.bottom, 20),
              },
            ]}
          >
            <View style={[styles.displaySheetHeader, { borderBottomColor: border }]}>
              <View style={[styles.displayHeaderSide, { justifyContent: 'flex-start' }]}>
                <Pressable
                  onPress={closeDisplayMenu}
                  hitSlop={12}
                  style={[styles.displayHeaderIconBtn, { backgroundColor: cardBg }]}
                  accessibilityLabel="Закрыть"
                >
                  <MaterialIcons name="close" size={22} color={headerText} />
                </Pressable>
              </View>
              <ThemedText style={[styles.displaySheetTitle, { color: headerText }]}>Вид и команды</ThemedText>
              <View style={[styles.displayHeaderSide, { justifyContent: 'flex-end' }]}>
                <Pressable
                  onPress={closeDisplayMenu}
                  hitSlop={12}
                  style={[styles.displayHeaderIconBtn, { backgroundColor: primary }]}
                  accessibilityLabel="Готово"
                >
                  <MaterialIcons name="check" size={22} color="#fff" />
                </Pressable>
              </View>
            </View>

            <ThemedText style={[styles.displaySectionLabel, { color: headerSubtitle }]}>Раскладка</ThemedText>
            <View style={[styles.layoutRow, styles.layoutRowTwo, { backgroundColor: cardBg, borderColor: border }]}>
              <Pressable
                onPress={() => applyLayout('list')}
                style={styles.layoutCell}
              >
                <View
                  style={[
                    styles.layoutIconFrame,
                    { borderColor: viewMode === 'list' ? primary : border },
                  ]}
                >
                  <MaterialIcons
                    name="format-list-bulleted"
                    size={26}
                    color={viewMode === 'list' ? primary : headerSubtitle}
                  />
                </View>
                <View
                  style={[
                    styles.layoutLabelPill,
                    viewMode === 'list' && { backgroundColor: primary },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.layoutLabelText,
                      { color: viewMode === 'list' ? '#fff' : headerSubtitle },
                    ]}
                    numberOfLines={1}
                  >
                    Список
                  </ThemedText>
                </View>
              </Pressable>

              <Pressable onPress={() => applyLayout('calendar')} style={styles.layoutCell}>
                <View
                  style={[
                    styles.layoutIconFrame,
                    { borderColor: viewMode === 'calendar' ? primary : border },
                  ]}
                >
                  <MaterialIcons
                    name="calendar-month"
                    size={26}
                    color={viewMode === 'calendar' ? primary : headerSubtitle}
                  />
                </View>
                <View
                  style={[
                    styles.layoutLabelPill,
                    viewMode === 'calendar' && { backgroundColor: primary },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.layoutLabelText,
                      { color: viewMode === 'calendar' ? '#fff' : headerSubtitle },
                    ]}
                    numberOfLines={1}
                  >
                    Календарь
                  </ThemedText>
                </View>
              </Pressable>
            </View>

            <ThemedText style={[styles.displaySectionLabel, { color: headerSubtitle, marginTop: 20 }]}>
              Команды
            </ThemedText>
            <Pressable
              onPress={openTeamsFromDisplayMenu}
              style={({ pressed }) => [
                styles.teamsMenuRow,
                { borderColor: border, backgroundColor: cardBg },
                pressed && { opacity: 0.85 },
              ]}
            >
              <MaterialIcons name="groups" size={24} color={primary} />
              <ThemedText style={[styles.teamsMenuRowLabel, { color: headerText }]}>Команды</ThemedText>
              <MaterialIcons name="chevron-right" size={24} color={headerSubtitle} />
            </Pressable>
          </View>
        </View>
      </Modal>
      <TaskAddSheet
        visible={addSheetOpen}
        onClose={() => setAddSheetOpen(false)}
        mainView={mainView}
        todayKey={todayKey}
        tomorrowKey={tomorrowKey}
        defaultDateKey={mainView === 'upcoming' ? upcomingDate : null}
        addTask={addTask}
      />
      {teamsPanelOpen ? (
        <TeamsInboxPanel onClose={() => setTeamsPanelOpen(false)} />
      ) : null}
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
  upcomingCalendarInline: {
    marginTop: 10,
  },
  upcomingCalendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  upcomingMonthTitle: {
    fontSize: 16,
    fontWeight: '700',
    textTransform: 'capitalize',
  },
  upcomingStripRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 16,
  },
  upcomingDayCell: {
    width: 42,
    alignItems: 'center',
    gap: 6,
  },
  upcomingWeekday: {
    fontSize: 11,
    fontWeight: '600',
  },
  upcomingDayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  moreMenuBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displayModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  displayModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  displaySheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  displaySheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 14,
    marginBottom: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  displayHeaderSide: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  displayHeaderIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  displaySheetTitle: {
    fontSize: 17,
    fontWeight: '700',
    flex: 2,
    textAlign: 'center',
  },
  displaySectionLabel: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 10,
    marginTop: 4,
  },
  layoutRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 8,
    justifyContent: 'space-between',
  },
  layoutRowTwo: {
    justifyContent: 'space-around',
    gap: 16,
  },
  layoutCell: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 4,
  },
  layoutIconFrame: {
    width: 52,
    height: 52,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  layoutLabelPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    maxWidth: '100%',
  },
  layoutLabelText: {
    fontSize: 12,
    fontWeight: '700',
  },
  teamsMenuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  teamsMenuRowLabel: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
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
