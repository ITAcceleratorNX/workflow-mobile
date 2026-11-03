import { MaterialIcons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SurveyResultBar } from '@/components/ui/survey-result-bar';
import { useAsyncResource } from '@/hooks/use-async-resource';
import { useProductUi } from '@/hooks/use-product-ui';
import { surveysApi } from '@/lib/surveys-api';
import { DEFAULT_SCALE_LABELS, pluralRu } from '@/lib/surveys/format';
import { questionTypeLabel } from '@/lib/surveys/admin-editor';
import type { SurveyQuestionResult, SurveyResults, SurveyStatus } from '@/lib/surveys/types';

type ResultsTab = 'questions' | 'results';

function statusText(status: SurveyStatus) {
  if (status === 'published') return 'Опубликован';
  if (status === 'closed') return 'Завершён';
  return 'Черновик';
}

function questionIcon(type: SurveyQuestionResult['type']): React.ComponentProps<typeof MaterialIcons>['name'] {
  switch (type) {
    case 'single_choice': return 'radio-button-checked';
    case 'multiple_choice': return 'check-box';
    case 'rating': return 'star-outline';
    case 'yes_no': return 'check-circle-outline';
    case 'text': return 'subject';
  }
}

function formatPublishedDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('ru-RU', {
    day: 'numeric',
    month: 'long',
    timeZone: 'Asia/Almaty',
  }).format(date);
}

function QuestionHeading({ question, index }: { question: SurveyQuestionResult; index: number }) {
  const ui = useProductUi();
  return (
    <>
      <View style={styles.questionKind}>
        <MaterialIcons name={questionIcon(question.type)} size={15} color={ui.accent} />
        <Text style={[styles.questionKindText, { color: ui.accent }]}>
          Вопрос {index + 1} · {questionTypeLabel(question.type)}
        </Text>
      </View>
      <Text style={[styles.questionTitle, { color: ui.fg() }]}>{question.text}</Text>
    </>
  );
}

function ReadOnlyQuestionCard({ question, index }: { question: SurveyQuestionResult; index: number }) {
  const ui = useProductUi();
  return (
    <Card padding="lg" style={[styles.questionCard, { backgroundColor: ui.raised }]}>
      <QuestionHeading question={question} index={index} />
      {question.type === 'single_choice' || question.type === 'multiple_choice' || question.type === 'yes_no' ? (
        <View style={styles.readOnlyOptions}>
          {question.options.map((option) => (
            <View key={option.id} style={[styles.readOnlyOption, { backgroundColor: ui.surface }]}>
              <Text style={[styles.readOnlyOptionText, { color: ui.fg(0.82) }]}>{option.text}</Text>
            </View>
          ))}
        </View>
      ) : question.type === 'rating' ? (
        <View style={styles.ratingLabels}>
          <Text style={[styles.readOnlyOptionText, { color: ui.fg(0.6) }]}>{question.scale_min_label ?? DEFAULT_SCALE_LABELS.min}</Text>
          <Text style={[styles.readOnlyOptionText, { color: ui.fg(0.6) }]}>{question.scale_max_label ?? DEFAULT_SCALE_LABELS.max}</Text>
        </View>
      ) : (
        <Text style={[styles.readOnlyOptionText, { color: ui.fg(0.5) }]}>Свободный текст</Text>
      )}
    </Card>
  );
}

function ChoiceResultCard({
  question,
  index,
}: {
  question: Extract<SurveyQuestionResult, { options: { id: number; text: string; count: number; percent: number }[] }>;
  index: number;
}) {
  const ui = useProductUi();
  const multiple = question.type === 'multiple_choice';
  const percentTotal = question.options.reduce((sum, option) => sum + option.percent, 0);
  const yes = question.options[0];
  const no = question.options[1];

  return (
    <Card padding="lg" style={[styles.questionCard, { backgroundColor: ui.raised }]}>
      <QuestionHeading question={question} index={index} />
      {multiple && percentTotal > 100 ? (
        <Text style={[styles.note, { color: ui.fg(0.48) }]}>Можно было выбрать несколько вариантов — сумма больше 100%</Text>
      ) : null}
      {question.type === 'yes_no' && yes && no ? (
        <>
          <View accessibilityRole="progressbar" style={[styles.stackedBar, { backgroundColor: ui.fg(0.2) }]}>
            <View style={[styles.stackedSegment, { width: `${yes.percent}%`, backgroundColor: ui.accent }]} />
            <View style={[styles.stackedSegment, { width: `${no.percent}%`, backgroundColor: ui.fg(0.32) }]} />
          </View>
          <View style={styles.legend}>
            {[yes, no].map((option, optionIndex) => (
              <View key={option.id} style={[styles.legendItem, optionIndex === 1 && styles.legendRight]}>
                <View style={[styles.legendDot, { backgroundColor: optionIndex === 0 ? ui.accent : ui.fg(0.32) }]} />
                <Text style={[styles.legendText, { color: ui.fg(0.72) }]}>
                  {option.text} · <Text style={[styles.legendCount, { color: ui.fg() }]}>{option.count}</Text> · {option.percent}%
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.bars}>
          {question.options.map((option) => (
            <SurveyResultBar key={option.id} label={option.text} count={option.count} percent={option.percent} />
          ))}
        </View>
      )}
    </Card>
  );
}

function RatingResultCard({ question, index }: { question: Extract<SurveyQuestionResult, { type: 'rating' }>; index: number }) {
  const ui = useProductUi();
  const average = question.average == null ? '—' : question.average.toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return (
    <Card padding="lg" style={[styles.questionCard, { backgroundColor: ui.raised }]}>
      <QuestionHeading question={question} index={index} />
      <View style={styles.averageRow}>
        <Text style={[styles.average, { color: ui.fg() }]}>{average}</Text>
        <Text style={[styles.averageCaption, { color: ui.fg(0.48) }]}>средняя оценка из 5</Text>
      </View>
      <View style={styles.bars}>
        {[...question.distribution].sort((a, b) => b.value - a.value).map((item) => (
          <SurveyResultBar
            key={item.value}
            label={`${item.value} ☆`}
            count={item.count}
            percent={item.percent}
          />
        ))}
      </View>
    </Card>
  );
}

function TextResultCard({
  question,
  index,
  expanded,
  onShowAll,
}: {
  question: Extract<SurveyQuestionResult, { type: 'text' }>;
  index: number;
  expanded: boolean;
  onShowAll: () => void;
}) {
  const ui = useProductUi();
  const visibleAnswers = expanded ? question.answers : question.answers.slice(0, 3);
  return (
    <Card padding="lg" style={[styles.questionCard, { backgroundColor: ui.raised }]}>
      <QuestionHeading question={question} index={index} />
      <Text style={[styles.note, { color: ui.fg(0.48) }]}>
        {question.answers.length} текстовых {pluralRu(question.answers.length, ['ответ', 'ответа', 'ответов'])}
      </Text>
      <View style={styles.textAnswers}>
        {visibleAnswers.map((answer, answerIndex) => (
          <View key={`${question.id}-${answerIndex}`} style={[styles.textAnswer, { backgroundColor: ui.surface }]}>
            <Text style={[styles.answerText, { color: ui.fg(0.82) }]}>{answer.text}</Text>
            {answer.respondent ? <Text style={[styles.respondent, { color: ui.fg(0.45) }]}>{answer.respondent.full_name}</Text> : null}
          </View>
        ))}
      </View>
      {!expanded && question.answers.length > 3 ? (
        <Button
          title={`Показать все ${question.answers.length} ${pluralRu(question.answers.length, ['ответ', 'ответа', 'ответов'])}`}
          onPress={onShowAll}
          variant="raised"
          size="block"
        />
      ) : null}
    </Card>
  );
}

function ResultQuestionCard({
  question,
  index,
  expanded,
  onShowAll,
}: {
  question: SurveyQuestionResult;
  index: number;
  expanded: boolean;
  onShowAll: () => void;
}) {
  if (question.type === 'rating') return <RatingResultCard question={question} index={index} />;
  if (question.type === 'text') return <TextResultCard question={question} index={index} expanded={expanded} onShowAll={onShowAll} />;
  return <ChoiceResultCard question={question} index={index} />;
}

function SummaryCard({ results }: { results: SurveyResults }) {
  const ui = useProductUi();
  const published = formatPublishedDate(results.survey.published_at);
  return (
    <Card padding="none" style={[styles.summaryCard, { backgroundColor: ui.raised }]}>
      <View style={styles.summaryItem}>
        <Text style={[styles.summaryLabel, { color: ui.fg(0.52) }]}>Ответов получено</Text>
        <Text style={[styles.summaryValue, { color: ui.fg() }]}>{results.survey.responses_count}</Text>
      </View>
      {results.survey.responses_count > 0 && published ? (
        <View style={[styles.summaryItem, styles.summaryDate, { borderLeftColor: ui.fg(0.1) }]}>
          <Text style={[styles.summaryLabel, { color: ui.fg(0.52) }]}>Опубликован</Text>
          <Text style={[styles.summaryDateValue, { color: ui.fg() }]}>{published}</Text>
        </View>
      ) : null}
    </Card>
  );
}

export function AdminSurveyResults() {
  const params = useLocalSearchParams<{ id?: string }>();
  const surveyId = typeof params.id === 'string' ? Number(params.id) : NaN;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ui = useProductUi();
  const [tab, setTab] = useState<ResultsTab>('results');
  const [expandedText, setExpandedText] = useState<Record<number, boolean>>({});

  const loadResults = useCallback(async () => {
    if (!Number.isInteger(surveyId) || surveyId < 1) throw new Error('Не удалось загрузить результаты');
    const result = await surveysApi.getResults(surveyId);
    if (!result.ok) throw new Error(result.error);
    return result.data;
  }, [surveyId]);
  const { data: results, loading, error, refresh } = useAsyncResource<SurveyResults | null>(loadResults, null);

  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));

  if (loading && !results) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
        <ScreenHeader title="Результаты" onBack={() => router.back()} />
        <View style={styles.state}><ActivityIndicator size="large" color={ui.accent} /></View>
      </ThemedView>
    );
  }

  if (error || !results) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
        <ScreenHeader title="Результаты" onBack={() => router.back()} />
        <EmptyState
          icon="cloud-off"
          title="Не удалось загрузить результаты"
          description={error ?? 'Не удалось загрузить данные'}
          action={<Button title="Повторить" onPress={() => void refresh()} variant="accent-outline" size="compact" />}
          style={styles.errorState}
        />
      </ThemedView>
    );
  }

  const showAllAnswers = (questionId: number) => setExpandedText((current) => ({ ...current, [questionId]: true }));
  const statusColor = results.survey.status === 'published' ? ui.success : results.survey.status === 'closed' ? ui.fg(0.58) : ui.accentOnSoft;
  const statusBackground = results.survey.status === 'published' ? ui.success : results.survey.status === 'closed' ? ui.fg(0.1) : ui.accentSoft;

  return (
    <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
      <ScreenHeader
        title={results.survey.title}
        onBack={() => router.back()}
        rightSlot={(
          <View style={[styles.status, { backgroundColor: statusBackground }]}>
            <Text style={[styles.statusText, { color: statusColor }]}>{statusText(results.survey.status)}</Text>
          </View>
        )}
      />
      <SegmentedControl
        value={tab}
        onChange={setTab}
        accessibilityLabel="Содержимое опроса"
        fill
        options={[
          { value: 'questions', label: 'Вопросы' },
          { value: 'results', label: 'Результаты' },
        ]}
        style={styles.tabs}
      />
      <SummaryCard results={results} />

      {tab === 'questions' ? (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {results.questions.map((question, index) => (
            <ReadOnlyQuestionCard key={question.id} question={question} index={index} />
          ))}
        </ScrollView>
      ) : results.survey.responses_count === 0 ? (
        <EmptyState
          icon="bar-chart"
          title="Пока нет ответов"
          description="Диаграммы и комментарии появятся, когда клиенты начнут проходить опрос"
          style={styles.noAnswers}
        />
      ) : (
        <ScrollView contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + 24 }]} showsVerticalScrollIndicator={false}>
          {results.questions.map((question, index) => (
            <ResultQuestionCard
              key={question.id}
              question={question}
              index={index}
              expanded={expandedText[question.id] ?? false}
              onShowAll={() => showAllAnswers(question.id)}
            />
          ))}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  state: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  errorState: { flex: 1, justifyContent: 'center', paddingBottom: 48 },
  noAnswers: { flex: 1, justifyContent: 'center', paddingHorizontal: 28, paddingBottom: 48 },
  status: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  statusText: { fontSize: 11, lineHeight: 14, fontWeight: '700' },
  tabs: { marginHorizontal: 16, marginBottom: 12 },
  summaryCard: { marginHorizontal: 16, marginBottom: 12, flexDirection: 'row' },
  summaryItem: { flex: 1, minHeight: 88, justifyContent: 'center', paddingHorizontal: 16, gap: 5 },
  summaryDate: { borderLeftWidth: StyleSheet.hairlineWidth },
  summaryLabel: { fontSize: 12, lineHeight: 16 },
  summaryValue: { fontSize: 30, lineHeight: 34, fontWeight: '700', fontVariant: ['tabular-nums'] },
  summaryDateValue: { fontSize: 16, fontWeight: '600' },
  list: { paddingHorizontal: 16, gap: 12 },
  questionCard: { gap: 12 },
  questionKind: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  questionKindText: { fontSize: 12, fontWeight: '700' },
  questionTitle: { fontSize: 16, lineHeight: 21, fontWeight: '700' },
  note: { fontSize: 12, lineHeight: 17 },
  bars: { gap: 10 },
  stackedBar: { height: 14, flexDirection: 'row', borderRadius: 7, overflow: 'hidden' },
  stackedSegment: { height: '100%' },
  legend: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  legendItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendRight: { justifyContent: 'flex-end' },
  legendDot: { width: 9, height: 9, borderRadius: 3 },
  legendText: { fontSize: 12, lineHeight: 17 },
  legendCount: { fontWeight: '700' },
  averageRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  average: { fontSize: 38, lineHeight: 44, fontWeight: '700', fontVariant: ['tabular-nums'] },
  averageCaption: { fontSize: 14 },
  textAnswers: { gap: 8 },
  textAnswer: { borderRadius: 12, paddingHorizontal: 12, paddingVertical: 11, gap: 6 },
  answerText: { fontSize: 14, lineHeight: 20 },
  respondent: { fontSize: 12, lineHeight: 16 },
  readOnlyOptions: { gap: 7 },
  readOnlyOption: { minHeight: 44, justifyContent: 'center', borderRadius: 11, paddingHorizontal: 13 },
  readOnlyOptionText: { fontSize: 14, lineHeight: 19 },
  ratingLabels: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
});
