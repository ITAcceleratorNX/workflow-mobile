import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface StatRowProps {
  label: string;
  value: number | string;
  valueColor?: string;
}

export function StatRow({ label, value, valueColor }: StatRowProps) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  return (
    <View style={styles.row}>
      <ThemedText style={[styles.label, { color: textMuted }]}>{label}</ThemedText>
      <ThemedText style={[styles.value, { color: valueColor ?? text }]}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  label: {
    fontSize: 15,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
  },
});
