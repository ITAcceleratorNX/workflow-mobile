import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatRequestDate } from '@/lib/dateTimeUtils';
import { describeTaskEvent, getTaskHistory, type TaskEvent } from '@/lib/task-recipients-api';
import type { UserTask } from '@/lib/user-tasks-api';

type Props = {
  task: Pick<UserTask, 'id' | 'completed' | 'responsible_id' | 'updated_at'>;
};

/**
 * Единый журнал задачи: создание и первый получатель, передачи, ответственный, завершение и
 * возврат в работу — с датой и временем. Видят автор, текущие и бывшие участники.
 */
export function TaskHistorySection({ task }: Props) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  // Перечитывается после завершения, возврата, передачи и смены ответственного.
  const historyKey = `${task.id}:${task.completed}:${task.responsible_id ?? ''}:${task.updated_at}`;
  const [state, setState] = useState<{ key: string; events: TaskEvent[]; error: string | null } | null>(null);
  const events = state?.events ?? [];
  const loading = state?.key !== historyKey;

  useEffect(() => {
    let cancelled = false;
    void getTaskHistory(task.id).then((res) => {
      if (cancelled) return;
      setState(res.ok ? { key: historyKey, events: res.data, error: null } : { key: historyKey, events: [], error: res.error });
    });
    return () => {
      cancelled = true;
    };
  }, [task.id, historyKey]);

  return (
    <>
      <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>История</ThemedText>
      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        {loading && events.length === 0 ? (
          <View style={styles.centerBlock}>
            <ActivityIndicator size="small" color={primary} />
          </View>
        ) : events.length === 0 ? (
          <ThemedText style={[styles.hint, styles.empty, { color: textMuted }]}>
            {state?.error ?? 'Пока нет действий'}
          </ThemedText>
        ) : (
          events.map((e, i) => (
            <View key={`${e.id}:${e.action}`}>
              {i > 0 ? <View style={[styles.divider, { backgroundColor: border }]} /> : null}
              <View style={styles.row}>
                <ThemedText style={[styles.rowText, { color: text }]}>{describeTaskEvent(e)}</ThemedText>
                <ThemedText style={[styles.rowTime, { color: textMuted }]}>{formatRequestDate(e.created_at)}</ThemedText>
              </View>
            </View>
          ))
        )}
      </View>
    </>
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
  divider: { height: StyleSheet.hairlineWidth },
  hint: { fontSize: 12, lineHeight: 17 },
  centerBlock: { paddingVertical: 16, alignItems: 'center' },
  empty: { paddingHorizontal: 14, paddingVertical: 14 },
  row: { paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  rowText: { fontSize: 14 },
  rowTime: { fontSize: 12 },
});
