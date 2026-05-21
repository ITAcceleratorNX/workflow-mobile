import { MaterialIcons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import { useNavigation } from '@react-navigation/native';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
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

import {
  TaskExecutorPickerOverlay,
  TaskTeamPickerOverlay,
} from '@/components/tasks/task-assignment-pickers';
import { TaskScheduleSheetContent } from '@/components/tasks/TaskScheduleSheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/context/toast-context';
import { useTeams } from '@/hooks/use-teams';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoList } from '@/hooks/use-todo-list';
import {
  formatRequestDate,
  formatTaskTime,
  toAppDateKey,
  toUtcIsoFromAppDateTime,
} from '@/lib/dateTimeUtils';
import {
  defaultRecurrenceNone,
  formatRecurrenceSummaryCompactRu,
  normalizeRecurrenceFromApi,
  type TaskRecurrencePayload,
} from '@/lib/task-recurrence';
import {
  canEditUserTaskDetails,
  type TaskPriority,
  type UserTask,
  type UserTaskAttachment,
} from '@/lib/user-tasks-api';
import {
  deleteUserTaskAttachment,
  getUserTask,
  getUserTaskAttachments,
  uploadUserTaskAttachments,
} from '@/lib/user-tasks-api';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import { useAuthStore } from '@/stores/auth-store';

const PRIORITY_OPTIONS: { value: TaskPriority; label: string }[] = [
  { value: 'low', label: 'Низкий' },
  { value: 'medium', label: 'Средний' },
  { value: 'high', label: 'Высокий' },
];

function isoForDateTime(dateKey: string, time: string) {
  return toUtcIsoFromAppDateTime(dateKey, time);
}

const TITLE_SAVE_DEBOUNCE_MS = 450;

function getExecutorFromTask(t: UserTask): { id: number; full_name: string } | null {
  if (t.executor_id && t.executor?.full_name) {
    return { id: t.executor_id, full_name: t.executor.full_name };
  }
  if (t.assignees && t.assignees.length > 0) {
    return { id: t.assignees[0].id, full_name: t.assignees[0].full_name };
  }
  if (t.assignee_ids?.length) {
    const id = t.assignee_ids[0];
    const fromAssignees = t.assignees?.find((a) => a.id === id);
    return { id, full_name: fromAssignees?.full_name ?? `Пользователь #${id}` };
  }
  return null;
}

function buildRemindTimingSelectValue(t: UserTask): string {
  const m = t.remind_before_minutes;
  if (m == null) return 'default';
  return `before_${m}`;
}

function buildRemindTimingSelectOptions(t: UserTask): { value: string; label: string }[] {
  const opts: { value: string; label: string }[] = [
    { value: 'default', label: 'По умолчанию' },
    { value: 'before_5', label: 'За 5 мин до срока' },
    { value: 'before_15', label: 'За 15 мин до срока' },
    { value: 'before_30', label: 'За 30 мин до срока' },
  ];
  const m = t.remind_before_minutes;
  if (m != null && ![5, 15, 30].includes(m)) {
    opts.push({ value: `before_${m}`, label: `За ${m} мин до срока` });
  }
  return opts;
}

export default function TaskDetailsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { taskId: taskIdParam } = useLocalSearchParams<{ taskId?: string }>();
  const taskId = taskIdParam ? parseInt(taskIdParam) : null;
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { show: showToast } = useToast();
  const { teams, loading: teamsLoading } = useTeams();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  /** Единые цвета Switch — без ios_backgroundColor на iOS выключенный трек выглядит иначе, чем у соседних. */
  const detailSwitchProps = useMemo(() => {
    const common = {
      trackColor: { false: border, true: primary } as const,
      thumbColor: '#fff' as const,
    };
    return Platform.OS === 'ios' ? { ...common, ios_backgroundColor: border } : common;
  }, [border, primary]);

  const { tasks, updateTask, removeTask, toggleComplete } = useTodoList({ filter: 'all', enabled: false });
  const tasksInvalidateVersion = useUserTasksInvalidateStore((s) => s.version);

  const [fetchedTask, setFetchedTask] = useState<UserTask | null>(null);
  const [loadingTask, setLoadingTask] = useState(false);

  const task = useMemo(() => {
    if (!taskId) return null;
    return tasks.find((t) => t.id === taskId) ?? fetchedTask;
  }, [tasks, taskId, fetchedTask]);

  useEffect(() => {
    if (!taskId || isGuest) {
      setFetchedTask(null);
      setLoadingTask(false);
      return;
    }
    if (tasks.some((t) => t.id === taskId)) {
      setFetchedTask(null);
      setLoadingTask(false);
      return;
    }
    let cancelled = false;
    setLoadingTask(true);
    void getUserTask(taskId).then((res) => {
      if (cancelled) return;
      if (res.ok) setFetchedTask(res.data);
      setLoadingTask(false);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, isGuest, tasks, tasksInvalidateVersion]);

  const canEditDetails = !!task && canEditUserTaskDetails(task, currentUserId);

  const notifyCreatorOnly = useCallback(() => {
    showToast({
      title: 'Нет прав на редактирование',
      description: 'Менять детали могут создатель задачи или руководитель команды. Вы можете отметить выполнение.',
      variant: 'default',
      duration: 4000,
    });
  }, [showToast]);

  const scheduledEnabled = !!task?.scheduled_at;
  const [titleDraft, setTitleDraft] = useState('');

  const taskRef = useRef(task);
  const canEditDetailsRef = useRef(canEditDetails);
  const titleDraftRef = useRef(titleDraft);
  const completeToggleBusyRef = useRef(false);
  taskRef.current = task;
  canEditDetailsRef.current = canEditDetails;
  titleDraftRef.current = titleDraft;

  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleDraftDate, setScheduleDraftDate] = useState<string | null>(null);
  const [scheduleDraftTime, setScheduleDraftTime] = useState('09:00');
  const [scheduleCalendarMonth, setScheduleCalendarMonth] = useState(() => new Date());
  const [scheduleDraftRecurrence, setScheduleDraftRecurrence] = useState<TaskRecurrencePayload>(() =>
    defaultRecurrenceNone()
  );

  const [priorityPickerOpen, setPriorityPickerOpen] = useState(false);
  const [priorityPickerDraft, setPriorityPickerDraft] = useState<TaskPriority>('medium');
  const [remindTimingPickerOpen, setRemindTimingPickerOpen] = useState(false);
  const [remindTimingPickerDraft, setRemindTimingPickerDraft] = useState('default');

  const [pickerSheet, setPickerSheet] = useState<'team' | 'executor' | null>(null);
  const [executorDraft, setExecutorDraft] = useState<{ id: number; full_name: string } | null>(null);
  const executorDraftRef = useRef<{ id: number; full_name: string } | null>(null);

  const [attachments, setAttachments] = useState<UserTaskAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);

  /** Заголовок: только id/title — не цепляем remind/priority, чтобы не было гонок с PATCH при быстром UI. */
  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title ?? '');
  }, [task?.id, task?.title]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!task?.id) {
        setAttachments([]);
        setAttachmentsLoading(false);
        return;
      }
      setAttachmentsLoading(true);
      const res = await getUserTaskAttachments(task.id);
      if (cancelled) return;
      if (res.ok) {
        setAttachments(res.data);
      } else {
        setAttachments([]);
        showToast({ title: 'Ошибка загрузки', description: res.error, variant: 'destructive', duration: 4000 });
      }
      setAttachmentsLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [task?.id, showToast]);

  const flushTitleToServer = useCallback(async () => {
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = null;
    }
    const t = taskRef.current;
    if (!t || !canEditDetailsRef.current) return;
    const next = titleDraftRef.current.trim();
    if (!next) {
      setTitleDraft(t.title ?? '');
      return;
    }
    if (next === t.title) return;
    await updateTask(t, { title: next });
  }, [updateTask]);

  const scheduleTitleSave = useCallback(() => {
    if (!canEditDetailsRef.current) return;
    if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
    titleDebounceRef.current = setTimeout(() => {
      titleDebounceRef.current = null;
      void flushTitleToServer();
    }, TITLE_SAVE_DEBOUNCE_MS);
  }, [flushTitleToServer]);

  useEffect(() => {
    if (titleDebounceRef.current) {
      clearTimeout(titleDebounceRef.current);
      titleDebounceRef.current = null;
    }
  }, [task?.id]);

  useEffect(() => {
    return () => {
      void flushTitleToServer();
    };
  }, [flushTitleToServer]);

  useEffect(() => {
    return navigation.addListener('beforeRemove', (e) => {
      if (!canEditDetailsRef.current) return;
      const t = taskRef.current;
      const next = titleDraftRef.current.trim();
      if (!t || !next || next === t.title) return;
      e.preventDefault();
      void flushTitleToServer()
        .catch(() => {})
        .finally(() => {
          navigation.dispatch(e.data.action);
        });
    });
  }, [navigation, flushTitleToServer]);

  const handleToggleSchedule = useCallback(async () => {
    if (!task || !canEditDetails) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (task.scheduled_at) {
      await updateTask(task, {
        scheduled_at: null,
        recurrence_type: 'none',
        recurrence_interval: 1,
        recurrence_custom_unit: null,
        recurrence_weekdays: null,
      });
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

  const closeScheduleModal = useCallback(() => {
    setScheduleModalOpen(false);
  }, []);

  const openScheduleModal = useCallback(() => {
    if (!task) return;
    if (!canEditDetails) {
      notifyCreatorOnly();
      return;
    }
    const dateKey = task.scheduled_at ? toAppDateKey(task.scheduled_at) : null;
    const time = task.scheduled_at ? formatTaskTime(task.scheduled_at) : '09:00';
    setScheduleDraftDate(dateKey);
    setScheduleDraftTime(time);
    const base = new Date((dateKey ?? toAppDateKey(new Date())) + 'T12:00:00');
    setScheduleCalendarMonth(new Date(base.getFullYear(), base.getMonth(), 1));
    setScheduleDraftRecurrence(normalizeRecurrenceFromApi(task));
    setScheduleModalOpen(true);
  }, [task, canEditDetails, notifyCreatorOnly]);

  const applyScheduleModal = useCallback(async () => {
    if (!task || !canEditDetails) return;
    const r = scheduleDraftRecurrence;
    const hasDate = !!scheduleDraftDate;
    await updateTask(task, {
      scheduled_at: scheduleDraftDate ? isoForDateTime(scheduleDraftDate, scheduleDraftTime) : null,
      recurrence_type: hasDate ? r.recurrence_type : 'none',
      recurrence_interval: hasDate ? r.recurrence_interval : 1,
      recurrence_custom_unit: hasDate ? r.recurrence_custom_unit : null,
      recurrence_weekdays: hasDate ? r.recurrence_weekdays : null,
    });
    closeScheduleModal();
  }, [
    task,
    canEditDetails,
    scheduleDraftDate,
    scheduleDraftTime,
    scheduleDraftRecurrence,
    updateTask,
    closeScheduleModal,
  ]);

  /** PATCH напоминания из колесика (только «по умолчанию» и «за N мин»). */
  const applyReminderTimingFromPicker = useCallback(
    async (val: string) => {
      const t = taskRef.current;
      if (!t || !canEditDetailsRef.current || t.reminders_disabled) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      if (val === 'default') {
        await updateTask(t, { remind_before_minutes: null, remind_at: null });
        return;
      }
      if (val.startsWith('before_')) {
        const mins = parseInt(val.slice('before_'.length), 10);
        if (!Number.isFinite(mins)) return;
        await updateTask(t, { remind_before_minutes: mins, remind_at: null });
      }
    },
    [updateTask]
  );

  const applyPriorityFromPicker = useCallback(
    async (next: TaskPriority) => {
      const t = taskRef.current;
      if (!t || !canEditDetailsRef.current) return;
      if (!PRIORITY_OPTIONS.some((o) => o.value === next)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await updateTask(t, { priority: next });
    },
    [updateTask]
  );

  const openPriorityPicker = useCallback(() => {
    Keyboard.dismiss();
    const t = taskRef.current;
    if (!t || !canEditDetailsRef.current) return;
    setPriorityPickerDraft(t.priority ?? 'medium');
    setPriorityPickerOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const closePriorityPicker = useCallback(() => setPriorityPickerOpen(false), []);

  const confirmPriorityPicker = useCallback(async () => {
    setPriorityPickerOpen(false);
    await applyPriorityFromPicker(priorityPickerDraft);
  }, [priorityPickerDraft, applyPriorityFromPicker]);

  const openRemindTimingPicker = useCallback(() => {
    Keyboard.dismiss();
    const t = taskRef.current;
    if (!t || !canEditDetailsRef.current || t.reminders_disabled) return;
    setRemindTimingPickerDraft(buildRemindTimingSelectValue(t));
    setRemindTimingPickerOpen(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, []);

  const closeRemindTimingPicker = useCallback(() => setRemindTimingPickerOpen(false), []);

  const confirmRemindTimingPicker = useCallback(() => {
    setRemindTimingPickerOpen(false);
    void applyReminderTimingFromPicker(remindTimingPickerDraft);
  }, [remindTimingPickerDraft, applyReminderTimingFromPicker]);

  const handleCompleteSwitch = useCallback(async () => {
    const t = taskRef.current;
    if (!t || completeToggleBusyRef.current) return;
    completeToggleBusyRef.current = true;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      await toggleComplete(t);
    } finally {
      completeToggleBusyRef.current = false;
    }
  }, [toggleComplete]);

  const handlePickMedia = useCallback(async () => {
    if (!task || !canEditDetails || attachmentsUploading) return;

    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast({
        title: 'Нет доступа к фото/видео',
        description: 'Разрешите доступ к медиатеке в настройках устройства.',
        variant: 'destructive',
        duration: 4000,
      });
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled) return;
    const assets = (result as any).assets as Array<{ uri: string; mimeType?: string; fileName?: string }>;
    if (!Array.isArray(assets) || assets.length === 0) return;

    const extFromUri = (uri: string) => {
      const m = uri?.match(/\.([a-zA-Z0-9]+)(\?|#|$)/);
      return m ? `.${m[1].toLowerCase()}` : '';
    };

    const files = assets.slice(0, 10).map((a, idx) => {
      const uri = a.uri;
      const ext = extFromUri(a.fileName ?? uri) || (uri.includes('mp4') ? '.mp4' : '');
      const name = a.fileName ?? `attachment_${idx}_${Date.now()}${ext}`;
      const type = a.mimeType ?? (ext === '.mp4' ? 'video/mp4' : 'application/octet-stream');
      return { uri, name, type };
    });

    setAttachmentsUploading(true);
    const res = await uploadUserTaskAttachments(task.id, files);
    if (res.ok) {
      setAttachments((prev) => [...res.data, ...prev]);
      showToast({ title: 'Готово', description: 'Вложения загружены', variant: 'success', duration: 2500 });
    } else {
      showToast({ title: 'Ошибка загрузки', description: res.error, variant: 'destructive', duration: 4000 });
    }
    setAttachmentsUploading(false);
  }, [task, canEditDetails, attachmentsUploading, showToast]);

  const handlePickDocuments = useCallback(async () => {
    if (!task || !canEditDetails || attachmentsUploading) return;

    const result = await DocumentPicker.getDocumentAsync({
      type: '*/*',
      multiple: true,
    });

    // expo-document-picker (SDK 49+) uses { canceled, assets }.
    if ((result as { canceled?: boolean }).canceled) return;

    const assets = (result as { assets?: Array<{ uri: string; mimeType?: string; name?: string }> }).assets ?? [];

    if (!Array.isArray(assets) || assets.length === 0) return;

    const extFromNameOrUri = (nameOrUri: string) => {
      const m = nameOrUri?.match(/\.([a-zA-Z0-9]+)(\?|#|$)/);
      return m ? `.${m[1].toLowerCase()}` : '';
    };

    const files = assets.slice(0, 10).map((a, idx) => {
      const ext = extFromNameOrUri(a.name ?? a.uri);
      const name = a.name ?? `document_${idx}_${Date.now()}${ext}`;
      return { uri: a.uri, name, type: a.mimeType ?? 'application/octet-stream' };
    });

    setAttachmentsUploading(true);
    const res = await uploadUserTaskAttachments(task.id, files);
    if (res.ok) {
      setAttachments((prev) => [...res.data, ...prev]);
      showToast({ title: 'Готово', description: 'Файлы загружены', variant: 'success', duration: 2500 });
    } else {
      showToast({ title: 'Ошибка загрузки', description: res.error, variant: 'destructive', duration: 4000 });
    }
    setAttachmentsUploading(false);
  }, [task, canEditDetails, attachmentsUploading, showToast]);

  const handleDeleteAttachment = useCallback(
    async (attachmentId: number) => {
      if (!task || !canEditDetails) return;

      const before = attachments;
      setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));

      const res = await deleteUserTaskAttachment(task.id, attachmentId);
      if (res.ok) {
        return;
      }

      setAttachments(before);
      showToast({ title: 'Ошибка удаления', description: res.error, variant: 'destructive', duration: 4000 });
    },
    [task, canEditDetails, attachments, showToast]
  );

  const effectiveExecutor = useMemo(
    () => (task ? getExecutorFromTask(task) : null),
    [task]
  );

  const executorRowSummary = useMemo(() => effectiveExecutor?.full_name ?? '—', [effectiveExecutor]);

  const completedByName = useMemo(() => {
    if (!task?.completed) return null;
    const u = task.completed_by_user ?? task.completedByUser;
    return u?.full_name ?? null;
  }, [task]);

  const applyTeam = useCallback(
    async (nextTeamId: number | null) => {
      if (!task || !canEditDetails) return;
      await updateTask(task, {
        team_id: nextTeamId,
        executor_id: null,
        assignee_ids: [],
        assignees: [],
        executor: undefined,
      });
    },
    [task, canEditDetails, updateTask]
  );

  const applyExecutor = useCallback(
    async (next: { id: number; full_name: string } | null) => {
      if (!task || !canEditDetails) return;
      await updateTask(task, {
        team_id: null,
        executor_id: next?.id ?? null,
        assignee_ids: next ? [next.id] : [],
        assignees: next ? [next] : [],
        executor: next ?? undefined,
      });
    },
    [task, canEditDetails, updateTask]
  );

  const openTeamPicker = useCallback(() => {
    if (!canEditDetails) return;
    Keyboard.dismiss();
    setPickerSheet('team');
  }, [canEditDetails]);

  const openExecutorPicker = useCallback(() => {
    if (!canEditDetails || !task) return;
    Keyboard.dismiss();
    const initial = getExecutorFromTask(task);
    executorDraftRef.current = initial;
    setExecutorDraft(initial);
    setPickerSheet('executor');
  }, [canEditDetails, task]);

  /** Сохранение сразу при выборе строки (pick вызывает onSelect до ре-рендера — нельзя читать executorDraft в onClose). */
  const handleExecutorSelect = useCallback(
    (user: { id: number; full_name: string } | null) => {
      executorDraftRef.current = user;
      setExecutorDraft(user);
      setPickerSheet(null);
      if (!task || !canEditDetails) return;
      const current = getExecutorFromTask(task);
      if ((current?.id ?? null) === (user?.id ?? null)) return;
      void applyExecutor(user);
    },
    [task, canEditDetails, applyExecutor]
  );

  const closeExecutorPicker = useCallback(() => {
    setPickerSheet(null);
  }, []);

  const remindTimingSelectOptions = useMemo(() => {
    if (!task) return [];
    return buildRemindTimingSelectOptions(task);
  }, [task]);

  const remindTimingSummaryLabel = useMemo(() => {
    if (!task) return '';
    const opts = remindTimingSelectOptions;
    const v = buildRemindTimingSelectValue(task);
    const fromList = opts.find((o) => o.value === v)?.label;
    if (fromList) return fromList;
    if (task.remind_at) return formatRequestDate(task.remind_at);
    return 'По умолчанию';
  }, [task, remindTimingSelectOptions]);

  const prioritySummaryLabel = useMemo(() => {
    if (!task) return '';
    return PRIORITY_OPTIONS.find((o) => o.value === task.priority)?.label ?? '';
  }, [task]);

  if (!task) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
        <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
        <View style={styles.grabberWrap} pointerEvents="none">
          <View style={[styles.grabber, { backgroundColor: primary }]} />
        </View>
        <View style={styles.header}>
          <View style={styles.headerBtn} />
          <ThemedText style={[styles.headerTitle, { color: text }]}>Подробно</ThemedText>
          <View style={styles.headerBtn} />
        </View>
        <View style={styles.empty}>
          {loadingTask ? (
            <ActivityIndicator size="large" color={primary} />
          ) : (
            <ThemedText style={{ color: textMuted }}>Задача не найдена</ThemedText>
          )}
        </View>
      </ThemedView>
    );
  }

  const todayKey = toAppDateKey(new Date());
  const tomorrowKey = toAppDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const scheduledDateLabel = task.scheduled_at ? toAppDateKey(task.scheduled_at) : 'Без срока';
  const scheduledTimeLabel = task.scheduled_at ? formatTaskTime(task.scheduled_at) : '';
  const repeatHint =
    task.scheduled_at && task.recurrence_type && task.recurrence_type !== 'none'
      ? formatRecurrenceSummaryCompactRu(normalizeRecurrenceFromApi(task), {
          anchorDateKey: toAppDateKey(task.scheduled_at),
        })
      : '';
  const scheduledPrimaryLine = task.scheduled_at
    ? `${scheduledDateLabel} · ${scheduledTimeLabel}`
    : 'Без срока';

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />

      <View style={styles.grabberWrap} pointerEvents="none">
        <View style={[styles.grabber, { backgroundColor: primary }]} />
      </View>
      <View style={styles.header}>
        <View style={styles.headerBtn} />
        <ThemedText style={[styles.headerTitle, { color: text }]}>Подробно</ThemedText>
        <View style={styles.headerBtn} />
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
            onChangeText={(txt) => {
              setTitleDraft(txt);
              scheduleTitleSave();
            }}
            onBlur={() => {
              void flushTitleToServer();
            }}
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

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Вложения</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          {canEditDetails ? (
            <View style={styles.attachmentActions}>
              <Pressable
                disabled={attachmentsUploading}
                onPress={handlePickMedia}
                style={({ pressed }) => [
                  styles.attachmentActionBtn,
                  { borderColor: border, backgroundColor: cardBg, opacity: attachmentsUploading ? 0.6 : 1 },
                  pressed && !attachmentsUploading && { opacity: 0.85 },
                ]}
              >
                <MaterialIcons name="image" size={18} color={primary} />
                <ThemedText style={[styles.attachmentActionText, { color: primary }]}>Фото/Видео</ThemedText>
              </Pressable>
              <Pressable
                disabled={attachmentsUploading}
                onPress={handlePickDocuments}
                style={({ pressed }) => [
                  styles.attachmentActionBtn,
                  { borderColor: border, backgroundColor: cardBg, opacity: attachmentsUploading ? 0.6 : 1 },
                  pressed && !attachmentsUploading && { opacity: 0.85 },
                ]}
              >
                <MaterialIcons name="attach-file" size={18} color={primary} />
                <ThemedText style={[styles.attachmentActionText, { color: primary }]}>Файлы</ThemedText>
              </Pressable>
            </View>
          ) : null}

          {attachmentsLoading ? (
            <View style={styles.attachmentLoading}>
              <ActivityIndicator size="small" color={primary} />
              <ThemedText style={{ color: textMuted, marginTop: 6, fontSize: 12 }}>Загрузка…</ThemedText>
            </View>
          ) : attachments.length === 0 ? (
            <View style={styles.attachmentEmpty}>
              <MaterialIcons name="attachment" size={26} color={textMuted} />
              <ThemedText style={{ color: textMuted, marginTop: 8, textAlign: 'center' }}>Пока нет вложений</ThemedText>
            </View>
          ) : (
            <View style={styles.attachmentList}>
              {attachments.map((a) => (
                <View key={a.id} style={styles.attachmentRow}>
                  <Pressable
                    onPress={() => Linking.openURL(a.file_url)}
                    style={styles.attachmentRowLeft}
                    accessibilityRole="link"
                  >
                    {a.file_kind === 'image' ? (
                      <Image source={{ uri: a.file_url }} style={styles.attachmentThumb} />
                    ) : (
                      <View style={[styles.attachmentIconWrap, { borderColor: border }]}>
                        <MaterialIcons
                          name={a.file_kind === 'video' ? 'video-library' : 'description'}
                          size={18}
                          color={textMuted}
                        />
                      </View>
                    )}
                    <View style={styles.attachmentMeta}>
                      <ThemedText style={[styles.attachmentFileName, { color: text }]} numberOfLines={1}>
                        {a.file_name || (a.file_kind === 'video' ? 'Видео' : a.file_kind === 'image' ? 'Фото' : 'Файл')}
                      </ThemedText>
                      <ThemedText style={{ color: textMuted, fontSize: 11, marginTop: 3 }}>
                        {a.file_kind === 'video' ? 'Видео' : a.file_kind === 'image' ? 'Фото' : 'Документ'}
                      </ThemedText>
                    </View>
                  </Pressable>

                  {canEditDetails ? (
                    <Pressable
                      onPress={() => handleDeleteAttachment(a.id)}
                      hitSlop={10}
                      style={({ pressed }) => [styles.attachmentDeleteBtn, pressed && { opacity: 0.8 }]}
                      accessibilityRole="button"
                      accessibilityLabel="Удалить вложение"
                    >
                      <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                    </Pressable>
                  ) : null}
                </View>
              ))}
            </View>
          )}
        </View>

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Срок</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <Pressable
              onPress={() => {
                if (!canEditDetails) {
                  notifyCreatorOnly();
                  return;
                }
                openScheduleModal();
              }}
              style={({ pressed }) => [
                styles.rowPressable,
                pressed && styles.rowPressablePressed,
                !canEditDetails && { opacity: 0.75 },
              ]}
            >
              <View style={styles.scheduleRowLeft}>
                <MaterialIcons name="event" size={20} color={textMuted} />
                <ThemedText style={[styles.rowTitle, { color: text }]}>Срок</ThemedText>
              </View>
              <View style={styles.scheduleSummaryCol}>
                <ThemedText
                  style={[
                    styles.rowValue,
                    styles.schedulePrimaryLine,
                    {
                      color: textMuted,
                      textDecorationLine: canEditDetails ? 'underline' : 'none',
                    },
                  ]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {scheduledPrimaryLine}
                </ThemedText>
                {repeatHint ? (
                  <ThemedText
                    style={[styles.scheduleRepeatLine, { color: textMuted }]}
                    numberOfLines={2}
                    ellipsizeMode="tail"
                  >
                    {repeatHint}
                  </ThemedText>
                ) : null}
              </View>
            </Pressable>
            <View style={styles.rowSwitchCell}>
              <Switch
                value={scheduledEnabled}
                onValueChange={handleToggleSchedule}
                disabled={!canEditDetails}
                {...detailSwitchProps}
              />
            </View>
          </View>
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
                    {executorRowSummary}
                  </ThemedText>
                  {canEditDetails ? (
                    <MaterialIcons name="chevron-right" size={22} color={textMuted} />
                  ) : null}
                </View>
              </Pressable>
              {task.team_id && task.completed && completedByName ? (
                <>
                  <View style={[styles.divider, { backgroundColor: border }]} />
                  <View style={styles.row}>
                    <View style={styles.rowLeft}>
                      <MaterialIcons name="check-circle-outline" size={20} color={textMuted} />
                      <ThemedText style={[styles.rowTitle, { color: text }]}>Завершил</ThemedText>
                    </View>
                    <ThemedText style={[styles.rowValue, { color: textMuted, flexShrink: 1 }]} numberOfLines={1}>
                      {completedByName}
                    </ThemedText>
                  </View>
                </>
              ) : null}
              <View style={[styles.divider, { backgroundColor: border }]} />
            </>
          ) : null}
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Приоритет</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <Pressable
            onPress={() => {
              if (!canEditDetails) {
                notifyCreatorOnly();
                return;
              }
              openPriorityPicker();
            }}
            disabled={!canEditDetails}
            style={({ pressed }) => [
              styles.row,
              pressed && canEditDetails && styles.rowPressablePressed,
              !canEditDetails && { opacity: 0.85 },
            ]}
          >
            <View style={styles.rowLeft}>
              <MaterialIcons name="flag" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Уровень</ThemedText>
            </View>
            <View style={styles.rowRight}>
              <ThemedText
                style={[
                  styles.rowValue,
                  {
                    color: textMuted,
                    flexShrink: 1,
                    textDecorationLine: canEditDetails ? 'underline' : 'none',
                  },
                ]}
                numberOfLines={2}
              >
                {prioritySummaryLabel}
              </ThemedText>
              {canEditDetails ? (
                <MaterialIcons name="chevron-right" size={22} color={textMuted} />
              ) : null}
            </View>
          </Pressable>
        </View>

        <View style={{ height: 16 }} />

        <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Напоминания</ThemedText>
        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="notifications" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Включить напоминания</ThemedText>
            </View>
            <View style={styles.rowSwitchCell}>
              <Switch
                value={!task.reminders_disabled}
                onValueChange={handleToggleReminders}
                disabled={!canEditDetails}
                {...detailSwitchProps}
              />
            </View>
          </View>
          <View style={[styles.remindersHintWrap, { borderColor: border }]}>
            <ThemedText style={[styles.remindersHint, { color: textMuted }]}>
              Пуш по времени в календаре или по кнопке в уведомлении
            </ThemedText>
          </View>
          <View style={[styles.divider, { backgroundColor: border }]} />
          <Pressable
            onPress={() => {
              if (!canEditDetails) {
                notifyCreatorOnly();
                return;
              }
              if (task.reminders_disabled) return;
              openRemindTimingPicker();
            }}
            disabled={!canEditDetails || task.reminders_disabled}
            style={({ pressed }) => [
              styles.row,
              pressed && canEditDetails && !task.reminders_disabled && styles.rowPressablePressed,
              (!canEditDetails || task.reminders_disabled) && { opacity: 0.55 },
            ]}
          >
            <View style={styles.rowLeft}>
              <MaterialIcons name="alarm" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Когда напомнить</ThemedText>
            </View>
            <View style={styles.rowRight}>
              <ThemedText
                style={[
                  styles.rowValue,
                  {
                    color: textMuted,
                    flexShrink: 1,
                    textAlign: 'right',
                    textDecorationLine:
                      canEditDetails && !task.reminders_disabled ? 'underline' : 'none',
                  },
                ]}
                numberOfLines={2}
              >
                {remindTimingSummaryLabel}
              </ThemedText>
              {canEditDetails && !task.reminders_disabled ? (
                <MaterialIcons name="chevron-right" size={22} color={textMuted} />
              ) : null}
            </View>
          </Pressable>
          <View style={[styles.remindersFootnoteWrap, { borderTopColor: border }]}>
            <ThemedText style={[styles.remindersTimingFootnote, { color: textMuted }]}>
              {task.scheduled_at
                ? `Напоминание «за N минут» считается от времени срока: ${scheduledPrimaryLine}`
                : 'Без срока в календаре используется системная логика напоминаний.'}
            </ThemedText>
          </View>
        </View>

        <View style={{ height: 16 }} />

        <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <MaterialIcons name="task-alt" size={20} color={textMuted} />
              <ThemedText style={[styles.rowTitle, { color: text }]}>Выполнено</ThemedText>
            </View>
            <View style={styles.rowSwitchCell}>
              <Switch
                value={task.completed}
                onValueChange={() => void handleCompleteSwitch()}
                {...detailSwitchProps}
              />
            </View>
          </View>
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

      {scheduleModalOpen ? (
        <Modal visible={scheduleModalOpen} transparent animationType="slide" onRequestClose={closeScheduleModal}>
          <View style={styles.scheduleModalRoot}>
            <Pressable
              style={styles.scheduleModalBackdrop}
              onPress={closeScheduleModal}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
            />
            <View
              style={[
                styles.scheduleModalSheet,
                {
                  backgroundColor: background,
                  paddingBottom: Math.max(insets.bottom, 12),
                },
              ]}
            >
              <TaskScheduleSheetContent
                active={scheduleModalOpen}
                colors={{
                  sheetBackground: background,
                  bannerBackground: cardBg,
                  border,
                  primary,
                  text,
                  textMuted,
                }}
                bottomInset={insets.bottom}
                todayKey={todayKey}
                tomorrowKey={tomorrowKey}
                scheduledDate={scheduleDraftDate}
                onScheduledDateChange={setScheduleDraftDate}
                scheduledTime={scheduleDraftTime}
                onScheduledTimeChange={setScheduleDraftTime}
                calendarMonth={scheduleCalendarMonth}
                onCalendarMonthChange={setScheduleCalendarMonth}
                onClosePress={closeScheduleModal}
                onConfirmPress={() => void applyScheduleModal()}
                recurrence={scheduleDraftRecurrence}
                onRecurrenceChange={setScheduleDraftRecurrence}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      <Modal
        visible={priorityPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closePriorityPicker}
      >
        <View style={styles.reminderTimePickerRoot}>
          <Pressable
            style={styles.reminderTimePickerBackdrop}
            onPress={closePriorityPicker}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View
            style={[
              styles.reminderTimePickerSheet,
              {
                backgroundColor: background,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={[styles.reminderTimePickerToolbar, { borderBottomColor: border }]}>
              <Pressable
                onPress={closePriorityPicker}
                hitSlop={12}
                style={[styles.reminderTimePickerToolbarSide, { alignItems: 'flex-start' }]}
              >
                <ThemedText style={{ color: primary, fontSize: 17 }}>Отмена</ThemedText>
              </Pressable>
              <ThemedText style={[styles.reminderTimePickerToolbarTitle, { color: text }]}>
                Приоритет
              </ThemedText>
              <Pressable
                onPress={() => void confirmPriorityPicker()}
                hitSlop={12}
                style={[styles.reminderTimePickerToolbarSide, { alignItems: 'flex-end' }]}
              >
                <ThemedText style={{ color: primary, fontSize: 17, fontWeight: '700' }}>Готово</ThemedText>
              </Pressable>
            </View>
            <View style={styles.reminderTimePickerWheelWrap}>
              <Picker
                selectedValue={priorityPickerDraft}
                onValueChange={(v) => {
                  setPriorityPickerDraft(v as TaskPriority);
                  void Haptics.selectionAsync();
                }}
                style={Platform.OS === 'ios' ? styles.taskDetailPickerIOS : styles.taskDetailPickerAndroid}
                itemStyle={
                  Platform.OS === 'ios' ? { color: text, fontSize: 22 } : undefined
                }
                {...(Platform.OS === 'ios' ? { selectionColor: primary } : {})}
                {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
              >
                {PRIORITY_OPTIONS.map((o) => (
                  <Picker.Item
                    key={o.value}
                    label={o.label}
                    value={o.value}
                    color={Platform.OS === 'ios' ? text : undefined}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={remindTimingPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={closeRemindTimingPicker}
      >
        <View style={styles.reminderTimePickerRoot}>
          <Pressable
            style={styles.reminderTimePickerBackdrop}
            onPress={closeRemindTimingPicker}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View
            style={[
              styles.reminderTimePickerSheet,
              {
                backgroundColor: background,
                paddingBottom: Math.max(insets.bottom, 12),
              },
            ]}
          >
            <View style={[styles.reminderTimePickerToolbar, { borderBottomColor: border }]}>
              <Pressable
                onPress={closeRemindTimingPicker}
                hitSlop={12}
                style={[styles.reminderTimePickerToolbarSide, { alignItems: 'flex-start' }]}
              >
                <ThemedText style={{ color: primary, fontSize: 17 }}>Отмена</ThemedText>
              </Pressable>
              <ThemedText style={[styles.reminderTimePickerToolbarTitle, { color: text }]}>
                Напоминание
              </ThemedText>
              <Pressable
                onPress={confirmRemindTimingPicker}
                hitSlop={12}
                style={[styles.reminderTimePickerToolbarSide, { alignItems: 'flex-end' }]}
              >
                <ThemedText style={{ color: primary, fontSize: 17, fontWeight: '700' }}>Готово</ThemedText>
              </Pressable>
            </View>
            <View style={styles.reminderTimePickerWheelWrap}>
              <Picker
                selectedValue={remindTimingPickerDraft}
                onValueChange={(v) => {
                  setRemindTimingPickerDraft(String(v));
                  void Haptics.selectionAsync();
                }}
                style={Platform.OS === 'ios' ? styles.taskDetailPickerIOS : styles.taskDetailPickerAndroid}
                itemStyle={
                  Platform.OS === 'ios' ? { color: text, fontSize: 22 } : undefined
                }
                {...(Platform.OS === 'ios' ? { selectionColor: primary } : {})}
                {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
              >
                {remindTimingSelectOptions.map((o) => (
                  <Picker.Item
                    key={o.value}
                    label={o.label}
                    value={o.value}
                    color={Platform.OS === 'ios' ? text : undefined}
                  />
                ))}
              </Picker>
            </View>
          </View>
        </View>
      </Modal>

      {!isGuest && task ? (
        <>
          <TaskTeamPickerOverlay
            visible={pickerSheet === 'team'}
            onClose={() => setPickerSheet(null)}
            teams={teams}
            loading={teamsLoading}
            selectedTeamId={task.team_id ?? null}
            onSelect={(id) => void applyTeam(id)}
          />
          <TaskExecutorPickerOverlay
            visible={pickerSheet === 'executor'}
            onClose={closeExecutorPicker}
            teamScope={false}
            team={null}
            selectedExecutor={executorDraft}
            onSelect={handleExecutorSelect}
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
    width: '100%',
    maxWidth: '100%',
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
  rowSwitchCell: {
    flexShrink: 0,
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
  scheduleRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flexShrink: 0,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  rowValue: {
    fontSize: 13,
  },
  scheduleSummaryCol: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
    gap: 2,
  },
  schedulePrimaryLine: {
    textAlign: 'right',
    maxWidth: '100%',
  },
  scheduleRepeatLine: {
    fontSize: 12,
    lineHeight: 16,
    textAlign: 'right',
    maxWidth: '100%',
    opacity: 0.92,
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
  assigneesChipsBlock: {
    paddingHorizontal: 14,
    paddingBottom: 12,
  },
  assigneesChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  assigneeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingLeft: 10,
    paddingRight: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
  },
  assigneeChipText: {
    fontSize: 13,
    fontWeight: '600',
    flexShrink: 1,
    maxWidth: 220,
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
  taskDetailPickerIOS: {
    width: '100%',
    height: 216,
  },
  taskDetailPickerAndroid: {
    width: '100%',
    minHeight: 120,
    maxHeight: 220,
  },
  remindersFootnoteWrap: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  remindersTimingFootnote: {
    fontSize: 12,
    lineHeight: 17,
  },
  reminderTimePickerRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  reminderTimePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  reminderTimePickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  reminderTimePickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  reminderTimePickerToolbarSide: {
    flex: 1,
  },
  reminderTimePickerToolbarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  reminderTimePickerWheelWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  scheduleModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scheduleModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scheduleModalSheet: {
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  attachmentActions: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 10,
    flexDirection: 'row',
    gap: 10,
  },
  attachmentActionBtn: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  attachmentActionText: {
    fontSize: 13,
    fontWeight: '700',
  },
  attachmentLoading: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentEmpty: {
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  attachmentList: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 6,
  },
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  attachmentRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  attachmentThumb: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.06)',
  },
  attachmentIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.03)',
  },
  attachmentMeta: {
    flex: 1,
    minWidth: 0,
  },
  attachmentFileName: {
    fontSize: 14,
    fontWeight: '600',
  },
  attachmentDeleteBtn: {
    padding: 8,
    borderRadius: 12,
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});

