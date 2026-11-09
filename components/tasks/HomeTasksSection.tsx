import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useCurrentTaskDay } from '@/hooks/use-current-task-day';
import { useProductUi } from '@/hooks/use-product-ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodayTasks } from '@/hooks/use-today-tasks';
import { formatDue, isTaskOverdue, taskDue } from '@/lib/task-due';
import type { UserTask } from '@/lib/user-tasks-api';

const TASK_PREVIEW_LIMIT = 3;

function TaskPreviewRow({ task, todayKey, onPress }: { task: UserTask; todayKey: string; onPress: () => void }) {
  const ui = useProductUi();
  const danger = useThemeColor({}, 'danger');
  const warning = useThemeColor({}, 'warning');
  const success = useThemeColor({}, 'success');
  const muted = ui.fg(0.5);
  const due = taskDue(task);
  const overdue = isTaskOverdue(task);
  const flagColor = overdue ? danger : task.priority === 'high' ? danger : task.priority === 'medium' ? warning : success;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${task.title}, ${formatDue(due, todayKey, ', ')}`}
      onPress={onPress}
      style={({ pressed }) => [styles.taskRow, pressed && styles.pressed]}
    >
      <View style={styles.taskCopy}>
        <Text numberOfLines={1} style={[styles.taskTitle, { color: ui.fg(0.96) }]}>{task.title}</Text>
        {due ? (
          <Text numberOfLines={1} style={[styles.taskDue, { color: overdue ? danger : muted }]}>
            {formatDue(due, todayKey, ', ')}
          </Text>
        ) : null}
      </View>
      <MaterialIcons name="flag" size={20} color={flagColor} accessibilityElementsHidden />
    </Pressable>
  );
}

function TaskSkeleton() {
  const ui = useProductUi();
  return (
    <View accessibilityLabel="Загружаем задачи" style={styles.skeletonContent}>
      <View style={[styles.skeletonCount, { backgroundColor: ui.raised }]} />
      <View style={[styles.skeletonTrack, { backgroundColor: ui.raised }]} />
      {[0, 1].map((item) => (
        <View key={item} style={styles.skeletonRow}>
          <View style={[styles.skeletonTitle, { backgroundColor: ui.raised }]} />
          <View style={[styles.skeletonSubtitle, { backgroundColor: ui.raised }]} />
        </View>
      ))}
    </View>
  );
}

export function HomeTasksSection() {
  const ui = useProductUi();
  const router = useRouter();
  const todayKey = useCurrentTaskDay();
  const { tasks, stats, loading, error, refresh } = useTodayTasks();
  const openTasks = tasks.filter((task) => !task.completed).slice(0, TASK_PREVIEW_LIMIT);
  const percent = stats.todayTotal > 0
    ? Math.min(100, Math.round((stats.todayCompleted / stats.todayTotal) * 100))
    : 0;
  const hasTasks = stats.todayTotal > 0;

  const openTaskList = () => router.push({ pathname: '/client/tasks', params: { view: 'list', tab: 'today' } });
  const openComposer = () => router.push({ pathname: '/client/tasks', params: { view: 'list', tab: 'today', compose: '1' } });
  const openTask = (task: UserTask) => router.push({ pathname: '/client/tasks/details', params: { taskId: String(task.id) } });

  return (
    <View style={styles.section}>
      <View style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.fg(0.06) }]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Открыть задачи на сегодня"
          onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openTaskList(); }}
          style={({ pressed }) => [styles.header, pressed && styles.pressed]}
        >
          <View style={[styles.iconWrap, { backgroundColor: ui.accentSoft }]}>
            <MaterialIcons name="task-alt" size={28} color={ui.accent} />
          </View>
          <Text style={[styles.headerTitle, { color: ui.fg() }]}>Мои задачи</Text>
          <MaterialIcons name="chevron-right" size={28} color={ui.fg(0.3)} />
        </Pressable>

        {loading && !hasTasks ? (
          <TaskSkeleton />
        ) : error && !hasTasks ? (
          <View style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: ui.fg(0.72) }]}>Не удалось загрузить задачи</Text>
            <Text style={[styles.emptySubtitle, { color: ui.fg(0.5) }]} numberOfLines={2}>{error}</Text>
            <Pressable onPress={() => void refresh()} accessibilityRole="button" style={styles.createAction}>
              <Text style={[styles.createActionText, { color: ui.accent }]}>Повторить</Text>
            </Pressable>
          </View>
        ) : !hasTasks ? (
          <View style={styles.emptyContent}>
            <Text style={[styles.emptyTitle, { color: ui.fg(0.78) }]}>На сегодня задач нет</Text>
            <Text style={[styles.emptySubtitle, { color: ui.fg(0.5) }]}>Здесь появится прогресс по задачам</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => { void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openComposer(); }}
              style={({ pressed }) => [styles.createAction, pressed && styles.pressed]}
            >
              <MaterialIcons name="add" size={24} color={ui.accent} />
              <Text style={[styles.createActionText, { color: ui.accent }]}>Создать задачу</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.progressContent}>
            <View style={styles.progressSummary}>
              <Text style={[styles.progressCount, { color: ui.fg() }]}>{stats.todayCompleted} из {stats.todayTotal}</Text>
              <Text style={[styles.progressLabel, { color: ui.fg(0.5) }]}>выполнено</Text>
              <Text style={[styles.progressPercent, { color: ui.accent }]}>{percent}%</Text>
            </View>
            <View
              accessibilityRole="progressbar"
              accessibilityValue={{ min: 0, max: 100, now: percent }}
              style={[styles.progressTrack, { backgroundColor: ui.accentSoft }]}
            >
              <View style={[styles.progressBar, { width: `${percent}%`, backgroundColor: ui.accent }]} />
            </View>

            {error ? (
              <View accessibilityRole="alert" style={styles.inlineError}>
                <Text style={[styles.errorText, { color: ui.fg(0.6) }]} numberOfLines={2}>{error}</Text>
                <Pressable onPress={() => void refresh()} accessibilityRole="button">
                  <Text style={[styles.retryText, { color: ui.accent }]}>Повторить</Text>
                </Pressable>
              </View>
            ) : null}

            {openTasks.length > 0 ? (
              <View style={styles.taskList}>
                {openTasks.map((task, index) => (
                  <View key={task.id}>
                    {index > 0 ? <View style={[styles.separator, { backgroundColor: ui.fg(0.06) }]} /> : null}
                    <TaskPreviewRow task={task} todayKey={todayKey} onPress={() => openTask(task)} />
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: 16, marginTop: 16 },
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, padding: 16 },
  header: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, fontSize: 20, lineHeight: 25, fontWeight: '700' },
  pressed: { opacity: 0.78 },
  progressContent: { marginTop: 14 },
  progressSummary: { minHeight: 42, flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  progressCount: { fontSize: 28, lineHeight: 34, fontWeight: '700' },
  progressLabel: { flex: 1, fontSize: 15, lineHeight: 20 },
  progressPercent: { fontSize: 19, lineHeight: 24, fontWeight: '700' },
  progressTrack: { height: 8, borderRadius: 999, overflow: 'hidden', marginTop: 8, marginBottom: 14 },
  progressBar: { height: '100%', borderRadius: 999 },
  taskList: { gap: 0 },
  taskRow: { minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  taskCopy: { flex: 1, minWidth: 0, gap: 3 },
  taskTitle: { fontSize: 16, lineHeight: 22, fontWeight: '500' },
  taskDue: { fontSize: 14, lineHeight: 19 },
  separator: { height: StyleSheet.hairlineWidth },
  emptyContent: { minHeight: 160, paddingTop: 18, paddingBottom: 4, justifyContent: 'space-between' },
  emptyTitle: { fontSize: 17, lineHeight: 23 },
  emptySubtitle: { marginTop: 2, fontSize: 15, lineHeight: 21 },
  createAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, marginTop: 16 },
  createActionText: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  inlineError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 8 },
  errorText: { flex: 1, fontSize: 12 },
  retryText: { fontSize: 13, fontWeight: '600' },
  skeletonContent: { marginTop: 16 },
  skeletonCount: { width: '42%', height: 26, borderRadius: 8 },
  skeletonTrack: { height: 8, borderRadius: 999, marginTop: 12, marginBottom: 14 },
  skeletonRow: { paddingVertical: 12, gap: 7 },
  skeletonTitle: { width: '72%', height: 15, borderRadius: 8 },
  skeletonSubtitle: { width: '45%', height: 12, borderRadius: 8 },
});
