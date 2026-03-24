import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, ScrollView, Pressable, StyleSheet, TextInput as RNTextInput, KeyboardAvoidingView, Platform, ActivityIndicator, Keyboard, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader, Select, Button } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoList } from '@/hooks/use-todo-list';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import type { UserTask } from '@/lib/user-tasks-api';
import { formatTaskTime, toAppDateKey, toUtcIsoFromAppDateTime } from '@/lib/dateTimeUtils';
import { searchUsersForAssign, type UserSearchItem } from '@/lib/api';
import { getDeadlineStatus } from '@/lib/taskDeadlineUtils';

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
  for (let i = -7; i <= 60; i++) { // Расширенный диапазон дат для редактирования
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

const REMIND_BEFORE_OPTIONS: { value: number | null; label: string }[] = [
  { value: null, label: 'По умолчанию' },
  { value: 5, label: '5 мин' },
  { value: 15, label: '15 мин' },
  { value: 30, label: '30 мин' },
];

interface AssigneeChipProps {
  user: { id: number; full_name: string };
  onRemove: (id: number) => void;
  primaryColor: string;
  textColor: string;
}

function AssigneeChip({ user, onRemove, primaryColor, textColor }: AssigneeChipProps) {
  return (
    <View style={[styles.assigneeChip, { backgroundColor: `${primaryColor}20`, borderColor: primaryColor }]}>
      <ThemedText style={[styles.assigneeChipText, { color: textColor }]} numberOfLines={1}>{user.full_name}</ThemedText>
      <Pressable onPress={() => onRemove(user.id)} hitSlop={8} style={styles.assigneeChipRemove}>
        <MaterialIcons name="close" size={16} color={primaryColor} />
      </Pressable>
    </View>
  );
}

export default function TaskEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { mode, taskId: taskIdParam, initialDate, initialTitle, focus } = useLocalSearchParams<{
    mode: 'create' | 'edit';
    taskId?: string;
    initialDate?: string;
    initialTitle?: string;
    focus?: 'title' | 'schedule' | 'deadline' | 'assignees' | 'details';
  }>();
  const isCreate = mode === 'create';
  const taskId = taskIdParam ? parseInt(taskIdParam) : undefined;

  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { tasks, addTask, updateTask, removeTask, loading: loadingTasks } = useTodoList();
  const bumpTasks = useUserTasksInvalidateStore((s) => s.bump);

  const scrollRef = useRef<ScrollView | null>(null);
  const [anchorY, setAnchorY] = useState<{ schedule?: number; deadline?: number; assignees?: number }>({});

  const [currentTask, setCurrentTask] = useState<UserTask | null>(null);
  const [title, setTitle] = useState('');
  const [scheduledDate, setScheduledDate] = useState<string | null>(null);
  const [scheduledTime, setScheduledTime] = useState<string>('09:00');
  const [deadlineFrom, setDeadlineFrom] = useState<string | null>(null);
  const [deadlineTo, setDeadlineTo] = useState<string | null>(null);
  const [deadlineTime, setDeadlineTime] = useState<string>('17:00');
  const [selectedAssignees, setSelectedAssignees] = useState<{ id: number; full_name: string }[]>([]);
  const [assigneeSearch, setAssigneeSearch] = useState('');
  const [assigneeResults, setAssigneeResults] = useState<UserSearchItem[]>([]);
  const [assigneeSearching, setAssigneeSearching] = useState(false);
  const [remindersDisabled, setRemindersDisabled] = useState(false);
  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const dateOptions = useMemo(() => getDateOptions(), []);

  useEffect(() => {
    if (!isCreate && taskId) {
      const task = tasks.find(t => t.id === taskId);
      if (task) {
        setCurrentTask(task);
        setTitle(task.title);
        if (task.scheduled_at) {
          setScheduledDate(toAppDateKey(task.scheduled_at));
          setScheduledTime(formatTaskTime(task.scheduled_at));
        } else {
          setScheduledDate(null);
          setScheduledTime('09:00');
        }
        setDeadlineFrom(task.deadline_from);
        setDeadlineTo(task.deadline_to);
        setDeadlineTime(task.deadline_time || '17:00');
        setRemindersDisabled(task.reminders_disabled ?? false);
        setRemindBeforeMinutes(task.remind_before_minutes ?? null);
        setSelectedAssignees(task.assignees || []);
      } else if (!loadingTasks) { // If not found and not loading, it might be a new task or error
        // Optionally navigate back or show error
        // router.back();
      }
    } else if (isCreate) {
      const nowPlus15Min = new Date(Date.now() + 15 * 60 * 1000);
      const nextDateKey = initialDate || toAppDateKey(nowPlus15Min);
      const nextTime = formatTaskTime(nowPlus15Min);
      setScheduledDate(nextDateKey);
      setScheduledTime(nextTime);
      setRemindersDisabled(false);
      setRemindBeforeMinutes(null);
    }
  }, [isCreate, taskId, tasks, loadingTasks, initialDate]);

  useEffect(() => {
    if (!isCreate) return;
    if (!initialTitle) return;
    // Only set if user hasn't typed yet
    setTitle((prev) => (prev.trim().length === 0 ? initialTitle : prev));
  }, [isCreate, initialTitle]);

  useEffect(() => {
    if (!focus) return;
    const y =
      focus === 'schedule' ? anchorY.schedule :
      focus === 'deadline' ? anchorY.deadline :
      focus === 'assignees' ? anchorY.assignees :
      0;
    if (!scrollRef.current) return;
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ y: Math.max(0, (y ?? 0) - 12), animated: true });
    });
  }, [focus, anchorY]);

  const handleAddAssignee = useCallback((user: UserSearchItem) => {
    setSelectedAssignees((prev) =>
      prev.some((a) => a.id === user.id) ? prev : [...prev, { id: user.id, full_name: user.full_name }]
    );
    setAssigneeSearch('');
    setAssigneeResults([]);
  }, []);

  const handleRemoveAssignee = useCallback((id: number) => {
    setSelectedAssignees((prev) => prev.filter((a) => a.id !== id));
  }, []);

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
      if (res.ok) setAssigneeResults(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [assigneeSearch]);

  const handleSave = useCallback(async () => {
    if (!title.trim()) return;
    setSaving(true);
    const scheduledAtIso = scheduledDate ? toUtcIsoFromAppDateTime(scheduledDate, scheduledTime) : null;
    const assigneeIds = selectedAssignees.length > 0 ? selectedAssignees.map((a) => a.id) : undefined;

    if (isCreate) {
      await addTask(title, scheduledAtIso, {
        from: deadlineFrom,
        to: deadlineTo,
        time: deadlineTime,
      }, assigneeIds, remindersDisabled, remindBeforeMinutes);
    } else if (currentTask) {
      await updateTask(currentTask, {
        title,
        scheduled_at: scheduledAtIso,
        deadline_from: deadlineFrom,
        deadline_to: deadlineTo,
        deadline_time: deadlineTo ? deadlineTime : null,
        assignee_ids: assigneeIds,
        reminders_disabled: remindersDisabled,
        remind_before_minutes: remindBeforeMinutes,
      });
    }
    setSaving(false);
    bumpTasks();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    router.back();
  }, [title, scheduledDate, scheduledTime, deadlineFrom, deadlineTo, deadlineTime, selectedAssignees, remindersDisabled, remindBeforeMinutes, isCreate, currentTask, addTask, updateTask, bumpTasks]);

  const handleDelete = useCallback(async () => {
    if (!currentTask) return;
    setDeleting(true);
    await removeTask(currentTask);
    setDeleting(false);
    bumpTasks();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    Keyboard.dismiss();
    router.back();
  }, [currentTask, removeTask, bumpTasks]);

  const handleToggleComplete = useCallback(async () => {
    if (!currentTask) return;
    setSaving(true);
    await updateTask(currentTask, { completed: !currentTask.completed });
    setSaving(false);
    bumpTasks();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [currentTask, updateTask, bumpTasks]);

  const status = useMemo(() => {
    if (!currentTask) return null;
    return getDeadlineStatus(currentTask.deadline_to, currentTask.deadline_time);
  }, [currentTask]);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <Stack.Screen options={{
        headerShown: false,
        presentation: 'card',
      }} />
      <ScreenHeader title={isCreate ? 'Новая задача' : 'Задача'} inlineTitle hideBackLabel />
      
      {loadingTasks && !currentTask && !isCreate ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <ScrollView
            ref={(r) => { scrollRef.current = r; }}
            style={styles.scrollView}
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]} // Добавляем отступ для кнопки
            showsVerticalScrollIndicator={false}
          >
            <ThemedText style={[styles.label, { color: headerSubtitle }]}>Название задачи</ThemedText>
            <RNTextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Название задачи"
              placeholderTextColor={headerSubtitle}
              style={[styles.input, { color: headerText, borderColor: border }]} 
            />

            <View
              onLayout={(e) => {
                const y = e?.nativeEvent?.layout?.y;
                if (typeof y !== 'number') return;
                setAnchorY((prev) => ({ ...prev, schedule: y }));
              }}
            >
              <ThemedText style={[styles.label, { color: headerSubtitle }]}>Назначить в календарь (опционально)</ThemedText>
            <View style={styles.row}>
              <View style={styles.selectContainer}>
                <Select
                  value={scheduledDate || ''}
                  onValueChange={(v) => setScheduledDate(v || null)}
                  options={dateOptions}
                  placeholder="Дата"
                />
              </View>
              <View style={styles.selectContainer}>
                <Select
                  value={scheduledTime}
                  onValueChange={setScheduledTime}
                  options={TIME_SLOTS}
                  placeholder="Время"
                />
              </View>
            </View>
            </View>

            <View
              onLayout={(e) => {
                const y = e?.nativeEvent?.layout?.y;
                if (typeof y !== 'number') return;
                setAnchorY((prev) => ({ ...prev, deadline: y }));
              }}
            >
              <ThemedText style={[styles.label, { color: headerSubtitle }]}>Срок (опционально)</ThemedText>
            <View style={styles.row}>
              <View style={styles.selectContainer}>
                <Select
                  value={deadlineFrom || ''}
                  onValueChange={(v) => setDeadlineFrom(v || null)}
                  options={dateOptions}
                  placeholder="Дата с"
                />
              </View>
              <View style={styles.selectContainer}>
                <Select
                  value={deadlineTo || ''}
                  onValueChange={(v) => setDeadlineTo(v || null)}
                  options={dateOptions}
                  placeholder="Дата по"
                />
              </View>
              <View style={styles.selectContainer}>
                <Select
                  value={deadlineTime}
                  onValueChange={setDeadlineTime}
                  options={TIME_SLOTS}
                  placeholder="Время"
                />
              </View>
            </View>
            </View>

            <View
              onLayout={(e) => {
                const y = e?.nativeEvent?.layout?.y;
                if (typeof y !== 'number') return;
                setAnchorY((prev) => ({ ...prev, assignees: y }));
              }}
            >
              <ThemedText style={[styles.label, { color: headerSubtitle }]}>Исполнители (опционально)</ThemedText>
            <RNTextInput
              value={assigneeSearch}
              onChangeText={setAssigneeSearch}
              placeholder="Поиск по имени (минимум 2 символа)"
              placeholderTextColor={headerSubtitle}
              style={[styles.input, { color: headerText, borderColor: border }]} 
            />
            {assigneeSearching && (
              <ThemedText style={[styles.searchHint, { color: headerSubtitle }]}>Поиск...</ThemedText>
            )}
            {assigneeResults.length > 0 && (
              <View style={[styles.assigneeResults, { borderColor: border }]}>
                {assigneeResults.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => handleAddAssignee(u)}
                    style={({ pressed }) => [styles.assigneeResultItem, pressed && { opacity: 0.7 }]}
                  >
                    <ThemedText style={[styles.assigneeResultText, { color: headerText }]} numberOfLines={1}>
                      {u.full_name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
            {selectedAssignees.length > 0 && (
              <View style={styles.assigneeChips}>
                {selectedAssignees.map((a) => (
                  <AssigneeChip 
                    key={a.id} 
                    user={a} 
                    onRemove={handleRemoveAssignee} 
                    primaryColor={primary} 
                    textColor={headerText} 
                  />
                ))}
              </View>
            )}
            </View>

            <View style={[styles.remindersRow, { borderColor: border }]}>
              <ThemedText style={[styles.remindersLabel, { color: headerText }]}>
                Напоминания
              </ThemedText>
              <ThemedText style={[styles.remindersHint, { color: headerSubtitle }]}>
                Пуш-уведомления по времени в календаре, дедлайну или по кнопке «Напомнить» в пуше
              </ThemedText>
              <View style={[styles.switchRow, { borderColor: border }]}>
                <ThemedText style={[styles.switchLabel, { color: headerText }]}>
                  Включить напоминания
                </ThemedText>
                <Switch
                  value={!remindersDisabled}
                  onValueChange={(v) => setRemindersDisabled(!v)}
                  trackColor={{ false: border, true: primary }}
                  thumbColor="#fff"
                />
              </View>

              {!remindersDisabled && (
                <View style={styles.remindBeforeContainer}>
                  <ThemedText style={[styles.label, { color: headerSubtitle, marginTop: 12 }]}>
                    Когда напомнить
                  </ThemedText>
                  <View style={styles.remindBeforeBlocks}>
                    {REMIND_BEFORE_OPTIONS.map((o) => {
                      const isSelected = (o.value === null && remindBeforeMinutes === null) || (o.value !== null && remindBeforeMinutes === o.value);
                      return (
                        <Pressable
                          key={o.value ?? 'default'}
                          onPress={() => setRemindBeforeMinutes(o.value)}
                          style={[
                            styles.remindBeforeBlock,
                            { borderColor: border, backgroundColor: cardBg },
                            isSelected && { borderColor: primary, backgroundColor: `${primary}18` },
                          ]}
                        >
                          <ThemedText
                            style={[
                              styles.remindBeforeBlockText,
                              { color: isSelected ? primary : headerText },
                            ]}
                          >
                            {o.label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>
              )}
            </View>

            {!isCreate && currentTask && (
              <View style={styles.actionsContainer}>
                <Pressable onPress={handleToggleComplete} style={styles.actionButton}>
                  <MaterialIcons 
                    name={currentTask.completed ? 'check-box' : 'check-box-outline-blank'} 
                    size={24} 
                    color={primary} 
                  />
                  <ThemedText style={[styles.actionText, { color: primary }]}>
                    {currentTask.completed ? 'Отметить как невыполненную' : 'Отметить как выполненную'}
                  </ThemedText>
                </Pressable>

                <Pressable onPress={handleDelete} style={styles.actionButton}>
                  <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                  <ThemedText style={[styles.actionText, { color: '#EF4444' }]}>
                    Удалить задачу
                  </ThemedText>
                </Pressable>

                {status === 'overdue' && !currentTask.completed && (
                  <View style={[styles.badge, { backgroundColor: '#EF4444' }]}>
                    <ThemedText style={styles.badgeText}>Просрочено</ThemedText>
                  </View>
                )}
                {status === 'expiring' && !currentTask.completed && (
                  <View style={[styles.badge, { backgroundColor: '#F59E0B' }]}>
                    <ThemedText style={styles.badgeText}>Истекает срок</ThemedText>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
          <View style={[styles.bottomActions, { backgroundColor: background, borderTopColor: border }]}>
            <Button 
              title="Отмена" 
              variant="secondary" 
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                Keyboard.dismiss();
                router.back();
              }}
              containerStyle={styles.actionButtonSpace}
            />
            <Button 
              title={saving ? 'Сохранение...' : 'Сохранить'} 
              onPress={handleSave} 
              disabled={!title.trim() || saving || deleting} 
              containerStyle={styles.actionButtonSpace}
            />
          </View>
        </KeyboardAvoidingView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  keyboardView: { flex: 1 },
  scrollView: { flex: 1, paddingHorizontal: 16, paddingTop: 16 },
  scrollContent: { flexGrow: 1 },
  label: { fontSize: 14, marginBottom: 6, marginTop: 12 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
  },
  row: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  selectContainer: { flex: 1 },
  searchHint: { fontSize: 12, marginBottom: 4 },
  assigneeResults: {
    borderWidth: 1,
    borderRadius: 8,
    maxHeight: 120,
    marginBottom: 8,
  },
  assigneeResultItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  assigneeResultText: { fontSize: 14 },
  assigneeChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 16,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingLeft: 8,
    paddingRight: 4,
    borderRadius: 8,
    borderWidth: 1,
  },
  assigneeChipText: {
    fontSize: 13,
    maxWidth: 120,
  },
  assigneeChipRemove: {
    marginLeft: 4,
  },
  remindersRow: {
    marginTop: 20,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 8,
  },
  remindersLabel: {
    fontSize: 14,
    fontWeight: '600',
  },
  remindersHint: {
    fontSize: 12,
    lineHeight: 18,
  },
  remindBeforeContainer: {
    marginTop: 10,
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
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  actionsContainer: {
    marginTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 16,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 12,
  },
  actionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 8,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  bottomActions: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto', 
    gap: 12,
  },
  actionButtonSpace: { flex: 1 },
});
