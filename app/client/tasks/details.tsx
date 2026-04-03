import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useNavigation } from '@react-navigation/native';
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
import type { TaskPriority, UserTaskAttachment } from '@/lib/user-tasks-api';
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

const TITLE_SAVE_DEBOUNCE_MS = 450;

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
    if (!task) return;
    setSelectedAssignees(task.assignees ?? []);
  }, [task]);

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

  const scheduledDateLabel = task.scheduled_at ? toAppDateKey(task.scheduled_at) : '—';
  const scheduledTimeLabel = task.scheduled_at ? formatTaskTime(task.scheduled_at) : '—';

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

