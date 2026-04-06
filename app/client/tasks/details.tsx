import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState, type SetStateAction } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import {
  collectTeamMemberOptions,
  TaskAssigneesPickerOverlay,
  TaskTeamPickerOverlay,
} from '@/components/tasks/task-assignment-pickers';
import { TaskScheduleSheetContent } from '@/components/tasks/TaskScheduleSheet';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTeams } from '@/hooks/use-teams';
import { useTodoList } from '@/hooks/use-todo-list';
import type { Team } from '@/lib/teams-api';
import { formatTaskTime, toAppDateKey, toUtcIsoFromAppDateTime } from '@/lib/dateTimeUtils';
import type { TaskPriority, UserTask, UserTaskAttachment } from '@/lib/user-tasks-api';
import { deleteUserTaskAttachment, getUserTaskAttachments, uploadUserTaskAttachments } from '@/lib/user-tasks-api';
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

const TITLE_SAVE_DEBOUNCE_MS = 450;

function mergeAssigneesFromTask(t: UserTask): { id: number; full_name: string }[] {
  if (t.assignees && t.assignees.length > 0) return t.assignees;
  if (t.executor_id && t.executor?.full_name) {
    return [{ id: t.executor_id, full_name: t.executor.full_name }];
  }
  if (t.assignee_ids?.length) {
    return t.assignee_ids.map((id) => ({ id, full_name: `Пользователь #${id}` }));
  }
  return [];
}

function sameAssigneeIds(a: { id: number }[], b: { id: number }[]): boolean {
  if (a.length !== b.length) return false;
  const sa = [...a.map((x) => x.id)].sort((x, y) => x - y);
  const sb = [...b.map((x) => x.id)].sort((x, y) => x - y);
  return sa.every((v, i) => v === sb[i]);
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

  const { tasks, updateTask, removeTask, toggleComplete } = useTodoList();

  const task = useMemo(() => {
    if (!taskId) return null;
    return tasks.find((t) => t.id === taskId) ?? null;
  }, [tasks, taskId]);

  const canEditDetails = !!task && !!currentUserId && task.creator_id === currentUserId;

  const notifyCreatorOnly = useCallback(() => {
    showToast({
      title: 'Только создатель может редактировать',
      description: 'Вы можете менять только статус выполнения.',
      variant: 'default',
      duration: 4000,
    });
  }, [showToast]);

  const scheduledEnabled = !!task?.scheduled_at;
  const [titleDraft, setTitleDraft] = useState('');

  const taskRef = useRef(task);
  const canEditDetailsRef = useRef(canEditDetails);
  const titleDraftRef = useRef(titleDraft);
  taskRef.current = task;
  canEditDetailsRef.current = canEditDetails;
  titleDraftRef.current = titleDraft;

  const titleDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scrollRef = useRef<ScrollView | null>(null);
  const [scheduleModalOpen, setScheduleModalOpen] = useState(false);
  const [scheduleDraftDate, setScheduleDraftDate] = useState<string | null>(null);
  const [scheduleDraftTime, setScheduleDraftTime] = useState('09:00');
  const [scheduleCalendarMonth, setScheduleCalendarMonth] = useState(() => new Date());

  const [remindBeforeMinutes, setRemindBeforeMinutes] = useState<number | null>(null);
  const [pickerSheet, setPickerSheet] = useState<'team' | 'assignees' | null>(null);
  /** Черновик исполнителей в модалке (как в TaskAddSheet), коммит при закрытии пикера. */
  const [assigneesDraft, setAssigneesDraft] = useState<{ id: number; full_name: string }[]>([]);
  const assigneesDraftRef = useRef<{ id: number; full_name: string }[]>([]);
  /** Снимок исполнителей на момент открытия модалки — закрытие без изменений не шлёт PATCH (в т.ч. без гонки с async update). */
  const assigneesSeedAtOpenRef = useRef<{ id: number; full_name: string }[]>([]);
  const [priority, setPriority] = useState<TaskPriority>('medium');

  const [attachments, setAttachments] = useState<UserTaskAttachment[]>([]);
  const [attachmentsLoading, setAttachmentsLoading] = useState(false);
  const [attachmentsUploading, setAttachmentsUploading] = useState(false);

  /** Поля задачи по значению, не по ссылке на `task`: иначе любой refresh списка затирает черновик заголовка при вводе. */
  useEffect(() => {
    if (!task) return;
    setTitleDraft(task.title ?? '');
    setRemindBeforeMinutes(task.remind_before_minutes ?? null);
    setPriority(task.priority ?? 'medium');
  }, [task?.id, task?.title, task?.remind_before_minutes, task?.priority]);

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
    setScheduleModalOpen(true);
  }, [task, canEditDetails, notifyCreatorOnly]);

  const applyScheduleModal = useCallback(async () => {
    if (!task || !canEditDetails) return;
    await updateTask(task, {
      scheduled_at: scheduleDraftDate ? isoForDateTime(scheduleDraftDate, scheduleDraftTime) : null,
    });
    closeScheduleModal();
  }, [task, canEditDetails, scheduleDraftDate, scheduleDraftTime, updateTask, closeScheduleModal]);

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

  const effectiveAssignees = useMemo(
    () => (task ? mergeAssigneesFromTask(task) : []),
    [task]
  );

  const assigneesRowSummary = useMemo(() => {
    const n = effectiveAssignees.length;
    if (n === 0) return '—';
    if (n === 1) return effectiveAssignees[0].full_name;
    return `${n} исполнителей`;
  }, [effectiveAssignees]);

  const applyTeamAndFilterAssignees = useCallback(
    async (nextTeamId: number | null) => {
      if (!task || !canEditDetails) return;
      let next = mergeAssigneesFromTask(task);
      if (nextTeamId != null) {
        const tm =
          teams.find((x) => x.id === nextTeamId) ??
          (task.team?.id === nextTeamId ? task.team : null);
        const opts = collectTeamMemberOptions(tm);
        const allowed = new Set(opts.map((o) => o.id));
        next = next.filter((a) => allowed.has(a.id));
      }
      await updateTask(task, {
        team_id: nextTeamId,
        executor_id: null,
        assignee_ids: next.map((a) => a.id),
        assignees: next,
      });
    },
    [task, canEditDetails, updateTask, teams]
  );

  const applyAssignees = useCallback(
    async (next: { id: number; full_name: string }[]) => {
      if (!task || !canEditDetails) return;
      await updateTask(task, {
        assignee_ids: next.map((a) => a.id),
        executor_id: null,
        assignees: next,
      });
    },
    [task, canEditDetails, updateTask]
  );

  const removeAssignee = useCallback(
    async (id: number) => {
      if (!task || !canEditDetails) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const next = mergeAssigneesFromTask(task).filter((a) => a.id !== id);
      await updateTask(task, {
        assignee_ids: next.map((a) => a.id),
        executor_id: null,
        assignees: next,
      });
    },
    [task, canEditDetails, updateTask]
  );

  const openTeamPicker = useCallback(() => {
    if (!canEditDetails) return;
    Keyboard.dismiss();
    setPickerSheet('team');
  }, [canEditDetails]);

  const openAssigneesPicker = useCallback(() => {
    if (!canEditDetails || !task) return;
    Keyboard.dismiss();
    const initial = mergeAssigneesFromTask(task);
    assigneesSeedAtOpenRef.current = initial.map((x) => ({ ...x }));
    assigneesDraftRef.current = initial;
    setAssigneesDraft(initial);
    setPickerSheet('assignees');
  }, [canEditDetails, task]);

  const closeAssigneesPicker = useCallback(() => {
    if (task && canEditDetails) {
      const draft = assigneesDraftRef.current;
      const seed = assigneesSeedAtOpenRef.current;
      if (sameAssigneeIds(draft, seed)) {
        setPickerSheet(null);
        return;
      }
      void applyAssignees(draft);
    }
    setPickerSheet(null);
  }, [task, canEditDetails, applyAssignees]);

  const onAssigneesDraftChange = useCallback((update: SetStateAction<{ id: number; full_name: string }[]>) => {
    setAssigneesDraft((prev) => {
      const next = typeof update === 'function' ? update(prev) : update;
      assigneesDraftRef.current = next;
      return next;
    });
  }, []);

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
          <ThemedText style={{ color: textMuted }}>Задача не найдена</ThemedText>
        </View>
      </ThemedView>
    );
  }

  const todayKey = toAppDateKey(new Date());
  const tomorrowKey = toAppDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));

  const scheduledDateLabel = task.scheduled_at ? toAppDateKey(task.scheduled_at) : 'Без срока';
  const scheduledTimeLabel = task.scheduled_at ? formatTaskTime(task.scheduled_at) : '';
  const scheduledSummaryLabel = task.scheduled_at ? `${scheduledDateLabel} · ${scheduledTimeLabel}` : 'Без срока';

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
              <View style={styles.rowLeft}>
                <MaterialIcons name="event" size={20} color={textMuted} />
                <ThemedText style={[styles.rowTitle, { color: text }]}>Срок</ThemedText>
              </View>
              <ThemedText
                style={[
                  styles.rowValue,
                  {
                    color: textMuted,
                    textDecorationLine: canEditDetails ? 'underline' : 'none',
                  },
                ]}
              >
                {scheduledSummaryLabel}
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
                  openAssigneesPicker();
                }}
                style={({ pressed }) => [
                  styles.row,
                  pressed && canEditDetails && styles.rowPressablePressed,
                  !canEditDetails && { opacity: 0.85 },
                ]}
              >
                <View style={styles.rowLeft}>
                  <MaterialIcons name="person-outline" size={20} color={textMuted} />
                  <ThemedText style={[styles.rowTitle, { color: text }]}>Исполнители</ThemedText>
                </View>
                <View style={styles.rowRight}>
                  <ThemedText style={[styles.rowValue, { color: textMuted, flexShrink: 1 }]} numberOfLines={1}>
                    {assigneesRowSummary}
                  </ThemedText>
                  {canEditDetails ? (
                    <MaterialIcons name="chevron-right" size={22} color={textMuted} />
                  ) : null}
                </View>
              </Pressable>
              {effectiveAssignees.length > 0 ? (
                <View style={styles.assigneesChipsBlock}>
                  <View style={styles.assigneesChipsRow}>
                    {effectiveAssignees.map((a) => (
                      <View
                        key={a.id}
                        style={[styles.assigneeChip, { borderColor: primary, backgroundColor: `${primary}18` }]}
                      >
                        <ThemedText style={[styles.assigneeChipText, { color: text }]} numberOfLines={1}>
                          {a.full_name}
                        </ThemedText>
                        {canEditDetails ? (
                          <Pressable
                            onPress={() => void removeAssignee(a.id)}
                            hitSlop={8}
                            accessibilityLabel="Убрать исполнителя"
                          >
                            <MaterialIcons name="close" size={16} color={primary} />
                          </Pressable>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
              <View style={[styles.divider, { backgroundColor: border }]} />
            </>
          ) : null}
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
              />
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
            onSelect={(id) => void applyTeamAndFilterAssignees(id)}
          />
          <TaskAssigneesPickerOverlay
            visible={pickerSheet === 'assignees'}
            onClose={closeAssigneesPicker}
            teamScope={task.team_id != null}
            team={teamForExecutor}
            teamLoading={task.team_id != null && !teamForExecutor && teamsLoading}
            selectedAssignees={assigneesDraft}
            onChange={onAssigneesDraftChange}
            currentUserId={currentUserId}
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

