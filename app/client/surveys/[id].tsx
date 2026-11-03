import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EmptyState } from '@/components/ui/empty-state';
import {
  Button,
  PageLoader,
  ScreenHeader,
  SurveyBadge,
  SurveyOption,
  SurveyProgress,
  SurveyRatingScale,
  TextInput,
} from '@/components/ui';
import { useProductUi } from '@/hooks/use-product-ui';
import { surveysApi } from '@/lib/surveys-api';
import { durationLabel, questionHint } from '@/lib/surveys/format';
import {
  ANSWER_TEXT_LIMIT,
  answerTextLength,
  chooseOption,
  submissionAnswers,
  submitOutcome,
  type AnswersDraft,
} from '@/lib/surveys/answers';
import type { ClientSurveyDetail, SurveyQuestion } from '@/lib/surveys/types';
import { newRequestId } from '@/lib/task-comments/request-id';

type ScreenState = 'loading' | 'error' | 'unavailable' | 'closed' | 'completed' | 'ready';

export default function ClientSurveyScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string | string[] }>();
  const surveyId = Number(Array.isArray(idParam) ? idParam[0] : idParam);
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ui = useProductUi();
  const [screenState, setScreenState] = useState<ScreenState>('loading');
  const [survey, setSurvey] = useState<ClientSurveyDetail | null>(null);
  const [loadError, setLoadError] = useState('');
  const [started, setStarted] = useState(false);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<AnswersDraft>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitFailed, setSubmitFailed] = useState(false);
  const requestSequence = useRef(0);
  const submittingRef = useRef(false);
  const submitAttemptRef = useRef<{ fingerprint: string; id: string } | null>(null);

  const loadSurvey = useCallback(async () => {
    const current = ++requestSequence.current;
    setScreenState('loading');
    setLoadError('');
    if (!Number.isInteger(surveyId) || surveyId <= 0) {
      setScreenState('unavailable');
      return;
    }
    const result = await surveysApi.getSurvey(surveyId);
    if (current !== requestSequence.current) return;
    if (!result.ok) {
      if (result.code === 'SURVEY_CLOSED') setScreenState('closed');
      else if (result.code === 'SURVEY_ALREADY_COMPLETED') router.replace('/client/news?tab=surveys');
      else if (result.status === 404 || result.code === 'SURVEY_NOT_FOUND' || result.code === 'SURVEY_OFFICE_NOT_FOUND') setScreenState('unavailable');
      else {
        setLoadError(result.error);
        setScreenState('error');
      }
      return;
    }
    if (result.data.state === 'closed') {
      setScreenState('closed');
      return;
    }
    if (result.data.state === 'completed') {
      router.replace('/client/news?tab=surveys');
      return;
    }
    setSurvey(result.data);
    setScreenState('ready');
  }, [surveyId, router]);

  useEffect(() => {
    void Promise.resolve().then(loadSurvey);
    return () => { requestSequence.current += 1; };
  }, [loadSurvey]);

  const currentQuestion = survey?.questions[questionIndex];
  const totalQuestions = survey?.questions.length ?? 0;
  const currentAnswer = currentQuestion ? answers[currentQuestion.id] : undefined;
  const validCurrentAnswer = currentQuestion ? submissionAnswers([currentQuestion], answers) !== null : false;
  const submitPayload = useMemo(() => survey ? submissionAnswers(survey.questions, answers) : null, [survey, answers]);
  const fingerprint = submitPayload ? JSON.stringify(submitPayload) : '';

  const goToList = useCallback(() => router.replace('/client/news?tab=surveys'), [router]);

  const submit = useCallback(async () => {
    if (!survey || !submitPayload || submittingRef.current) return;
    submittingRef.current = true;
    const previousAttempt = submitAttemptRef.current;
    const requestId = previousAttempt?.fingerprint === fingerprint ? previousAttempt.id : newRequestId();
    const attempt = { fingerprint, id: requestId };
    submitAttemptRef.current = attempt;
    setSubmitting(true);
    setSubmitFailed(false);
    const result = await surveysApi.submitAnswers(survey.id, {
      client_request_id: requestId,
      answers: submitPayload,
    });
    submittingRef.current = false;
    setSubmitting(false);
    if (result.ok) {
      setScreenState('completed');
      return;
    }
    const outcome = submitOutcome(result);
    if (outcome === 'closed') setScreenState('closed');
    else if (outcome === 'unavailable') setScreenState('unavailable');
    else if (outcome === 'already-completed') router.replace('/client/news?tab=surveys');
    else setSubmitFailed(true);
  }, [survey, submitPayload, fingerprint, router]);

  const setTextAnswer = (questionId: number, value: string) => {
    const limited = [...value].slice(0, ANSWER_TEXT_LIMIT).join('');
    setAnswers((previous) => ({ ...previous, [questionId]: { text: limited } }));
  };

  const updateOption = (question: SurveyQuestion, optionId: number) => {
    setAnswers((previous) => ({ ...previous, [question.id]: chooseOption(question, previous[question.id], optionId) }));
    setSubmitFailed(false);
  };

  const backQuestion = () => {
    if (questionIndex > 0) setQuestionIndex((index) => index - 1);
    else setStarted(false);
  };

  const advance = () => {
    if (!survey || !currentQuestion || !validCurrentAnswer) return;
    if (questionIndex < totalQuestions - 1) setQuestionIndex((index) => index + 1);
    else void submit();
  };

  if (screenState === 'loading') {
    return <View style={[styles.center, { backgroundColor: ui.canvas }]}><PageLoader size={64} /></View>;
  }

  if (screenState === 'error') {
    return (
      <View style={[styles.stateScreen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <ScreenHeader title="Опрос" />
        <View style={styles.stateContent}>
          <EmptyState icon="error-outline" title="Не удалось загрузить опрос" description={loadError} action={<Button title="Повторить" onPress={() => void loadSurvey()} size="block" />} />
        </View>
      </View>
    );
  }

  if (screenState === 'unavailable' || screenState === 'closed') {
    const unavailable = screenState === 'unavailable';
    return (
      <View style={[styles.stateScreen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <ScreenHeader title="Опрос" />
        <View style={styles.stateContent}>
          <EmptyState
            icon={unavailable ? 'visibility-off' : 'event-busy'}
            title={unavailable ? 'Опрос недоступен' : 'Опрос завершён'}
            description={unavailable ? 'Возможно, он удалён или больше не доступен для вашего офиса.' : 'Срок прохождения этого опроса истёк.'}
            action={<Button title="К опросам" onPress={goToList} size="block" />}
          />
        </View>
      </View>
    );
  }

  if (screenState === 'completed') {
    return (
      <View style={[styles.successScreen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}>
        <View style={[styles.successIcon, { backgroundColor: ui.done }]}><MaterialIcons name="check" size={34} color={ui.onAccent} /></View>
        <Text style={[styles.successTitle, { color: ui.fg() }]}>Ответы отправлены</Text>
        <Text style={[styles.successDescription, { color: ui.fg(0.62) }]}>Ваши ответы помогут сделать Workflow удобнее</Text>
        <Button title="К опросам" onPress={goToList} size="block" style={styles.successButton} />
      </View>
    );
  }

  if (!survey) return null;

  if (!started) {
    return (
      <View style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 16 }]}>
        <ScreenHeader title="" onBack={goToList} />
        <ScrollView contentContainerStyle={styles.introContent} showsVerticalScrollIndicator={false}>
          <SurveyBadge kind="survey" />
          <Text style={[styles.introTitle, { color: ui.fg() }]}>{survey.title}</Text>
          {survey.description ? <Text style={[styles.introDescription, { color: ui.fg(0.62) }]}>{survey.description}</Text> : null}
          <View style={[styles.infoCard, { backgroundColor: ui.surface }]}>
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: ui.accentSoft }]}><MaterialIcons name="checklist" size={20} color={ui.accent} /></View>
              <View><Text style={[styles.infoLabel, { color: ui.fg(0.55) }]}>Вопросов</Text><Text style={[styles.infoValue, { color: ui.fg() }]}>{survey.questions_count}</Text></View>
            </View>
            <View style={[styles.infoDivider, { backgroundColor: ui.fg(0.08) }]} />
            <View style={styles.infoRow}>
              <View style={[styles.infoIcon, { backgroundColor: ui.accentSoft }]}><MaterialIcons name="schedule" size={20} color={ui.accent} /></View>
              <View><Text style={[styles.infoLabel, { color: ui.fg(0.55) }]}>Время</Text><Text style={[styles.infoValue, { color: ui.fg() }]}>{survey.estimated_minutes == null ? '—' : durationLabel(survey.estimated_minutes)}</Text></View>
            </View>
          </View>
          <View style={[styles.note, { backgroundColor: ui.accentSoft }]}>
            <MaterialIcons name="lightbulb-outline" size={20} color={ui.accent} />
            <Text style={[styles.noteText, { color: ui.accentOnSoft }]}>Правильных ответов нет — важно ваше мнение</Text>
          </View>
        </ScrollView>
        <View style={styles.bottomAction}><Button title="Начать" onPress={() => { setStarted(true); setQuestionIndex(0); }} size="block" variant="accent" /></View>
      </View>
    );
  }

  if (!currentQuestion) return null;
  const answerOptions = currentAnswer && 'optionIds' in currentAnswer ? currentAnswer.optionIds : [];
  const rating = currentAnswer && 'rating' in currentAnswer ? currentAnswer.rating : null;
  const textValue = currentAnswer && 'text' in currentAnswer ? currentAnswer.text : '';

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: ui.canvas }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={{ paddingTop: insets.top + 8 }}>
        <ScreenHeader title="" onBack={backQuestion} />
      </View>
      <ScrollView
        style={styles.questionScroll}
        contentContainerStyle={styles.questionContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SurveyProgress step={questionIndex + 1} total={totalQuestions} />
        <Text style={[styles.surveyTitle, { color: ui.fg(0.62) }]}>{survey.title}</Text>
        <Text style={[styles.questionText, { color: ui.fg() }]}>{currentQuestion.text}</Text>
        {questionHint(currentQuestion) ? <Text style={[styles.hint, { color: ui.fg(0.56) }]}>{questionHint(currentQuestion)}</Text> : null}
        {currentQuestion.type === 'rating' ? (
          <SurveyRatingScale
            value={rating}
            onChange={(value) => setAnswers((previous) => ({ ...previous, [currentQuestion.id]: { rating: value } }))}
            minLabel={currentQuestion.scale_min_label || 'Совсем неудобно'}
            maxLabel={currentQuestion.scale_max_label || 'Очень удобно'}
            style={styles.rating}
          />
        ) : currentQuestion.type === 'text' ? (
          <View style={styles.textAnswer}>
            <TextInput
              value={textValue}
              onChangeText={(value) => setTextAnswer(currentQuestion.id, value)}
              placeholder="Ваш ответ"
              multiline
              numberOfLines={6}
              autoCapitalize="sentences"
            />
            <Text style={[styles.counter, { color: ui.fg(0.48) }]}>{answerTextLength(textValue)} / {ANSWER_TEXT_LIMIT}</Text>
          </View>
        ) : (
          <View style={styles.options}>
            {currentQuestion.options.map((option) => (
              <SurveyOption
                key={option.id}
                label={option.text}
                selected={answerOptions.includes(option.id)}
                selectionType={currentQuestion.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                onPress={() => updateOption(currentQuestion, option.id)}
              />
            ))}
          </View>
        )}
      </ScrollView>
      {submitFailed ? (
        <View style={[styles.submitError, { backgroundColor: ui.dangerSoft }]}>
          <Text style={[styles.submitErrorTitle, { color: ui.danger }]}>Не удалось отправить ответы</Text>
          <Text style={[styles.submitErrorText, { color: ui.fg(0.72) }]}>Проверьте подключение к интернету и попробуйте ещё раз. Ответы остались заполненными.</Text>
          <Button title="Повторить отправку" onPress={() => void submit()} size="block" variant="accent" loading={submitting} />
          <Button title="Вернуться к вопросам" onPress={() => { setSubmitFailed(false); setQuestionIndex(Math.max(0, totalQuestions - 1)); }} size="block" variant="ghost" />
        </View>
      ) : (
        <View style={[styles.bottomNav, { paddingBottom: insets.bottom + 12, borderTopColor: ui.fg(0.08) }]}>
          <Button title="Назад" onPress={backQuestion} size="block" variant="accent-outline" style={styles.navButton} />
          <Button
            title={questionIndex === totalQuestions - 1 ? 'Отправить' : 'Далее'}
            onPress={advance}
            size="block"
            variant="accent"
            disabled={!validCurrentAnswer}
            loading={submitting}
            style={styles.navButton}
          />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  screen: { flex: 1 },
  stateScreen: { flex: 1 },
  stateContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 24 },
  successScreen: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  successIcon: { width: 68, height: 68, borderRadius: 34, alignItems: 'center', justifyContent: 'center', marginBottom: 22 },
  successTitle: { fontSize: 24, fontWeight: '700', textAlign: 'center' },
  successDescription: { fontSize: 16, lineHeight: 24, textAlign: 'center', marginTop: 10 },
  successButton: { alignSelf: 'stretch', marginTop: 36 },
  introContent: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24 },
  introTitle: { fontSize: 27, lineHeight: 34, fontWeight: '700', marginTop: 22 },
  introDescription: { fontSize: 16, lineHeight: 24, marginTop: 12 },
  infoCard: { borderRadius: 18, marginTop: 28, padding: 18, gap: 16 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  infoIcon: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  infoLabel: { fontSize: 13, lineHeight: 18 },
  infoValue: { fontSize: 17, lineHeight: 23, fontWeight: '600', marginTop: 1 },
  infoDivider: { height: StyleSheet.hairlineWidth },
  note: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, padding: 14, marginTop: 18 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '500' },
  bottomAction: { paddingHorizontal: 20, paddingTop: 8 },
  questionScroll: { flex: 1 },
  questionContent: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 24 },
  surveyTitle: { fontSize: 14, lineHeight: 20, fontWeight: '500', marginTop: 18 },
  questionText: { fontSize: 22, lineHeight: 29, fontWeight: '700', marginTop: 10 },
  hint: { fontSize: 14, lineHeight: 20, marginTop: 10 },
  options: { gap: 12, marginTop: 24 },
  rating: { marginTop: 28 },
  textAnswer: { marginTop: 20, gap: 8 },
  counter: { alignSelf: 'flex-end', fontSize: 13 },
  bottomNav: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  navButton: { flex: 1 },
  submitError: { gap: 10, paddingHorizontal: 16, paddingTop: 14, paddingBottom: 20 },
  submitErrorTitle: { fontSize: 17, fontWeight: '700' },
  submitErrorText: { fontSize: 14, lineHeight: 20, marginBottom: 4 },
});
