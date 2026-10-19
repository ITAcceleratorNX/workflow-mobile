import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { DetailCard } from '@/components/requests/request-detail-ui';
import { RequestHistoryList } from '@/components/requests/request-history-list';
import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { getRequestHistory, type RequestGroup, type RequestHistoryEntry } from '@/lib/api';
import { formatRequestDate } from '@/lib/dateTimeUtils';
import { canSeeRejectionDetails, isRejectedRequest } from '@/lib/request-permissions';
import { getRejectionMeta } from '@/lib/request-rejection';

/**
 * Карточка отклонённой заявки: причина видна всем, кому видна заявка (клиенту — тоже).
 * Администратор и Руководитель дополнительно видят, кем и когда она отклонена, и историю статусов.
 */
export function RequestRejectionInfo({
  request,
  userRole,
}: {
  request: RequestGroup;
  userRole: string | null | undefined;
}) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const danger = useThemeColor({}, 'danger');
  const dangerSoft = useThemeColor({}, 'dangerSoft');

  const rejected = isRejectedRequest(request);
  const isStaff = canSeeRejectionDetails(userRole);
  /** История последней загруженной заявки; для другой заявки считается «ещё грузится». */
  const [loaded, setLoaded] = useState<{
    requestId: number;
    entries: RequestHistoryEntry[] | null;
    error: string | null;
  } | null>(null);

  useEffect(() => {
    if (!rejected || !isStaff || request.id < 0) return;
    let cancelled = false;
    getRequestHistory(request.id).then((res) => {
      if (cancelled) return;
      setLoaded({
        requestId: request.id,
        entries: res.ok ? res.data : null,
        error: res.ok ? null : res.error,
      });
    });
    return () => {
      cancelled = true;
    };
  }, [rejected, isStaff, request.id]);

  if (!rejected) return null;

  const current = loaded?.requestId === request.id ? loaded : null;
  const history = current?.entries ?? null;
  const historyError = current?.error ?? null;

  const { rejectedByName, rejectedAt } = getRejectionMeta(request, history);

  return (
    <>
      <View style={[styles.notice, { backgroundColor: dangerSoft }]}>
        <View style={styles.noticeHeader}>
          <MaterialIcons name="cancel" size={18} color={danger} />
          <ThemedText style={[styles.noticeTitle, { color: danger }]}>Заявка отклонена</ThemedText>
        </View>
        <ThemedText style={[styles.label, { color: textMuted }]}>Причина отклонения</ThemedText>
        <ThemedText style={[styles.reason, { color: text }]}>
          {request.rejection_reason?.trim() || 'Причина не указана'}
        </ThemedText>
        {isStaff && (rejectedByName || rejectedAt) ? (
          <ThemedText style={[styles.label, styles.meta, { color: textMuted }]}>
            Отклонил{rejectedByName ? `: ${rejectedByName}` : ''}
            {rejectedAt ? ` · ${formatRequestDate(rejectedAt)}` : ''}
          </ThemedText>
        ) : null}
      </View>

      {isStaff ? (
        <DetailCard title="История статусов">
          {historyError ? (
            <ThemedText style={[styles.label, { color: danger }]}>
              Не удалось загрузить историю. {historyError}
            </ThemedText>
          ) : history === null ? (
            <ThemedText style={[styles.label, { color: textMuted }]}>Загрузка...</ThemedText>
          ) : (
            <RequestHistoryList entries={history} />
          )}
        </DetailCard>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  noticeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  noticeTitle: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
    fontWeight: '600',
  },
  label: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
  },
  reason: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  meta: {
    marginTop: Spacing.sm,
  },
});
