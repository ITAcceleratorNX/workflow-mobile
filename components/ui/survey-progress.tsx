import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

export type SurveyProgressProps = {
  /** Current question number, starting at 1. */
  step: number;
  total: number;
  style?: StyleProp<ViewStyle>;
};

/** Question progress used while a client is taking a survey. */
export function SurveyProgress({ step, total, style }: SurveyProgressProps) {
  const ui = useProductUi();
  const safeTotal = Math.max(0, Math.floor(total));
  const safeStep = safeTotal === 0 ? 0 : Math.min(safeTotal, Math.max(1, Math.floor(step)));
  const progress = safeTotal === 0 ? 0 : (safeStep / safeTotal) * 100;
  const label = `Вопрос ${safeStep} из ${safeTotal}`;

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 1, max: safeTotal, now: safeStep, text: label }}
      style={[styles.root, style]}
    >
      <Text style={[styles.label, { color: ui.fg(0.65) }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: ui.fg(0.1) }]}>
        <View style={[styles.fill, { width: `${progress}%`, backgroundColor: ui.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 10 },
  label: { fontSize: 14, fontWeight: '500' },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 3 },
});
