import { MaterialIcons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedView } from '@/components/themed-view';
import { SurveySortableList } from '@/components/surveys/survey-sortable-list';
import { BottomSheet } from '@/components/ui/bottom-sheet';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ConfirmSheet } from '@/components/ui/confirm-sheet';
import { EmptyState } from '@/components/ui/empty-state';
import { ScreenHeader } from '@/components/ui/screen-header';
import { Select } from '@/components/ui/select';
import { SurveyOption } from '@/components/ui/survey-option';
import { SurveyProgress } from '@/components/ui/survey-progress';
import { SurveyRatingScale } from '@/components/ui/survey-rating-scale';
import { TextInput } from '@/components/ui/text-input';
import { useProductUi } from '@/hooks/use-product-ui';
import { request, type Office } from '@/lib/api';
import { useToast } from '@/context/toast-context';
import { surveysApi } from '@/lib/surveys-api';
import { durationLabel, DEFAULT_SCALE_LABELS, pluralRu, questionsCountLabel, questionHint } from '@/lib/surveys/format';
import {
  newEditableQuestion,
  questionIsValid,
  questionTypeLabel,
  surveyCanPublish,
  surveyDraftInput,
  surveyEditorFromDetail,
  surveyEstimatedMinutes,
  SURVEY_QUESTION_TYPES,
  type EditableSurveyOption,
  type EditableSurveyQuestion,
  type SurveyEditorDraft,
} from '@/lib/surveys/admin-editor';
import type { SurveyQuestionType } from '@/lib/surveys/types';

type LeaveIntent = 'route' | 'question' | null;

const newSurveyDraft = (): SurveyEditorDraft => ({
  title: '',
  description: '',
  isAnonymous: true,
  allOffices: false,
  officeIds: [],
  questions: [],
});

const blankValue = (value: string) => value.trim().length === 0;

function surveyQuestionSummary(question: EditableSurveyQuestion) {
  switch (question.type) {
    case 'single_choice': return `${question.options.length} ${pluralRu(question.options.length, ['вариант', 'варианта', 'вариантов'])}`;
    case 'multiple_choice': return `${question.options.length} ${pluralRu(question.options.length, ['вариант', 'варианта', 'вариантов'])} · можно выбрать несколько`;
    case 'rating': return 'Шкала от 1 до 5';
    case 'yes_no': return 'Да или Нет';
    case 'text': return 'Свободный текст';
  }
}

export function AdminSurveyEditor() {
  const params = useLocalSearchParams<{ mode?: string; id?: string }>();
  const editId = params.mode === 'edit' && typeof params.id === 'string' ? Number(params.id) : null;
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const ui = useProductUi();
  const { show: showToast } = useToast();

  const [form, setForm] = useState<SurveyEditorDraft | null>(null);
  const [baseline, setBaseline] = useState('');
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [questionTypeSheet, setQuestionTypeSheet] = useState(false);
  const [officeSheet, setOfficeSheet] = useState(false);
  const [activeQuestion, setActiveQuestion] = useState<EditableSurveyQuestion | null>(null);
  const [activeQuestionKey, setActiveQuestionKey] = useState<string | null>(null);
  const [questionBaseline, setQuestionBaseline] = useState('');
  const [preview, setPreview] = useState(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [previewAnswers, setPreviewAnswers] = useState<Record<string, string | string[] | number>>({});
  const [publishConfirm, setPublishConfirm] = useState(false);
  const [leaveConfirm, setLeaveConfirm] = useState(false);
  const [leaveIntent, setLeaveIntent] = useState<LeaveIntent>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [undoDeleted, setUndoDeleted] = useState<{ question: EditableSurveyQuestion; index: number } | null>(null);
  const nextQuestionKey = useRef(0);
  const loadController = useRef<AbortController | null>(null);

  const isDirty = form != null && JSON.stringify(form) !== baseline;
  const questionDirty = activeQuestion != null && JSON.stringify(activeQuestion) !== questionBaseline;
  const validQuestionCount = form?.questions.length ?? 0;
  const canPublish = form != null && surveyCanPublish(form);
  const canPreview = form != null && Boolean(form.title.trim()) && form.questions.length > 0 && form.questions.every(questionIsValid);

  const load = useCallback(async () => {
    loadController.current?.abort();
    setLoading(true);
    setLoadError(null);
    const controller = new AbortController();
    loadController.current = controller;
    try {
      if (editId != null && (!Number.isInteger(editId) || editId < 1)) throw new Error('Не удалось загрузить опрос');
      const [officesResult, surveyResult] = await Promise.all([
        request<Office[] | Office>('/offices', { signal: controller.signal }),
        editId == null ? Promise.resolve(null) : surveysApi.getAdminSurvey(editId, controller.signal),
      ]);
      if (!officesResult.ok) throw new Error(officesResult.error);
      if (surveyResult && !surveyResult.ok) throw new Error(surveyResult.error);
      const officeData = officesResult.data;
      const officeList = Array.isArray(officeData) ? officeData : [officeData];
      setOffices(officeList);
      const next = surveyResult?.ok ? surveyEditorFromDetail(surveyResult.data) : newSurveyDraft();
      setForm(next);
      setBaseline(JSON.stringify(next));
    } catch (error) {
      if (!controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить опрос');
    } finally {
      if (!controller.signal.aborted) setLoading(false);
    }
  }, [editId]);

  useEffect(() => {
    const start = setTimeout(() => { void load(); }, 0);
    return () => {
      clearTimeout(start);
      loadController.current?.abort();
      loadController.current = null;
    };
  }, [load]);

  useEffect(() => {
    if (!undoDeleted) return;
    const timeout = setTimeout(() => setUndoDeleted(null), 5000);
    return () => clearTimeout(timeout);
  }, [undoDeleted]);

  const goBack = useCallback(() => {
    if (activeQuestion) {
      if (questionDirty) {
        setLeaveIntent('question');
        setLeaveConfirm(true);
      } else {
        setActiveQuestion(null);
        setActiveQuestionKey(null);
      }
      return;
    }
    if (preview) {
      setPreview(false);
      return;
    }
    if (isDirty) {
      setLeaveIntent('route');
      setLeaveConfirm(true);
      return;
    }
    router.back();
  }, [activeQuestion, isDirty, preview, questionDirty, router]);

  const leaveWithoutSaving = useCallback(() => {
    setLeaveConfirm(false);
    if (leaveIntent === 'question') {
      setActiveQuestion(null);
      setActiveQuestionKey(null);
    } else if (leaveIntent === 'route') {
      router.back();
    }
    setLeaveIntent(null);
  }, [leaveIntent, router]);

  const chooseQuestionType = useCallback((type: SurveyQuestionType) => {
    const key = `local-question-${Date.now()}-${nextQuestionKey.current++}`;
    const question = newEditableQuestion(type, key);
    setActiveQuestion(question);
    setActiveQuestionKey(null);
    setQuestionBaseline(JSON.stringify(question));
    setQuestionTypeSheet(false);
  }, []);

  const editQuestion = useCallback((question: EditableSurveyQuestion) => {
    const copy = { ...question, options: question.options.map((option) => ({ ...option })) };
    setActiveQuestion(copy);
    setActiveQuestionKey(question.key);
    setQuestionBaseline(JSON.stringify(copy));
  }, []);

  const changeQuestionType = useCallback((type: string) => {
    if (!activeQuestion || type === activeQuestion.type) return;
    const questionType = type as SurveyQuestionType;
    const next = newEditableQuestion(questionType, activeQuestion.key);
    const oldChoice = activeQuestion.type === 'single_choice' || activeQuestion.type === 'multiple_choice';
    const nextChoice = questionType === 'single_choice' || questionType === 'multiple_choice';
    setActiveQuestion({
      ...next,
      text: activeQuestion.text,
      options: oldChoice && nextChoice ? activeQuestion.options : next.options,
      scaleMinLabel: activeQuestion.scaleMinLabel,
      scaleMaxLabel: activeQuestion.scaleMaxLabel,
    });
  }, [activeQuestion]);

  const saveQuestion = useCallback(() => {
    if (!activeQuestion || !form || !questionIsValid(activeQuestion)) return;
    setForm((current) => {
      if (!current) return current;
      if (activeQuestionKey == null) return { ...current, questions: [...current.questions, activeQuestion] };
      return {
        ...current,
        questions: current.questions.map((question) => question.key === activeQuestionKey ? activeQuestion : question),
      };
    });
    setActiveQuestion(null);
    setActiveQuestionKey(null);
  }, [activeQuestion, activeQuestionKey, form]);

  const deleteQuestion = useCallback((question: EditableSurveyQuestion, index: number) => {
    setForm((current) => current ? { ...current, questions: current.questions.filter((item) => item.key !== question.key) } : current);
    setUndoDeleted({ question, index });
  }, []);

  const restoreQuestion = useCallback(() => {
    if (!undoDeleted) return;
    setForm((current) => {
      if (!current) return current;
      const questions = [...current.questions];
      questions.splice(Math.min(undoDeleted.index, questions.length), 0, undoDeleted.question);
      return { ...current, questions };
    });
    setUndoDeleted(null);
  }, [undoDeleted]);

  const selectedOffices = useMemo(() => offices.filter((office) => form?.officeIds.includes(office.id)), [offices, form?.officeIds]);

  const toggleOffice = useCallback((officeId: number) => {
    setForm((current) => {
      if (!current) return current;
      const selected = new Set(current.officeIds);
      if (selected.has(officeId)) selected.delete(officeId);
      else selected.add(officeId);
      return { ...current, allOffices: false, officeIds: [...selected] };
    });
  }, []);

  const saveCurrentDraft = useCallback(async (closeAfterSave: boolean) => {
    if (!form) return null;
    setSaving(true);
    const payload = surveyDraftInput(form);
    const result = editId == null
      ? await surveysApi.createSurvey(payload)
      : await surveysApi.updateSurvey(editId, payload);
    setSaving(false);
    if (!result.ok) {
      showToast({ title: 'Ошибка', description: result.error, variant: 'error', duration: 4000 });
      return null;
    }
    setBaseline(JSON.stringify(form));
    if (closeAfterSave) {
      showToast({ title: 'Черновик сохранён', variant: 'success' });
      router.back();
    }
    return result.data.id;
  }, [editId, form, router, showToast]);

  const saveDraft = useCallback(() => {
    void saveCurrentDraft(true);
  }, [saveCurrentDraft]);

  const publish = useCallback(async () => {
    if (!form) return;
    setPublishConfirm(false);
    setPublishing(true);
    const payload = surveyDraftInput(form);
    const saved = editId == null
      ? await surveysApi.createSurvey(payload)
      : await surveysApi.updateSurvey(editId, payload);
    if (!saved.ok) {
      setPublishing(false);
      showToast({ title: 'Ошибка', description: saved.error, variant: 'error', duration: 4000 });
      return;
    }
    const published = await surveysApi.publishSurvey(saved.data.id);
    setPublishing(false);
    if (!published.ok) {
      showToast({ title: 'Не удалось опубликовать опрос', description: published.error, variant: 'error', duration: 4000 });
      return;
    }
    showToast({ title: 'Опрос опубликован', variant: 'success' });
    router.back();
  }, [editId, form, router, showToast]);

  const openPreview = useCallback(() => {
    setPreviewIndex(0);
    setPreviewAnswers({});
    setPreview(true);
  }, []);

  const addOption = useCallback(() => {
    setActiveQuestion((current) => {
      if (!current || current.options.length >= 20) return current;
      const key = `${current.key}-option-${Date.now()}-${current.options.length}`;
      return { ...current, options: [...current.options, { key, text: '' }] };
    });
  }, []);

  const updateOption = useCallback((key: string, text: string) => {
    setActiveQuestion((current) => current ? {
      ...current,
      options: current.options.map((option) => option.key === key ? { ...option, text } : option),
    } : current);
  }, []);

  const removeOption = useCallback((key: string) => {
    setActiveQuestion((current) => current ? { ...current, options: current.options.filter((option) => option.key !== key) } : current);
  }, []);

  const activeQuestionIndex = activeQuestionKey == null
    ? form?.questions.length ?? 0
    : Math.max(0, form?.questions.findIndex((question) => question.key === activeQuestionKey) ?? 0);
  const headerTitle = activeQuestion
    ? `Вопрос ${activeQuestionIndex + 1}`
    : preview
      ? 'Предпросмотр'
      : editId == null
        ? 'Новый опрос'
        : 'Редактировать опрос';

  if (loading) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
        <ScreenHeader title={editId == null ? 'Новый опрос' : 'Опрос'} onBack={() => router.back()} />
        <View style={styles.loadState}><ActivityIndicator size="large" color={ui.accent} /></View>
      </ThemedView>
    );
  }

  if (loadError || !form) {
    return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
        <ScreenHeader title="Опрос" onBack={() => router.back()} />
        <EmptyState
          icon="cloud-off"
          title="Не удалось загрузить опрос"
          description={loadError ?? 'Не удалось загрузить данные'}
          action={<Button title="Повторить" onPress={() => void load()} variant="accent-outline" size="compact" />}
          style={styles.loadError}
        />
      </ThemedView>
    );
  }

  if (activeQuestion) {
    const choiceQuestion = activeQuestion.type === 'single_choice' || activeQuestion.type === 'multiple_choice';
    const canSaveQuestion = questionIsValid(activeQuestion);
    return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
        <ScreenHeader title={headerTitle} onBack={goBack} />
        <ScrollView contentContainerStyle={[styles.questionPage, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled">
          <Card padding="lg" style={[styles.questionEditorCard, { backgroundColor: ui.raised }]}>
            <Text style={[styles.fieldLabel, { color: ui.fg(0.55) }]}>Тип ответа</Text>
            <Select
              value={activeQuestion.type}
              onValueChange={changeQuestionType}
              options={SURVEY_QUESTION_TYPES.map((item) => ({ value: item.value, label: item.label }))}
            />
            <TextInput
              label="Текст вопроса *"
              placeholder="Текст вопроса"
              value={activeQuestion.text}
              onChangeText={(text) => setActiveQuestion((question) => question ? { ...question, text } : question)}
              multiline
              numberOfLines={3}
              maxLength={500}
              autoCapitalize="sentences"
            />
            {choiceQuestion ? (
              <View style={styles.optionsSection}>
                <Text style={[styles.fieldLabel, { color: ui.fg(0.55) }]}>Варианты ответа</Text>
                <SurveySortableList<EditableSurveyOption>
                  data={activeQuestion.options}
                  keyExtractor={(option) => option.key}
                  onReorder={(options) => setActiveQuestion((question) => question ? { ...question, options } : question)}
                  style={styles.sortableList}
                  renderItem={({ item, dragHandle }) => (
                    <View style={styles.optionRow}>
                      {dragHandle}
                      <TextInput
                        value={item.text}
                        onChangeText={(text) => updateOption(item.key, text)}
                        placeholder="Вариант ответа"
                        maxLength={200}
                        flex
                        autoCapitalize="sentences"
                      />
                      <Pressable
                        onPress={() => removeOption(item.key)}
                        accessibilityRole="button"
                        accessibilityLabel="Удалить вариант"
                        hitSlop={10}
                        style={styles.removeOption}
                      >
                        <MaterialIcons name="close" size={21} color={ui.danger} />
                      </Pressable>
                    </View>
                  )}
                />
                <Button
                  title="Добавить вариант"
                  onPress={addOption}
                  variant="accent-outline"
                  size="block"
                  disabled={activeQuestion.options.length >= 20}
                  leftIcon={<MaterialIcons name="add" size={20} color={ui.accent} />}
                />
                <Text style={[styles.helper, { color: ui.fg(0.45) }]}>
                  {activeQuestion.type === 'multiple_choice' ? 'Клиент сможет выбрать несколько вариантов' : 'Клиент выберет один вариант'}
                </Text>
                {!canSaveQuestion && activeQuestion.options.length < 2 ? (
                  <Text style={[styles.helper, { color: ui.fg(0.45) }]}>Добавьте хотя бы 2 варианта</Text>
                ) : null}
              </View>
            ) : activeQuestion.type === 'rating' ? (
              <View style={styles.previewField}>
                <Text style={[styles.fieldLabel, { color: ui.fg(0.55) }]}>Как увидит клиент</Text>
                <View style={styles.ratingPreview}>
                  {[1, 2, 3, 4, 5].map((value) => (
                    <View key={value} style={[styles.ratingPreviewValue, { backgroundColor: ui.surface, borderColor: ui.fg(0.1) }]}>
                      <Text style={[styles.ratingPreviewText, { color: ui.fg(0.8) }]}>{value}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.helper, { color: ui.fg(0.45) }]}>Шкала фиксированная, от 1 до 5. Варианты добавлять не нужно</Text>
              </View>
            ) : activeQuestion.type === 'yes_no' ? (
              <View style={styles.previewField}>
                <Text style={[styles.fieldLabel, { color: ui.fg(0.55) }]}>Как увидит клиент</Text>
                <View style={styles.yesNoPreview}>
                  {['Да', 'Нет'].map((label) => (
                    <View key={label} style={[styles.yesNoOption, { backgroundColor: ui.surface, borderColor: ui.fg(0.1) }]}>
                      <Text style={[styles.yesNoLabel, { color: ui.fg(0.85) }]}>{label}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[styles.helper, { color: ui.fg(0.45) }]}>Клиент выберет «Да» или «Нет»</Text>
              </View>
            ) : (
              <View style={styles.previewField}>
                <Text style={[styles.fieldLabel, { color: ui.fg(0.55) }]}>Как увидит клиент</Text>
                <View style={[styles.textAnswerPreview, { backgroundColor: ui.surface, borderColor: ui.fg(0.1) }]}>
                  <Text style={{ color: ui.fg(0.42) }}>Напишите ответ своими словами</Text>
                </View>
                <Text style={[styles.helper, { color: ui.fg(0.45) }]}>Клиент напишет ответ своими словами, до 500 символов</Text>
              </View>
            )}
            <Button title="Сохранить" onPress={saveQuestion} variant="accent" size="block" disabled={!canSaveQuestion} />
          </Card>
        </ScrollView>
        <ConfirmSheet
          visible={leaveConfirm && leaveIntent === 'question'}
          onClose={() => { setLeaveConfirm(false); setLeaveIntent(null); }}
          title="Есть несохранённые изменения"
          message="Выйти без сохранения?"
          confirmLabel="Выйти"
          tone="danger"
          onConfirm={leaveWithoutSaving}
        />
      </ThemedView>
    );
  }

  if (preview) {
    const question = form.questions[previewIndex];
    const questionOptions = question.type === 'yes_no'
      ? ['Да', 'Нет']
      : question.type === 'single_choice' || question.type === 'multiple_choice'
        ? question.options.map((option) => option.text)
        : [];
    const answer = previewAnswers[question.key];
    const setPreviewAnswer = (value: string | string[] | number) => setPreviewAnswers((current) => ({ ...current, [question.key]: value }));
    return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
        <View style={[styles.previewNotice, { backgroundColor: ui.accentSoft, borderColor: ui.accent }]}>
          <MaterialIcons name="visibility" size={18} color={ui.accentOnSoft} />
          <Text style={[styles.previewNoticeText, { color: ui.accentOnSoft }]}>Предпросмотр — так опрос увидит клиент. Ответы не сохраняются.</Text>
          <Pressable onPress={() => setPreview(false)} accessibilityRole="button" accessibilityLabel="Закрыть предпросмотр">
            <Text style={[styles.previewClose, { color: ui.accentOnSoft }]}>Закрыть</Text>
          </Pressable>
        </View>
        <ScrollView contentContainerStyle={[styles.previewContent, { paddingBottom: insets.bottom + 24 }]}>
          <ScreenHeader title={form.title} subtitle={form.description || undefined} onBack={() => setPreview(false)} />
          <Card padding="lg" style={[styles.previewQuestionCard, { backgroundColor: ui.raised }]}>
            <SurveyProgress step={previewIndex + 1} total={form.questions.length} />
            <Text style={[styles.previewQuestionText, { color: ui.fg() }]}>{question.text}</Text>
            <Text style={[styles.previewHint, { color: ui.fg(0.56) }]}>
              {questionHint({ type: question.type, scale_min_label: question.scaleMinLabel ?? null, scale_max_label: question.scaleMaxLabel ?? null })}
            </Text>
            {question.type === 'rating' ? (
              <SurveyRatingScale
                value={typeof answer === 'number' ? answer : null}
                onChange={setPreviewAnswer}
                minLabel={question.scaleMinLabel ?? DEFAULT_SCALE_LABELS.min}
                maxLabel={question.scaleMaxLabel ?? DEFAULT_SCALE_LABELS.max}
              />
            ) : question.type === 'text' ? (
              <TextInput
                value={typeof answer === 'string' ? answer : ''}
                onChangeText={setPreviewAnswer}
                placeholder="Напишите ответ своими словами"
                maxLength={500}
                multiline
                numberOfLines={4}
                autoCapitalize="sentences"
              />
            ) : (
              <View style={styles.previewOptions}>
                {questionOptions.map((option) => {
                  const selected = Array.isArray(answer) ? answer.includes(option) : answer === option;
                  return (
                    <SurveyOption
                      key={option}
                      label={option}
                      selected={selected}
                      selectionType={question.type === 'multiple_choice' ? 'checkbox' : 'radio'}
                      onPress={() => {
                        if (question.type === 'multiple_choice') {
                          const current = Array.isArray(answer) ? answer : [];
                          setPreviewAnswer(selected ? current.filter((item) => item !== option) : [...current, option]);
                        } else {
                          setPreviewAnswer(option);
                        }
                      }}
                    />
                  );
                })}
              </View>
            )}
          </Card>
          <View style={styles.previewActions}>
            <Button title="Назад" onPress={() => setPreviewIndex((index) => Math.max(0, index - 1))} variant="raised" size="block" disabled={previewIndex === 0} style={styles.previewButton} />
            <Button title="Далее" onPress={() => setPreviewIndex((index) => Math.min(form.questions.length - 1, index + 1))} variant="accent" size="block" disabled={previewIndex === form.questions.length - 1} style={styles.previewButton} />
          </View>
        </ScrollView>
      </ThemedView>
    );
  }

  const questionCount = validQuestionCount;
  const selectedOfficeSummary = selectedOffices.map((office) => office.name).join(', ');
  const publishDuration = surveyEstimatedMinutes(form.questions);

  return (
      <ThemedView style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 8 }]}>
      <ScreenHeader title={headerTitle} onBack={goBack} />
      <ScrollView
        contentContainerStyle={[styles.formScroll, { paddingBottom: 20 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card padding="lg" style={[styles.formCard, { backgroundColor: ui.raised }]}>
          <TextInput
            label="Заголовок *"
            placeholder="Название опроса"
            value={form.title}
            onChangeText={(title) => setForm((current) => current ? { ...current, title } : current)}
            maxLength={255}
            autoCapitalize="sentences"
          />
          <TextInput
            label="Описание"
            placeholder="Коротко о том, зачем опрос"
            value={form.description}
            onChangeText={(description) => setForm((current) => current ? { ...current, description } : current)}
            multiline
            numberOfLines={3}
            maxLength={1000}
            autoCapitalize="sentences"
          />

          <View style={styles.questionListHeader}>
            <Text style={[styles.sectionTitle, { color: ui.fg(0.55) }]}>
              {questionCount ? `Вопросы · ${questionCount}` : 'Вопросы'}
            </Text>
            {questionCount > 0 ? <Text style={[styles.dragHint, { color: ui.fg(0.42) }]}>Перетащите, чтобы изменить порядок</Text> : null}
          </View>

          {form.questions.length === 0 ? (
            <View style={[styles.emptyQuestions, { borderColor: ui.fg(0.14) }]}>
              <View style={[styles.emptyIcon, { backgroundColor: ui.fg(0.06) }]}>
                <MaterialIcons name="format-list-bulleted" size={24} color={ui.fg(0.55)} />
              </View>
              <Text style={[styles.emptyQuestionTitle, { color: ui.fg() }]}>Вопросов пока нет</Text>
              <Text style={[styles.emptyQuestionDescription, { color: ui.fg(0.5) }]}>Добавьте хотя бы один вопрос, чтобы опубликовать опрос</Text>
            </View>
          ) : (
            <SurveySortableList<EditableSurveyQuestion>
              data={form.questions}
              keyExtractor={(question) => question.key}
              onReorder={(questions) => setForm((current) => current ? { ...current, questions } : current)}
              style={styles.sortableList}
              renderItem={({ item, index, dragHandle }) => (
                <View style={[styles.questionRow, { borderColor: ui.fg(0.1), backgroundColor: ui.raised }]}>
                  {dragHandle}
                  <Pressable
                    onPress={() => editQuestion(item)}
                    accessibilityRole="button"
                    accessibilityLabel={`Редактировать вопрос ${index + 1}`}
                    style={({ pressed }) => [styles.questionDetails, pressed && { opacity: 0.75 }]}
                  >
                    <Text style={[styles.questionType, { color: ui.accent }]}>
                      {index + 1}. {questionTypeLabel(item.type)}
                    </Text>
                    <Text style={[styles.questionText, { color: ui.fg() }]} numberOfLines={2}>{item.text}</Text>
                    <Text style={[styles.questionSummary, { color: ui.fg(0.45) }]}>{surveyQuestionSummary(item)}</Text>
                  </Pressable>
                  <View style={styles.questionActions}>
                    <Pressable onPress={() => editQuestion(item)} accessibilityRole="button" accessibilityLabel="Изменить вопрос" hitSlop={8} style={styles.questionIconButton}>
                      <MaterialIcons name="edit" size={19} color={ui.fg(0.62)} />
                    </Pressable>
                    <Pressable onPress={() => deleteQuestion(item, index)} accessibilityRole="button" accessibilityLabel="Удалить вопрос" hitSlop={8} style={styles.questionIconButton}>
                      <MaterialIcons name="delete-outline" size={20} color={ui.danger} />
                    </Pressable>
                  </View>
                </View>
              )}
            />
          )}

          <Button
            title="Добавить вопрос"
            onPress={() => setQuestionTypeSheet(true)}
            variant="accent-outline"
            size="block"
            disabled={form.questions.length >= 50}
            leftIcon={<MaterialIcons name="add" size={20} color={ui.accent} />}
          />

          <View style={[styles.settingsSection, { borderTopColor: ui.fg(0.1) }]}>
            <Text style={[styles.settingsTitle, { color: ui.fg() }]}>Для каких офисов</Text>
            <View style={styles.audienceChoices}>
              <Pressable
                onPress={() => setForm((current) => current ? { ...current, allOffices: true, officeIds: [] } : current)}
                accessibilityRole="radio"
                accessibilityState={{ checked: form.allOffices }}
                style={styles.radioChoice}
              >
                <MaterialIcons name={form.allOffices ? 'radio-button-checked' : 'radio-button-unchecked'} size={21} color={form.allOffices ? ui.accent : ui.fg(0.45)} />
                <Text style={[styles.radioLabel, { color: ui.fg() }]}>Все офисы</Text>
              </Pressable>
              <Pressable
                onPress={() => setForm((current) => current ? { ...current, allOffices: false } : current)}
                accessibilityRole="radio"
                accessibilityState={{ checked: !form.allOffices }}
                style={styles.radioChoice}
              >
                <MaterialIcons name={!form.allOffices ? 'radio-button-checked' : 'radio-button-unchecked'} size={21} color={!form.allOffices ? ui.accent : ui.fg(0.45)} />
                <Text style={[styles.radioLabel, { color: ui.fg() }]}>Выбрать офисы</Text>
              </Pressable>
            </View>
            {!form.allOffices ? (
              <Pressable onPress={() => setOfficeSheet(true)} style={[styles.officePicker, { borderColor: ui.fg(0.14), backgroundColor: ui.surface }]}>
                <Text style={[styles.officePickerText, { color: selectedOfficeSummary ? ui.fg() : ui.fg(0.45) }]} numberOfLines={2}>
                  {selectedOfficeSummary || 'Выберите офисы'}
                </Text>
                <MaterialIcons name="keyboard-arrow-down" size={22} color={ui.fg(0.5)} />
              </Pressable>
            ) : null}
          </View>

          <View style={[styles.anonymousRow, { borderTopColor: ui.fg(0.1) }]}>
            <View style={styles.anonymousCopy}>
              <Text style={[styles.settingsTitle, { color: ui.fg() }]}>Ответы анонимные</Text>
            </View>
            <Switch
              value={form.isAnonymous}
              onValueChange={(isAnonymous) => setForm((current) => current ? { ...current, isAnonymous } : current)}
              trackColor={{ false: ui.fg(0.2), true: ui.accentSoft }}
              thumbColor={form.isAnonymous ? ui.accent : ui.fg(0.5)}
            />
          </View>
        </Card>
        {undoDeleted ? (
          <View style={[styles.undoBar, { backgroundColor: ui.raised }]}>
            <Text style={[styles.undoText, { color: ui.fg() }]}>Вопрос удалён</Text>
            <Pressable onPress={restoreQuestion} accessibilityRole="button" hitSlop={8}>
              <Text style={[styles.undoAction, { color: ui.accent }]}>Отменить</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 12), backgroundColor: ui.canvas }]}>
        <Button
          title="Предпросмотр"
          onPress={openPreview}
          variant="raised"
          size="block"
          disabled={!canPreview || saving || publishing}
          leftIcon={<MaterialIcons name="visibility" size={18} color={ui.fg(0.75)} />}
        />
        <Button title="Сохранить черновик" onPress={saveDraft} variant="raised" size="block" disabled={blankValue(form.title) || saving || publishing} loading={saving} />
        <Button title="Опубликовать" onPress={() => setPublishConfirm(true)} variant="accent" size="block" disabled={!canPublish || saving || publishing} loading={publishing} />
      </View>

      <BottomSheet
        visible={questionTypeSheet}
        onClose={() => setQuestionTypeSheet(false)}
        title="Тип вопроса"
      >
        <View style={styles.typeOptions}>
          {SURVEY_QUESTION_TYPES.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => chooseQuestionType(item.value)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.typeOption, { backgroundColor: ui.raised }, pressed && { opacity: 0.7 }]}
            >
              <MaterialIcons name={item.value === 'single_choice' ? 'radio-button-checked' : item.value === 'multiple_choice' ? 'check-box' : item.value === 'rating' ? 'star-outline' : item.value === 'yes_no' ? 'check-circle-outline' : 'subject'} size={21} color={ui.accent} />
              <Text style={[styles.typeOptionText, { color: ui.fg() }]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>
      </BottomSheet>

      <BottomSheet
        visible={officeSheet}
        onClose={() => setOfficeSheet(false)}
        title="Выберите офисы"
        action={{ label: 'Готово', onPress: () => setOfficeSheet(false) }}
      >
        {offices.length === 0 ? (
          <EmptyState icon="location-off" title="Нет доступных офисов" />
        ) : (
          <View style={styles.officeOptions}>
            {offices.map((office) => {
              const selected = form.officeIds.includes(office.id);
              return (
                <Pressable
                  key={office.id}
                  onPress={() => toggleOffice(office.id)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selected }}
                  style={styles.officeOption}
                >
                  <MaterialIcons name={selected ? 'check-box' : 'check-box-outline-blank'} size={22} color={selected ? ui.accent : ui.fg(0.4)} />
                  <Text style={[styles.officeOptionText, { color: ui.fg() }]}>{office.name}</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </BottomSheet>

      <ConfirmSheet
        visible={publishConfirm}
        onClose={() => setPublishConfirm(false)}
        title="Опубликовать опрос?"
        message={`«${form.title}» появится у клиентов в «Все новости → Опросы». После публикации вопросы нельзя будет изменить.\n\n${questionsCountLabel(form.questions.length)}${publishDuration == null ? '' : ` · ${durationLabel(publishDuration)}`}`}
        confirmLabel="Опубликовать"
        tone="accent"
        busy={publishing}
        onConfirm={() => void publish()}
      />
      <ConfirmSheet
        visible={leaveConfirm && leaveIntent === 'route'}
        onClose={() => { setLeaveConfirm(false); setLeaveIntent(null); }}
        title="Есть несохранённые изменения"
        message="Выйти без сохранения?"
        confirmLabel="Выйти"
        tone="danger"
        onConfirm={leaveWithoutSaving}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loadState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadError: { flex: 1, justifyContent: 'center', paddingBottom: 48 },
  formScroll: { paddingHorizontal: 16, gap: 12 },
  formCard: { gap: 18 },
  sectionTitle: { fontSize: 14, fontWeight: '500' },
  questionListHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  dragHint: { fontSize: 11 },
  emptyQuestions: { minHeight: 164, alignItems: 'center', justifyContent: 'center', gap: 10, padding: 20, borderWidth: 1, borderStyle: 'dashed', borderRadius: 16 },
  emptyIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  emptyQuestionTitle: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  emptyQuestionDescription: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  questionRow: { minHeight: 94, borderWidth: 1, borderRadius: 15, paddingLeft: 8, paddingRight: 10, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 7 },
  questionDetails: { flex: 1, gap: 3 },
  questionType: { fontSize: 12, fontWeight: '600' },
  questionText: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
  questionSummary: { fontSize: 12 },
  questionActions: { alignItems: 'center', gap: 4 },
  questionIconButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  settingsSection: { paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, gap: 12 },
  settingsTitle: { fontSize: 15, fontWeight: '600' },
  audienceChoices: { gap: 6 },
  radioChoice: { minHeight: 40, flexDirection: 'row', alignItems: 'center', gap: 10 },
  radioLabel: { fontSize: 15 },
  officePicker: { minHeight: 48, borderWidth: 1, borderRadius: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  officePickerText: { flex: 1, fontSize: 14, lineHeight: 18 },
  anonymousRow: { paddingTop: 16, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  anonymousCopy: { flex: 1, gap: 4 },
  footer: { paddingHorizontal: 16, paddingTop: 10, gap: 8 },
  undoBar: { minHeight: 48, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  undoText: { fontSize: 14 },
  undoAction: { fontSize: 14, fontWeight: '700' },
  typeOptions: { gap: 8, paddingBottom: 8 },
  typeOption: { minHeight: 52, paddingHorizontal: 14, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 12 },
  typeOptionText: { fontSize: 16, fontWeight: '500' },
  questionPage: { paddingHorizontal: 16 },
  questionEditorCard: { gap: 18 },
  sortableList: { gap: 8 },
  fieldLabel: { fontSize: 14, fontWeight: '500' },
  optionsSection: { gap: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  removeOption: { width: 32, height: 44, alignItems: 'center', justifyContent: 'center' },
  helper: { fontSize: 12, lineHeight: 17 },
  previewField: { gap: 12 },
  ratingPreview: { flexDirection: 'row', gap: 8 },
  ratingPreviewValue: { flex: 1, height: 48, borderWidth: 1, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  ratingPreviewText: { fontSize: 16, fontWeight: '600' },
  yesNoPreview: { flexDirection: 'row', gap: 10 },
  yesNoOption: { flex: 1, minHeight: 52, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  yesNoLabel: { fontSize: 16, fontWeight: '600' },
  textAnswerPreview: { minHeight: 86, borderWidth: 1, borderRadius: 12, padding: 14, justifyContent: 'flex-start' },
  officeOptions: { gap: 4, paddingBottom: 12 },
  officeOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  officeOptionText: { flex: 1, fontSize: 15 },
  previewNotice: { minHeight: 48, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 8 },
  previewNoticeText: { flex: 1, fontSize: 12, lineHeight: 16 },
  previewClose: { fontSize: 13, fontWeight: '600' },
  previewContent: { gap: 12 },
  previewQuestionCard: { marginHorizontal: 16, gap: 18 },
  previewQuestionText: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  previewHint: { fontSize: 14, lineHeight: 19 },
  previewOptions: { gap: 8 },
  previewActions: { flexDirection: 'row', gap: 10, paddingHorizontal: 16 },
  previewButton: { flex: 1 },
});
