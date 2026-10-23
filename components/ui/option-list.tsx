import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Fragment } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

export type OptionListItem<T extends string> = { value: T; label: string; icon?: IconName };

type OptionListProps<T extends string> = {
  value: T | null;
  onChange: (value: T) => void;
  options: readonly OptionListItem<T>[];
  accessibilityLabel: string;
  /** `raised` — a group in a sheet (Figma «Сортировать по»); `compact` — light rows («Направление»). */
  variant?: 'raised' | 'compact';
};

/** One choice from a short list with a check mark on the chosen option (Figma «Сортировка»). */
export function OptionList<T extends string>({ value, onChange, options, accessibilityLabel, variant = 'raised' }: OptionListProps<T>) {
  const ui = useProductUi();
  const compact = variant === 'compact';
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={accessibilityLabel} style={compact ? styles.compactList : [styles.list, { backgroundColor: ui.raised }]}>
      {options.map((option, index) => {
        const selected = option.value === value;
        return (
          <Fragment key={option.value}>
            {!compact && index > 0 ? <View style={[styles.separator, { backgroundColor: ui.fg(0.06) }]} /> : null}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              accessibilityLabel={option.label}
              onPress={() => {
                void Haptics.selectionAsync();
                onChange(option.value);
              }}
              style={({ pressed }) => [
                compact ? styles.compactRow : styles.row,
                compact && selected && { backgroundColor: ui.fg(0.06) },
                pressed && { backgroundColor: ui.fg(0.08) },
              ]}
            >
              {option.icon ? <MaterialIcons name={option.icon} size={16} color={ui.fg(0.7)} /> : null}
              <Text
                style={[compact ? styles.compactLabel : styles.label, { color: ui.fg() }, selected && styles.labelStrong]}
                numberOfLines={1}
              >
                {option.label}
              </Text>
              {selected ? <MaterialIcons name="check" size={compact ? 18 : 22} color={compact ? ui.accentOnSoft : ui.accent} /> : null}
            </Pressable>
          </Fragment>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { borderRadius: 14, overflow: 'hidden' },
  compactList: { gap: 2 },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  compactRow: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, paddingHorizontal: 10, borderRadius: 8 },
  label: { flex: 1, fontSize: 16 },
  compactLabel: { flex: 1, fontSize: 14 },
  labelStrong: { fontWeight: '600' },
});
