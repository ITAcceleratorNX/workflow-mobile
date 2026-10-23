import * as Haptics from 'expo-haptics';
import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import type { StripDay } from '@/hooks/use-tasks-screen';
import { formatDayShort } from '@/lib/task-due';

const DAY_STRIDE = 50;
const DAY_WIDTH = 42;
const SCREEN_INSET = 32;

type TaskDayStripProps = {
  days: StripDay[];
  selected: string;
  onSelect: (dateKey: string) => void;
  /** The day under the middle of the strip while it scrolls, for the month caption. */
  onVisibleChange: (dateKey: string) => void;
  monthLabel: string;
  accessibilityLabel: string;
};

/** A sideways strip of days for «Предстоящие» and «Выполненные»: the list shows the chosen day. */
export function TaskDayStrip({ days, selected, onSelect, onVisibleChange, monthLabel, accessibilityLabel }: TaskDayStripProps) {
  const ui = useProductUi();
  const ref = useRef<ScrollView>(null);
  const viewport = Math.max(1, useWindowDimensions().width - SCREEN_INSET);

  useEffect(() => {
    const index = days.findIndex((day) => day.key === selected);
    if (index < 0) return;
    const content = days.length * DAY_STRIDE - (DAY_STRIDE - DAY_WIDTH);
    const x = Math.max(0, Math.min(content - viewport, index * DAY_STRIDE + DAY_WIDTH / 2 - viewport / 2));
    requestAnimationFrame(() => ref.current?.scrollTo({ x, animated: true }));
    onVisibleChange(selected);
    // Scroll to the chosen day when it or the days change, not on every caption update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, days, viewport]);

  return (
    <View style={styles.root}>
      <Text style={[styles.month, { color: ui.fg() }]}>{monthLabel}</Text>
      <ScrollView
        ref={ref}
        horizontal
        showsHorizontalScrollIndicator={false}
        accessibilityRole="radiogroup"
        accessibilityLabel={accessibilityLabel}
        contentContainerStyle={styles.row}
        scrollEventThrottle={32}
        onScroll={(event) => {
          const index = Math.min(days.length - 1, Math.max(0, Math.round((event.nativeEvent.contentOffset.x + viewport / 2) / DAY_STRIDE)));
          const key = days[index]?.key;
          if (key) onVisibleChange(key);
        }}
      >
        {days.map((day) => {
          const active = day.key === selected;
          return (
            <Pressable
              key={day.key}
              onPress={() => {
                void Haptics.selectionAsync();
                onSelect(day.key);
              }}
              accessibilityRole="radio"
              accessibilityState={{ checked: active }}
              accessibilityLabel={formatDayShort(day.key)}
              style={styles.cell}
            >
              <Text style={[styles.weekday, { color: active ? ui.accent : ui.fg(0.5) }]}>{day.weekdayLabel}</Text>
              <View style={[styles.circle, active && { backgroundColor: ui.accent }]}>
                <Text style={[styles.number, { color: active ? ui.onAccent : ui.fg() }]}>{day.dayNumber}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: 8 },
  month: { fontSize: 16, fontWeight: '700', textTransform: 'capitalize' },
  row: { gap: 8, paddingRight: 16 },
  cell: { width: DAY_WIDTH, alignItems: 'center', gap: 6 },
  weekday: { fontSize: 11, fontWeight: '600' },
  circle: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  number: { fontSize: 14, fontWeight: '600' },
});
