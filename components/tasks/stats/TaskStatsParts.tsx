import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';

import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';
import { useProductUi } from '@/hooks/use-product-ui';
import { chartTicks, initials, plural, share, SMALL_SAMPLE, type StatsPeriod, type TaskPriority, type TaskStats } from '@/lib/task-stats';

const PRIORITY_LABEL: Record<TaskPriority, string> = { high: 'Высокий', medium: 'Средний', low: 'Низкий' };
const AMBER = '#F59E0B';
const TICK_WIDTH = 44;

/** One choice of two on a dark track, the chosen one solid accent (Figma «Моя / Сотрудники»). */
export function SolidTabs<T extends string>({
  value,
  options,
  onSelect,
  accessibilityLabel,
}: {
  value: T;
  options: readonly { value: T; label: string }[];
  onSelect: (value: T) => void;
  accessibilityLabel: string;
}) {
  const ui = useProductUi();
  return (
    <View accessibilityRole="tablist" accessibilityLabel={accessibilityLabel} style={[styles.solidTrack, { backgroundColor: ui.surface, borderColor: ui.fg(0.1) }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => {
              if (selected) return;
              void Haptics.selectionAsync();
              onSelect(option.value);
            }}
            style={({ pressed }) => [styles.solidOption, selected && { backgroundColor: ui.accent }, pressed && !selected && { opacity: 0.7 }]}
          >
            <Text style={[styles.solidLabel, { color: selected ? ui.onAccent : ui.fg(0.65) }, selected && styles.solidLabelSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** ‹ «Октябрь 2026» › with the person and the checkpoint under the title; own dates open the picker instead. */
export function PeriodBar({
  title,
  subtitle,
  onStep,
  onPress,
}: {
  title: string;
  subtitle: string;
  onStep?: (delta: -1 | 1) => void;
  onPress?: () => void;
}) {
  const ui = useProductUi();
  const arrow = (delta: -1 | 1) =>
    onStep ? (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={delta < 0 ? 'Предыдущий период' : 'Следующий период'}
        hitSlop={6}
        onPress={() => onStep(delta)}
        style={({ pressed }) => [styles.arrow, pressed && { opacity: 0.6 }]}
      >
        <MaterialIcons name={delta < 0 ? 'chevron-left' : 'chevron-right'} size={26} color={ui.accent} />
      </Pressable>
    ) : (
      <View style={styles.arrow} />
    );
  const label = (
    <View style={styles.periodText} accessibilityLiveRegion="polite">
      <Text style={[styles.periodTitle, { color: ui.fg() }]} numberOfLines={1}>{title}</Text>
      <Text style={[styles.periodSubtitle, { color: ui.fg(0.55) }]} numberOfLines={1}>{subtitle}</Text>
    </View>
  );
  return (
    <View style={[styles.periodBar, { backgroundColor: ui.surface }]}>
      {arrow(-1)}
      {onPress ? (
        <Pressable accessibilityRole="button" accessibilityHint="Выбрать другие даты" onPress={onPress} style={styles.periodText}>
          {label}
        </Pressable>
      ) : (
        label
      )}
      {arrow(1)}
    </View>
  );
}

export function Avatar({ name, size }: { name: string; size: number }) {
  const ui = useProductUi();
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: ui.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: ui.accentOnSoft, fontWeight: '700', fontSize: size * 0.36 }}>{initials(name)}</Text>
    </View>
  );
}

export function SectionLabel({ children }: { children: string }) {
  const ui = useProductUi();
  return (
    <Text accessibilityRole="header" style={[styles.section, { color: ui.fg(0.45) }]}>
      {children}
    </Text>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ui = useProductUi();
  return <View style={[styles.card, { backgroundColor: ui.surface }, style]}>{children}</View>;
}

export function Meter({ value, color, style }: { value: number; color?: string; style?: StyleProp<ViewStyle> }) {
  const ui = useProductUi();
  return (
    <View style={[styles.meter, { backgroundColor: ui.fg(0.1) }, style]}>
      <View style={[styles.meterFill, { width: `${value * 100}%`, backgroundColor: color ?? ui.accent }]} />
    </View>
  );
}

/** Not completed, split into «в срок» (grey) and «просрочено» (red), as one bar. */
export function OpenSplitBar({ stats }: { stats: TaskStats }) {
  const ui = useProductUi();
  return (
    <View style={[styles.meter, styles.split, { backgroundColor: ui.fg(0.1) }]}>
      {stats.on_track > 0 ? <View style={{ width: `${share(stats.on_track, stats.not_completed) * 100}%`, backgroundColor: ui.fg(0.4) }} /> : null}
      {stats.overdue > 0 ? <View style={{ flex: 1, backgroundColor: ui.danger }} /> : null}
    </View>
  );
}

/** «Всего 2 задачи на этой неделе — процент меняется от каждой задачи». */
export function smallSampleNote(stats: TaskStats, phrase: string): string | null {
  if (stats.total === 0 || stats.total >= SMALL_SAMPLE) return null;
  return `Всего ${stats.total} ${plural(stats.total, 'задача', 'задачи', 'задач')} ${phrase} — процент меняется от каждой задачи`;
}

export function endedNote(stats: TaskStats): string | null {
  return stats.period.ended && stats.not_completed > 0 ? 'Период закончился — все невыполненные задачи уже просрочены' : null;
}

/** «Динамика выполнения»: completed tasks per day of the period, nothing invented for empty days. */
export function DailyChart({ stats, period, height = 120 }: { stats: TaskStats; period: StatsPeriod; height?: number }) {
  const ui = useProductUi();
  const days = stats.daily;
  const max = Math.max(0, ...days.map((d) => d.completed));
  const total = days.reduce((sum, d) => sum + d.completed, 0);
  const ticks = chartTicks(period, days.length);
  const dense = days.length > 40;

  return (
    <View>
      {total === 0 ? (
        <View style={[styles.chartEmpty, { height, borderBottomColor: ui.fg(0.1) }]}>
          <Text style={{ color: ui.fg(0.55), fontSize: 14 }}>В этом периоде задачи не завершались</Text>
        </View>
      ) : (
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={`Завершено ${total} ${plural(total, 'задача', 'задачи', 'задач')}, больше всего за день — ${max}`}
          style={[styles.bars, { height, gap: dense ? 1 : 3 }]}
        >
          {days.map((day) => (
            <View key={day.date} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  !dense && styles.barNarrow,
                  day.completed > 0
                    ? { height: `${Math.max(4, (day.completed / max) * 100)}%`, backgroundColor: ui.accent }
                    : { height: 3, borderRadius: 2, backgroundColor: ui.fg(0.1) },
                ]}
              />
            </View>
          ))}
        </View>
      )}
      <View style={styles.ticks} importantForAccessibility="no-hide-descendants">
        {ticks.map((tick, i) => {
          // Weekdays sit under their bars; the ends of a month or own dates align with the chart edges.
          const edge = period.kind === 'week' ? null : i === 0 ? 'left' : i === ticks.length - 1 ? 'right' : null;
          const position: TextStyle =
            edge === 'left'
              ? { left: 0 }
              : edge === 'right'
                ? { right: 0 }
                : { left: `${((tick.index + 0.5) / days.length) * 100}%`, marginLeft: -TICK_WIDTH / 2 };
          return (
            <Text
              key={tick.index}
              style={[styles.tick, position, { color: ui.fg(0.45), textAlign: edge ?? 'center' }]}
              numberOfLines={1}
            >
              {tick.label}
            </Text>
          );
        })}
      </View>
    </View>
  );
}

/** «По приоритетам»: completed of the tasks due in the period, per level. */
export function PriorityBars({ stats }: { stats: TaskStats }) {
  const ui = useProductUi();
  const colors: Record<TaskPriority, string> = { high: ui.danger, medium: AMBER, low: ui.done };
  return (
    <View style={styles.priorities}>
      {stats.priorities.map((p) => (
        <View key={p.priority} style={styles.priority}>
          <View style={styles.priorityHead}>
            <Text style={[styles.priorityLabel, { color: ui.fg() }]}>{PRIORITY_LABEL[p.priority]}</Text>
            <Text style={[styles.priorityValue, { color: ui.fg(0.55) }]}>{p.total > 0 ? `${p.completed} из ${p.total}` : 'нет задач'}</Text>
          </View>
          {p.total > 0 ? <Meter value={share(p.completed, p.total)} color={colors[p.priority]} /> : null}
        </View>
      ))}
    </View>
  );
}

export function StatsLoading() {
  const ui = useProductUi();
  return (
    <View style={styles.loading} accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={ui.accent} />
      <Text style={{ color: ui.fg(0.55), fontSize: 14 }}>Загружаем статистику…</Text>
    </View>
  );
}

/** Network failure or no access: a message only, never the numbers of another filter. */
export function StatsError({ reason, onRetry }: { reason: 'forbidden' | 'failed'; onRetry: () => void }) {
  return reason === 'forbidden' ? (
    <EmptyState style={styles.message} icon="lock-outline" title="Нет доступа" description="Статистика этого сотрудника вам недоступна" />
  ) : (
    <EmptyState
      style={styles.message}
      icon="error-outline"
      title="Не удалось загрузить статистику"
      description="Проверьте подключение к интернету и попробуйте ещё раз"
      action={<Button title="Повторить" onPress={onRetry} variant="accent-outline" size="compact" />}
    />
  );
}

const styles = StyleSheet.create({
  solidTrack: { flexDirection: 'row', gap: 4, padding: 4, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  solidOption: { flex: 1, minHeight: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  solidLabel: { fontSize: 17, fontWeight: '500' },
  solidLabelSelected: { fontWeight: '600' },
  periodBar: { flexDirection: 'row', alignItems: 'center', borderRadius: 12, paddingHorizontal: 4, minHeight: 48 },
  arrow: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
  periodText: { flex: 1, alignItems: 'center', paddingVertical: 6 },
  periodTitle: { fontSize: 17, fontWeight: '600' },
  periodSubtitle: { fontSize: 12, marginTop: 1 },
  section: { fontSize: 13, fontWeight: '600', letterSpacing: 0.8, textTransform: 'uppercase', paddingHorizontal: 2 },
  card: { borderRadius: 18, padding: 18 },
  meter: { height: 8, borderRadius: 4, overflow: 'hidden' },
  meterFill: { height: '100%', borderRadius: 4 },
  split: { flexDirection: 'row', gap: 2 },
  chartEmpty: { alignItems: 'center', justifyContent: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  bars: { flexDirection: 'row', alignItems: 'flex-end' },
  barSlot: { flex: 1, height: '100%', alignItems: 'center', justifyContent: 'flex-end' },
  bar: { width: '100%', borderTopLeftRadius: 3, borderTopRightRadius: 3 },
  barNarrow: { maxWidth: 10 },
  ticks: { height: 16, marginTop: 8 },
  tick: { position: 'absolute', top: 0, width: TICK_WIDTH, fontSize: 11 },
  priorities: { gap: 16 },
  priority: { gap: 8 },
  priorityHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  priorityLabel: { fontSize: 17, fontWeight: '600' },
  priorityValue: { fontSize: 15 },
  loading: { paddingVertical: 64, alignItems: 'center', gap: 12 },
  message: { paddingVertical: 64 },
});
