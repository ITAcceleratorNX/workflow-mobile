import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Avatar,
  Card,
  DailyChart,
  endedNote,
  Meter,
  OpenSplitBar,
  PeriodBar,
  PriorityBars,
  SectionLabel,
  smallSampleNote,
  SolidTabs,
  StatsError,
  StatsLoading,
} from '@/components/tasks/stats/TaskStatsParts';
import { TaskStatsRangeSheet } from '@/components/tasks/stats/TaskStatsRangeSheet';
import { ChipTabs } from '@/components/ui/chip-tabs';
import { EmptyState } from '@/components/ui/empty-state';
import { useProductUi } from '@/hooks/use-product-ui';
import { useTaskStatsScreen, type StatsTab, type UseTaskStatsScreenResult } from '@/hooks/use-task-stats-screen';
import {
  asOfLabel,
  completedInPeriodHint,
  emptyTitle,
  periodPhrase,
  periodTitle,
  share,
  statsContent,
  type StatsPeriodKind,
  type TaskStats,
} from '@/lib/task-stats';

const PERIOD_TABS = [
  { value: 'week' as const, label: 'Неделя' },
  { value: 'month' as const, label: 'Месяц' },
  { value: 'custom' as const, label: 'Свои даты' },
];
const VIEW_TABS = [
  { value: 'my' as const, label: 'Моя' },
  { value: 'employees' as const, label: 'Сотрудники' },
];

/**
 * «Статистика задач» (Figma «Моя статистика», «Сотрудники отдела», «Статистика сотрудника» and the
 * states): own statistics, and for the head of a company or a department, an employee's.
 */
export default function TaskStatsScreen() {
  const page = useTaskStatsScreen();
  const ui = useProductUi();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [picker, setPicker] = useState({ open: false, key: 0 });
  const { employee, tab, period } = page;
  const showList = tab === 'employees' && !employee;
  const who = employee?.full_name ?? 'Мои задачи';
  // A fresh picker on each opening starts from the period on screen.
  const openPicker = () => setPicker((p) => ({ open: true, key: p.key + 1 }));
  const closePicker = () => setPicker((p) => ({ ...p, open: false }));

  return (
    <View style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: Math.max(insets.bottom, 24) + 16 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Pressable
          onPress={() => (employee ? page.selectEmployee(null) : router.back())}
          hitSlop={10}
          accessibilityRole="button"
          style={styles.back}
        >
          <MaterialIcons name="chevron-left" size={28} color={ui.accent} />
          <Text style={[styles.backLabel, { color: ui.accent }]}>{employee ? 'Сотрудники' : 'Назад'}</Text>
        </Pressable>

        {employee ? (
          <View style={styles.person}>
            <Avatar name={employee.full_name} size={48} />
            <View style={styles.personText}>
              <Text style={[styles.personName, { color: ui.fg() }]} numberOfLines={1} accessibilityRole="header">
                {employee.full_name}
              </Text>
              <Text style={[styles.personRole, { color: ui.fg(0.55) }]} numberOfLines={1}>
                {[employee.position, page.employeeDepartment?.department_name].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={[styles.title, { color: ui.fg() }]} accessibilityRole="header">
            Статистика задач
          </Text>
        )}

        {!page.signedIn ? (
          <EmptyState style={styles.message} icon="lock-outline" title="Войдите в аккаунт" description="Статистика доступна после входа" />
        ) : (
          <>
            {page.canViewEmployees && !employee ? (
              <SolidTabs<StatsTab> accessibilityLabel="Чья статистика" value={tab} options={VIEW_TABS} onSelect={page.setTab} />
            ) : null}

            {showList ? (
              <EmployeeList page={page} />
            ) : (
              <>
                <ChipTabs<StatsPeriodKind>
                  accessibilityLabel="Период"
                  value={period.kind}
                  tabs={PERIOD_TABS}
                  onChange={(kind) => (kind === 'custom' ? openPicker() : page.setPeriodKind(kind))}
                />
                <PeriodBar
                  title={periodTitle(period)}
                  subtitle={`${who} · ${asOfLabel(period, page.todayKey)}`}
                  onStep={period.kind === 'custom' ? undefined : page.stepPeriod}
                  onPress={period.kind === 'custom' ? openPicker : undefined}
                />
                <StatsBody page={page} />
              </>
            )}
          </>
        )}
      </ScrollView>

      <TaskStatsRangeSheet
        key={picker.key}
        visible={picker.open}
        initial={period}
        todayKey={page.todayKey}
        onClose={closePicker}
        onApply={(next) => {
          page.setPeriod(next);
          closePicker();
        }}
      />
    </View>
  );
}

function EmployeeList({ page }: { page: UseTaskStatsScreenResult }) {
  const ui = useProductUi();
  return (
    <View style={styles.list}>
      <View style={[styles.search, { backgroundColor: ui.surface }]}>
        <MaterialIcons name="search" size={20} color={ui.fg(0.45)} />
        <TextInput
          value={page.search}
          onChangeText={page.setSearch}
          placeholder="Поиск сотрудника"
          placeholderTextColor={ui.fg(0.4)}
          accessibilityLabel="Поиск сотрудника"
          autoCorrect={false}
          returnKeyType="search"
          style={[styles.searchInput, { color: ui.fg() }]}
        />
      </View>
      {page.departments.length === 0 ? (
        <Text style={[styles.nothing, { color: ui.fg(0.55) }]}>Никого не нашли</Text>
      ) : (
        page.departments.map((department) => (
          <View key={`${department.company_id}:${department.department_id ?? ''}`} style={styles.department}>
            <SectionLabel>{`${department.department_name} · ${department.employees.length}`}</SectionLabel>
            <View style={[styles.rows, { backgroundColor: ui.surface }]}>
              {department.employees.map((employee, index) => (
                <Pressable
                  key={employee.id}
                  accessibilityRole="button"
                  accessibilityLabel={[employee.full_name, employee.position].filter(Boolean).join(', ')}
                  onPress={() => page.selectEmployee(employee.id)}
                  style={({ pressed }) => [
                    styles.row,
                    index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.fg(0.12) },
                    pressed && { backgroundColor: ui.fg(0.05) },
                  ]}
                >
                  <Avatar name={employee.full_name} size={40} />
                  <View style={styles.personText}>
                    <Text style={[styles.rowName, { color: ui.fg() }]} numberOfLines={1}>{employee.full_name}</Text>
                    {employee.position ? (
                      <Text style={[styles.rowRole, { color: ui.fg(0.55) }]} numberOfLines={1}>{employee.position}</Text>
                    ) : null}
                  </View>
                  <MaterialIcons name="chevron-right" size={22} color={ui.fg(0.35)} />
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}
    </View>
  );
}

function StatsBody({ page }: { page: UseTaskStatsScreenResult }) {
  const { view } = page;
  if (!view || view.status === 'loading') return <StatsLoading />;
  if (view.status === 'error') return <StatsError reason={view.reason} onRetry={page.retry} />;
  const content = statsContent(view.stats);
  if (content === 'empty') {
    return (
      <EmptyState
        style={styles.message}
        icon="inbox"
        title={emptyTitle(page.period)}
        description="Статистика появится, когда будут назначены задачи со сроком в этом периоде"
      />
    );
  }
  return <StatsSections stats={view.stats} page={page} noDue={content === 'noDue'} />;
}

function StatsSections({ stats, page, noDue }: { stats: TaskStats; page: UseTaskStatsScreenResult; noDue: boolean }) {
  const ui = useProductUi();
  const { period, todayKey } = page;
  const phrase = periodPhrase(period, todayKey);
  const sample = smallSampleNote(stats, phrase);
  const ended = endedNote(stats);
  const chartLabel = period.kind === 'month' ? periodTitle(period).split(' ')[0].toLowerCase() : periodTitle(period);
  const muted = { color: ui.fg(0.55) };
  const divider = { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.fg(0.12) };

  return (
    <View style={styles.sections}>
      <SectionLabel>Показатели</SectionLabel>
      <Card>
        <Text style={[styles.cardCaption, muted]}>Процент выполнения</Text>
        {noDue ? (
          <>
            <Text style={[styles.notComputed, { color: ui.fg(0.85) }]}>Не рассчитывается</Text>
            <Text style={[styles.note, muted]}>
              {phrase[0].toUpperCase() + phrase.slice(1)} нет задач со сроком. Процент и показатели появятся, когда у задач будет срок в этом периоде
            </Text>
          </>
        ) : (
          <>
            <View style={styles.percentRow}>
              <Text style={[styles.percent, { color: ui.fg() }]}>{stats.completion_percent}%</Text>
              <Text style={[styles.percentOf, { color: ui.fg(0.8) }]}>
                выполнено {stats.completed} из {stats.total}
              </Text>
            </View>
            <Meter value={share(stats.completed, stats.total)} style={styles.gapTop} />
            <Text style={[styles.note, muted]}>
              {sample ?? `${stats.total} — все задачи${page.employee ? ' сотрудника' : ''} со сроком ${phrase}: и выполненные, и нет`}
            </Text>

            <View style={[styles.metricRow, divider]}>
              <View style={styles.metricLabel}>
                <View style={[styles.dot, { backgroundColor: ui.done }]} />
                <Text style={[styles.metricText, { color: ui.fg() }]}>Выполнено вовремя</Text>
              </View>
              <Text style={[styles.metricText, muted]}>
                {stats.completed > 0 ? (
                  <>
                    <Text style={[styles.strong, { color: ui.fg() }]}>{stats.completed_on_time}</Text> из {stats.completed}
                  </>
                ) : (
                  '—'
                )}
              </Text>
            </View>
            <View style={[styles.metricRow, divider]}>
              <View style={styles.metricLabel}>
                <View style={[styles.dot, { backgroundColor: ui.fg(0.45) }]} />
                <Text style={[styles.metricText, { color: ui.fg() }]}>Не выполнено</Text>
              </View>
              <Text style={[styles.metricText, muted]}>
                <Text style={[styles.strong, { color: ui.fg() }]}>{stats.not_completed}</Text> из {stats.total}
              </Text>
            </View>
            <OpenSplitBar stats={stats} />
            <View style={styles.legend}>
              <View style={styles.metricLabel}>
                <View style={[styles.square, { backgroundColor: ui.fg(0.45) }]} />
                <Text style={[styles.legendText, muted]}>{stats.on_track} в срок</Text>
              </View>
              <View style={styles.metricLabel}>
                <View style={[styles.square, { backgroundColor: stats.overdue > 0 ? ui.danger : ui.fg(0.3) }]} />
                <Text style={[styles.legendText, { color: stats.overdue > 0 ? ui.danger : ui.fg(0.55) }]}>{stats.overdue} просрочено</Text>
              </View>
            </View>
            {ended ? <Text style={[styles.note, muted]}>{ended}</Text> : null}
          </>
        )}
      </Card>

      <SectionLabel>Отдельно от процента</SectionLabel>
      <Card style={styles.separate}>
        <SeparateRow title="Выполнено за период" hint={completedInPeriodHint(period, todayKey)} value={stats.completed_in_period} />
        <SeparateRow title="Без срока" hint="Открытые задачи без дедлайна, в процент не входят" value={stats.without_due} divided />
      </Card>

      <SectionLabel>Графики</SectionLabel>
      <Card>
        <Text style={[styles.chartTitle, { color: ui.fg() }]}>Динамика выполнения</Text>
        <Text style={[styles.chartCaption, muted]}>Завершено задач по дням · {chartLabel}</Text>
        <DailyChart stats={stats} period={period} />
      </Card>
      <Card>
        <Text style={[styles.chartTitle, { color: ui.fg() }]}>По приоритетам</Text>
        <Text style={[styles.chartCaption, muted, stats.total === 0 && styles.noMargin]}>
          {stats.total > 0 ? 'Выполнено из задач со сроком в периоде' : 'Нет задач со сроком в этом периоде'}
        </Text>
        {stats.total > 0 ? <PriorityBars stats={stats} /> : null}
      </Card>
    </View>
  );
}

function SeparateRow({ title, hint, value, divided = false }: { title: string; hint: string; value: number; divided?: boolean }) {
  const ui = useProductUi();
  return (
    <View style={[styles.separateRow, divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.fg(0.12) }]}>
      <View style={styles.personText}>
        <Text style={[styles.separateTitle, { color: ui.fg() }]}>{title}</Text>
        <Text style={[styles.separateHint, { color: ui.fg(0.55) }]}>{hint}</Text>
      </View>
      <Text style={[styles.separateValue, { color: ui.fg() }]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 16, gap: 16 },
  back: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', minHeight: 44, marginLeft: -6 },
  backLabel: { fontSize: 18 },
  title: { fontSize: 30, fontWeight: '700', lineHeight: 36 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  personText: { flex: 1, minWidth: 0 },
  personName: { fontSize: 22, fontWeight: '700' },
  personRole: { fontSize: 14, marginTop: 2 },
  message: { paddingVertical: 80 },
  list: { gap: 14 },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 12, paddingHorizontal: 14, minHeight: 48 },
  searchInput: { flex: 1, fontSize: 17, paddingVertical: 10 },
  nothing: { textAlign: 'center', paddingVertical: 32, fontSize: 14 },
  department: { gap: 10 },
  rows: { borderRadius: 18, overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowName: { fontSize: 17, fontWeight: '600' },
  rowRole: { fontSize: 14, marginTop: 1 },
  sections: { gap: 16 },
  cardCaption: { fontSize: 15 },
  notComputed: { fontSize: 26, fontWeight: '700', marginTop: 8 },
  percentRow: { flexDirection: 'row', alignItems: 'baseline', gap: 12, marginTop: 4 },
  percent: { fontSize: 44, fontWeight: '700' },
  percentOf: { fontSize: 17 },
  gapTop: { marginTop: 12 },
  note: { fontSize: 13, lineHeight: 18, marginTop: 12 },
  metricRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, paddingTop: 16, marginBottom: 12 },
  metricLabel: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  metricText: { fontSize: 17 },
  strong: { fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  square: { width: 8, height: 8, borderRadius: 2 },
  legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  legendText: { fontSize: 13 },
  separate: { paddingVertical: 4 },
  separateRow: { flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 14 },
  separateTitle: { fontSize: 17, fontWeight: '600' },
  separateHint: { fontSize: 13, lineHeight: 18, marginTop: 2 },
  separateValue: { fontSize: 22, fontWeight: '700' },
  chartTitle: { fontSize: 18, fontWeight: '600' },
  chartCaption: { fontSize: 13, marginTop: 2, marginBottom: 16 },
  noMargin: { marginBottom: 0 },
});
