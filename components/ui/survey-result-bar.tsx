import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

export type SurveyResultBarProps = {
  label: string;
  count: number;
  percent: number;
  style?: StyleProp<ViewStyle>;
};

/** One answer's count, share and fill bar for survey results. */
export function SurveyResultBar({ label, count, percent, style }: SurveyResultBarProps) {
  const ui = useProductUi();
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  const visiblePercent = Number.isInteger(percent) ? `${percent}` : percent.toFixed(1);

  return (
    <View
      accessibilityRole="summary"
      accessibilityLabel={`${label}: ${count}, ${visiblePercent}%`}
      style={[styles.root, style]}
    >
      <View style={styles.heading}>
        <Text style={[styles.label, { color: ui.fg() }]}>{label}</Text>
        <Text style={[styles.value, { color: ui.fg(0.6) }]}>{count} · {visiblePercent}%</Text>
      </View>
      <View style={[styles.track, { backgroundColor: ui.fg(0.1) }]}>
        <View style={[styles.fill, { width: `${safePercent}%`, backgroundColor: ui.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  heading: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  label: { flex: 1, fontSize: 14, lineHeight: 19 },
  value: { fontSize: 13, fontWeight: '500', lineHeight: 19, fontVariant: ['tabular-nums'] },
  track: { height: 7, borderRadius: 4, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
});
