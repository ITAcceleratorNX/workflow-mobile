import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

export type SurveyRatingScaleProps = {
  value: number | null;
  onChange: (value: number) => void;
  minLabel: string;
  maxLabel: string;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
};

/** A 1–5 single-selection scale with labels at both ends. */
export function SurveyRatingScale({ value, onChange, minLabel, maxLabel, disabled = false, style }: SurveyRatingScaleProps) {
  const ui = useProductUi();

  return (
    <View style={[styles.root, style]}>
      <View accessibilityRole="radiogroup" accessibilityLabel="Оценка от 1 до 5" style={styles.values}>
        {[1, 2, 3, 4, 5].map((rating) => {
          const selected = value === rating;
          return (
            <Pressable
              key={rating}
              accessibilityRole="radio"
              accessibilityLabel={`${rating}`}
              accessibilityState={{ checked: selected, disabled }}
              disabled={disabled}
              onPress={() => onChange(rating)}
              style={({ pressed }) => [
                styles.value,
                {
                  backgroundColor: selected ? ui.accent : ui.surface,
                  borderColor: selected ? ui.accent : ui.fg(0.14),
                },
                pressed && !disabled && styles.pressed,
                disabled && styles.disabled,
              ]}
            >
              <Text style={[styles.valueText, { color: selected ? ui.onAccent : ui.fg() }]}>{rating}</Text>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.labels}>
        <Text style={[styles.label, { color: ui.fg(0.55) }]}>{minLabel}</Text>
        <Text style={[styles.label, styles.labelRight, { color: ui.fg(0.55) }]}>{maxLabel}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 12 },
  values: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  value: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueText: { fontSize: 17, fontWeight: '600' },
  labels: { flexDirection: 'row', justifyContent: 'space-between', gap: 16 },
  label: { flex: 1, fontSize: 12, lineHeight: 16 },
  labelRight: { textAlign: 'right' },
  pressed: { transform: [{ scale: 0.96 }] },
  disabled: { opacity: 0.5 },
});
