import { MaterialIcons } from '@expo/vector-icons';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { RequestHistoryList } from '@/components/requests/request-history-list';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { getStatusLabel, getTypeLabel } from '@/constants/requests';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getRequestDeletionAudit, type RequestDeletionAuditEntry } from '@/lib/api';
import { formatRequestDate } from '@/lib/dateTimeUtils';

/**
 * Контрольный журнал удалений Руководителя платформы: только чтение, новые записи первыми.
 * reloadKey меняется на pull-to-refresh — журнал перечитывается с первой страницы.
 */
export function DeletionAuditList({ reloadKey = 0 }: { reloadKey?: number }) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const danger = useThemeColor({}, 'danger');
  const primary = useThemeColor({}, 'primary');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const [entries, setEntries] = useState<RequestDeletionAuditEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  /** «Повторить» после ошибки — ещё одна загрузка первой страницы. */
  const [attempt, setAttempt] = useState(0);
  /** Какая загрузка первой страницы уже завершилась; пока не совпадает с текущей — идёт загрузка. */
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  /** Ответ «Показать ещё», пришедший после перезагрузки журнала, отбрасывается. */
  const version = useRef(0);

  const firstPageKey = `${reloadKey}:${attempt}`;
  const loadingFirst = loadedKey !== firstPageKey;
  const loading = loadingFirst || loadingMore;

  useEffect(() => {
    const current = ++version.current;
    getRequestDeletionAudit(1).then((res) => {
      if (current !== version.current) return;
      if (res.ok) {
        setEntries(res.data.data);
        setPage(1);
        setTotalPages(res.data.totalPages);
        setError(null);
      } else {
        setError(res.error);
      }
      setLoadedKey(firstPageKey);
    });
  }, [firstPageKey]);

  useEffect(
    () => () => {
      version.current += 1;
    },
    []
  );

  const loadMore = useCallback(async () => {
    const current = version.current;
    setLoadingMore(true);
    setError(null);
    const res = await getRequestDeletionAudit(page + 1);
    setLoadingMore(false);
    if (current !== version.current) return;
    if (res.ok) {
      setEntries((prev) => [...prev, ...res.data.data]);
      setPage(page + 1);
      setTotalPages(res.data.totalPages);
    } else {
      setError(res.error);
    }
  }, [page]);

  if (error && entries.length === 0 && !loading) {
    return (
      <View style={styles.centered}>
        <ThemedText style={[styles.small, { color: danger }]}>
          Не удалось загрузить журнал удалений. {error}
        </ThemedText>
        <Button title="Повторить" variant="outline" onPress={() => setAttempt((n) => n + 1)} />
      </View>
    );
  }

  if (loading && entries.length === 0) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="small" color={primary} />
      </View>
    );
  }

  if (entries.length === 0) {
    return (
      <View style={styles.centered}>
        <MaterialIcons name="inbox" size={48} color={textMuted} />
        <ThemedText style={[styles.small, { color: textMuted }]}>Удалённых заявок нет</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const snapshot = entry.snapshot ?? { id: entry.request_group_id };
        const expanded = expandedId === entry.id;
        const rows: { label: string; value: string }[] = [];
        if (snapshot.status) rows.push({ label: 'Статус', value: getStatusLabel(snapshot.status) });
        if (snapshot.request_type) rows.push({ label: 'Тип', value: getTypeLabel(snapshot.request_type) });
        if (snapshot.created_date) rows.push({ label: 'Создана', value: formatRequestDate(snapshot.created_date) });
        if (snapshot.client) rows.push({ label: 'Клиент', value: snapshot.client.full_name });
        if (snapshot.office) rows.push({ label: 'Офис', value: snapshot.office.name });
        if (snapshot.location) {
          rows.push({
            label: 'Локация',
            value: snapshot.location_detail
              ? `${snapshot.location}, ${snapshot.location_detail}`
              : snapshot.location,
          });
        }
        if (snapshot.rejection_reason) {
          rows.push({ label: 'Причина отклонения', value: snapshot.rejection_reason });
        }

        return (
          <View
            key={entry.id}
            style={[styles.card, { backgroundColor: cardBackground, borderColor: border }]}
          >
            <Pressable
              onPress={() => setExpandedId(expanded ? null : entry.id)}
              accessibilityRole="button"
              accessibilityState={{ expanded }}
              accessibilityLabel={`Удалённая заявка ${entry.request_group_id}`}
              style={styles.cardHeader}
            >
              <View style={styles.cardHeaderText}>
                <ThemedText style={[styles.title, { color: text }]}>
                  Заявка #{entry.request_group_id}
                  {entry.request_id ? ` · подзаявка #${entry.request_id}` : ''}
                </ThemedText>
                <ThemedText style={[styles.caption, { color: textMuted }]}>
                  Удалил: {entry.deleted_by_name ?? `#${entry.deleted_by}`} ·{' '}
                  {formatRequestDate(entry.deleted_at)}
                </ThemedText>
                <ThemedText style={[styles.small, { color: entry.reason ? text : textMuted }]}>
                  {entry.reason ? `Причина: ${entry.reason}` : 'Причина не указана'}
                </ThemedText>
              </View>
              <MaterialIcons
                name={expanded ? 'expand-less' : 'expand-more'}
                size={22}
                color={textMuted}
              />
            </Pressable>

            {expanded ? (
              <View style={[styles.details, { borderTopColor: border }]}>
                {rows.map((row) => (
                  <View key={row.label} style={styles.row}>
                    <ThemedText style={[styles.caption, { color: textMuted }]}>{row.label}</ThemedText>
                    <ThemedText style={[styles.small, { color: text }]}>{row.value}</ThemedText>
                  </View>
                ))}

                {(snapshot.requests?.length ?? 0) > 0 ? (
                  <View style={styles.section}>
                    <ThemedText style={[styles.sectionTitle, { color: textMuted }]}>Подзаявки</ThemedText>
                    {snapshot.requests?.map((sub) => (
                      <ThemedText key={sub.id} style={[styles.small, { color: text }]}>
                        #{sub.id} {sub.title}
                        <ThemedText style={[styles.small, { color: textMuted }]}>
                          {' '}
                          · {getStatusLabel(sub.status)}
                        </ThemedText>
                      </ThemedText>
                    ))}
                  </View>
                ) : null}

                <View style={styles.section}>
                  <ThemedText style={[styles.sectionTitle, { color: textMuted }]}>
                    История до удаления
                  </ThemedText>
                  <RequestHistoryList entries={entry.history ?? []} />
                </View>
              </View>
            ) : null}
          </View>
        );
      })}

      {error ? <ThemedText style={[styles.small, { color: danger }]}>{error}</ThemedText> : null}

      {loading || page < totalPages ? (
        <Button
          title={loading ? 'Загрузка...' : 'Показать ещё'}
          variant="outline"
          disabled={loading}
          onPress={() => void loadMore()}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  centered: {
    alignItems: 'center',
    gap: Spacing.md,
    paddingVertical: Spacing.xxl,
  },
  list: {
    gap: Spacing.md,
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
  },
  cardHeaderText: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
    fontWeight: '600',
  },
  caption: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
  },
  small: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  details: {
    marginTop: Spacing.lg,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    gap: Spacing.md,
  },
  row: {
    gap: Spacing.xs,
  },
  section: {
    gap: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
});
