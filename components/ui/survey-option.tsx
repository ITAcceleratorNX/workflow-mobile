import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

export type SurveyOptionProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  selectionType?: 'radio' | 'checkbox';
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/** Selectable answer row for single-choice, multiple-choice and yes/no questions. */
export function SurveyOption({
  label,
  selected,
  onPress,
  selectionType = 'radio',
  disabled = false,
  style,
  testID,
}: SurveyOptionProps) {
  const ui = useProductUi();
  const shape = selectionType === 'radio' ? styles.radio : styles.checkbox;

  return (
    <Pressable
      accessibilityRole={selectionType}
      accessibilityLabel={label}
      accessibilityState={{ checked: selected, disabled }}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: selected ? ui.accentSoft : ui.surface,
          borderColor: selected ? ui.accent : ui.fg(0.12),
        },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <View
        style={[
          styles.control,
          shape,
          {
            borderColor: selected ? ui.accent : ui.fg(0.35),
            backgroundColor: selected ? ui.accent : 'transparent',
          },
        ]}
      >
        {selected ? <MaterialIcons name="check" size={16} color={ui.onAccent} /> : null}
      </View>
      <Text style={[styles.label, { color: ui.fg() }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    minHeight: 56,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
    borderRadius: 14,
  },
  control: { width: 22, height: 22, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  radio: { borderRadius: 11 },
  checkbox: { borderRadius: 6 },
  label: { flex: 1, fontSize: 15, lineHeight: 21 },
  pressed: { opacity: 0.75 },
  disabled: { opacity: 0.5 },
});
