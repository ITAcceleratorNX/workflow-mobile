import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { MonthGrid } from '@/components/ui/month-grid';
import { OptionList } from '@/components/ui/option-list';
import { useProductUi } from '@/hooks/use-product-ui';
import { monthOfKey, monthTitle, sameMonth, shiftMonth, type MonthRef } from '@/lib/month-grid';
import { DEFAULT_DUE_TIME, formatDayShort, quickDueOptions, type TaskDue } from '@/lib/task-due';
import {
  defaultRecurrenceNone,
  formatRecurrenceSummaryCompactRu,
  presetToPayload,
  RECURRENCE_PRESET_OPTIONS,
  type RecurrenceType,
  type TaskRecurrencePayload,
} from '@/lib/task-recurrence';

export type DueValue = { due: TaskDue | null; recurrence: TaskRecurrencePayload };

const PRESETS = RECURRENCE_PRESET_OPTIONS.filter((item) => item.type !== 'custom');
const pad = (value: number) => String(value).padStart(2, '0');

/** A wall-clock time as a Date for the native picker (the picker shows the device's local time). */
function timeAsDate(time: string): Date {
  const [hours, minutes] = time.split(':').map((part) => parseInt(part, 10));
  const date = new Date();
  date.setHours(hours || 0, minutes || 0, 0, 0);
  return date;
}

type TaskDueEditorProps = {
  visible: boolean;
  onClose: () => void;
  value: DueValue;
  onApply: (value: DueValue) => void;
  todayKey: string;
};

/**
 * «Срок» (Figma «Задачи · Срок»): quick days, a month without past days, the time and the repeat.
 * Changes are a draft until «Готово»; closing otherwise keeps the previous «Срок».
 */
export function TaskDueEditor({ visible, onClose, value, onApply, todayKey }: TaskDueEditorProps) {
  const ui = useProductUi();
  const [draft, setDraft] = useState(value);
  const [month, setMonth] = useState<MonthRef>(() => monthOfKey(value.due?.dateKey ?? todayKey));
  const [repeatOpen, setRepeatOpen] = useState(false);
  const [androidTimeOpen, setAndroidTimeOpen] = useState(false);

  const [wasVisible, setWasVisible] = useState(visible);
  // Every opening starts from the current «Срок»; `value` changing while the sheet is open keeps the draft.
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setDraft(value);
      setMonth(monthOfKey(value.due?.dateKey ?? todayKey));
      setRepeatOpen(false);
    }
  }

  const quick = quickDueOptions(todayKey);
  const selectedKey = draft.due?.dateKey ?? null;
  const time = draft.due?.time ?? DEFAULT_DUE_TIME;
  const firstMonth = monthOfKey(todayKey);
  const recurrence = draft.recurrence;
  const repeatOptions = [
    ...PRESETS.map((item) => ({ value: item.type as string, label: item.type === 'none' ? 'Не повторять' : item.label })),
    ...(recurrence.recurrence_type === 'custom'
      ? [{ value: 'custom', label: formatRecurrenceSummaryCompactRu(recurrence, { anchorDateKey: selectedKey ?? todayKey }) }]
      : []),
  ];
  const repeatLabel = repeatOptions.find((item) => item.value === recurrence.recurrence_type)?.label ?? 'Не повторять';

  const chooseDay = (dateKey: string | null) => {
    void Haptics.selectionAsync();
    if (dateKey == null) {
      setDraft({ due: null, recurrence: defaultRecurrenceNone() });
      return;
    }
    setDraft({ ...draft, due: { dateKey, time } });
    const target = monthOfKey(dateKey);
    if (!sameMonth(target, month)) setMonth(target);
  };
  const setTime = (date: Date) => {
    if (draft.due) setDraft({ ...draft, due: { ...draft.due, time: `${pad(date.getHours())}:${pad(date.getMinutes())}` } });
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="Срок"
      action={{
        label: 'Готово',
        onPress: () => {
          onApply(draft);
          onClose();
        },
      }}
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} accessibilityLabel="Быстрый выбор">
        {quick.map((option) => {
          const active = option.dateKey === selectedKey;
          return (
            <Pressable
              key={option.id}
              onPress={() => chooseDay(option.dateKey)}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              style={[styles.chip, { backgroundColor: active ? ui.accentSoft : ui.raised }]}
            >
              <Text style={[styles.chipLabel, { color: active ? ui.accentOnSoft : ui.fg(0.85) }]}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.monthBlock}>
        <View style={styles.monthHeader}>
          <Text style={[styles.monthTitle, { color: ui.fg() }]} accessibilityRole="header">
            {monthTitle(month)}
          </Text>
          <View style={styles.monthNav}>
            <Pressable
              onPress={() => setMonth(shiftMonth(month, -1))}
              disabled={sameMonth(month, firstMonth)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Предыдущий месяц"
              style={sameMonth(month, firstMonth) && styles.disabled}
            >
              <MaterialIcons name="chevron-left" size={24} color={ui.accent} />
            </Pressable>
            <Pressable onPress={() => setMonth(shiftMonth(month, 1))} hitSlop={8} accessibilityRole="button" accessibilityLabel="Следующий месяц">
              <MaterialIcons name="chevron-right" size={24} color={ui.accent} />
            </Pressable>
          </View>
        </View>
        <MonthGrid
          month={month}
          weekdayStyle={styles.weekday}
          renderDay={(day) => {
            const past = day.key < todayKey;
            const selected = day.key === selectedKey;
            const today = day.key === todayKey;
            return (
              <Pressable
                onPress={() => chooseDay(day.key)}
                disabled={past}
                accessibilityRole="button"
                accessibilityState={{ selected, disabled: past }}
                accessibilityLabel={`${formatDayShort(day.key)}${today ? ', сегодня' : ''}`}
                style={[styles.day, selected && { backgroundColor: ui.accent }]}
              >
                <Text
                  style={[
                    styles.dayLabel,
                    { color: selected ? ui.onAccent : past ? ui.fg(0.3) : today ? ui.accent : ui.fg() },
                    (selected || today) && styles.dayLabelStrong,
                  ]}
                >
                  {day.day}
                </Text>
              </Pressable>
            );
          }}
        />
      </View>

      <ListGroup tone="raised">
        <View style={styles.timeRow}>
          <MaterialIcons name="schedule" size={20} color={ui.fg(0.7)} />
          <Text style={[styles.timeLabel, { color: ui.fg() }]}>Время</Text>
          {Platform.OS === 'ios' ? (
            <DateTimePicker
              value={timeAsDate(time)}
              mode="time"
              display="compact"
              disabled={!draft.due}
              themeVariant={ui.scheme}
              accentColor={ui.accent}
              onChange={(_, date) => {
                if (date) setTime(date);
              }}
            />
          ) : (
            <Pressable
              onPress={() => setAndroidTimeOpen(true)}
              disabled={!draft.due}
              accessibilityRole="button"
              accessibilityLabel={`Время ${time}`}
              style={[styles.timePill, { backgroundColor: ui.well }, !draft.due && styles.disabled]}
            >
              <Text style={[styles.timeValue, { color: ui.fg() }]}>{time}</Text>
            </Pressable>
          )}
        </View>
        <ListRow
          icon="repeat"
          label="Повтор"
          value={draft.due ? repeatLabel : 'Нужен срок'}
          disabled={!draft.due}
          onPress={() => setRepeatOpen((open) => !open)}
        />
      </ListGroup>
      {repeatOpen && draft.due ? (
        <OptionList<string>
          accessibilityLabel="Повтор"
          value={recurrence.recurrence_type}
          options={repeatOptions}
          onChange={(type) => {
            if (type !== 'custom') setDraft({ ...draft, recurrence: presetToPayload(type as RecurrenceType) });
            setRepeatOpen(false);
          }}
        />
      ) : null}

      {Platform.OS === 'android' && androidTimeOpen ? (
        <DateTimePicker
          value={timeAsDate(time)}
          mode="time"
          display="default"
          is24Hour
          onChange={(event, date) => {
            setAndroidTimeOpen(false);
            if (event.type === 'set' && date) setTime(date);
          }}
        />
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  chips: { gap: 8 },
  chip: { minHeight: 33, borderRadius: 16, paddingHorizontal: 12, justifyContent: 'center' },
  chipLabel: { fontSize: 14, fontWeight: '500' },
  monthBlock: { gap: 2 },
  monthHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 6 },
  monthTitle: { fontSize: 16, fontWeight: '600' },
  monthNav: { flexDirection: 'row', gap: 16 },
  disabled: { opacity: 0.35 },
  weekday: { fontSize: 12 },
  day: { width: '100%', maxWidth: 50, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  dayLabel: { fontSize: 16 },
  dayLabelStrong: { fontWeight: '600' },
  timeRow: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 8 },
  timeLabel: { flex: 1, fontSize: 16 },
  timePill: { borderRadius: 8, paddingVertical: 6, paddingHorizontal: 12 },
  timeValue: { fontSize: 16, fontWeight: '600' },
});
