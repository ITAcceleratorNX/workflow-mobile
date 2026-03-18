import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, TextInput as RNTextInput, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Select } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoList } from '@/hooks/use-todo-list';
import { searchUsersForAssign, type UserSearchItem } from '@/lib/api';
import { formatDateForApi, formatTimeOnly } from '@/lib/dateTimeUtils';
import { toAppDateKey, toUtcIsoFromAppDateTime } from '@/lib/taskDateTime';
import { useAuthStore } from '@/stores/auth-store';

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
    const key = formatDateForApi(d);
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

  const scheduledEnabled = !!task?.scheduled_at;
  const deadlineEnabled = !!task?.deadline_to;
  const [titleDraft, setTitleDraft] = useState('');
  const dateOptions = useMemo(() => getDateOptions(), []);
  const scrollRef = useRef<ScrollView | null>(null);
  const [anchorY, setAnchorY] = useState<{ assignees?: number }>({});

  const [iosPicker, setIosPicker] = useState<{
    open: boolean;
    mode: 'schedule-date' | 'schedule-time' | 'deadline-from' | 'deadline-to' | 'deadline-time';
    value: Date;
  }>({ open: false, mode: 'schedule-date', value: new Date() });

  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<UserSearchItem[]>([]);
  const [assigneeSearching, setAssigneeSearching] = useState(false);
  const [selectedAssignees, setSelectedAssignees] = useState<{ id: number; full_name: string }[]>([]);

  const clampDeadlineRange = useCallback((fromKey: string | null, toKey: string | null) => {
    if (!fromKey || !toKey) return { from: fromKey, to: toKey };
    // Compare as YYYY-MM-DD strings (lexicographically safe)
    if (fromKey <= toKey) return { from: fromKey, to: toKey };
    return { from: toKey, to: fromKey };
  }, []);

  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title ?? '');
  }, [task?.id, task?.title]);

  useEffect(() => {
    if (!task) return;
    setSelectedAssignees(task.assignees ?? []);
  }, [task?.id]);

  useEffect(() => {
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
  }, [assigneeSearch, currentUserId]);

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.back();
  }, [router]);

  const handleToggleSchedule = useCallback(async () => {
    if (!task) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (task.scheduled_at) {
      await updateTask(task, { scheduled_at: null });
      return;
    }
    const todayKey = formatDateForApi(new Date());
    await updateTask(task, { scheduled_at: isoForDateTime(todayKey, '09:00') });
  }, [task, updateTask]);

  const handleToggleDeadline = useCallback(async () => {
    if (!task) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (task.deadline_to) {
      await updateTask(task, { deadline_from: null, deadline_to: null, deadline_time: null });
      return;
    }
    const todayKey = formatDateForApi(new Date());
    await updateTask(task, { deadline_from: todayKey, deadline_to: todayKey, deadline_time: '17:00' });
  }, [task, updateTask]);

  const openIosPicker = useCallback((mode: 'schedule-date' | 'schedule-time' | 'deadline-from' | 'deadline-to' | 'deadline-time') => {
    if (!task) return;

    const scheduledBase = task.scheduled_at ? new Date(task.scheduled_at) : new Date();
    const deadlineBase =
      task.deadline_to || task.deadline_from
        ? new Date(toUtcIsoFromAppDateTime((task.deadline_to ?? task.deadline_from)!, task.deadline_time ?? '17:00'))
        : new Date();

    const value =
      mode === 'schedule-date' || mode === 'schedule-time'
        ? scheduledBase
        : deadlineBase;

    setIosPicker({ open: true, mode, value });
  }, [task]);

  const applyIosPicker = useCallback(async () => {
    if (!task) return;
    const mode = iosPicker.mode;
    const next = iosPicker.value;

    if (mode === 'schedule-date' || mode === 'schedule-time') {
      const dateKey = formatDateForApi(next);
      const time = formatTimeOnly(next);
      await updateTask(task, { scheduled_at: isoForDateTime(dateKey, time) });
      return;
    }

    if (mode === 'deadline-time') {
      const time = formatTimeOnly(next);
      const baseFrom = task.deadline_from ?? task.deadline_to ?? formatDateForApi(new Date());
      const baseTo = task.deadline_to ?? task.deadline_from ?? baseFrom;
      const { from, to } = clampDeadlineRange(baseFrom, baseTo);
      await updateTask(task, { deadline_from: from, deadline_to: to, deadline_time: time });
      return;
    }

    const pickedDateKey = formatDateForApi(next);
    const baseFrom = mode === 'deadline-from' ? pickedDateKey : (task.deadline_from ?? pickedDateKey);
    const baseTo = mode === 'deadline-to' ? pickedDateKey : (task.deadline_to ?? pickedDateKey);
    const { from, to } = clampDeadlineRange(baseFrom, baseTo);
    await updateTask(task, { deadline_from: from, deadline_to: to });
  }, [iosPicker.mode, iosPicker.value, task, updateTask]);

  const updateScheduleDateAndroid = useCallback(async (dateKey: string) => {
    if (!task) return;
    const currentTime = task.scheduled_at ? formatTimeOnly(task.scheduled_at) : '09:00';
    await updateTask(task, { scheduled_at: isoForDateTime(dateKey, currentTime) });
  }, [task, updateTask]);

  const updateScheduleTimeAndroid = useCallback(async (time: string) => {
    if (!task) return;
    const dateKey = task.scheduled_at ? toAppDateKey(task.scheduled_at) : formatDateForApi(new Date());
    await updateTask(task, { scheduled_at: isoForDateTime(dateKey, time) });
  }, [task, updateTask]);

  const updateDeadlineFromAndroid = useCallback(async (dateKey: string) => {
    if (!task) return;
    const baseTo = task.deadline_to ?? dateKey;
    const { from, to } = clampDeadlineRange(dateKey, baseTo);
    await updateTask(task, { deadline_from: from, deadline_to: to });
  }, [task, updateTask, clampDeadlineRange]);

  const updateDeadlineToAndroid = useCallback(async (dateKey: string) => {
    if (!task) return;
    const baseFrom = task.deadline_from ?? dateKey;
    const { from, to } = clampDeadlineRange(baseFrom, dateKey);
    await updateTask(task, { deadline_from: from, deadline_to: to });
  }, [task, updateTask, clampDeadlineRange]);

  const updateDeadlineTimeAndroid = useCallback(async (time: string) => {
    if (!task) return;
    const baseFrom = task.deadline_from ?? task.deadline_to ?? formatDateForApi(new Date());
    const baseTo = task.deadline_to ?? task.deadline_from ?? baseFrom;
    const { from, to } = clampDeadlineRange(baseFrom, baseTo);
    await updateTask(task, { deadline_from: from, deadline_to: to, deadline_time: time });
  }, [task, updateTask, clampDeadlineRange]);

  const saveTitle = useCallback(async () => {
    if (!task) return;
    const next = titleDraft.trim();
    if (!next || next === task.title) {
      setTitleDraft(task.title ?? '');
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await updateTask(task, { title: next });
  }, [task, titleDraft, updateTask]);

  const persistAssignees = useCallback(async (next: { id: number; full_name: string }[]) => {
    if (!task) return;
    setSelectedAssignees(next);
    const ids = next.map((a) => a.id);
    await updateTask(task, { assignee_ids: ids });
  }, [task, updateTask]);

  const handleAddAssignee = useCallback(async (user: UserSearchItem) => {
    if (currentUserId && user.id === currentUserId) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = selectedAssignees.some((a) => a.id === user.id)
      ? selectedAssignees
      : [...selectedAssignees, { id: user.id, full_name: user.full_name }];
    setAssigneeSearch('');
    setAssigneeResults([]);
    await persistAssignees(next);
  }, [persistAssignees, selectedAssignees, currentUserId]);

  const handleRemoveAssignee = useCallback(async (id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const next = selectedAssignees.filter((a) => a.id !== id);
    await persistAssignees(next);
  }, [persistAssignees, selectedAssignees]);

  if (!task) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={styles.grabberWrap} pointerEvents="none">
          <View style={[styles.grabber, { backgroundColor: border }]} />
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
  const scheduledTimeLabel = task.scheduled_at ? formatTimeOnly(task.scheduled_at) : '—';
  const deadlineFromLabel = task.deadline_from ?? '—';
  const deadlineToLabel = task.deadline_to ?? '—';
  const deadlineTimeLabel = task.deadline_time ?? '—';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <View style={styles.grabberWrap} pointerEvents="none">
        <View style={[styles.grabber, { backgroundColor: border }]} />
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
            returnKeyType="done"
            placeholder="Название задачи"
            placeholderTextColor={textMuted}
            style={[styles.titleInput, { color: text }]}
          />
        </View>

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Дата и время</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="event" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Дата</ThemedText>
            </View>
            <View style={styles.rowRight}>
              <Pressable
                disabled={!scheduledEnabled}
                onPress={() => {
                  if (!scheduledEnabled) return;
                  if (Platform.OS === 'ios') openIosPicker('schedule-date');
                }}
                hitSlop={8}
              >
                <ThemedText style={[styles.rowValue, { color: scheduledEnabled ? textMuted : textMuted, textDecorationLine: Platform.OS === 'ios' && scheduledEnabled ? 'underline' : 'none' }]}>
                  {scheduledDateLabel}
                </ThemedText>
              </Pressable>
              <Switch value={scheduledEnabled} onValueChange={handleToggleSchedule} />
            </View>
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="schedule" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Время</ThemedText>
            </View>
            <View style={styles.rowRight}>
              <Pressable
                disabled={!scheduledEnabled}
                onPress={() => {
                  if (!scheduledEnabled) return;
                  if (Platform.OS === 'ios') openIosPicker('schedule-time');
                }}
                hitSlop={8}
              >
                <ThemedText style={[styles.rowValue, { color: textMuted, textDecorationLine: Platform.OS === 'ios' && scheduledEnabled ? 'underline' : 'none' }]}>
                  {scheduledTimeLabel}
                </ThemedText>
              </Pressable>
            </View>
          </View>

          {Platform.OS === 'android' && scheduledEnabled ? (
            <View style={styles.pickersBlock}>
              <Select
                value={scheduledDateLabel === '—' ? formatDateForApi(new Date()) : scheduledDateLabel}
                onValueChange={updateScheduleDateAndroid}
                options={dateOptions}
                placeholder="Дата"
              />
              <Select
                value={scheduledTimeLabel === '—' ? '09:00' : scheduledTimeLabel}
                onValueChange={updateScheduleTimeAndroid}
                options={TIME_SLOTS}
                placeholder="Время"
              />
            </View>
          ) : null}
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Дедлайн</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="flag" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Срок</ThemedText>
            </View>
            <View style={styles.rowRight}>
              <Pressable
                disabled={!deadlineEnabled}
                onPress={() => {
                  if (!deadlineEnabled) return;
                  if (Platform.OS === 'ios') openIosPicker('deadline-to');
                }}
                hitSlop={8}
              >
                <ThemedText style={[styles.rowValue, { color: textMuted, textDecorationLine: Platform.OS === 'ios' && deadlineEnabled ? 'underline' : 'none' }]}>
                  {deadlineEnabled ? `${deadlineFromLabel} → ${deadlineToLabel}` : '—'}
                </ThemedText>
              </Pressable>
              <Switch value={deadlineEnabled} onValueChange={handleToggleDeadline} />
            </View>
          </View>

          {Platform.OS === 'ios' && deadlineEnabled ? (
            <>
              <View style={[styles.divider, { backgroundColor: border }]} />
              <Pressable onPress={() => openIosPicker('deadline-from')} style={styles.linkRow}>
                <ThemedText style={[styles.linkText, { color: primary }]}>Дата с</ThemedText>
                <MaterialIcons name="chevron-right" size={22} color={textMuted} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: border }]} />
              <Pressable onPress={() => openIosPicker('deadline-to')} style={styles.linkRow}>
                <ThemedText style={[styles.linkText, { color: primary }]}>Дата по</ThemedText>
                <MaterialIcons name="chevron-right" size={22} color={textMuted} />
              </Pressable>
              <View style={[styles.divider, { backgroundColor: border }]} />
              <Pressable onPress={() => openIosPicker('deadline-time')} style={styles.linkRow}>
                <ThemedText style={[styles.linkText, { color: primary }]}>Время</ThemedText>
                <ThemedText style={[styles.rowValue, { color: textMuted }]}>{deadlineTimeLabel}</ThemedText>
              </Pressable>
            </>
          ) : null}

          {Platform.OS === 'android' && deadlineEnabled ? (
            <View style={styles.pickersBlock}>
              <Select
                value={task.deadline_from ?? task.deadline_to ?? formatDateForApi(new Date())}
                onValueChange={updateDeadlineFromAndroid}
                options={dateOptions}
                placeholder="Дата с"
              />
              <Select
                value={task.deadline_to ?? task.deadline_from ?? formatDateForApi(new Date())}
                onValueChange={updateDeadlineToAndroid}
                options={dateOptions}
                placeholder="Дата по"
              />
              <Select
                value={task.deadline_time ?? '17:00'}
                onValueChange={updateDeadlineTimeAndroid}
                options={TIME_SLOTS}
                placeholder="Время"
              />
            </View>
          ) : null}
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Организация</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
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
              placeholder="Поиск по имени (минимум 2 символа)"
              placeholderTextColor={textMuted}
              onFocus={() => {
                const y = anchorY.assignees ?? 0;
                requestAnimationFrame(() => {
                  scrollRef.current?.scrollTo({ y: Math.max(0, y - 12), animated: true });
                });
              }}
              style={[styles.assigneeInput, { color: text, borderColor: border }]}
            />

            {assigneeSearching ? (
              <ThemedText style={{ color: textMuted, fontSize: 12 }}>Поиск…</ThemedText>
            ) : null}

            {assigneeResults.length > 0 ? (
              <View style={[styles.assigneeResults, { borderColor: border, backgroundColor: cardBg }]}>
                {assigneeResults.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => handleAddAssignee(u)}
                    style={({ pressed }) => [styles.assigneeResultItem, pressed && { opacity: 0.7 }]}
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
                    <Pressable onPress={() => handleRemoveAssignee(a.id)} hitSlop={10} style={styles.assigneeChipRemove}>
                      <MaterialIcons name="close" size={16} color={primary} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : null}
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
            onPress={async () => {
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
              await removeTask(task);
              router.back();
            }}
            style={styles.linkRow}
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
          <Pressable
            style={styles.pickerBackdrop}
            onPress={() => setIosPicker((p) => ({ ...p, open: false }))}
          >
            <Pressable style={[styles.pickerSheet, { backgroundColor: cardBg, borderColor: border }]} onPress={() => {}}>
              <View style={styles.pickerHeader}>
                <Pressable
                  onPress={() => setIosPicker((p) => ({ ...p, open: false }))}
                  hitSlop={10}
                >
                  <ThemedText style={{ color: primary, fontWeight: '700' }}>Отмена</ThemedText>
                </Pressable>
                <Pressable
                  onPress={async () => {
                    await applyIosPicker();
                    setIosPicker((p) => ({ ...p, open: false }));
                  }}
                  hitSlop={10}
                >
                  <ThemedText style={{ color: primary, fontWeight: '800' }}>Готово</ThemedText>
                </Pressable>
              </View>

              <DateTimePicker
                value={iosPicker.value}
                mode={iosPicker.mode.endsWith('time') ? 'time' : 'date'}
                display="spinner"
                onChange={(_, d) => {
                  if (!d) return;
                  setIosPicker((p) => ({ ...p, value: d }));
                }}
                style={{ backgroundColor: 'transparent' }}
              />
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 6,
    paddingBottom: 2,
  },
  grabber: {
    width: 40,
    height: 5,
    borderRadius: 999,
    opacity: 0.45,
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
  rowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
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
  pickerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'flex-end',
  },
  pickerSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    borderWidth: 1,
    paddingBottom: 18,
  },
  pickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

