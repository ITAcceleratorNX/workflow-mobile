import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AdminSurveyTabs, type AdminSurveySection } from '@/components/surveys/admin-survey-tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ChipTabs } from '@/components/ui/chip-tabs';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { ThemedView } from '@/components/themed-view';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useProductUi } from '@/hooks/use-product-ui';
import { useToast } from '@/context/toast-context';
import { surveysApi } from '@/lib/surveys-api';
import { pluralRu, questionsCountLabel } from '@/lib/surveys/format';
import type { AdminSurvey, SurveyStatus } from '@/lib/surveys/types';

type SurveyFilter = 'all' | SurveyStatus;
const FILTERS: { value: SurveyFilter; label: string }[] = [
  { value: 'all', label: 'Все' },
  { value: 'draft', label: 'Черновики' },
  { value: 'published', label: 'Опубликованы' },
  { value: 'closed', label: 'Завершены' },
];

function statusLabel(status: SurveyStatus) {
  switch (status) {
    case 'draft': return 'Черновик';
    case 'published': return 'Опубликован';
    case 'closed': return 'Завершён';
  }
}

export default function AdminWorkerSurveysScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ui = useProductUi();
  const { show: showToast } = useToast();
  const [filter, setFilter] = useState<SurveyFilter>('all');
  const [closingSurvey, setClosingSurvey] = useState<AdminSurvey | null>(null);
  const [closing, setClosing] = useState(false);
  const status = filter === 'all' ? undefined : filter;
  const loadSurveys = useCallback(async () => {
    const result = await surveysApi.listAdminSurveys(status);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, [status]);
  const { data: surveys, loading, error, refresh } = useAsyncResource<AdminSurvey[]>(loadSurveys, []);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  const openEditor = useCallback((survey?: AdminSurvey) => {
    router.push({
      pathname: '/admin-worker/survey-editor',
      params: survey ? { mode: 'edit', id: String(survey.id) } : { mode: 'create' },
    });
  }, [router]);

  const changeSection = useCallback((section: AdminSurveySection) => {
    if (section === 'news') router.replace('/admin-worker/news');
  }, [router]);

  const closeSurvey = useCallback(async () => {
    if (!closingSurvey) return;
    setClosing(true);
    const result = await surveysApi.closeSurvey(closingSurvey.id);
    setClosing(false);
    if (!result.ok) {
      showToast({ title: 'Ошибка', description: result.error, variant: 'error', duration: 4000 });
      return;
    }
    showToast({ title: 'Опрос завершён', variant: 'success' });
    setClosingSurvey(null);
    void refresh();
  }, [closingSurvey, refresh, showToast]);

  return (
    <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
      <ScreenHeader title="Управление опросами" />
      <AdminSurveyTabs value="surveys" onChange={changeSection} />
      <ChipTabs
        value={filter}
        onChange={setFilter}
        accessibilityLabel="Фильтр опросов"
        tabs={FILTERS}
      />
      <Button
        title="Добавить опрос"
        onPress={() => openEditor()}
        variant="accent"
        size="block"
        leftIcon={<MaterialIcons name="add" size={20} color={ui.onAccent} />}
        style={styles.addButton}
      />

      {loading ? (
        <View style={styles.state}>
          <ActivityIndicator size="large" color={ui.accent} />
          <Text style={[styles.stateText, { color: ui.fg(0.55) }]}>Загрузка...</Text>
        </View>
      ) : error ? (
        <EmptyState
          icon="cloud-off"
          title="Не удалось загрузить опросы"
          description={error}
          action={<Button title="Повторить" onPress={() => void refresh()} variant="accent-outline" size="compact" />}
          style={styles.emptyState}
        />
      ) : surveys.length === 0 ? (
        <EmptyState
          icon="poll"
          title="Опросов пока нет"
          description="Создайте первый опрос для клиентов"
          action={<Button title="Добавить опрос" onPress={() => openEditor()} variant="accent" size="compact" />}
          style={styles.emptyState}
        />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {surveys.map((survey) => (
            <Card key={survey.id} padding="lg" style={[styles.card, { backgroundColor: ui.raised }]}>
              <View style={styles.cardTop}>
                <View style={[styles.status, { backgroundColor: survey.status === 'published' ? ui.success : survey.status === 'closed' ? ui.fg(0.1) : ui.accentSoft }]}>
                  <Text style={[styles.statusText, { color: survey.status === 'published' ? ui.onAccent : survey.status === 'closed' ? ui.fg(0.6) : ui.accentOnSoft }]}>
                    {statusLabel(survey.status)}
                  </Text>
                </View>
                <Text style={[styles.respondents, { color: ui.fg(0.55) }]}>
                  {questionsCountLabel(survey.questions_count)} · {survey.responses_count} {pluralRu(survey.responses_count, ['ответ', 'ответа', 'ответов'])}
                </Text>
              </View>
              <Text style={[styles.title, { color: ui.fg() }]}>{survey.title}</Text>
              {survey.description ? (
                <Text style={[styles.description, { color: ui.fg(0.6) }]} numberOfLines={3}>{survey.description}</Text>
              ) : null}
              <Text style={[styles.audience, { color: ui.fg(0.48) }]} numberOfLines={2}>
                {survey.all_offices ? 'Все офисы' : survey.offices.map((office) => office.name).join(', ')}
                {' · '}{survey.is_anonymous ? 'Анонимный' : 'Именной'}
              </Text>
              <View style={styles.actions}>
                {survey.status === 'draft' ? (
                  <Pressable onPress={() => openEditor(survey)} accessibilityRole="button" style={styles.action}>
                    <MaterialIcons name="edit" size={18} color={ui.accent} />
                    <Text style={[styles.actionLabel, { color: ui.accent }]}>Редактировать</Text>
                  </Pressable>
                ) : null}
                {survey.status === 'published' ? (
                  <Pressable onPress={() => setClosingSurvey(survey)} accessibilityRole="button" style={styles.action}>
                    <MaterialIcons name="stop-circle" size={18} color={ui.accent} />
                    <Text style={[styles.actionLabel, { color: ui.accent }]}>Завершить</Text>
                  </Pressable>
                ) : null}
                {survey.status !== 'draft' ? (
                  <Pressable
                    onPress={() => router.push({ pathname: '/admin-worker/survey-results', params: { id: String(survey.id) } })}
                    accessibilityRole="button"
                    style={styles.action}
                  >
                    <MaterialIcons name="bar-chart" size={18} color={ui.accent} />
                    <Text style={[styles.actionLabel, { color: ui.accent }]}>Результаты</Text>
                  </Pressable>
                ) : null}
              </View>
            </Card>
          ))}
        </ScrollView>
      )}
      <ConfirmSheet
        visible={closingSurvey != null}
        onClose={() => setClosingSurvey(null)}
        title="Завершить опрос?"
        message={closingSurvey ? `«${closingSurvey.title}» больше не будет доступен клиентам. Ответы сохранятся.` : ''}
        confirmLabel="Завершить опрос"
        tone="accent"
        busy={closing}
        onConfirm={() => void closeSurvey()}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  addButton: { marginHorizontal: 16, marginTop: 14, marginBottom: 12 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  stateText: { fontSize: 15 },
  emptyState: { flex: 1, justifyContent: 'center', paddingBottom: 48 },
  list: { paddingHorizontal: 16, gap: 12 },
  card: { gap: 8 },
  cardTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  status: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
  respondents: { fontSize: 12 },
  title: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  description: { fontSize: 14, lineHeight: 19 },
  audience: { fontSize: 12, lineHeight: 17 },
  actions: { flexDirection: 'row', gap: 16, marginTop: 4, paddingTop: 8 },
  action: { minHeight: 36, flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionLabel: { fontSize: 14, fontWeight: '600' },
});
