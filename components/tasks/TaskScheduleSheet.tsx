import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatTaskTime } from '@/lib/dateTimeUtils';
import {
    customPayload,
    defaultRecurrenceNone,
    formatEveryIntervalRu,
    formatRecurrenceSummaryCompactRu,
    getRecurrenceHighlightDateKeysForMonth,
    presetToPayload,
    RECURRENCE_PRESET_OPTIONS,
    type RecurrenceCustomUnit,
    type TaskRecurrencePayload,
} from '@/lib/task-recurrence';
import {
    buildMonthCells,
    formatDateLabelRu,
    MONTHS_NOMINATIVE,
    nextMondayAfterToday,
    nextWeekendDayKey,
    parseTimeIntoDate,
    WEEKDAY_SHORT,
} from '@/lib/task-schedule-helpers';

export type TaskScheduleSheetColors = {
  sheetBackground: string;
  bannerBackground: string;
  border: string;
  primary: string;
  text: string;
  textMuted: string;
};

export type TaskScheduleSheetContentProps = {
  /** Когда false — сбрасываем вложенный выбор времени (как при закрытии шита). */
  active: boolean;
  colors: TaskScheduleSheetColors;
  bottomInset: number;
  todayKey: string;
  tomorrowKey: string;
  scheduledDate: string | null;
  onScheduledDateChange: (dateKey: string | null) => void;
  scheduledTime: string;
  onScheduledTimeChange: (time: string) => void;
  calendarMonth: Date;
  onCalendarMonthChange: (d: Date) => void;
  onClosePress: () => void;
  onConfirmPress: () => void;
  recurrence: TaskRecurrencePayload;
  onRecurrenceChange: (next: TaskRecurrencePayload) => void;
};

/**
 * Тело шита «Срок» — то же, что в быстром создании задачи.
 * Строка «Время» открывает системный/спиннер выбор времени: на iOS это отдельная модалка поверх шита
 * (ограничение @react-native-community/datetimepicker), на Android — системный диалог.
 */
export function TaskScheduleSheetContent({
  active,
  colors,
  bottomInset,
  todayKey,
  tomorrowKey,
  scheduledDate,
  onScheduledDateChange,
  scheduledTime,
  onScheduledTimeChange,
  calendarMonth,
  onCalendarMonthChange,
  onClosePress,
  onConfirmPress,
  recurrence,
  onRecurrenceChange,
}: TaskScheduleSheetContentProps) {
  const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);
  const [repeatMenuOpen, setRepeatMenuOpen] = useState(false);
  const [customRepeatOpen, setCustomRepeatOpen] = useState(false);
  const [customInterval, setCustomInterval] = useState(1);
  const [customUnit, setCustomUnit] = useState<RecurrenceCustomUnit>('day');
  const [customWeekdays, setCustomWeekdays] = useState<number[]>([1]);

  const intervalValues = useMemo(() => Array.from({ length: 365 }, (_, i) => i + 1), []);

  const unitPickerItems = useMemo(
    () =>
      [
        { value: 'day' as const, label: 'Дней' },
        { value: 'week' as const, label: 'Недель' },
        { value: 'month' as const, label: 'Месяцев' },
      ] as const,
    []
  );

  const customEveryTitle = useMemo(
    () => formatEveryIntervalRu(customInterval, customUnit),
    [customInterval, customUnit]
  );

  useEffect(() => {
    if (!active) {
      setShowScheduleTimePicker(false);
      setRepeatMenuOpen(false);
      setCustomRepeatOpen(false);
    }
  }, [active]);

  const openCustomEditor = useCallback(() => {
    if (recurrence.recurrence_type === 'custom') {
      const n = Math.min(365, Math.max(1, recurrence.recurrence_interval ?? 1));
      setCustomInterval(n);
      setCustomUnit((recurrence.recurrence_custom_unit as RecurrenceCustomUnit) ?? 'day');
      setCustomWeekdays(
        recurrence.recurrence_weekdays?.length ? [...recurrence.recurrence_weekdays] : [1]
      );
    } else {
      setCustomInterval(1);
      setCustomUnit('day');
      setCustomWeekdays([1]);
    }
    setRepeatMenuOpen(false);
    setCustomRepeatOpen(true);
  }, [recurrence]);

  const applyCustomRepeat = useCallback(() => {
    const n = Math.min(365, Math.max(1, customInterval));
    let wds = customUnit === 'week' ? [...customWeekdays].sort((a, b) => a - b) : null;
    if (customUnit === 'week' && (!wds || wds.length === 0)) wds = [1];
    onRecurrenceChange(customPayload(n, customUnit, wds));
    setCustomRepeatOpen(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [customInterval, customUnit, customWeekdays, onRecurrenceChange]);

  const closeCustomRepeat = useCallback(() => {
    setCustomRepeatOpen(false);
    setRepeatMenuOpen(true);
  }, []);

  const toggleWeekday = useCallback((wd: number) => {
    setCustomWeekdays((prev) => {
      const set = new Set(prev);
      if (set.has(wd)) {
        if (set.size <= 1) return prev;
        set.delete(wd);
      } else {
        set.add(wd);
      }
      return [...set].sort((a, b) => a - b);
    });
    Haptics.selectionAsync();
  }, []);

  const weekendShortcutKey = useMemo(() => nextWeekendDayKey(todayKey), [todayKey]);
  const nextWeekShortcutKey = useMemo(() => nextMondayAfterToday(todayKey), [todayKey]);
  const monthCells = useMemo(
    () => buildMonthCells(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [calendarMonth]
  );

  const recurrenceHighlightKeys = useMemo(() => {
    if (!scheduledDate || recurrence.recurrence_type === 'none') return new Set<string>();
    return getRecurrenceHighlightDateKeysForMonth(
      calendarMonth.getFullYear(),
      calendarMonth.getMonth(),
      scheduledDate,
      recurrence
    );
  }, [scheduledDate, recurrence, calendarMonth]);

  const { sheetBackground, bannerBackground, border, primary, text, textMuted } = colors;

  const repeatDisabled = !scheduledDate;
  const repeatSummaryCompact = formatRecurrenceSummaryCompactRu(recurrence, { anchorDateKey: scheduledDate });

  return (
    <>
      <View style={styles.subSheetHeader}>
        <Pressable onPress={onClosePress} hitSlop={12} style={styles.subSheetHeaderBtn}>
          <MaterialIcons name="close" size={24} color={text} />
        </Pressable>
        <ThemedText style={[styles.subSheetHeaderTitle, { color: text }]}>Срок</ThemedText>
        <Pressable onPress={onConfirmPress} hitSlop={12} style={styles.subSheetHeaderBtn}>
          <MaterialIcons name="check" size={24} color={primary} />
        </Pressable>
      </View>

      <View style={[styles.selectedDateBanner, { backgroundColor: bannerBackground, borderColor: border }]}>
        <ThemedText style={[styles.selectedDateBannerText, { color: text }]}>
          {formatDateLabelRu(scheduledDate)}
        </ThemedText>
      </View>

      <ScrollView
        style={[styles.subScheduleScroll, { backgroundColor: sheetBackground }]}
        contentContainerStyle={styles.subSheetScrollContent}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
        showsVerticalScrollIndicator={false}
        bounces
      >
        <Pressable
          style={[styles.shortcutRow, { borderBottomColor: border }]}
          onPress={() => {
            onScheduledDateChange(tomorrowKey);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <MaterialIcons name="wb-sunny" size={22} color="#F9A825" />
          <ThemedText style={[styles.shortcutLabel, { color: text }]}>Завтра</ThemedText>
          <ThemedText style={[styles.shortcutHint, { color: textMuted }]}>
            {WEEKDAY_SHORT[new Date(tomorrowKey + 'T12:00:00').getDay()]}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.shortcutRow, { borderBottomColor: border }]}
          onPress={() => {
            onScheduledDateChange(weekendShortcutKey);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <MaterialIcons name="event-available" size={22} color="#42A5F5" />
          <ThemedText style={[styles.shortcutLabel, { color: text }]}>На выходных</ThemedText>
          <ThemedText style={[styles.shortcutHint, { color: textMuted }]}>
            {WEEKDAY_SHORT[new Date(weekendShortcutKey + 'T12:00:00').getDay()]}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.shortcutRow, { borderBottomColor: border }]}
          onPress={() => {
            onScheduledDateChange(nextWeekShortcutKey);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <MaterialIcons name="forward" size={22} color="#AB47BC" />
          <ThemedText style={[styles.shortcutLabel, { color: text }]}>Следующая неделя</ThemedText>
          <ThemedText style={[styles.shortcutHint, { color: textMuted }]}>
            {WEEKDAY_SHORT[new Date(nextWeekShortcutKey + 'T12:00:00').getDay()]}
          </ThemedText>
        </Pressable>

        <Pressable
          style={[styles.shortcutRow, { borderBottomColor: border }]}
          onPress={() => {
            onScheduledDateChange(null);
            onRecurrenceChange(defaultRecurrenceNone());
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <MaterialIcons name="event-busy" size={22} color={textMuted} />
          <ThemedText style={[styles.shortcutLabel, { color: text }]}>Без срока</ThemedText>
        </Pressable>

        <View style={styles.calendarHeader}>
          <Pressable
            onPress={() => {
              const d = new Date(calendarMonth);
              d.setMonth(d.getMonth() - 1);
              onCalendarMonthChange(d);
            }}
            hitSlop={8}
          >
            <MaterialIcons name="chevron-left" size={28} color={text} />
          </Pressable>
          <ThemedText style={[styles.calendarMonthTitle, { color: text }]}>
            {MONTHS_NOMINATIVE[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
          </ThemedText>
          <Pressable
            onPress={() => {
              const d = new Date(calendarMonth);
              d.setMonth(d.getMonth() + 1);
              onCalendarMonthChange(d);
            }}
            hitSlop={8}
          >
            <MaterialIcons name="chevron-right" size={28} color={text} />
          </Pressable>
        </View>

        <View style={styles.weekdayRow}>
          {['П', 'В', 'С', 'Ч', 'П', 'С', 'В'].map((l, i) => (
            <ThemedText key={`${l}-${i}`} style={[styles.weekdayCell, { color: textMuted }]}>
              {l}
            </ThemedText>
          ))}
        </View>

        <View style={styles.calendarGrid}>
          {monthCells.map((cell, idx) => {
            if (!cell.inMonth || !cell.dateKey) {
              return <View key={`e-${idx}`} style={styles.dayCell} />;
            }
            const selected = scheduledDate === cell.dateKey;
            const isToday = cell.dateKey === todayKey;
            const recurrenceHit = recurrenceHighlightKeys.has(cell.dateKey);
            const showRecurrenceRing = recurrenceHit && !selected;
            return (
              <Pressable
                key={cell.dateKey}
                onPress={() => {
                  onScheduledDateChange(cell.dateKey);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
                style={[
                  styles.dayCell,
                  selected && { backgroundColor: primary },
                  showRecurrenceRing && {
                    borderWidth: 1,
                    borderStyle: 'dotted',
                    borderColor: primary,
                  },
                  isToday && !selected && !showRecurrenceRing && { borderWidth: 1, borderColor: primary },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dayCellText,
                    { color: selected ? '#fff' : text },
                    recurrenceHit && !selected && !isToday && { fontWeight: '700' },
                    isToday && !selected && { color: primary, fontWeight: '700' },
                  ]}
                >
                  {cell.day}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          style={[styles.metaRow, { borderColor: border }]}
          onPress={() => setShowScheduleTimePicker(true)}
        >
          <MaterialIcons name="schedule" size={22} color={textMuted} />
          <ThemedText style={[styles.metaRowLabel, { color: text }]}>Время</ThemedText>
          <ThemedText style={[styles.metaRowValue, { color: textMuted }]}>{scheduledTime}</ThemedText>
          <MaterialIcons name="chevron-right" size={22} color={textMuted} />
        </Pressable>

        <Pressable
          style={[styles.metaRow, { borderColor: border, opacity: repeatDisabled ? 0.45 : 1 }]}
          disabled={repeatDisabled}
          onPress={() => {
            if (repeatDisabled) return;
            setRepeatMenuOpen(true);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          }}
        >
          <MaterialIcons name="repeat" size={22} color={textMuted} />
          <ThemedText style={[styles.metaRowLabelNarrow, { color: text }]}>Повтор</ThemedText>
          <ThemedText
            style={[styles.metaRowValue, styles.metaRowValueRight, { color: textMuted }]}
            numberOfLines={2}
            ellipsizeMode="tail"
          >
            {repeatDisabled ? 'Сначала дату' : repeatSummaryCompact}
          </ThemedText>
          <MaterialIcons name="unfold-more" size={22} color={textMuted} />
        </Pressable>
      </ScrollView>

      {Platform.OS === 'android' && showScheduleTimePicker ? (
        <DateTimePicker
          value={parseTimeIntoDate(scheduledDate || todayKey, scheduledTime)}
          mode="time"
          display="default"
          onChange={(event, date) => {
            setShowScheduleTimePicker(false);
            if (event.type === 'dismissed' || !date) return;
            onScheduledTimeChange(formatTaskTime(date));
          }}
        />
      ) : null}

      <Modal
        visible={repeatMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setRepeatMenuOpen(false)}
      >
        <View style={styles.timePickerRoot}>
          <Pressable
            style={styles.timePickerBackdrop}
            onPress={() => setRepeatMenuOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View
            style={[
              styles.repeatMenuSheet,
              {
                backgroundColor: bannerBackground,
                paddingBottom: Math.max(bottomInset, 12),
              },
            ]}
          >
            <ThemedText style={[styles.repeatMenuTitle, { color: text }]}>Повтор</ThemedText>
            {RECURRENCE_PRESET_OPTIONS.map((opt, idx) => (
              <Pressable
                key={opt.type}
                style={[
                  styles.repeatMenuRow,
                  { borderBottomColor: border },
                  idx === RECURRENCE_PRESET_OPTIONS.length - 1 && styles.repeatMenuRowLast,
                ]}
                onPress={() => {
                  if (opt.type === 'custom') {
                    openCustomEditor();
                    return;
                  }
                  onRecurrenceChange(presetToPayload(opt.type));
                  setRepeatMenuOpen(false);
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                }}
              >
                <ThemedText
                  style={[styles.repeatMenuLabel, { color: text }]}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {opt.label}
                </ThemedText>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>

      <Modal
        visible={customRepeatOpen}
        transparent
        animationType="slide"
        onRequestClose={closeCustomRepeat}
      >
        <View style={styles.timePickerRoot}>
          <Pressable
            style={styles.timePickerBackdrop}
            onPress={closeCustomRepeat}
            accessibilityRole="button"
            accessibilityLabel="Закрыть"
          />
          <View
            style={[
              styles.customRepeatSheetShell,
              {
                backgroundColor: bannerBackground,
                paddingBottom: Math.max(bottomInset, 12),
              },
            ]}
          >
            <View style={styles.subSheetHeader}>
              <Pressable onPress={closeCustomRepeat} hitSlop={12} style={styles.subSheetHeaderBtn}>
                <MaterialIcons name="arrow-back" size={24} color={text} />
              </Pressable>
              <ThemedText style={[styles.subSheetHeaderTitle, { color: text }]} numberOfLines={1}>
                Свой вариант
              </ThemedText>
              <Pressable onPress={applyCustomRepeat} hitSlop={12} style={styles.subSheetHeaderBtn}>
                <MaterialIcons name="check" size={24} color={primary} />
              </Pressable>
            </View>

            <View
              style={[
                styles.selectedDateBanner,
                styles.customEveryBanner,
                {
                  backgroundColor: sheetBackground,
                  borderColor: border,
                },
              ]}
            >
              <ThemedText style={[styles.customEveryBannerLabel, { color: textMuted }]}>Каждые</ThemedText>
              <ThemedText style={[styles.customEveryBannerValue, { color: primary }]} numberOfLines={1}>
                {customEveryTitle}
              </ThemedText>
            </View>

            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={styles.customRepeatScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.customPickerRow}>
                <Picker
                  selectedValue={customInterval}
                  onValueChange={(v) => {
                    setCustomInterval(Number(v));
                    Haptics.selectionAsync();
                  }}
                  style={Platform.OS === 'ios' ? styles.customPickerIOS : styles.customPickerAndroid}
                  itemStyle={
                    Platform.OS === 'ios'
                      ? { color: text, fontSize: 22 }
                      : undefined
                  }
                  {...(Platform.OS === 'ios' ? { selectionColor: primary } : {})}
                  {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                >
                  {intervalValues.map((n) => (
                    <Picker.Item
                      key={n}
                      label={String(n)}
                      value={n}
                      color={Platform.OS === 'ios' ? text : undefined}
                    />
                  ))}
                </Picker>
                <Picker
                  selectedValue={customUnit}
                  onValueChange={(v) => {
                    setCustomUnit(v as RecurrenceCustomUnit);
                    Haptics.selectionAsync();
                  }}
                  style={Platform.OS === 'ios' ? styles.customPickerIOS : styles.customPickerAndroid}
                  itemStyle={
                    Platform.OS === 'ios'
                      ? { color: text, fontSize: 22 }
                      : undefined
                  }
                  {...(Platform.OS === 'ios' ? { selectionColor: primary } : {})}
                  {...(Platform.OS === 'android' ? { mode: 'dropdown' as const } : {})}
                >
                  {unitPickerItems.map((u) => (
                    <Picker.Item
                      key={u.value}
                      label={u.label}
                      value={u.value}
                      color={Platform.OS === 'ios' ? text : undefined}
                    />
                  ))}
                </Picker>
              </View>

              {customUnit === 'week' ? (
                <>
                  <ThemedText style={[styles.customSectionLabel, { color: textMuted, marginTop: 8 }]}>
                    ДНИ НЕДЕЛИ
                  </ThemedText>
                  <View style={styles.weekdayRowPick}>
                    {(['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'] as const).map((label, i) => {
                      const wd = i + 1;
                      const selected = customWeekdays.includes(wd);
                      return (
                        <Pressable
                          key={wd}
                          onPress={() => toggleWeekday(wd)}
                          style={[
                            styles.weekdayChip,
                            { borderColor: border },
                            selected && { backgroundColor: primary, borderColor: primary },
                          ]}
                        >
                          <ThemedText
                            style={{ fontSize: 13, fontWeight: '700', color: selected ? '#fff' : text }}
                          >
                            {label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              ) : null}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {Platform.OS === 'ios' ? (
        <Modal
          visible={showScheduleTimePicker}
          transparent
          animationType="fade"
          onRequestClose={() => setShowScheduleTimePicker(false)}
        >
          <View style={styles.timePickerRoot}>
            <Pressable
              style={styles.timePickerBackdrop}
              onPress={() => setShowScheduleTimePicker(false)}
              accessibilityRole="button"
              accessibilityLabel="Закрыть выбор времени"
            />
            <View
              style={[
                styles.timePickerSheet,
                {
                  backgroundColor: bannerBackground,
                  paddingBottom: Math.max(bottomInset, 12),
                },
              ]}
            >
              <View style={[styles.timePickerToolbar, { borderBottomColor: border }]}>
                <Pressable
                  onPress={() => setShowScheduleTimePicker(false)}
                  hitSlop={12}
                  style={[styles.timePickerToolbarSide, { alignItems: 'flex-start' }]}
                >
                  <ThemedText style={{ color: primary, fontSize: 17 }}>Отмена</ThemedText>
                </Pressable>
                <ThemedText style={[styles.timePickerToolbarTitle, { color: text }]}>Время</ThemedText>
                <Pressable
                  onPress={() => setShowScheduleTimePicker(false)}
                  hitSlop={12}
                  style={[styles.timePickerToolbarSide, { alignItems: 'flex-end' }]}
                >
                  <ThemedText style={{ color: primary, fontSize: 17, fontWeight: '700' }}>Готово</ThemedText>
                </Pressable>
              </View>
              <View style={styles.timePickerWheelWrap}>
                <DateTimePicker
                  value={parseTimeIntoDate(scheduledDate || todayKey, scheduledTime)}
                  mode="time"
                  display="spinner"
                  onChange={(_, date) => {
                    if (date) onScheduledTimeChange(formatTaskTime(date));
                  }}
                  style={styles.timePickerIOS}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  subSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  subSheetHeaderBtn: { padding: 4 },
  subSheetHeaderTitle: { fontSize: 17, fontWeight: '700' },
  selectedDateBanner: {
    marginHorizontal: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectedDateBannerText: { fontSize: 16, fontWeight: '600' },
  subScheduleScroll: { maxHeight: 520, paddingHorizontal: 16 },
  subSheetScrollContent: { paddingBottom: 20, flexGrow: 1 },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  shortcutLabel: { flex: 1, fontSize: 16 },
  shortcutHint: { fontSize: 14, fontWeight: '500' },
  calendarHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    marginBottom: 8,
  },
  calendarMonthTitle: { fontSize: 16, fontWeight: '700' },
  weekdayRow: { flexDirection: 'row', marginBottom: 4 },
  weekdayCell: { flex: 1, textAlign: 'center', fontSize: 12, fontWeight: '600' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap', width: '100%', marginBottom: 16 },
  dayCell: {
    width: '14.28%',
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayCellText: { fontSize: 15 },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  metaRowLabel: { flex: 1, fontSize: 16 },
  /** Подпись слева без растягивания — значение уходит вправо (строка «Повтор»). */
  metaRowLabelNarrow: {
    fontSize: 16,
    fontWeight: '600',
    flexShrink: 0,
  },
  metaRowValue: { fontSize: 15, marginRight: 4 },
  metaRowValueRight: {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
    marginRight: 0,
  },
  timePickerRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  timePickerBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  timePickerSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
  },
  timePickerToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  timePickerToolbarSide: {
    flex: 1,
  },
  timePickerToolbarTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  timePickerWheelWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
  },
  timePickerIOS: {
    width: '100%',
    maxWidth: 320,
    height: 216,
  },
  repeatMenuSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingTop: 14,
    maxHeight: '70%',
  },
  repeatMenuTitle: {
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  repeatMenuRow: {
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  repeatMenuRowLast: {
    borderBottomWidth: 0,
  },
  repeatMenuLabel: {
    fontSize: 15,
    flexShrink: 1,
    paddingRight: 4,
  },
  customRepeatSheetShell: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    maxHeight: '92%',
  },
  customEveryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  customEveryBannerLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  customEveryBannerValue: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    textAlign: 'right',
  },
  customRepeatScrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  customSectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  customPickerRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    width: '100%',
    maxWidth: '100%',
  },
  customPickerIOS: {
    flex: 1,
    height: 216,
  },
  customPickerAndroid: {
    flex: 1,
    minHeight: 120,
    maxHeight: 220,
  },
  weekdayRowPick: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  weekdayChip: {
    minWidth: 40,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
});
