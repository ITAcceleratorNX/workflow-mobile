import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import { monthTitle, monthWeeks, WEEKDAY_SHORT_MON_FIRST, type MonthRef } from '@/lib/month-grid';

export type MonthGridDay = { key: string; day: number };

type MonthGridProps = {
  month: MonthRef;
  /** Renders one day; the look of a day belongs to the caller. */
  renderDay: (day: MonthGridDay) => ReactNode;
  style?: StyleProp<ViewStyle>;
  weekdayStyle?: StyleProp<TextStyle>;
  /** Space between the weeks. */
  rowGap?: number;
};

/** A month as a grid of days, Monday first (Figma «Месяц»). */
export function MonthGrid({ month, renderDay, style, weekdayStyle, rowGap = 0 }: MonthGridProps) {
  const ui = useProductUi();
  const weeks = useMemo(() => monthWeeks(month), [month]);
  return (
    <View style={[{ gap: rowGap }, style]} accessibilityLabel={monthTitle(month)}>
      <View style={styles.row}>
        {WEEKDAY_SHORT_MON_FIRST.map((name) => (
          <Text key={name} style={[styles.weekday, { color: ui.fg(0.45) }, weekdayStyle]} accessibilityElementsHidden>
            {name}
          </Text>
        ))}
      </View>
      {weeks.map((week, index) => (
        <View key={index} style={styles.row}>
          {week.map((cell, cellIndex) => (
            <View key={cell?.key ?? `empty-${cellIndex}`} style={styles.cell}>
              {cell ? renderDay(cell) : null}
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 11, fontWeight: '500', paddingBottom: 4 },
});
