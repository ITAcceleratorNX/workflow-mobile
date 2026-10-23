import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type SegmentedOption<T extends string> = {
  value: T;
  label?: string;
  icon?: IconName;
  /** Color of the icon while the option is not chosen (e.g. the red flag of «Высокий»). */
  iconColor?: string;
  /** Required when the option shows only an icon. */
  accessibilityLabel?: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  options: readonly SegmentedOption<T>[];
  accessibilityLabel: string;
  /** `accent` — the chosen option on accent-soft (view switch); `neutral` — on a lighter surface (priority). */
  tone?: 'accent' | 'neutral';
  /** Stretch the options to equal widths. */
  fill?: boolean;
  style?: StyleProp<ViewStyle>;
  optionStyle?: StyleProp<ViewStyle>;
};

/** One choice of a few (Figma «Вид: список / календарь», «Приоритет»): a dark track with the chosen option. */
export function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  accessibilityLabel,
  tone = 'accent',
  fill = false,
  style,
  optionStyle,
}: SegmentedControlProps<T>) {
  const ui = useProductUi();
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={[styles.track, { backgroundColor: ui.surface }, fill && styles.fill, style]}>
      {options.map((option) => {
        const selected = option.value === value;
        const color = selected ? (tone === 'accent' ? ui.accentOnSoft : ui.fg()) : ui.fg(0.6);
        return (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            accessibilityLabel={option.accessibilityLabel ?? option.label}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(option.value);
            }}
            style={({ pressed }) => [
              styles.option,
              fill && styles.optionFill,
              selected && { backgroundColor: tone === 'accent' ? ui.accentSoft : ui.fg(0.13) },
              pressed && !selected && { opacity: 0.7 },
              optionStyle,
            ]}
          >
            {option.icon ? (
              <MaterialIcons name={option.icon} size={option.label ? 16 : 20} color={!selected && option.iconColor ? option.iconColor : color} />
            ) : null}
            {option.label ? (
              <Text style={[styles.label, { color }, selected && tone === 'neutral' && styles.labelStrong]} numberOfLines={1}>
                {option.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: { flexDirection: 'row', gap: 2, padding: 3, borderRadius: 11, alignSelf: 'flex-start' },
  fill: { alignSelf: 'stretch' },
  option: {
    minHeight: 30,
    paddingHorizontal: 9,
    borderRadius: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  optionFill: { flex: 1 },
  label: { fontSize: 14, fontWeight: '500' },
  labelStrong: { fontWeight: '600' },
});
