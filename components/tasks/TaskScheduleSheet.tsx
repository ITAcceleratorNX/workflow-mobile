import DateTimePicker from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { formatTaskTime } from '@/lib/dateTimeUtils';
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
}: TaskScheduleSheetContentProps) {
  const [showScheduleTimePicker, setShowScheduleTimePicker] = useState(false);

  useEffect(() => {
    if (!active) setShowScheduleTimePicker(false);
  }, [active]);

  const weekendShortcutKey = useMemo(() => nextWeekendDayKey(todayKey), [todayKey]);
  const nextWeekShortcutKey = useMemo(() => nextMondayAfterToday(todayKey), [todayKey]);
  const monthCells = useMemo(
    () => buildMonthCells(calendarMonth.getFullYear(), calendarMonth.getMonth()),
    [calendarMonth]
  );

  const { sheetBackground, bannerBackground, border, primary, text, textMuted } = colors;

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
                  isToday && !selected && { borderWidth: 1, borderColor: primary },
                ]}
              >
                <ThemedText
                  style={[
                    styles.dayCellText,
                    { color: selected ? '#fff' : text },
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
  metaRowValue: { fontSize: 15, marginRight: 4 },
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
});
