import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ROLE_TRANSLATIONS } from '@/constants/profile';
import { FontSizes, LineHeights, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { RequestHistoryEntry } from '@/lib/api';
import { formatRequestDate } from '@/lib/dateTimeUtils';

/** История статусов и действий по заявке — от старых к новым. */
export function RequestHistoryList({ entries }: { entries: RequestHistoryEntry[] }) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');

  if (entries.length === 0) {
    return <ThemedText style={[styles.meta, { color: textMuted }]}>История пуста</ThemedText>;
  }

  return (
    <View style={styles.list}>
      {entries.map((entry) => {
        const role = entry.user?.role ? ROLE_TRANSLATIONS[entry.user.role] : undefined;
        return (
          <View key={entry.id} style={[styles.item, { borderLeftColor: border }]}>
            <ThemedText style={[styles.description, { color: text }]}>
              {entry.action_description}
            </ThemedText>
            <ThemedText style={[styles.meta, { color: textMuted }]}>
              {formatRequestDate(entry.created_at)}
              {entry.user ? ` · ${entry.user.full_name}${role ? ` (${role})` : ''}` : ''}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: Spacing.sm,
  },
  item: {
    borderLeftWidth: 2,
    paddingLeft: Spacing.md,
  },
  description: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  meta: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
  },
});
