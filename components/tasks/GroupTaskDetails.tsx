import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useToast } from '@/context/toast-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatRequestDate } from '@/lib/dateTimeUtils';
import {
  describeTaskEvent,
  getTaskHistory,
  getTaskParticipants,
  groupRecipientLabel,
  setTaskResponsible,
  type TaskEvent,
  type TaskParticipant,
} from '@/lib/task-recipients-api';
import type { UserTask } from '@/lib/user-tasks-api';

type Props = {
  task: UserTask;
  currentUserId: number | null;
  /** После смены ответственного: перечитать задачу и списки. */
  onChanged: () => void;
};

/** Карточка групповой задачи: получатель, ответственный, правило завершения и история. */
export function GroupTaskDetails({ task, currentUserId, onChanged }: Props) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');
  const { show: showToast } = useToast();

  const [sheetOpen, setSheetOpen] = useState(false);
  // История перечитывается после завершения, возврата и смены ответственного.
  const historyKey = `${task.id}:${task.completed}:${task.responsible_id ?? ''}:${task.updated_at}`;
  const [historyState, setHistoryState] = useState<{
    key: string;
    events: TaskEvent[];
  } | null>(null);
  const history = historyState?.events ?? [];
  const historyLoading = historyState?.key !== historyKey;

  const perms = task.group_permissions;
  const canOpenResponsible = !!perms && (perms.can_manage_responsible || perms.can_take_responsibility);
  const responsibleName = task.responsible?.full_name ?? null;
  const completedBy = task.completed_by_user ?? task.completedByUser ?? null;

  useEffect(() => {
    let cancelled = false;
    void getTaskHistory(task.id).then((res) => {
      if (!cancelled) setHistoryState({ key: historyKey, events: res.ok ? res.data : [] });
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, historyKey]);

  const recipientValue =
    task.participants_count != null
      ? `${groupRecipientLabel(task)} · участников: ${task.participants_count}`
      : groupRecipientLabel(task);

  const ruleHint = task.completed
    ? 'Задача выполнена у всех участников. Вернуть в работу может автор или ответственный, который её завершил.'
    : responsibleName
      ? `Одна общая задача для всех участников. Завершить её может только ответственный: ${responsibleName}.`
      : 'Одна общая задача для всех участников. Пока ответственный не назначен, завершить её может любой участник.';

  return (
    <>
      <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Групповая задача</ThemedText>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <MaterialIcons
              name={
                task.assignment_type === 'company'
                  ? 'business'
                  : task.assignment_type === 'department'
                    ? 'apartment'
                    : 'people-outline'
              }
              size={20}
              color={textMuted}
            />
            <ThemedText style={[styles.rowTitle, { color: text }]}>Получатель</ThemedText>
          </View>
          <ThemedText style={[styles.rowValue, styles.valueCol, { color: textMuted }]} numberOfLines={3}>
            {recipientValue}
          </ThemedText>
        </View>
        <View style={[styles.divider, { backgroundColor: border }]} />
        <Pressable
          disabled={!canOpenResponsible}
          onPress={() => {
            void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setSheetOpen(true);
          }}
          style={({ pressed }) => [styles.row, pressed && canOpenResponsible && { opacity: 0.65 }]}
          accessibilityRole="button"
          accessibilityLabel="Ответственный"
        >
          <View style={styles.rowLeft}>
            <MaterialIcons name="verified-user" size={20} color={textMuted} />
            <ThemedText style={[styles.rowTitle, { color: text }]}>Ответственный</ThemedText>
          </View>
          <View style={styles.rowRight}>
            <ThemedText
              style={[styles.rowValue, { color: responsibleName ? text : textMuted, flexShrink: 1 }]}
              numberOfLines={1}
            >
              {responsibleName ?? 'Не назначен'}
            </ThemedText>
            {canOpenResponsible ? <MaterialIcons name="chevron-right" size={22} color={textMuted} /> : null}
          </View>
        </Pressable>
        {task.completed && completedBy?.full_name ? (
          <>
            <View style={[styles.divider, { backgroundColor: border }]} />
            <View style={styles.row}>
              <View style={styles.rowLeft}>
                <MaterialIcons name="check-circle-outline" size={20} color={textMuted} />
                <ThemedText style={[styles.rowTitle, { color: text }]}>Завершил</ThemedText>
              </View>
              <ThemedText style={[styles.rowValue, { color: textMuted, flexShrink: 1 }]} numberOfLines={1}>
                {completedBy.full_name}
              </ThemedText>
            </View>
          </>
        ) : null}
        <View style={[styles.hintWrap, { borderTopColor: border }]}>
          <ThemedText style={[styles.hint, { color: textMuted }]}>{ruleHint}</ThemedText>
        </View>
      </View>

      <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>История</ThemedText>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        {historyLoading && history.length === 0 ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={primary} />
          </View>
        ) : history.length === 0 ? (
          <ThemedText style={[styles.hint, styles.historyEmpty, { color: textMuted }]}>Пока нет действий</ThemedText>
        ) : (
          history.map((e, i) => (
            <View key={e.id}>
              {i > 0 ? <View style={[styles.divider, { backgroundColor: border }]} /> : null}
              <View style={styles.historyRow}>
                <ThemedText style={[styles.historyText, { color: text }]}>{describeTaskEvent(e)}</ThemedText>
                <ThemedText style={[styles.historyTime, { color: textMuted }]}>
                  {formatRequestDate(e.created_at)}
                </ThemedText>
              </View>
            </View>
          ))
        )}
      </View>

      <ResponsibleSheet
        visible={sheetOpen}
        task={task}
        currentUserId={currentUserId}
        onClose={() => setSheetOpen(false)}
        onApply={async (userId) => {
          const res = await setTaskResponsible(task.id, userId);
          if (!res.ok) {
            showToast({
              title: 'Не удалось изменить ответственного',
              description: res.error,
              variant: 'destructive',
              duration: 4000,
            });
            return;
          }
          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setSheetOpen(false);
          onChanged();
        }}
      />
    </>
  );
}

type SheetProps = {
  visible: boolean;
  task: UserTask;
  currentUserId: number | null;
  onClose: () => void;
  onApply: (userId: number | null) => Promise<void>;
};

function ResponsibleSheet(props: SheetProps) {
  return (
    <Modal visible={props.visible} transparent animationType="slide" onRequestClose={props.onClose}>
      {props.visible ? <ResponsibleSheetBody {...props} /> : null}
    </Modal>
  );
}

function ResponsibleSheetBody({ task, currentUserId, onClose, onApply }: SheetProps) {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const perms = task.group_permissions;
  const canManage = perms?.can_manage_responsible === true;
  const canTake = perms?.can_take_responsibility === true;

  const [query, setQuery] = useState('');
  const [participants, setParticipants] = useState<TaskParticipant[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!canManage) return;
    let cancelled = false;
    const t = setTimeout(
      async () => {
        setLoading(true);
        const res = await getTaskParticipants(task.id, query);
        if (cancelled) return;
        setLoading(false);
        setParticipants(res.ok ? res.data : []);
      },
      query ? 300 : 0
    );
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [canManage, task.id, query]);

  const apply = useCallback(
    async (userId: number | null) => {
      if (busy) return;
      setBusy(true);
      await onApply(userId);
      setBusy(false);
    },
    [busy, onApply]
  );

  return (
    <View style={styles.modalRoot}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: background,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn} accessibilityLabel="Закрыть">
            <MaterialIcons name="close" size={24} color={text} />
          </Pressable>
          <ThemedText style={[styles.sheetTitle, { color: text }]}>Ответственный</ThemedText>
          <View style={styles.headerBtn}>{busy ? <ActivityIndicator size="small" color={primary} /> : null}</View>
        </View>
        <ThemedText style={[styles.hint, styles.sheetHint, { color: textMuted }]}>
          Ответственный завершает задачу за всех. Задача остаётся видна всем участникам.
        </ThemedText>

        <ScrollView style={styles.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {canTake && task.responsible_id !== currentUserId ? (
            <Pressable
              style={[styles.sheetRow, { borderBottomColor: border }]}
              onPress={() => void apply(currentUserId)}
              disabled={busy}
            >
              <MaterialIcons name="how-to-reg" size={22} color={primary} />
              <ThemedText style={[styles.sheetRowLabel, { color: primary }]}>Назначить себя</ThemedText>
            </Pressable>
          ) : null}
          {canManage && task.responsible_id != null ? (
            <Pressable
              style={[styles.sheetRow, { borderBottomColor: border }]}
              onPress={() => void apply(null)}
              disabled={busy}
            >
              <MaterialIcons name="person-off" size={22} color="#EF4444" />
              <ThemedText style={[styles.sheetRowLabel, { color: '#EF4444' }]}>Снять ответственного</ThemedText>
            </Pressable>
          ) : null}

          {canManage ? (
            <>
              <View style={[styles.searchCard, { backgroundColor: cardBg, borderColor: border }]}>
                <MaterialIcons name="search" size={22} color={textMuted} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Участник задачи"
                  placeholderTextColor={textMuted}
                  style={[styles.searchInput, { color: text }]}
                  autoCorrect={false}
                />
              </View>
              {loading && participants.length === 0 ? (
                <View style={styles.centerBlock}>
                  <ActivityIndicator size="small" color={primary} />
                </View>
              ) : participants.length === 0 ? (
                <ThemedText style={[styles.hint, { color: textMuted }]}>Участники не найдены</ThemedText>
              ) : (
                participants.map((p) => {
                  const selected = p.id === task.responsible_id;
                  return (
                    <Pressable
                      key={p.id}
                      style={[styles.sheetRow, { borderBottomColor: border }]}
                      onPress={() => void apply(p.id)}
                      disabled={busy || selected}
                    >
                      <MaterialIcons name="person" size={22} color={primary} />
                      <View style={styles.flex1}>
                        <ThemedText style={[styles.sheetRowLabel, { color: text }]} numberOfLines={1}>
                          {p.full_name}
                          {p.id === currentUserId ? ' (вы)' : ''}
                        </ThemedText>
                        {p.position ? (
                          <ThemedText style={[styles.rowValue, { color: textMuted }]} numberOfLines={1}>
                            {p.position}
                          </ThemedText>
                        ) : null}
                      </View>
                      {selected ? <MaterialIcons name="check" size={22} color={primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </>
          ) : null}
        </ScrollView>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: {
    marginTop: 18,
    marginBottom: 8,
    fontSize: 13,
    fontWeight: '700',
  },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
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
  rowTitle: { fontSize: 15, fontWeight: '600' },
  rowValue: { fontSize: 13 },
  valueCol: { flex: 1, textAlign: 'right' },
  divider: { height: StyleSheet.hairlineWidth },
  hintWrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  hint: { fontSize: 12, lineHeight: 17 },
  centerBlock: { paddingVertical: 16, alignItems: 'center' },
  historyEmpty: { paddingHorizontal: 14, paddingVertical: 14 },
  historyRow: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  historyText: { fontSize: 14 },
  historyTime: { fontSize: 12 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.38)' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '80%',
    paddingTop: 12,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
  },
  headerBtn: { padding: 4, minWidth: 32 },
  sheetTitle: { fontSize: 17, fontWeight: '700' },
  sheetHint: { paddingHorizontal: 16, paddingVertical: 8 },
  sheetScroll: { paddingHorizontal: 16 },
  sheetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  sheetRowLabel: { fontSize: 16 },
  flex1: { flex: 1 },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: 12,
    marginBottom: 4,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
});
