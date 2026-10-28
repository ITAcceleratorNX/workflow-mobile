import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { MonthGrid } from '@/components/ui/month-grid';
import { useProductUi } from '@/hooks/use-product-ui';
import { monthOfKey, monthTitle, shiftMonth, type MonthRef } from '@/lib/month-grid';
import { customPeriod, dayMonthLabel, periodLengthDays, rangeLabel, type StatsPeriod } from '@/lib/task-stats';

const MAX_DAYS = 366;

type Props = {
  visible: boolean;
  initial: StatsPeriod;
  todayKey: string;
  onApply: (period: StatsPeriod) => void;
  onClose: () => void;
};

/**
 * «Свои даты» (Figma « Свои даты»): the start and the end on one month grid. The active field takes
 * the next tapped day; after the start the end is next. The screen changes only on «Показать».
 * The caller remounts it (`key`) on each opening, so it starts from the period on screen.
 */
export function TaskStatsRangeSheet({ visible, initial, todayKey, onApply, onClose }: Props) {
  const ui = useProductUi();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [editing, setEditing] = useState<'from' | 'to'>('from');
  const [month, setMonth] = useState<MonthRef>(() => monthOfKey(initial.from));

  const pick = (key: string) => {
    if (editing === 'from') {
      setFrom(key);
      if (key > to) setTo(key);
      setEditing('to');
    } else if (key < from) {
      setFrom(key);
    } else {
      setTo(key);
    }
  };

  const tooLong = periodLengthDays({ kind: 'custom', from, to }) > MAX_DAYS;

  const field = (which: 'from' | 'to', label: string, value: string) => (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: editing === which }}
      accessibilityLabel={`${label}: ${dayMonthLabel(value)}`}
      onPress={() => {
        setEditing(which);
        setMonth(monthOfKey(value));
      }}
      style={[styles.field, { backgroundColor: ui.raised, borderColor: editing === which ? ui.accent : 'transparent' }]}
    >
      <Text style={[styles.fieldLabel, { color: ui.fg(0.55) }]}>{label}</Text>
      <Text style={[styles.fieldValue, { color: ui.fg() }]}>{dayMonthLabel(value)}</Text>
    </Pressable>
  );

  return (
    <BottomSheet visible={visible} onClose={onClose} title="Свои даты">
      <Text style={[styles.hint, { color: ui.fg(0.55) }]}>Выберите начало и конец периода</Text>
      <View style={styles.fields}>
        {field('from', 'Начало', from)}
        {field('to', 'Конец', to)}
      </View>

      <View style={styles.monthBar}>
        <Pressable accessibilityRole="button" accessibilityLabel="Предыдущий месяц" hitSlop={8} onPress={() => setMonth((m) => shiftMonth(m, -1))}>
          <MaterialIcons name="chevron-left" size={28} color={ui.accent} />
        </Pressable>
        <Text style={[styles.monthTitle, { color: ui.fg() }]}>{monthTitle(month)}</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Следующий месяц" hitSlop={8} onPress={() => setMonth((m) => shiftMonth(m, 1))}>
          <MaterialIcons name="chevron-right" size={28} color={ui.accent} />
        </Pressable>
      </View>

      <MonthGrid
        month={month}
        rowGap={6}
        weekdayStyle={styles.weekday}
        renderDay={(day) => {
          const endpoint = day.key === from || day.key === to;
          const inside = day.key > from && day.key < to;
          const ranged = to > from;
          return (
            <View style={styles.dayCell}>
              {inside ? <View style={[StyleSheet.absoluteFill, { backgroundColor: ui.accentSoft }]} /> : null}
              {ranged && day.key === from ? <View style={[styles.halfRight, { backgroundColor: ui.accentSoft }]} /> : null}
              {ranged && day.key === to ? <View style={[styles.halfLeft, { backgroundColor: ui.accentSoft }]} /> : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: endpoint }}
                accessibilityLabel={dayMonthLabel(day.key)}
                onPress={() => pick(day.key)}
                style={[
                  styles.day,
                  endpoint && { backgroundColor: ui.accent },
                  day.key === todayKey && !endpoint && { borderWidth: 1, borderColor: ui.accent },
                ]}
              >
                <Text style={[styles.dayText, { color: endpoint ? ui.onAccent : ui.fg(0.9) }, endpoint && styles.dayTextStrong]}>{day.day}</Text>
              </Pressable>
            </View>
          );
        }}
      />

      {tooLong ? <Text style={[styles.error, { color: ui.danger }]}>Период не может быть длиннее года</Text> : null}

      <View style={styles.actions}>
        <Button
          title={`Показать за ${rangeLabel({ from, to })}`}
          variant="accent"
          size="block"
          disabled={tooLong}
          onPress={() => onApply(customPeriod(from, to))}
        />
        <Button title="Отмена" variant="raised" size="block" onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hint: { fontSize: 14 },
  fields: { flexDirection: 'row', gap: 10 },
  field: { flex: 1, borderRadius: 12, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, gap: 2 },
  fieldLabel: { fontSize: 12 },
  fieldValue: { fontSize: 16, fontWeight: '600' },
  monthBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 18, marginBottom: 10 },
  monthTitle: { fontSize: 17, fontWeight: '600' },
  weekday: { fontSize: 13, paddingBottom: 8 },
  dayCell: { alignSelf: 'stretch', alignItems: 'center' },
  halfRight: { position: 'absolute', top: 0, bottom: 0, left: '50%', right: 0 },
  halfLeft: { position: 'absolute', top: 0, bottom: 0, left: 0, right: '50%' },
  day: { width: '100%', height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  dayText: { fontSize: 16 },
  dayTextStrong: { fontWeight: '700' },
  error: { fontSize: 13, marginTop: 10 },
  actions: { gap: 10, marginTop: 18 },
});
