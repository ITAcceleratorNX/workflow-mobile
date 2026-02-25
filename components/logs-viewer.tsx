import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  fetchRequestLogs,
  type RequestLog,
} from '@/lib/profile-api';

const ACTION_LABELS: Record<string, string> = {
  created: 'Создано',
  updated: 'Обновлено',
  status_changed: 'Статус изменён',
  assigned: 'Назначено',
  completed: 'Завершено',
  commented: 'Комментарий',
  deleted: 'Удалено',
  rejected: 'Отклонено',
};

export interface LogsViewerProps {
  userRole: string;
}

function formatLogDate(dateString: string): string {
  const d = new Date(dateString);
  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function LogsViewer({ userRole }: LogsViewerProps) {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchRequestLogs(userRole, page, 20);
    setLoading(false);

    if (!result.ok) {
      setError(result.error);
      setLogs([]);
      return;
    }
    setLogs(result.data.logs);
    setTotal(result.data.total);
    setTotalPages(result.data.totalPages);
  }, [userRole, page]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  return (
    <View style={[styles.card, { borderColor: border }]}>
      <ThemedText style={styles.title}>Логи действий</ThemedText>
      <ThemedText style={[styles.subtitle, { color: textMuted }]}>
        История операций
      </ThemedText>

      {loading && logs.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={border} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>
            Загрузка логов...
          </ThemedText>
        </View>
      ) : error ? (
        <View style={styles.centered}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Button title="Повторить" onPress={loadLogs} variant="secondary" />
        </View>
      ) : logs.length === 0 ? (
        <View style={styles.centered}>
          <ThemedText style={[styles.emptyText, { color: textMuted }]}>
            Логи не найдены
          </ThemedText>
        </View>
      ) : (
        <>
          <ThemedText style={[styles.countText, { color: textMuted }]}>
            Показано {logs.length} из {total}
          </ThemedText>
          <ScrollView
            style={styles.logsList}
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled
          >
            {logs.map((log) => (
              <View
                key={log.id}
                style={[styles.logItem, { borderColor: border }]}
              >
                <View style={styles.logHeader}>
                  <View style={[styles.badge, { backgroundColor: border }]}>
                    <ThemedText style={[styles.badgeText, { color: text }]}>
                      {ACTION_LABELS[log.action_type] ?? log.action_type}
                    </ThemedText>
                  </View>
                  <ThemedText style={[styles.logDate, { color: textMuted }]}>
                    {formatLogDate(log.created_at)}
                  </ThemedText>
                </View>
                <ThemedText style={[styles.logDesc, { color: text }]}>
                  {log.action_description}
                </ThemedText>
                <View style={styles.logMeta}>
                  <MaterialIcons name="person" size={14} color={textMuted} />
                  <ThemedText style={[styles.logMetaText, { color: textMuted }]}>
                    {log.user?.full_name ?? '—'} ({log.user?.role ?? '—'})
                  </ThemedText>
                </View>
                {log.request && (
                  <ThemedText style={[styles.logRequest, { color: textMuted }]}>
                    Заявка №{log.request.id}: {log.request.title}
                  </ThemedText>
                )}
              </View>
            ))}
          </ScrollView>

          {totalPages > 1 && (
            <View style={styles.pagination}>
              <Pressable
                onPress={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                style={[
                  styles.pageBtn,
                  { borderColor: border },
                  page <= 1 && styles.pageBtnDisabled,
                ]}
              >
                <ThemedText style={[styles.pageBtnText, { color: text }]}>
                  Назад
                </ThemedText>
              </Pressable>
              <ThemedText style={[styles.pageInfo, { color: textMuted }]}>
                {page} / {totalPages}
              </ThemedText>
              <Pressable
                onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                style={[
                  styles.pageBtn,
                  { borderColor: border },
                  page >= totalPages && styles.pageBtnDisabled,
                ]}
              >
                <ThemedText style={[styles.pageBtnText, { color: text }]}>
                  Вперёд
                </ThemedText>
              </Pressable>
            </View>
          )}

          <Button
            title={loading ? 'Обновление...' : 'Обновить'}
            onPress={loadLogs}
            disabled={loading}
            variant="secondary"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 14,
  },
  centered: {
    paddingVertical: 32,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorText: {
    fontSize: 14,
    color: '#F35713',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
  },
  countText: {
    fontSize: 13,
  },
  logsList: {
    maxHeight: 400,
  },
  logItem: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
    gap: 6,
  },
  logHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  logDate: {
    fontSize: 12,
  },
  logDesc: {
    fontSize: 14,
    fontWeight: '500',
  },
  logMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  logMetaText: {
    fontSize: 12,
  },
  logRequest: {
    fontSize: 12,
  },
  pagination: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  pageBtnDisabled: {
    opacity: 0.5,
  },
  pageBtnText: {
    fontSize: 14,
    fontWeight: '500',
  },
  pageInfo: {
    fontSize: 14,
  },
});
