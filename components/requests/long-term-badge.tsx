import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { LONG_TERM_LABEL } from '@/constants/requests';
import { Radius } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type LongTermBadgeProps = {
  /** Чуть крупнее для экрана деталей, но без акцентной рамки */
  detail?: boolean;
};

export function LongTermBadge({ detail = false }: LongTermBadgeProps) {
  const textMuted = useThemeColor({}, 'textMuted');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  return (
    <View
      style={[
        detail ? styles.detail : styles.compact,
        { backgroundColor: surfaceMuted },
      ]}
    >
      <ThemedText
        style={[
          detail ? styles.detailText : styles.compactText,
          { color: textMuted },
        ]}
        numberOfLines={1}
      >
        {LONG_TERM_LABEL}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: Radius.pill,
    maxWidth: 88,
  },
  compactText: {
    fontSize: 10,
    fontWeight: '600',
  },
  detail: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  detailText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
