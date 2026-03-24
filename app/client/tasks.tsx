import { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  TextInput as RNTextInput,
  ActivityIndicator,
  Keyboard,
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
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoList } from '@/hooks/use-todo-list';
import { useAuthStore } from '@/stores/auth-store';
import { formatDateForApi, formatTimeOnly, toAppDateKey, formatTaskTime, toUtcIsoFromAppDateTime } from '@/lib/dateTimeUtils';
import { getDeadlineStatus } from '@/lib/taskDeadlineUtils';
import type { UserTask } from '@/lib/user-tasks-api';
import { CalendarTab } from '@/components/tasks/CalendarTab';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatTaskDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00'); // Hack to avoid timezone issues
  const today = new Date();
  const todayKey = formatDateForApi(today);
  if (dateStr === todayKey) return 'Сегодня';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === formatDateForApi(yesterday)) return 'Вчера';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const FILTER_OPTIONS: { value: 'all' | 'today' | 'overdue'; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'today', label: 'Сегодня' },
  { value: 'overdue', label: 'Просроченные' },
];

interface TaskRowProps {
  item: UserTask;
  onToggle: () => void;
  onPressTitle: () => void;
  isEditing: boolean;
  draftTitle: string;
  onChangeDraftTitle: (v: string) => void;
  onSubmitTitle: () => void;
  onCancelEdit: () => void;
  onPressInfo: () => void;
  inputRef?: React.RefObject<RNTextInput | null>;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
  isTeam: boolean;
}

function TaskRow({
  item,
  onToggle,
  onPressTitle,
  isEditing,
  draftTitle,
  onChangeDraftTitle,
  onSubmitTitle,
  onCancelEdit,
  onPressInfo,
  inputRef,
  textColor,
  textMuted,
  primary,
  borderColor,
  isTeam,
}: TaskRowProps) {
  const dateStr = item.scheduled_at ? formatDateForApi(new Date(item.scheduled_at)) : null;
  const timeStr = item.scheduled_at ? formatTimeOnly(item.scheduled_at) : null;
  const isOverdue = item.deadline_to && getDeadlineStatus(item.deadline_to, item.deadline_time) === 'overdue' && !item.completed;

  return (
    <Pressable
      style={[styles.row, { borderBottomColor: borderColor }]}>
      <Pressable
        onPress={() => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          onToggle();
        }}
        style={[styles.checkbox, { borderColor: item.completed ? primary : borderColor }, item.completed && { backgroundColor: primary }]}>
        {item.completed && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
      </Pressable>
      <View style={styles.rowContent}>
        {isEditing ? (
          <RNTextInput
            ref={inputRef as any}
            value={draftTitle}
            onChangeText={onChangeDraftTitle}
            autoFocus
            returnKeyType="done"
            onSubmitEditing={onSubmitTitle}
            onBlur={onCancelEdit}
            placeholder="Название задачи"
            placeholderTextColor={textMuted}
            style={[
              styles.inlineInput,
              { color: textColor, borderColor: borderColor },
            ]}
          />
        ) : (
          <Pressable onPress={onPressTitle} hitSlop={6}>
            <ThemedText
              style={[styles.rowText, { color: item.completed ? textMuted : textColor }, item.completed && styles.textCompleted]}
              numberOfLines={2}>
              {item.title}
            </ThemedText>
          </Pressable>
        )}
        {(dateStr || timeStr) && (
          <ThemedText style={[styles.rowDate, { color: textMuted }, isOverdue && { color: '#EF4444' }]}>
            {dateStr && formatTaskDate(dateStr)} {timeStr && `• ${timeStr}`}
            {isOverdue && ' • Просрочено'}
            {isTeam && ' • Командный'}
          </ThemedText>
        )}
      </View>
      {isEditing ? (
        <Pressable onPress={onPressInfo} hitSlop={12} style={styles.infoBtn}>
          <MaterialIcons name="info-outline" size={24} color={primary} />
        </Pressable>
      ) : (
        <MaterialIcons name="chevron-right" size={24} color={textMuted} />
      )}
    </Pressable>
  );
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const { filter: initialFilter, date: initialDate, view: initialView } = useLocalSearchParams<{
    filter?: 'all' | 'today' | 'overdue';
    date?: string;
    view?: 'list' | 'calendar';
  }>();

  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { tasks, toggleComplete, loading: loadingTasks, addTask, updateTask } = useTodoList();
  const [filterDate, setFilterDate] = useState<'all' | 'today' | 'overdue'>(initialDate === 'today' || initialDate === 'overdue' ? initialDate : (initialFilter ?? 'all') ?? 'all');
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>(initialView === 'calendar' ? 'calendar' : 'list');

  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [creating, setCreating] = useState(false);
  const [createDraftTitle, setCreateDraftTitle] = useState('');

  const editInputRef = useRef<RNTextInput | null>(null);
  const createInputRef = useRef<RNTextInput | null>(null);
  const listRef = useRef<FlatList<UserTask> | null>(null);

  useEffect(() => {
    if (initialFilter === 'today' || initialFilter === 'overdue') setFilterDate(initialFilter);
    if (initialDate === 'today' || initialDate === 'overdue') setFilterDate(initialDate);
  }, [initialFilter, initialDate]);

  useEffect(() => {
    if (initialView === 'calendar') setViewMode('calendar');
    if (initialView === 'list') setViewMode('list');
  }, [initialView]);

  useEffect(() => {
    const showEvt = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvt = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvt as any, (e: any) => setKeyboardHeight(e?.endCoordinates?.height ?? 0));
    const subHide = Keyboard.addListener(hideEvt as any, () => setKeyboardHeight(0));
    return () => {
      subShow.remove();
      subHide.remove();
    };
  }, []);

  const todayKey = formatDateForApi(new Date());
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    return monday;
  }, []);
  const weekStartKey = formatDateForApi(weekStart);

  const filteredTasks = useMemo(() => {
    let list = [...tasks];
    if (filterDate === 'today') {
      list = list.filter((i) => i.scheduled_at && formatDateForApi(new Date(i.scheduled_at)) === todayKey);
    } else if (filterDate === 'overdue') {
      list = list.filter((i) => i.deadline_to && getDeadlineStatus(i.deadline_to, i.deadline_time) === 'overdue' && !i.completed);
    }

    return list.sort((a, b) => {
      const dateA = a.scheduled_at ? new Date(a.scheduled_at).getTime() : 0;
      const dateB = b.scheduled_at ? new Date(b.scheduled_at).getTime() : 0;
      return dateA - dateB;
    });
  }, [tasks, filterDate, todayKey]);

  const scrollToActiveInput = useCallback(() => {
    if (viewMode !== 'list') return;
    // If creating, scroll to end (footer input)
    if (creating) {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated: true });
      });
      return;
    }
    // If editing, scroll to item
    if (editingTaskId) {
      const idx = filteredTasks.findIndex((t) => t.id === editingTaskId);
      if (idx < 0) return;
      requestAnimationFrame(() => {
        try {
          listRef.current?.scrollToIndex({ index: idx, animated: true, viewPosition: 0.25 });
        } catch {
          // ignore
        }
      });
    }
  }, [creating, editingTaskId, filteredTasks, viewMode]);

  const openInlineCreate = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setEditingTaskId(null);
    setDraftTitle('');
    setCreating(true);
    setCreateDraftTitle('');
    requestAnimationFrame(() => {
      scrollToActiveInput();
      createInputRef.current?.focus();
    });
  }, [scrollToActiveInput]);

  const startInlineEdit = useCallback((task: UserTask) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setCreating(false);
    setCreateDraftTitle('');
    setEditingTaskId(task.id);
    setDraftTitle(task.title);
    requestAnimationFrame(() => {
      scrollToActiveInput();
      editInputRef.current?.focus();
    });
  }, [scrollToActiveInput]);

  const saveInlineEdit = useCallback(async () => {
    if (!editingTaskId) return;
    const trimmed = draftTitle.trim();
    const original = tasks.find((t) => t.id === editingTaskId);
    if (!trimmed || !original) {
      setEditingTaskId(null);
      setDraftTitle('');
      return;
    }
    if (trimmed !== original.title) {
      await updateTask(original, { title: trimmed });
    }
    setEditingTaskId(null);
    setDraftTitle('');
    Keyboard.dismiss();
  }, [draftTitle, editingTaskId, tasks, updateTask]);

  const cancelInlineEdit = useCallback(() => {
    if (editingTaskId) {
      setEditingTaskId(null);
      setDraftTitle('');
    }
  }, [editingTaskId]);

  const saveInlineCreate = useCallback(async () => {
    const trimmed = createDraftTitle.trim();
    if (!trimmed) {
      setCreating(false);
      setCreateDraftTitle('');
      Keyboard.dismiss();
      return;
    }
    const scheduledAtIso = filterDate === 'today'
      ? toUtcIsoFromAppDateTime(
          toAppDateKey(new Date(Date.now() + 15 * 60 * 1000)),
          formatTaskTime(new Date(Date.now() + 15 * 60 * 1000))
        )
      : null;
    await addTask(trimmed, scheduledAtIso);
    setCreating(false);
    setCreateDraftTitle('');
    Keyboard.dismiss();
  }, [addTask, createDraftTitle, filterDate, todayKey]);

  const cancelInlineCreate = useCallback(() => {
    if (creating) {
      setCreating(false);
      setCreateDraftTitle('');
    }
  }, [creating]);

  useEffect(() => {
    if (viewMode !== 'list') return;
    if (!creating && !editingTaskId) return;
    // When keyboard appears/changes, ensure input is visible
    scrollToActiveInput();
  }, [keyboardHeight, creating, editingTaskId, scrollToActiveInput, viewMode]);

  const openTaskEditor = useCallback((params: Record<string, string | undefined>) => {
    router.push({ pathname: '/client/tasks/task-editor', params: params as any });
  }, [router]);

  const renderItem = useCallback(
    ({ item }: { item: UserTask }) => (
      <TaskRow
        item={item}
        onToggle={() => toggleComplete(item)}
        onPressTitle={() => startInlineEdit(item)}
        isEditing={editingTaskId === item.id}
        draftTitle={editingTaskId === item.id ? draftTitle : ''}
        onChangeDraftTitle={setDraftTitle}
        onSubmitTitle={saveInlineEdit}
        onCancelEdit={cancelInlineEdit}
        onPressInfo={() => {
          if (item?.id == null) return;
          router.push({ pathname: '/client/tasks/details', params: { taskId: String(item.id) } });
        }}
        inputRef={editingTaskId === item.id ? editInputRef : undefined}
        textColor={headerText}
        textMuted={headerSubtitle}
        primary={primary}
        borderColor={border}
        isTeam={!!currentUserId && item.creator_id !== currentUserId}
      />
    ),
    [toggleComplete, startInlineEdit, editingTaskId, draftTitle, saveInlineEdit, cancelInlineEdit, headerText, headerSubtitle, primary, border, openTaskEditor, currentUserId]
  );

  const ListEmpty = (
    <View style={styles.empty}>
      <MaterialIcons name="assignment" size={48} color={headerSubtitle} />
      <ThemedText style={[styles.emptyTitle, { color: headerText }]}>Нет задач</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: headerSubtitle }]}>
        Создайте новую задачу или измените фильтры
      </ThemedText>
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
          <View style={styles.filterPills}>
            {FILTER_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  setFilterDate(opt.value);
                }}
                style={[
                  styles.pill,
                  {
                    borderColor: border,
                    backgroundColor: opt.value === filterDate ? `${primary}25` : 'transparent',
                  },
                ]}
              >
                <ThemedText style={{ color: opt.value === filterDate ? primary : headerSubtitle, fontSize: 13, fontWeight: '600' }}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
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
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
        >
          <FlatList
            ref={(r) => {
              listRef.current = r;
            }}
            data={filteredTasks}
            renderItem={renderItem}
            keyExtractor={(item) => {
              if (item?.id != null) return String(item.id);
              const created = (item as any)?.created_at ?? '';
              const title = (item as any)?.title ?? '';
              return `tmp-${created}-${title}`;
            }}
            contentContainerStyle={[styles.listContent, { paddingBottom: 40 + insets.bottom }]}
            ListEmptyComponent={ListEmpty}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            onScrollToIndexFailed={() => {
              // retry after layout
              setTimeout(() => scrollToActiveInput(), 50);
            }}
            ListFooterComponent={
              creating ? (
                <View style={[styles.createRow, { borderColor: border }]}>
                  <View style={[styles.checkbox, { borderColor: border }]} />
                  <RNTextInput
                    ref={createInputRef}
                    value={createDraftTitle}
                    onChangeText={setCreateDraftTitle}
                    placeholder="Новая задача"
                    placeholderTextColor={headerSubtitle}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={saveInlineCreate}
                    onBlur={cancelInlineCreate}
                    style={[styles.createInput, { color: headerText }]}
                  />
                </View>
              ) : (
                <View style={{ height: 24 }} />
              )
            }
          />
        </KeyboardAvoidingView>
      )}

      {viewMode === 'list' && (
        <>
          <Pressable
            onPress={openInlineCreate}
            style={[
              styles.fab,
              { backgroundColor: primary, right: 16, bottom: insets.bottom + 16 },
            ]}
          >
            <MaterialIcons name="add" size={26} color="#FFFFFF" />
          </Pressable>
        </>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 6,
  },
  filterPills: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 2,
  },
  pill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  calendarWrap: {
    flex: 1,
    paddingTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowText: { fontSize: 16 },
  textCompleted: { textDecorationLine: 'line-through' },
  rowDate: { fontSize: 12, marginTop: 4 },
  inlineInput: {
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    fontSize: 16,
  },
  inlineSaveBtn: {
    paddingLeft: 8,
    paddingVertical: 6,
  },
  infoBtn: {
    paddingLeft: 10,
    paddingVertical: 6,
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
  emptySubtitle: { fontSize: 14, marginTop: 4 },
  createRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    marginTop: 8,
  },
  createInput: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 6,
  },
  fab: {
    position: 'absolute',
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
});