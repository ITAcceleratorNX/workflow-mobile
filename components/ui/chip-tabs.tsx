import * as Haptics from 'expo-haptics';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

export type ChipTab<T extends string> = {
  value: T;
  label: string;
  /** Shown as a badge when greater than zero. */
  count?: number | null;
};

type ChipTabsProps<T extends string> = {
  value: T;
  onChange: (value: T) => void;
  tabs: readonly ChipTab<T>[];
  accessibilityLabel: string;
};

/** Tabs of a list with counters (Figma «Фильтры»: «Входящие 9», «Сегодня 2»); scroll sideways. */
export function ChipTabs<T extends string>({ value, onChange, tabs, accessibilityLabel }: ChipTabsProps<T>) {
  const ui = useProductUi();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      accessibilityRole="tablist"
      accessibilityLabel={accessibilityLabel}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {tabs.map((tab) => {
        const selected = tab.value === value;
        const count = tab.count ?? 0;
        return (
          <Pressable
            key={tab.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={count > 0 ? `${tab.label}, ${count}` : tab.label}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onChange(tab.value);
            }}
            style={({ pressed }) => [
              styles.chip,
              selected
                ? { backgroundColor: ui.accentSoft, borderColor: 'transparent' }
                : { borderColor: ui.fg(0.1) },
              pressed && !selected && { opacity: 0.7 },
            ]}
          >
            <Text style={[styles.label, { color: selected ? ui.accentOnSoft : ui.fg(0.6) }]}>{tab.label}</Text>
            {count > 0 ? (
              <View style={[styles.badge, { backgroundColor: selected ? ui.accent : ui.fg(0.12) }]}>
                <Text style={[styles.badgeText, { color: selected ? ui.onAccent : ui.fg(0.8) }]}>{count}</Text>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { marginHorizontal: -16, flexGrow: 0 },
  row: { flexDirection: 'row', gap: 6, paddingHorizontal: 16 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 13,
    borderRadius: 20,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  label: { fontSize: 15, fontWeight: '500' },
  badge: { minWidth: 20, height: 16, borderRadius: 8, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' },
  badgeText: { fontSize: 12, fontWeight: '600', lineHeight: 14 },
});
