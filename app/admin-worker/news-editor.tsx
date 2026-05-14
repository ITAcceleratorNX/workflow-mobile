import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useToast } from '@/context/toast-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  clampNewsScheduleDate,
  formatNewsScheduleDateTime,
  getNewsScheduleMaximumDate,
  getNewsScheduleMinimumDate,
} from '@/lib/dateTimeUtils';
import {
  createNews,
  updateNews,
  type NotificationType,
  type NewsPublishMode,
} from '@/lib/news-api';

const NOTIFICATION_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'none', label: 'Без уведомления' },
  { value: 'push_sound', label: 'Уведомление со звуком' },
  { value: 'push_silent', label: 'Уведомление без звука' },
];

type FormState = {
  title: string;
  content: string;
  notification_type: NotificationType;
  image: { uri: string; type?: string; name?: string } | null;
};

export default function AdminWorkerNewsEditorScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show: showToast } = useToast();

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');

  const params = useLocalSearchParams<{
    mode?: 'create' | 'edit';
    id?: string;
    title?: string;
    content?: string;
    imageUrl?: string;
    status?: string;
    publishedAt?: string;
  }>();

  const mode = params.mode === 'edit' ? 'edit' : 'create';
  const editingId = mode === 'edit' ? params.id ?? null : null;
  const initialImageUrl = typeof params.imageUrl === 'string' ? params.imageUrl : '';
  const editingIsScheduled = mode === 'edit' && editingId != null && params.status === 'scheduled';
  const showPublishSchedule = mode === 'create' || editingIsScheduled;

  const initialScheduledAt = useMemo(() => {
    let d: Date;
    if (typeof params.publishedAt === 'string' && params.publishedAt.length > 0) {
      const parsed = new Date(params.publishedAt);
      d = Number.isNaN(parsed.getTime()) ? new Date(Date.now() + 60 * 60 * 1000) : parsed;
    } else {
      d = new Date(Date.now() + 60 * 60 * 1000);
    }
    return clampNewsScheduleDate(d);
  }, [params.publishedAt]);

  const [form, setForm] = useState<FormState>(() => ({
    title: typeof params.title === 'string' ? params.title : '',
    content: typeof params.content === 'string' ? params.content : '',
    notification_type: 'none',
    image: null,
  }));
  const [publishMode, setPublishMode] = useState<NewsPublishMode>(() =>
    editingIsScheduled ? 'schedule' : 'now'
  );
  const [scheduledAt, setScheduledAt] = useState<Date>(initialScheduledAt);
  const [androidPickerVisible, setAndroidPickerVisible] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (publishMode === 'schedule') {
      setScheduledAt((prev) => clampNewsScheduleDate(prev));
    }
  }, [publishMode]);

  const headerTitle = useMemo(() => (mode === 'edit' ? 'Редактировать новость' : 'Новая новость'), [mode]);

  const scheduleMin = getNewsScheduleMinimumDate();
  const scheduleMax = getNewsScheduleMaximumDate();

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      showToast({ title: 'Ошибка', description: 'Нет доступа к галерее', variant: 'destructive', duration: 4000 });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setForm((f) => ({
        ...f,
        image: { uri: asset.uri, type: asset.mimeType ?? 'image/jpeg', name: `image_${Date.now()}.jpg` },
      }));
    }
  }, [showToast]);

  const handleSave = useCallback(async () => {
    setFormError(null);
    const title = form.title.trim();
    const content = form.content.trim();
    if (!title) {
      setFormError('Заголовок обязателен');
      return;
    }
    if (!content) {
      setFormError('Текст новости обязателен');
      return;
    }

    if (showPublishSchedule && publishMode === 'schedule') {
      const minD = getNewsScheduleMinimumDate();
      const maxD = getNewsScheduleMaximumDate();
      if (scheduledAt.getTime() < minD.getTime()) {
        setFormError('Укажите дату и время публикации в будущем');
        return;
      }
      if (scheduledAt.getTime() > maxD.getTime()) {
        setFormError('Дата публикации не может быть позже чем через год');
        return;
      }
    }

    setSubmitting(true);
    const basePayload = {
      title,
      content,
      notification_type: form.notification_type,
      image: form.image ?? undefined,
    };

    let res:
      | { ok: true; data: unknown }
      | { ok: false; error: string };

    if (mode === 'edit' && editingId) {
      if (editingIsScheduled) {
        res = await updateNews(parseInt(editingId, 10), {
          ...basePayload,
          publish_mode: publishMode,
          ...(publishMode === 'schedule' ? { published_at: scheduledAt.toISOString() } : {}),
        });
      } else {
        res = await updateNews(parseInt(editingId, 10), basePayload);
      }
    } else {
      res = await createNews({
        ...basePayload,
        publish_mode: publishMode === 'schedule' ? 'schedule' : 'now',
        ...(publishMode === 'schedule' ? { published_at: scheduledAt.toISOString() } : {}),
      });
    }
    setSubmitting(false);

    if (res.ok) {
      showToast({
        title: mode === 'edit' ? 'Сохранено' : 'Готово',
        description:
          mode === 'edit'
            ? 'Новость обновлена'
            : publishMode === 'schedule'
              ? 'Новость запланирована'
              : 'Новость добавлена',
        variant: 'success',
      });
      router.back();
    } else {
      setFormError(res.error);
      showToast({ title: 'Ошибка', description: res.error, variant: 'destructive', duration: 4000 });
    }
  }, [
    form,
    mode,
    editingId,
    editingIsScheduled,
    showPublishSchedule,
    publishMode,
    scheduledAt,
    router,
    showToast,
  ]);

  const onAndroidScheduleChange = useCallback(
    (event: { type?: string }, date?: Date) => {
      setAndroidPickerVisible(false);
      if (event.type === 'set' && date) setScheduledAt(clampNewsScheduleDate(date));
    },
    []
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: screenBg }]}>
      <ScreenHeader title={headerTitle} inlineTitle hideBackLabel />

      <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
        <ScrollView
          style={styles.form}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        >
          {formError && <ThemedText style={[styles.formError, { color: '#F87171' }]}>{formError}</ThemedText>}

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Заголовок *</ThemedText>
            <RNTextInput
              value={form.title}
              onChangeText={(v) => setForm((f) => ({ ...f, title: v }))}
              placeholder="Заголовок новости"
              placeholderTextColor={textMuted}
              style={[styles.input, { color: text, borderColor: border }]}
            />
          </View>

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Текст новости *</ThemedText>
            <RNTextInput
              value={form.content}
              onChangeText={(v) => setForm((f) => ({ ...f, content: v }))}
              placeholder="Содержание новости"
              placeholderTextColor={textMuted}
              style={[styles.input, styles.inputMultiline, { color: text, borderColor: border }]}
              multiline
              numberOfLines={6}
            />
          </View>

          {showPublishSchedule ? (
            <View style={styles.field}>
              <ThemedText style={[styles.label, { color: textMuted }]}>Публикация</ThemedText>
              <View style={styles.radioRow}>
                <Pressable
                  style={[styles.radio, publishMode === 'now' && { backgroundColor: primary }]}
                  onPress={() => setPublishMode('now')}
                >
                  <ThemedText style={[styles.radioText, publishMode === 'now' && styles.radioTextActive]}>
                    Сейчас
                  </ThemedText>
                </Pressable>
                <Pressable
                  style={[styles.radio, publishMode === 'schedule' && { backgroundColor: primary }]}
                  onPress={() => setPublishMode('schedule')}
                >
                  <ThemedText style={[styles.radioText, publishMode === 'schedule' && styles.radioTextActive]}>
                    Запланировать
                  </ThemedText>
                </Pressable>
              </View>

              {publishMode === 'schedule' ? (
                <View style={styles.scheduleBlock}>
                  {Platform.OS === 'android' ? (
                    <>
                      <Pressable
                        style={[styles.scheduleTap, { borderColor: border }]}
                        onPress={() => setAndroidPickerVisible(true)}
                      >
                        <MaterialIcons name="event" size={22} color={textMuted} />
                        <ThemedText style={{ color: text, fontSize: 16 }}>
                          {formatNewsScheduleDateTime(scheduledAt)}
                        </ThemedText>
                      </Pressable>
                      {androidPickerVisible ? (
                        <DateTimePicker
                          value={scheduledAt}
                          mode="datetime"
                          display="default"
                          minimumDate={scheduleMin}
                          maximumDate={scheduleMax}
                          onChange={onAndroidScheduleChange}
                        />
                      ) : null}
                    </>
                  ) : (
                    <DateTimePicker
                      value={scheduledAt}
                      mode="datetime"
                      display="spinner"
                      minimumDate={scheduleMin}
                      maximumDate={scheduleMax}
                      onChange={(_, date) => date && setScheduledAt(clampNewsScheduleDate(date))}
                    />
                  )}
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Уведомление</ThemedText>
            <View style={styles.radioRow}>
              {NOTIFICATION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.radio, form.notification_type === opt.value && { backgroundColor: primary }]}
                  onPress={() => setForm((f) => ({ ...f, notification_type: opt.value }))}
                >
                  <ThemedText
                    style={[styles.radioText, form.notification_type === opt.value && styles.radioTextActive]}
                  >
                    {opt.label}
                  </ThemedText>
                </Pressable>
              ))}
            </View>
          </View>

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Изображение</ThemedText>
            <Pressable style={[styles.imagePicker, { borderColor: border }]} onPress={pickImage}>
              {form.image ? (
                <Image source={{ uri: form.image.uri }} style={styles.pickedImage} contentFit="cover" />
              ) : mode === 'edit' && initialImageUrl ? (
                <View style={styles.pickedImageWrap}>
                  <Image source={{ uri: initialImageUrl }} style={styles.pickedImage} contentFit="cover" />
                  <ThemedText style={[styles.imageHint, { color: textMuted }]}>Нажмите, чтобы заменить</ThemedText>
                </View>
              ) : (
                <>
                  <MaterialIcons name="add-photo-alternate" size={40} color={textMuted} />
                  <ThemedText style={[styles.imagePickerText, { color: textMuted }]}>Выбрать фото</ThemedText>
                </>
              )}
            </Pressable>
          </View>

          <View style={styles.actions}>
            <Button
              title={submitting ? (mode === 'edit' ? 'Сохранение...' : 'Создание...') : mode === 'edit' ? 'Сохранить' : 'Создать'}
              onPress={handleSave}
              disabled={submitting}
            />
            {submitting ? (
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color={primary} />
                <ThemedText style={[styles.submittingText, { color: textMuted }]}>Пожалуйста, подождите…</ThemedText>
              </View>
            ) : null}
          </View>
        </ScrollView>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  card: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
  },
  form: { padding: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 140, textAlignVertical: 'top' },
  radioRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  radio: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#374151',
  },
  radioText: { fontSize: 14, color: '#9CA3AF' },
  radioTextActive: { color: '#fff' },
  scheduleBlock: { marginTop: 12 },
  scheduleTap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  imagePicker: {
    borderWidth: 1,
    borderRadius: 12,
    borderStyle: 'dashed',
    minHeight: 140,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedImage: { width: '100%', height: 140, borderRadius: 12 },
  pickedImageWrap: { width: '100%' },
  imageHint: { fontSize: 12, marginTop: 6, textAlign: 'center' },
  imagePickerText: { fontSize: 14 },
  formError: { fontSize: 14, marginBottom: 12 },
  actions: { marginTop: 8, gap: 12 },
  submittingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center' },
  submittingText: { fontSize: 14 },
});
