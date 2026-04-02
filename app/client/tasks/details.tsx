import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  TextInput as RNTextInput,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  collectTeamMemberOptions,
  TaskExecutorPickerOverlay,
  TaskTeamPickerOverlay,
} from '@/components/tasks/task-assignment-pickers';
import { Select } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTeams } from '@/hooks/use-teams';
import { useTodoList } from '@/hooks/use-todo-list';
import type { Team } from '@/lib/teams-api';
import { searchUsersForAssign, type UserSearchItem } from '@/lib/api';
import { formatTaskTime, toAppDateKey, toUtcIsoFromAppDateTime } from '@/lib/dateTimeUtils';
import type { TaskPriority } from '@/lib/user-tasks-api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/context/toast-context';

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

function isoForDateTime(dateKey: string, time: string) {
  return toUtcIsoFromAppDateTime(dateKey, time);
}

const TIME_SLOTS: { value: string; label: string }[] = (() => {
  const slots: { value: string; label: string }[] = [];
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const value = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
      slots.push({ value, label: value });
    }
  }
  return slots;
})();

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function getDateOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const today = new Date();
  for (let i = -7; i <= 60; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const key = toAppDateKey(d);
    let label = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
    if (i === 0) label = 'Сегодня';
    if (i === 1) label = 'Завтра';
    if (i === -1) label = 'Вчера';
    options.push({ value: key, label });
  }
  return options;
}

export default function TaskDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { taskId: taskIdParam } = useLocalSearchParams<{ taskId?: string }>();
  const taskId = taskIdParam ? parseInt(taskIdParam) : null;
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { show } = useToast();
  const { teams, loading: teamsLoading } = useTeams();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { tasks, updateTask, removeTask, toggleComplete } = useTodoList();

  const task = useMemo(() => {
    if (!taskId) return null;
    return tasks.find((t) => t.id === taskId) ?? null;
  }, [tasks, taskId]);

  const canEditDetails = !!task && !!currentUserId && task.creator_id === currentUserId;

  const notifyCreatorOnly = useCallback(() => {
    show({
      title: 'Только создатель может редактировать',
      description: 'Вы можете менять только статус выполнения.',
      variant: 'default',
      duration: 3500,
    });
  }, [show]);

  const scheduledEnabled = !!task?.scheduled_at;
  const [titleDraft, setTitleDraft] = useState('');
  const dateOptions = useMemo(() => getDateOptions(), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const [anchorY, setAnchorY] = useState<{ assignees?: number }>({});

  const [iosPicker, setIosPicker] = useState<{
    open: boolean;
    mode: 'schedule-date' | 'schedule-time';
    value: Date;
  }>({ open: false, mode: 'schedule-date', value: new Date() });

  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<UserSearchItem[]>([]);
  const [assigneeSearching, setAssigneeSearching] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<{ id: number; full_name: string }[]>([]);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number | null>(null);
  const [pickerSheet, setPickerSheet] = useState<'team' | 'executor' | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('medium');

  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title ?? '');
    setRemindBeforeMinutes(task.remind_before_minutes ?? null);
    setPriority(task.priority ?? 'medium');
  }, [task]);

  useEffect(() => {
    if (!task) return;
    setSelectedAssignees(task.assignees ?? []);
  }, [task]);

  useEffect(() => {
    if (!canEditDetails) {
      setAssigneeResults([]);
      setAssigneeSearching(false);
      return;
    }
    const q = assigneeSearch.trim();
    if (q.length < 2) {
      setAssigneeResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setAssigneeSearching(true);
      const res = await searchUsersForAssign(q);
      setAssigneeSearching(false);
      if (res.ok) {
        const filtered = currentUserId ? res.data.filter((u) => u.id !== currentUserId) : res.data;
        setAssigneeResults(filtered);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [assigneeSearch, currentUserId, canEditDetails]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleToggleSchedule = useCallback(async () => {
    if (!task || !canEditDetails) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (task.scheduled_at) {
      await updateTask(task, { scheduled_at: null });
      return;
    }
    const nowPlus15Min = new Date(Date.now() + 15 * 60 * 1000);
    await updateTask(task, {
      scheduled_at: isoForDateTime(toAppDateKey(nowPlus15Min), formatTaskTime(nowPlus15Min)),
    });
  }, [task, canEditDetails, updateTask]);

  const handleToggleReminders = useCallback(async () => {
    if (!task || !canEditDetails) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateTask(task, { reminders_disabled: !task.reminders_disabled });
  }, [task, canEditDetails, updateTask]);

  const openIosPicker = useCallback(
    (mode: 'schedule-date' | 'schedule-time') => {
      if (!task) return;
      if (!canEditDetails) {
        notifyCreatorOnly();
        return;
      }
      const scheduledBase = task.scheduled_at ? new Date(task.scheduled_at) : new Date();
      setIosPicker({ open: true, mode, value: scheduledBase });
    },
    [task, canEditDetails, notifyCreatorOnly]
  );

  const applyIosPicker = useCallback(async () => {
    if (!task || !canEditDetails) return;
    const next = iosPicker.value;
    const dateKey = toAppDateKey(next);
    const time = formatTaskTime(next);
    await updateTask(task, { scheduled_at: isoForDateTime(dateKey, time) });
  }, [iosPicker.value, task, canEditDetails, updateTask]);

  const updateScheduleDate = useCallback(
    async (dateKey: string) => {
      if (!task || !canEditDetails) return;
      const currentTime = task.scheduled_at ? formatTaskTime(task.scheduled_at) : '09:00';
      await updateTask(task, { scheduled_at: isoForDateTime(dateKey, currentTime) });
    },
    [task, canEditDetails, updateTask]
  );

  const updateScheduleTime = useCallback(
    async (time: string) => {
      if (!task || !canEditDetails) return;
      const dateKey = task.scheduled_at ? toAppDateKey(task.scheduled_at) : toAppDateKey(new Date());
      await updateTask(task, { scheduled_at: isoForDateTime(dateKey, time) });
    },
    [task, canEditDetails, updateTask]
  );

  const handleRemindBeforeChange = useCallback(async (value: number | null) => {
    if (!task || !canEditDetails) return;
    setRemindBeforeMinutes(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateTask(task, { remind_before_minutes: value });
  }, [task, canEditDetails, updateTask]);

  const handlePriorityChange = useCallback(async (value: TaskPriority) => {
    if (!task || !canEditDetails) return;
    setPriority(value);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateTask(task, { priority: value });
  }, [task, canEditDetails, updateTask]);

  const saveTitle = useCallback(async () => {
    if (!task || !canEditDetails) return;
    const next = titleDraft.trim();
    if (!next || next === task.title) {
      setTitleDraft(task.title ?? '');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateTask(task, { title: next });
  }, [task, canEditDetails, titleDraft, updateTask]);

  const persistAssignees = useCallback(
    async (next: { id: number; full_name: string }[]) => {
      if (!task || !canEditDetails) return;
      setSelectedAssignees(next);
      const ids = next.map((a) => a.id);
      await updateTask(task, { assignee_ids: ids });
    },
    [task, canEditDetails, updateTask]
  );

  const handleAddAssignee = useCallback(
    async (user: UserSearchItem) => {
      if (!canEditDetails) return;
      if (currentUserId && user.id === currentUserId) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = selectedAssignees.some((a) => a.id === user.id)
        ? selectedAssignees
        : [...selectedAssignees, { id: user.id, full_name: user.full_name }];
      setAssigneeSearch('');
      setAssigneeResults([]);
      await persistAssignees(next);
    },
    [canEditDetails, persistAssignees, selectedAssignees, currentUserId]
  );

  const handleRemoveAssignee = useCallback(
    async (id: number) => {
      if (!canEditDetails) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = selectedAssignees.filter((a) => a.id !== id);
      await persistAssignees(next);
    },
    [canEditDetails, persistAssignees, selectedAssignees]
  );

  const teamForExecutor = useMemo((): Team | null => {
    if (!task?.team_id) return null;
    const fromList = teams.find((t) => t.id === task.team_id);
    if (fromList) return fromList;
    if (task.team && task.team.id === task.team_id) {
      return {
        id: task.team.id,
        name: task.team.name,
        leader_id: task.team.leader_id,
        created_by: 0,
        created_at: '',
        updated_at: '',
        leader: task.team.leader,
        members: task.team.members,
      };
    }
    return null;
  }, [task, teams]);

  const selectedExecutorForPicker = useMemo(() => {
    if (!task?.executor_id) return null;
    return {
      id: task.executor_id,
      full_name: task.executor?.full_name ?? 'Пользователь',
    };
  }, [task]);

  const applyTeamAndMaybeClearExecutor = useCallback(
    async (nextTeamId: number | null) => {
      if (!task || !canEditDetails) return;
      let nextExecutorId = task.executor_id ?? null;
      if (nextTeamId != null && nextExecutorId != null) {
        const tm =
          teams.find((x) => x.id === nextTeamId) ??
          (task.team?.id === nextTeamId ? task.team : null);
        const opts = collectTeamMemberOptions(tm);
        if (!opts.some((o) => o.id === nextExecutorId)) {
          nextExecutorId = null;
        }
      }
      await updateTask(task, { team_id: nextTeamId, executor_id: nextExecutorId });
    },
    [task, canEditDetails, updateTask, teams]
  );

  const applyExecutor = useCallback(
    async (ex: { id: number; full_name: string } | null) => {
      if (!task || !canEditDetails) return;
      await updateTask(task, { executor_id: ex?.id ?? null });
    },
    [task, canEditDetails, updateTask]
  );

  const openTeamPicker = useCallback(() => {
    if (!canEditDetails) return;
    Keyboard.dismiss();
    setPickerSheet('team');
  }, [canEditDetails]);

  const openExecutorPicker = useCallback(() => {
    if (!canEditDetails) return;
    Keyboard.dismiss();
    setPickerSheet('executor');
  }, [canEditDetails]);

  if (!task) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={styles.grabberWrap} pointerEvents="none">
          <View style={[styles.grabber, { backgroundColor: primary }]} />
        </View>
        <View style={styles.header}>
          <Pressable onPress={handleClose} hitSlop={12} style={styles.headerBtn}>
            <MaterialIcons name="close" size={26} color={textMuted} />
          </Pressable>
          <ThemedText style={[styles.headerTitle, { color: text }]}>Подробно</ThemedText>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.empty}>
          <ThemedText style={{ color: textMuted }}>Задача не найдена</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const scheduledDateLabel = task.scheduled_at ? toAppDateKey(task.scheduled_at) : '—';
  const scheduledTimeLabel = task.scheduled_at ? formatTaskTime(task.scheduled_at) : '—';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <View style={styles.grabberWrap} pointerEvents="none">
        <View style={[styles.grabber, { backgroundColor: primary }]} />
      </View>
      <View style={styles.header}>
        <Pressable onPress={handleClose} hitSlop={12} style={styles.headerBtn}>
          <MaterialIcons name="close" size={26} color={textMuted} />
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: text }]}>Подробно</ThemedText>
        <Pressable onPress={handleClose} hitSlop={12} style={[styles.headerBtn, styles.headerDone]}>
          <MaterialIcons name="check" size={24} color={primary} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          ref={(r) => {
            scrollRef.current = r;
          }}
          style={styles.scroll}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
        <View style={[styles.titleCard, { backgroundColor: cardBg, borderColor: border }]}>
          <RNTextInput
            value={titleDraft}
            onChangeText={setTitleDraft}
            onSubmitEditing={saveTitle}
            onBlur={saveTitle}
            editable={canEditDetails}
            onPressIn={() => {
              if (canEditDetails) return;
              notifyCreatorOnly();
            }}
            returnKeyType="default"
            multiline
            placeholder="Название и описание"
            placeholderTextColor={textMuted}
            style={[styles.titleInput, { color: canEditDetails ? text : textMuted }]}
          />
        </View>

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Дата и время</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <Pressable
              disabled={!scheduledEnabled}
              onPress={() => {
                if (!scheduledEnabled) return;
                if (Platform.OS === 'ios') openIosPicker('schedule-date');
              }}
              style={({ pressed }) => [
                styles.rowPressable,
                pressed && scheduledEnabled && styles.rowPressablePressed,
                !canEditDetails && scheduledEnabled && { opacity: 0.75 },
              ]}
            >
              <View style={styles.rowLeft}>
                <MaterialIcons name="event" size={20} color={textMuted} />
                <ThemedText style={[styles.rowTitle, { color: text }]}>Дата</ThemedText>
              </View>
              <ThemedText
                style={[
                  styles.rowValue,
                  {
                    color: textMuted,
                    textDecorationLine: Platform.OS === 'ios' && scheduledEnabled ? 'underline' : 'none',
                  },
                ]}
              >
                {scheduledDateLabel}
              </ThemedText>
            </Pressable>
            <Switch
              value={scheduledEnabled}
              onValueChange={handleToggleSchedule}
              disabled={!canEditDetails}
              trackColor={{ false: border, true: primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <Pressable
            disabled={!scheduledEnabled}
            onPress={() => {
              if (!scheduledEnabled) return;
              if (Platform.OS === 'ios') openIosPicker('schedule-time');
            }}
            style={({ pressed }) => [
              styles.row,
              pressed && scheduledEnabled && styles.rowPressablePressed,
              !canEditDetails && scheduledEnabled && { opacity: 0.75 },
            ]}
          >
            <View style={styles.rowLeft}>
              <MaterialIcons name="schedule" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Время</ThemedText>
            </View>
            <ThemedText
              style={[
                styles.rowValue,
                {
                  color: textMuted,
                  textDecorationLine: Platform.OS === 'ios' && scheduledEnabled ? 'underline' : 'none',
                },
              ]}
            >
              {scheduledTimeLabel}
            </ThemedText>
          </Pressable>

          {Platform.OS !== 'ios' && Platform.OS !== 'web' && scheduledEnabled ? (
            <View style={styles.pickersBlock}>
              <Select
                value={scheduledDateLabel === '—' ? toAppDateKey(new Date()) : scheduledDateLabel}
                onValueChange={updateScheduleDate}
                options={dateOptions}
                placeholder="Дата"
                disabled={!canEditDetails}
              />
              <Select
                value={scheduledTimeLabel === '—' ? '09:00' : scheduledTimeLabel}
                onValueChange={updateScheduleTime}
                options={TIME_SLOTS}
                placeholder="Время"
                disabled={!canEditDetails}
              />
            </View>
          ) : null}
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Организация</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {!isGuest ? (
            <>
              <Pressable
                onPress={() => {
                  if (!canEditDetails) {
                    notifyCreatorOnly();
                    return;
                  }
                  openTeamPicker();
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && canEditDetails && styles.rowPressablePressed,
                  !canEditDetails && { opacity: 0.85 },
                ]}
              >
                <View style={styles.rowLeft}>
                  <MaterialIcons name="groups" size={20} color={textMuted} />
                  <ThemedText style={[styles.rowTitle, { color: text }]}>Команда</ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText style={[styles.rowValue, { color: textMuted, flexShrink: 1 }]} numberOfLines={1}>
                    {task.team?.name ?? '—'}
                  </ThemedText>
                  {canEditDetails ? (
                    <MaterialIcons name="chevron-right" size={22} color={textMuted} />
                  ) : null}
                </View>
              </Pressable>
              <View style={[styles.divider, { backgroundColor: border }]} />
              <Pressable
                onPress={() => {
                  if (!canEditDetails) {
                    notifyCreatorOnly();
                    return;
                  }
                  openExecutorPicker();
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && canEditDetails && styles.rowPressablePressed,
                  !canEditDetails && { opacity: 0.85 },
                ]}
              >
                <View style={styles.rowLeft}>
                  <MaterialIcons name="person-outline" size={20} color={textMuted} />
                  <ThemedText style={[styles.rowTitle, { color: text }]}>Исполнитель</ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText style={[styles.rowValue, { color: textMuted, flexShrink: 1 }]} numberOfLines={1}>
                    {task.executor?.full_name ?? '—'}
                  </ThemedText>
                  {canEditDetails ? (
                    <MaterialIcons name="chevron-right" size={22} color={textMuted} />
                  ) : null}
                </View>
              </Pressable>
              <View style={[styles.divider, { backgroundColor: border }]} />
            </>
          ) : null}

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="group" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Исполнители</ThemedText>
            </View>
            <ThemedText style={[styles.rowValue, { color: textMuted }]}>
              {selectedAssignees.length || '—'}
            </ThemedText>
          </View>

          <View style={[styles.divider, { backgroundColor: border }]} />

          <View
            style={styles.assigneesBlock}
            onLayout={(e) => {
              const y = e?.nativeEvent?.layout?.y;
              if (typeof y !== 'number') return;
              setAnchorY((prev) => ({ ...prev, assignees: y }));
            }}
          >
            <RNTextInput
              value={assigneeSearch}
              onChangeText={setAssigneeSearch}
              editable={canEditDetails}
              placeholder="Поиск по имени (минимум 2 символа)"
              placeholderTextColor={textMuted}
              onPressIn={() => {
                if (canEditDetails) return;
                notifyCreatorOnly();
              }}
              onFocus={() => {
                const y = anchorY.assignees ?? 0;
                requestAnimationFrame(() => {
                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
                });
              }}
              style={[
                styles.assigneeInput,
                { color: text, borderColor: border },
                !canEditDetails && { opacity: 0.75 },
              ]}
            />

            {assigneeSearching ? (
              <ThemedText style={{ color: textMuted, fontSize: 12 }}>Поиск…</ThemedText>
            ) : null}

            {assigneeResults.length > 0 ? (
              <View style={[styles.assigneeResults, { borderColor: border, backgroundColor: cardBg }]}>
                {assigneeResults.map((u) => (
                  <Pressable
                    key={u.id}
                    disabled={!canEditDetails}
                    onPress={() => handleAddAssignee(u)}
                    style={({ pressed }) => [
                      styles.assigneeResultItem,
                      pressed && canEditDetails && { opacity: 0.7 },
                      !canEditDetails && { opacity: 0.55 },
                    ]}
                  >
                    <ThemedText style={{ color: text }} numberOfLines={1}>
                      {u.full_name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {selectedAssignees.length > 0 ? (
              <View style={styles.assigneeChips}>
                {selectedAssignees.map((a) => (
                  <View key={a.id} style={[styles.assigneeChip, { borderColor: primary, backgroundColor: `${primary}18` }]}>
                    <ThemedText style={{ color: text }} numberOfLines={1}>
                      {a.full_name}
                    </ThemedText>
                    <Pressable
                      disabled={!canEditDetails}
                      onPress={() => handleRemoveAssignee(a.id)}
                      hitSlop={10}
                      style={styles.assigneeChipRemove}
                    >
                      <MaterialIcons name="close" size={16} color={primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Приоритет</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.remindBeforeSection}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="flag" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Уровень</ThemedText>
            </View>
            <View style={styles.remindBeforeBlocks}>
              {PRIORITY_OPTIONS.map((o) => {
                const isSelected = priority === o.value;
                const disabled = !canEditDetails;
                return (
                  <Pressable
                    key={o.value}
                    onPress={() => !disabled && handlePriorityChange(o.value)}
                    disabled={disabled}
                    style={[
                      styles.remindBeforeBlock,
                      { borderColor: border, backgroundColor: cardBg },
                      isSelected && { borderColor: primary, backgroundColor: `${primary}18` },
                      disabled && { opacity: 0.6 },
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.remindBeforeBlockText,
                        { color: isSelected ? primary : text },
                      ]}
                    >
                      {o.label}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Напоминания</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="notifications" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Включить напоминания</ThemedText>
            </View>
            <Switch
              value={!task.reminders_disabled}
              onValueChange={handleToggleReminders}
              disabled={!canEditDetails}
              trackColor={{ false: border, true: primary }}
              thumbColor="#fff"
            />
          </View>
          <View style={[styles.remindersHintWrap, { borderColor: border }]}>
              <ThemedText style={[styles.remindersHint, { color: textMuted }]}>
                Пуш по времени в календаре или по кнопке в уведомлении
              </ThemedText>
            </View>
            <View style={[styles.divider, { backgroundColor: border }]} />
            <View style={styles.remindBeforeSection}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="alarm" size={20} color={textMuted} />
                <ThemedText style={[styles.rowTitle, { color: text }]}>
                  Когда напомнить
                </ThemedText>
              </View>
              <View style={styles.remindBeforeBlocks}>
                {REMIND_BEFORE_OPTIONS.map((o) => {
                  const isSelected = (o.value === null && remindBeforeMinutes === null) || (o.value !== null && remindBeforeMinutes === o.value);
                  const disabled = !canEditDetails || task.reminders_disabled;
                  return (
                    <Pressable
                      key={o.value ?? 'default'}
                      onPress={() => !disabled && handleRemindBeforeChange(o.value)}
                      disabled={disabled}
                      style={[
                        styles.remindBeforeBlock,
                        { borderColor: border, backgroundColor: cardBg },
                        isSelected && { borderColor: primary, backgroundColor: `${primary}18` },
                        disabled && { opacity: 0.6 },
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.remindBeforeBlockText,
                          { color: isSelected ? primary : text },
                        ]}
                      >
                        {o.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </View>

        <View style={{ height: 16 }} />

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Pressable
            onPress={() => toggleComplete(task)}
            style={styles.linkRow}
          >
            <View style={styles.rowLeft}>
              <MaterialIcons name={task.completed ? 'check-box' : 'check-box-outline-blank'} size={20} color={primary} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>
                {task.completed ? 'Снять выполнено' : 'Отметить выполнено'}
              </ThemedText>
            </View>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <Pressable
            disabled={!canEditDetails}
            onPress={async () => {
              if (!canEditDetails) return;
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await removeTask(task);
              router.back();
            }}
            style={[styles.linkRow, !canEditDetails && { opacity: 0.45 }]}
          >
            <View style={styles.rowLeft}>
              <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
              <ThemedText style={[styles.rowTitle, { color: '#EF4444' }]}>Удалить</ThemedText>
            </View>
          </Pressable>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={iosPicker.open}
          transparent
          animationType="fade"
          onRequestClose={() => setIosPicker((p) => ({ ...p, open: false }))}
        >
          <View style={styles.pickerRoot}>
            <Pressable
              style={styles.pickerBackdropDim}
              onPress={() => setIosPicker((p) => ({ ...p, open: false }))}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            />
            <View
              style={[
                styles.pickerSheet,
                {
                  backgroundColor: cardBg,
                  paddingBottom: Math.max(insets.bottom, 18),
                },
              ]}
            >
              <View style={[styles.pickerHeader, { borderBottomColor: border }]}>
                <Pressable
                  onPress={() => setIosPicker((p) => ({ ...p, open: false }))}
                  hitSlop={10}
                  style={styles.pickerHeaderSide}
                >
                  <ThemedText style={{ color: primary, fontSize: 17 }}>Отмена</ThemedText>
                </Pressable>
                <ThemedText style={[styles.pickerHeaderTitle, { color: text }]}>
                  {iosPicker.mode === 'schedule-time' ? 'Время' : 'Дата'}
                </ThemedText>
                <Pressable
                  onPress={async () => {
                    await applyIosPicker();
                    setIosPicker((p) => ({ ...p, open: false }));
                  }}
                  hitSlop={10}
                  style={[styles.pickerHeaderSide, { alignItems: 'flex-end' }]}
                >
                  <ThemedText style={{ color: primary, fontSize: 17, fontWeight: '700' }}>Готово</ThemedText>
                </Pressable>
              </View>
              <View style={styles.pickerWheelWrap}>
                <DateTimePicker
                  value={iosPicker.value}
                  mode={iosPicker.mode === 'schedule-time' ? 'time' : 'date'}
                  display="spinner"
                  onChange={(_, d) => {
                    if (!d) return;
                    setIosPicker((p) => ({ ...p, value: d }));
                  }}
                  style={styles.pickerWheel}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {!isGuest && task ? (
        <>
          <TaskTeamPickerOverlay
            visible={pickerSheet === 'team'}
            onClose={() => setPickerSheet(null)}
            teams={teams}
            loading={teamsLoading}
            selectedTeamId={task.team_id ?? null}
            onSelect={(id) => void applyTeamAndMaybeClearExecutor(id)}
          />
          <TaskExecutorPickerOverlay
            visible={pickerSheet === 'executor'}
            onClose={() => setPickerSheet(null)}
            teamScope={task.team_id != null}
            team={teamForExecutor}
            teamLoading={task.team_id != null && !teamForExecutor && teamsLoading}
            selectedExecutor={selectedExecutorForPicker}
            onSelect={(ex) => void applyExecutor(ex)}
          />
        </>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 2,
    paddingBottom: 0,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.95,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerDone: {
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
  },
  scroll: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleCard: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 16,
    marginTop: 6,
  },
  titleText: {
    fontSize: 22,
    fontWeight: '700',
  },
  titleInput: {
    fontSize: 22,
    fontWeight: '700',
    paddingVertical: 0,
    paddingHorizontal: 0,
    minHeight: 72,
    textAlignVertical: 'top',
  },
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  rowPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minWidth: 0,
    gap: 10,
    marginRight: 4,
  },
  rowPressablePressed: {
    opacity: 0.65,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 13,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  linkText: {
    fontSize: 15,
    fontWeight: '700',
  },
  chevronBtn: {
    padding: 4,
  },
  pickersBlock: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    gap: 10,
  },
  assigneesBlock: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  assigneeInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  assigneeResults: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  assigneeResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  assigneeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  assigneeChipRemove: {
    padding: 2,
  },
  remindersHintWrap: {
    paddingHorizontal: 14,
    paddingBottom: 12,
    paddingTop: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  remindersHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  remindBeforeSection: {
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  remindBeforeBlocks: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginTop: 8,
  },
  remindBeforeBlock: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    minWidth: 72,
  },
  remindBeforeBlockText: {
    fontSize: 14,
    fontWeight: '600',
  },
  pickerRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  pickerBackdropDim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  pickerSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
  },
  pickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  pickerHeaderSide: {
    flex: 1,
  },
  pickerHeaderTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  pickerWheelWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  pickerWheel: {
    width: '100%',
    maxWidth: 320,
    height: 216,
    backgroundColor: 'transparent',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

