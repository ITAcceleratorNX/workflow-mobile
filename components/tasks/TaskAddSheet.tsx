import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView as RNScrollView,
  StyleSheet,
  Switch,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Gesture, GestureDetector, GestureHandlerRootView, ScrollView } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  collectTeamMemberOptions,
  TaskAssigneesPickerOverlay,
  TaskTeamPickerOverlay,
} from '@/components/tasks/task-assignment-pickers';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTeams } from '@/hooks/use-teams';
import { formatDateForApi, formatTaskTime, toUtcIsoFromAppDateTime } from '@/lib/dateTimeUtils';
import type { TaskMainView } from '@/lib/task-views';
import { useAuthStore } from '@/stores/auth-store';
import type { TaskPriority } from '@/lib/user-tasks-api';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

const MONTHS_GENITIVE = [
  'января',
  'февраля',
  'марта',
  'апреля',
  'мая',
  'июня',
  'июля',
  'августа',
  'сентября',
  'октября',
  'ноября',
  'декабря',
];

const MONTHS_NOMINATIVE = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

function formatDateLabelRu(dateKey: string | null): string {
  if (!dateKey) return 'Без даты';
  const d = new Date(dateKey + 'T12:00:00');
  return `${d.getDate()} ${MONTHS_GENITIVE[d.getMonth()]}`;
}

function nextMondayAfterToday(todayKey: string): string {
  const d = new Date(todayKey + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return formatDateForApi(d);
}

/** Ближайшая суббота (выходные) от текущего дня */
function nextWeekendDayKey(todayKey: string): string {
  const d = new Date(todayKey + 'T12:00:00');
  const wd = d.getDay();
  if (wd === 6 || wd === 0) return formatDateForApi(d);
  d.setDate(d.getDate() + (6 - wd));
  return formatDateForApi(d);
}

function parseTimeIntoDate(dateKey: string, time: string): Date {
  const [hh, mm] = (time || '09:00').split(':').map((x) => parseInt(x, 10));
  const d = new Date(dateKey + 'T12:00:00');
  d.setHours(Number.isFinite(hh) ? hh : 9, Number.isFinite(mm) ? mm : 0, 0, 0);
  return d;
}

function buildMonthCells(year: number, month: number): { day: number; dateKey: string; inMonth: boolean }[] {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7;
  const cells: { day: number; dateKey: string; inMonth: boolean }[] = [];
  for (let i = 0; i < startPad; i++) cells.push({ day: 0, dateKey: '', inMonth: false });
  for (let d = 1; d <= lastDay; d++) {
    cells.push({ day: d, dateKey: formatDateForApi(new Date(year, month, d)), inMonth: true });
  }
  while (cells.length % 7 !== 0) cells.push({ day: 0, dateKey: '', inMonth: false });
  return cells;
}

const REMIND_BEFORE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'По умолчанию' },
  { value: 5, label: '5 мин' },
  { value: 15, label: '15 мин' },
  { value: 30, label: '30 мин' },
];

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
];

type SubModalId = 'schedule' | 'team' | 'assignees' | 'priority' | 'reminders' | null;

export interface TaskAddSheetProps {
  visible: boolean;
  onClose: () => void;
  mainView: TaskMainView;
  todayKey: string;
  tomorrowKey: string;
  defaultDateKey?: string | null;
  addTask: (
    title: string,
    scheduledAt?: string | null,
    remindersDisabled?: boolean,
    remindBeforeMinutes?: number | null,
    assignment?: {
      team_id?: number | null;
      assignees?: { id: number; full_name: string }[];
    },
    priority?: TaskPriority
  ) => Promise<unknown>;
}

export function TaskAddSheet({
  visible,
  onClose,
  mainView,
  todayKey,
  tomorrowKey,
  defaultDateKey,
  addTask,
}: TaskAddSheetProps) {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const isGuest = useAuthStore((s) => s.isGuest);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { teams, loading: teamsLoading } = useTeams();

  const [title, setTitle] = useState('');
  const titleInputRef = useRef<RNTextInput>(null);
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState('09:00');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [remindersDisabled, setRemindersDisabled] = useState(false);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [subModal, setSubModal] = useState<SubModalId>(null);
  const [calendarMonth, setCalendarMonth] = useState(() => new Date());
  const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  const [teamId, setTeamId] = useState<number | null>(null);
  const [assignees, setAssignees] = useState<{ id: number; full_name: string }[]>([]);

  useEffect(() => {
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setKeyboardHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  useEffect(() => {
    if (subModal !== 'schedule') return;
    const base = scheduledDate ? new Date(scheduledDate + 'T12:00:00') : new Date(todayKey + 'T12:00:00');
    setCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
  }, [subModal, scheduledDate, todayKey]);

  useEffect(() => {
    if (!visible) return;
    setSubModal(null);
    setTitle('');
    const nowPlus15 = new Date(Date.now() + 15 * 60 * 1000);
    setScheduledTime(formatTaskTime(nowPlus15));
    setPriority('medium');
    setRemindersDisabled(false);
    setRemindBeforeMinutes(null);
    if (mainView === 'inbox' || mainView === 'completed') setScheduledDate(null);
    else if (mainView === 'today') setScheduledDate(todayKey);
    else setScheduledDate(defaultDateKey ?? tomorrowKey);
    setTeamId(null);
    setAssignees([]);
  }, [visible, mainView, todayKey, tomorrowKey]);

  useEffect(() => {
    if (teamId == null) return;
    const team = teams.find((t) => t.id === teamId);
    if (!team) return;
    const opts = collectTeamMemberOptions(team);
    const allowed = new Set(opts.map((o) => o.id));
    setAssignees((prev) => prev.filter((a) => allowed.has(a.id)));
  }, [teamId, teams]);

  useEffect(() => {
    if (!visible) setSubModal(null);
  }, [visible]);

  useEffect(() => {
    if (!visible) {
      Keyboard.dismiss();
      setKeyboardHeight(0);
      return;
    }
    const id = setTimeout(() => titleInputRef.current?.focus(), 250);
    return () => clearTimeout(id);
  }, [visible]);

  const openScheduleModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    titleInputRef.current?.blur();
    Keyboard.dismiss();
    setSubModal('schedule');
  }, []);

  const openTeamModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    titleInputRef.current?.blur();
    Keyboard.dismiss();
    setSubModal('team');
  }, []);

  const openAssigneesModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    titleInputRef.current?.blur();
    Keyboard.dismiss();
    setSubModal('assignees');
  }, []);

  const openPriorityModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    titleInputRef.current?.blur();
    Keyboard.dismiss();
    setSubModal('priority');
  }, []);

  const openRemindersModal = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    titleInputRef.current?.blur();
    Keyboard.dismiss();
    setSubModal('reminders');
  }, []);

  const closeSub = useCallback(() => {
    setShowScheduleTimePicker(false);
    setSubModal(null);
  }, []);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeSubRef = useRef(closeSub);
  closeSubRef.current = closeSub;

  const flushCloseMain = useCallback(() => {
    onCloseRef.current();
  }, []);
  const flushCloseSub = useCallback(() => {
    closeSubRef.current();
  }, []);

  const mainSheetTranslateY = useSharedValue(0);
  const scheduleSheetTranslateY = useSharedValue(0);

  useEffect(() => {
    if (visible) mainSheetTranslateY.value = 0;
  }, [visible]);

  useEffect(() => {
    if (subModal === 'schedule') scheduleSheetTranslateY.value = 0;
  }, [subModal]);

  const mainSheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          const t = e.translationY;
          mainSheetTranslateY.value = t > 0 ? t : t * 0.2;
        })
        .onEnd((e) => {
          const y = mainSheetTranslateY.value;
          const shouldClose = y > 96 || e.velocityY > 520;
          if (shouldClose) {
            mainSheetTranslateY.value = withTiming(900, { duration: 260 }, (finished) => {
              if (finished) runOnJS(flushCloseMain)();
            });
          } else {
            mainSheetTranslateY.value = withSpring(0, { damping: 26, stiffness: 260 });
          }
        }),
    [flushCloseMain]
  );

  const scheduleSheetPanGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          const t = e.translationY;
          scheduleSheetTranslateY.value = t > 0 ? t : t * 0.2;
        })
        .onEnd((e) => {
          const y = scheduleSheetTranslateY.value;
          const shouldClose = y > 88 || e.velocityY > 520;
          if (shouldClose) {
            scheduleSheetTranslateY.value = withTiming(900, { duration: 240 }, (finished) => {
              if (finished) runOnJS(flushCloseSub)();
            });
          } else {
            scheduleSheetTranslateY.value = withSpring(0, { damping: 26, stiffness: 260 });
          }
        }),
    [flushCloseSub]
  );

  const mainSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: mainSheetTranslateY.value }],
  }));

  const scheduleSheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: scheduleSheetTranslateY.value }],
  }));

  const weekendShortcutKey = useMemo(() => nextWeekendDayKey(todayKey), [todayKey]);
  const nextWeekShortcutKey = useMemo(() => nextMondayAfterToday(todayKey), [todayKey]);

  /** Краткая подпись чипа даты в Quick Add (обновляется при смене дня в модалке «Срок») */
  const scheduleChipLabel = useMemo(() => {
    if (!scheduledDate) return 'Без даты';
    if (scheduledDate === todayKey) return 'Сегодня';
    if (scheduledDate === tomorrowKey) return 'Завтра';
    const d = new Date(scheduledDate + 'T12:00:00');
    return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  }, [scheduledDate, todayKey, tomorrowKey]);

  const scheduleChipHighlighted = scheduledDate != null;

  const teamForExecutor = useMemo(
    () => (teamId != null ? teams.find((t) => t.id === teamId) ?? null : null),
    [teamId, teams]
  );

  const teamChipLabel = useMemo(() => {
    if (teamId == null) return 'Команда';
    return teams.find((t) => t.id === teamId)?.name ?? 'Команда';
  }, [teamId, teams]);

  const assigneesChipLabel = useMemo(() => {
    if (assignees.length === 0) return 'Исполнители';
    if (assignees.length === 1) return assignees[0].full_name;
    return `Исполнители · ${assignees.length}`;
  }, [assignees]);
  const teamChipOn = teamId != null;
  const assigneesChipOn = assignees.length > 0;

  const priorityChipLabel = useMemo(
    () => PRIORITY_OPTIONS.find((o) => o.value === priority)?.label ?? 'Приоритет',
    [priority]
  );

  const remindersChipLabel = useMemo(() => {
    if (remindersDisabled) return 'Пуш выкл';
    const opt = REMIND_BEFORE_OPTIONS.find(
      (o) =>
        (o.value === null && remindBeforeMinutes === null) ||
        (o.value !== null && remindBeforeMinutes === o.value)
    );
    return opt ? `Пуш · ${opt.label}` : 'Пуш вкл';
  }, [remindersDisabled, remindBeforeMinutes]);

  const priorityChipHighlighted = priority !== 'medium';
  const remindersChipHighlighted = !remindersDisabled;

  const monthCells = useMemo(
    () => buildMonthCells(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [calendarMonth]
  );

  const handleSave = useCallback(async () => {
    const trimmed = title.trim();
    if (!trimmed || saving) return;
    setSaving(true);
    const scheduledAtIso =
      scheduledDate != null && scheduledDate !== ''
        ? toUtcIsoFromAppDateTime(scheduledDate, scheduledTime)
        : null;
    const created = await addTask(
      trimmed,
      scheduledAtIso,
      remindersDisabled,
      remindBeforeMinutes,
      { team_id: teamId, assignees },
      priority
    );
    setSaving(false);
    if (created) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onClose();
    }
  }, [
    title,
    scheduledDate,
    scheduledTime,
    remindersDisabled,
    remindBeforeMinutes,
    priority,
    saving,
    addTask,
    onClose,
    teamId,
    assignees,
  ]);

  const canSubmit = title.trim().length > 0 && !saving;

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (subModal) closeSub();
        else onClose();
      }}
    >
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.overlay, keyboardHeight > 0 && { paddingBottom: keyboardHeight }]}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <Animated.View
            style={[
              styles.sheet,
              {
                backgroundColor: background,
                paddingBottom: keyboardHeight > 0 ? 8 : Math.max(insets.bottom, 12),
                maxHeight: '88%',
              },
              mainSheetAnimatedStyle,
            ]}
          >
            <GestureDetector gesture={mainSheetPanGesture}>
              <View style={styles.sheetHandleHit}>
                <View style={[styles.dragGrabber, { backgroundColor: primary }]} />
              </View>
            </GestureDetector>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              nestedScrollEnabled
              showsVerticalScrollIndicator={false}
              bounces
            >
              <View style={styles.titleRow}>
                <View style={[styles.accentBar, { backgroundColor: primary }]} />
                <RNTextInput
                  ref={titleInputRef}
                  value={title}
                  onChangeText={setTitle}
                  placeholder="Название задачи"
                  placeholderTextColor={headerSubtitle}
                  style={[styles.titleInput, { color: headerText }]}
                  multiline={false}
                  returnKeyType="done"
                  blurOnSubmit
                  onSubmitEditing={handleSave}
                />
              </View>

              <View style={[styles.toolsRow, { borderTopColor: border }]}>
                <RNScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                  nestedScrollEnabled
                  contentContainerStyle={styles.metaChipsScrollContent}
                >
                  <Pressable
                    onPress={openScheduleModal}
                    style={[
                      styles.quickPill,
                      { borderColor: border, backgroundColor: cardBg },
                      scheduleChipHighlighted && { borderColor: primary, backgroundColor: `${primary}18` },
                    ]}
                  >
                    <MaterialIcons
                      name={scheduledDate === todayKey ? 'today' : 'event'}
                      size={18}
                      color={scheduleChipHighlighted ? primary : headerSubtitle}
                    />
                    <ThemedText
                      style={[
                        styles.quickPillText,
                        { color: scheduleChipHighlighted ? primary : headerText },
                      ]}
                      numberOfLines={1}
                    >
                      {scheduleChipLabel}
                    </ThemedText>
                  </Pressable>

                  {!isGuest && (
                    <>
                      <Pressable
                        onPress={openTeamModal}
                        style={[
                          styles.quickPill,
                          { borderColor: border, backgroundColor: cardBg },
                          teamChipOn && { borderColor: primary, backgroundColor: `${primary}18` },
                        ]}
                      >
                        <MaterialIcons
                          name="groups"
                          size={18}
                          color={teamChipOn ? primary : headerSubtitle}
                        />
                        <ThemedText
                          style={[
                            styles.quickPillText,
                            { color: teamChipOn ? primary : headerText },
                          ]}
                          numberOfLines={1}
                        >
                          {teamChipLabel}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        onPress={openAssigneesModal}
                        style={[
                          styles.quickPill,
                          { borderColor: border, backgroundColor: cardBg },
                          assigneesChipOn && { borderColor: primary, backgroundColor: `${primary}18` },
                        ]}
                      >
                        <MaterialIcons
                          name="person-outline"
                          size={18}
                          color={assigneesChipOn ? primary : headerSubtitle}
                        />
                        <ThemedText
                          style={[
                            styles.quickPillText,
                            { color: assigneesChipOn ? primary : headerText },
                          ]}
                          numberOfLines={1}
                        >
                          {assigneesChipLabel}
                        </ThemedText>
                      </Pressable>
                    </>
                  )}

                  <Pressable
                    onPress={openPriorityModal}
                    style={[
                      styles.quickPill,
                      { borderColor: border, backgroundColor: cardBg },
                      priorityChipHighlighted && { borderColor: primary, backgroundColor: `${primary}18` },
                    ]}
                  >
                    <MaterialIcons
                      name="flag"
                      size={18}
                      color={priorityChipHighlighted ? primary : headerSubtitle}
                    />
                    <ThemedText
                      style={[
                        styles.quickPillText,
                        { color: priorityChipHighlighted ? primary : headerText },
                      ]}
                      numberOfLines={1}
                    >
                      {priorityChipLabel}
                    </ThemedText>
                  </Pressable>

                  <Pressable
                    onPress={openRemindersModal}
                    style={[
                      styles.quickPill,
                      { borderColor: border, backgroundColor: cardBg },
                      remindersChipHighlighted && { borderColor: primary, backgroundColor: `${primary}18` },
                    ]}
                  >
                    <MaterialIcons
                      name="notifications"
                      size={18}
                      color={remindersChipHighlighted ? primary : headerSubtitle}
                    />
                    <ThemedText
                      style={[
                        styles.quickPillText,
                        { color: remindersChipHighlighted ? primary : headerText },
                      ]}
                      numberOfLines={1}
                    >
                      {remindersChipLabel}
                    </ThemedText>
                  </Pressable>
                </RNScrollView>
              </View>
            </ScrollView>

            <View style={[styles.sheetFooter, { borderTopColor: border }]}>
              <Pressable
                onPress={handleSave}
                disabled={!canSubmit}
                accessibilityLabel="Создать задачу"
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.submitFab,
                  { backgroundColor: primary },
                  !canSubmit && styles.submitFabDisabled,
                  pressed && canSubmit && { opacity: 0.9 },
                ]}
              >
                <MaterialIcons name="north" size={20} color="#fff" />
              </Pressable>
            </View>
          </Animated.View>

          {subModal === 'schedule' && (
            <View style={styles.subOverlayRoot}>
              <Pressable style={styles.subBackdrop} onPress={closeSub} />
              <View style={styles.subScheduleWrap}>
                <Animated.View
                  style={[
                    styles.subScheduleSheet,
                    {
                      backgroundColor: background,
                      paddingBottom: Math.max(insets.bottom, 12),
                    },
                    scheduleSheetAnimatedStyle,
                  ]}
                >
                  <GestureDetector gesture={scheduleSheetPanGesture}>
                    <View style={styles.sheetHandleHit}>
                      <View style={[styles.dragGrabber, { backgroundColor: primary }]} />
                    </View>
                  </GestureDetector>
                  <View style={styles.subSheetHeader}>
                    <Pressable onPress={closeSub} hitSlop={12} style={styles.subSheetHeaderBtn}>
                      <MaterialIcons name="close" size={24} color={headerText} />
                    </Pressable>
                    <ThemedText style={[styles.subSheetHeaderTitle, { color: headerText }]}>Срок</ThemedText>
                    <Pressable onPress={closeSub} hitSlop={12} style={styles.subSheetHeaderBtn}>
                      <MaterialIcons name="check" size={24} color={primary} />
                    </Pressable>
                  </View>

                  <View style={[styles.selectedDateBanner, { backgroundColor: cardBg, borderColor: border }]}>
                    <ThemedText style={[styles.selectedDateBannerText, { color: headerText }]}>
                      {formatDateLabelRu(scheduledDate)}
                    </ThemedText>
                  </View>

                  <ScrollView
                    style={styles.subScheduleScroll}
                    contentContainerStyle={styles.subSheetScrollContent}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
                    showsVerticalScrollIndicator={false}
                    bounces
                  >
                      <Pressable
                        style={[styles.shortcutRow, { borderBottomColor: border }]}
                        onPress={() => {
                          setScheduledDate(tomorrowKey);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <MaterialIcons name="wb-sunny" size={22} color="#F9A825" />
                        <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>Завтра</ThemedText>
                        <ThemedText style={[styles.shortcutHint, { color: headerSubtitle }]}>
                          {WEEKDAY_SHORT[new Date(tomorrowKey + 'T12:00:00').getDay()]}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        style={[styles.shortcutRow, { borderBottomColor: border }]}
                        onPress={() => {
                          setScheduledDate(weekendShortcutKey);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <MaterialIcons name="event-available" size={22} color="#42A5F5" />
                        <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>На выходных</ThemedText>
                        <ThemedText style={[styles.shortcutHint, { color: headerSubtitle }]}>
                          {WEEKDAY_SHORT[new Date(weekendShortcutKey + 'T12:00:00').getDay()]}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        style={[styles.shortcutRow, { borderBottomColor: border }]}
                        onPress={() => {
                          setScheduledDate(nextWeekShortcutKey);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <MaterialIcons name="forward" size={22} color="#AB47BC" />
                        <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>
                          Следующая неделя
                        </ThemedText>
                        <ThemedText style={[styles.shortcutHint, { color: headerSubtitle }]}>
                          {WEEKDAY_SHORT[new Date(nextWeekShortcutKey + 'T12:00:00').getDay()]}
                        </ThemedText>
                      </Pressable>

                      <Pressable
                        style={[styles.shortcutRow, { borderBottomColor: border }]}
                        onPress={() => {
                          setScheduledDate(null);
                          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        }}
                      >
                        <MaterialIcons name="event-busy" size={22} color={headerSubtitle} />
                        <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>Без срока</ThemedText>
                      </Pressable>

                      <View style={styles.calendarHeader}>
                        <Pressable
                          onPress={() => {
                            const d = new Date(calendarMonth);
                            d.setMonth(d.getMonth() - 1);
                            setCalendarMonth(d);
                          }}
                          hitSlop={8}
                        >
                          <MaterialIcons name="chevron-left" size={28} color={headerText} />
                        </Pressable>
                        <ThemedText style={[styles.calendarMonthTitle, { color: headerText }]}>
                          {MONTHS_NOMINATIVE[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                        </ThemedText>
                        <Pressable
                          onPress={() => {
                            const d = new Date(calendarMonth);
                            d.setMonth(d.getMonth() + 1);
                            setCalendarMonth(d);
                          }}
                          hitSlop={8}
                        >
                          <MaterialIcons name="chevron-right" size={28} color={headerText} />
                        </Pressable>
                      </View>

                      <View style={styles.weekdayRow}>
                        {['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((l, i) => (
                          <ThemedText key={`${l}-${i}`} style={[styles.weekdayCell, { color: headerSubtitle }]}>
                            {l}
                          </ThemedText>
                        ))}
                      </View>

                      <View style={styles.calendarGrid}>
                        {monthCells.map((cell, idx) => {
                          if (!cell.inMonth || !cell.dateKey) {
                            return <View key={`e-${idx}`} style={styles.dayCell} />;
                          }
                          const selected = scheduledDate === cell.dateKey;
                          const isToday = cell.dateKey === todayKey;
                          return (
                            <Pressable
                              key={cell.dateKey}
                              onPress={() => {
                                setScheduledDate(cell.dateKey);
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                              }}
                              style={[
                                styles.dayCell,
                                selected && { backgroundColor: primary },
                                isToday && !selected && { borderWidth: 1, borderColor: primary },
                              ]}
                            >
                              <ThemedText
                                style={[
                                  styles.dayCellText,
                                  { color: selected ? '#fff' : headerText },
                                  isToday && !selected && { color: primary, fontWeight: '700' },
                                ]}
                              >
                                {cell.day}
                              </ThemedText>
                            </Pressable>
                          );
                        })}
                      </View>

                      <Pressable
                        style={[styles.metaRow, { borderColor: border }]}
                        onPress={() => setShowScheduleTimePicker(true)}
                      >
                        <MaterialIcons name="schedule" size={22} color={headerSubtitle} />
                        <ThemedText style={[styles.metaRowLabel, { color: headerText }]}>Время</ThemedText>
                        <ThemedText style={[styles.metaRowValue, { color: headerSubtitle }]}>
                          {scheduledTime}
                        </ThemedText>
                        <MaterialIcons name="chevron-right" size={22} color={headerSubtitle} />
                      </Pressable>
                  </ScrollView>

                  {Platform.OS === 'android' && showScheduleTimePicker ? (
                    <DateTimePicker
                      value={parseTimeIntoDate(scheduledDate || todayKey, scheduledTime)}
                      mode="time"
                      display="default"
                      onChange={(event, date) => {
                        setShowScheduleTimePicker(false);
                        if (event.type === 'dismissed' || !date) return;
                        setScheduledTime(formatTaskTime(date));
                      }}
                    />
                  ) : null}

                  {Platform.OS === 'ios' ? (
                    <Modal
                      visible={showScheduleTimePicker}
                      transparent
                      animationType="fade"
                      onRequestClose={() => setShowScheduleTimePicker(false)}
                    >
                      <View style={styles.timePickerRoot}>
                        <Pressable
                          style={styles.timePickerBackdrop}
                          onPress={() => setShowScheduleTimePicker(false)}
                          accessibilityRole="button"
                          accessibilityLabel="Закрыть выбор времени"
                        />
                        <View
                          style={[
                            styles.timePickerSheet,
                            {
                              backgroundColor: cardBg,
                              paddingBottom: Math.max(insets.bottom, 12),
                            },
                          ]}
                        >
                          <View style={[styles.timePickerToolbar, { borderBottomColor: border }]}>
                            <Pressable
                              onPress={() => setShowScheduleTimePicker(false)}
                              hitSlop={12}
                              style={[styles.timePickerToolbarSide, { alignItems: 'flex-start' }]}
                            >
                              <ThemedText style={{ color: primary, fontSize: 17 }}>Отмена</ThemedText>
                            </Pressable>
                            <ThemedText style={[styles.timePickerToolbarTitle, { color: headerText }]}>
                              Время
                            </ThemedText>
                            <Pressable
                              onPress={() => setShowScheduleTimePicker(false)}
                              hitSlop={12}
                              style={[styles.timePickerToolbarSide, { alignItems: 'flex-end' }]}
                            >
                              <ThemedText style={{ color: primary, fontSize: 17, fontWeight: '700' }}>
                                Готово
                              </ThemedText>
                            </Pressable>
                          </View>
                          <View style={styles.timePickerWheelWrap}>
                            <DateTimePicker
                              value={parseTimeIntoDate(scheduledDate || todayKey, scheduledTime)}
                              mode="time"
                              display="spinner"
                              onChange={(_, date) => {
                                if (date) setScheduledTime(formatTaskTime(date));
                              }}
                              style={styles.timePickerIOS}
                            />
                          </View>
                        </View>
                      </View>
                    </Modal>
                  ) : null}
                </Animated.View>
              </View>
            </View>
          )}

          <TaskTeamPickerOverlay
            visible={subModal === 'team'}
            onClose={closeSub}
            teams={teams}
            loading={teamsLoading}
            selectedTeamId={teamId}
            onSelect={(id) => setTeamId(id)}
          />
          <TaskAssigneesPickerOverlay
            visible={subModal === 'assignees'}
            onClose={closeSub}
            teamScope={teamId != null}
            team={teamForExecutor}
            teamLoading={teamId != null && !teamForExecutor && teamsLoading}
            selectedAssignees={assignees}
            onChange={setAssignees}
            currentUserId={currentUserId}
          />

          {subModal === 'priority' && (
            <View style={styles.subOverlayRoot}>
              <Pressable style={styles.subBackdrop} onPress={closeSub} accessibilityLabel="Закрыть" />
              <View style={styles.subScheduleWrap}>
                <View
                  style={[
                    styles.subScheduleSheet,
                    {
                      backgroundColor: background,
                      paddingBottom: Math.max(insets.bottom, 12),
                      maxHeight: '72%',
                    },
                  ]}
                >
                  <View style={styles.sheetHandleHit}>
                    <View style={[styles.dragGrabber, { backgroundColor: primary }]} />
                  </View>
                  <View style={styles.subSheetHeader}>
                    <Pressable onPress={closeSub} hitSlop={12} style={styles.subSheetHeaderBtn}>
                      <MaterialIcons name="close" size={24} color={headerText} />
                    </Pressable>
                    <ThemedText style={[styles.subSheetHeaderTitle, { color: headerText }]}>Приоритет</ThemedText>
                    <Pressable onPress={closeSub} hitSlop={12} style={styles.subSheetHeaderBtn}>
                      <MaterialIcons name="check" size={24} color={primary} />
                    </Pressable>
                  </View>
                  <ScrollView
                    style={styles.subScheduleScroll}
                    contentContainerStyle={styles.subSheetScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    {PRIORITY_OPTIONS.map((o) => {
                      const selected = priority === o.value;
                      return (
                        <Pressable
                          key={o.value}
                          style={[styles.shortcutRow, { borderBottomColor: border }]}
                          onPress={() => {
                            setPriority(o.value);
                            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                          }}
                        >
                          <MaterialIcons
                            name="flag"
                            size={22}
                            color={selected ? primary : headerSubtitle}
                          />
                          <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>{o.label}</ThemedText>
                          {selected ? (
                            <MaterialIcons name="check" size={22} color={primary} />
                          ) : null}
                        </Pressable>
                      );
                    })}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}

          {subModal === 'reminders' && (
            <View style={styles.subOverlayRoot}>
              <Pressable style={styles.subBackdrop} onPress={closeSub} accessibilityLabel="Закрыть" />
              <View style={styles.subScheduleWrap}>
                <View
                  style={[
                    styles.subScheduleSheet,
                    {
                      backgroundColor: background,
                      paddingBottom: Math.max(insets.bottom, 12),
                      maxHeight: '72%',
                    },
                  ]}
                >
                  <View style={styles.sheetHandleHit}>
                    <View style={[styles.dragGrabber, { backgroundColor: primary }]} />
                  </View>
                  <View style={styles.subSheetHeader}>
                    <Pressable onPress={closeSub} hitSlop={12} style={styles.subSheetHeaderBtn}>
                      <MaterialIcons name="close" size={24} color={headerText} />
                    </Pressable>
                    <ThemedText style={[styles.subSheetHeaderTitle, { color: headerText }]}>
                      Напоминания
                    </ThemedText>
                    <Pressable onPress={closeSub} hitSlop={12} style={styles.subSheetHeaderBtn}>
                      <MaterialIcons name="check" size={24} color={primary} />
                    </Pressable>
                  </View>
                  <ScrollView
                    style={styles.subScheduleScroll}
                    contentContainerStyle={styles.subSheetScrollContent}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                  >
                    <View
                      style={[
                        styles.remindersModalSwitchRow,
                        { borderBottomColor: border },
                      ]}
                    >
                      <View style={styles.rowLeft}>
                        <MaterialIcons name="notifications" size={22} color={headerSubtitle} />
                        <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>
                          Пуш-уведомления
                        </ThemedText>
                      </View>
                      <Switch
                        value={!remindersDisabled}
                        onValueChange={(v) => setRemindersDisabled(!v)}
                        trackColor={{ false: border, true: primary }}
                        thumbColor="#fff"
                      />
                    </View>
                    {!remindersDisabled ? (
                      <View style={styles.remindModalChipsBlock}>
                        <ThemedText style={[styles.remindModalSectionTitle, { color: headerSubtitle }]}>
                          Когда напомнить
                        </ThemedText>
                        <View style={styles.remindModalChipsRow}>
                          {REMIND_BEFORE_OPTIONS.map((o) => {
                            const selected =
                              (o.value === null && remindBeforeMinutes === null) ||
                              (o.value !== null && remindBeforeMinutes === o.value);
                            return (
                              <Pressable
                                key={o.value ?? 'def'}
                                onPress={() => {
                                  setRemindBeforeMinutes(o.value);
                                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                                }}
                                style={[
                                  styles.remindChip,
                                  { borderColor: border, backgroundColor: cardBg },
                                  selected && { borderColor: primary, backgroundColor: `${primary}18` },
                                ]}
                              >
                                <ThemedText
                                  style={{
                                    color: selected ? primary : headerText,
                                    fontSize: 13,
                                    fontWeight: '600',
                                  }}
                                >
                                  {o.label}
                                </ThemedText>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    ) : null}
                  </ScrollView>
                </View>
              </View>
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.42)',
  },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  sheetHandleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 12,
    minHeight: 40,
  },
  dragGrabber: {
    width: 42,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.95,
  },
  scroll: { maxHeight: 460 },
  scrollContent: { paddingHorizontal: 16, paddingBottom: 8 },
  sheetFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 6,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  submitFab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitFabDisabled: {
    opacity: 0.4,
  },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start' },
  accentBar: { width: 3, borderRadius: 2, marginRight: 10, minHeight: 44 },
  titleInput: { flex: 1, fontSize: 17, minHeight: 44, paddingVertical: 8 },
  toolsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
    paddingLeft: 0,
    paddingRight: 0,
  },
  metaChipsScrollContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingLeft: 16,
    paddingRight: 16,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  remindersModalSwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  remindModalChipsBlock: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  remindModalSectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  remindModalChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  quickPillText: { fontSize: 13, fontWeight: '600' },
  subOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  subScheduleWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  subScheduleSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  subSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  subSheetHeaderBtn: { padding: 4 },
  subSheetHeaderTitle: { fontSize: 17, fontWeight: '700' },
  selectedDateBanner: {
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectedDateBannerText: { fontSize: 16, fontWeight: '600' },
  subScheduleScroll: { maxHeight: 520, paddingHorizontal: 16 },
  subSheetScrollContent: { paddingBottom: 20, flexGrow: 1 },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  shortcutLabel: { flex: 1, fontSize: 16 },
  shortcutHint: { fontSize: 14, fontWeight: '500' },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  calendarMonthTitle: { fontSize: 16, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 16 },
  dayCell: {
    width: '14.28%',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayCellText: { fontSize: 15 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metaRowLabel: { flex: 1, fontSize: 16 },
  metaRowValue: { fontSize: 15, marginRight: 4 },
  timePickerRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  timePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  timePickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  timePickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timePickerToolbarSide: {
    flex: 1,
  },
  timePickerToolbarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePickerWheelWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  timePickerIOS: {
    width: '100%',
    maxWidth: 320,
    height: 216,
  },
  subBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  remindChip: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
});
