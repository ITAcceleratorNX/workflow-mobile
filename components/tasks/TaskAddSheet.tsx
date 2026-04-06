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
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  collectTeamMemberOptions,
  TaskAssigneesPickerOverlay,
  TaskTeamPickerOverlay,
} from '@/components/tasks/task-assignment-pickers';
import { TaskScheduleSheetContent } from '@/components/tasks/TaskScheduleSheet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTeams } from '@/hooks/use-teams';
import { formatDateForApi, formatTaskTime, toUtcIsoFromAppDateTime } from '@/lib/dateTimeUtils';
import type { TaskMainView } from '@/lib/task-views';
import { useAuthStore } from '@/stores/auth-store';
import type { TaskPriority } from '@/lib/user-tasks-api';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

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
                  <TaskScheduleSheetContent
                    active={subModal === 'schedule'}
                    colors={{
                      sheetBackground: background,
                      bannerBackground: cardBg,
                      border,
                      primary,
                      text: headerText,
                      textMuted: headerSubtitle,
                    }}
                    bottomInset={insets.bottom}
                    todayKey={todayKey}
                    tomorrowKey={tomorrowKey}
                    scheduledDate={scheduledDate}
                    onScheduledDateChange={setScheduledDate}
                    scheduledTime={scheduledTime}
                    onScheduledTimeChange={setScheduledTime}
                    calendarMonth={calendarMonth}
                    onCalendarMonthChange={setCalendarMonth}
                    onClosePress={closeSub}
                    onConfirmPress={closeSub}
                  />
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
