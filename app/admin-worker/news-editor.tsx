import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput as RNTextInput, View } from 'react-native';
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
import { createNews, updateNews, type NotificationType } from '@/lib/news-api';

const NOTIFICATION_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'none', label: 'Без пуша' },
  { value: 'push_sound', label: 'Пуш со звуком' },
  { value: 'push_silent', label: 'Пуш без звука' },
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
  }>();

  const mode = params.mode === 'edit' ? 'edit' : 'create';
  const editingId = mode === 'edit' ? params.id ?? null : null;
  const initialImageUrl = typeof params.imageUrl === 'string' ? params.imageUrl : '';

  const [form, setForm] = useState<FormState>(() => ({
    title: typeof params.title === 'string' ? params.title : '',
    content: typeof params.content === 'string' ? params.content : '',
    notification_type: 'none',
    image: null,
  }));
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const headerTitle = useMemo(() => (mode === 'edit' ? 'Редактировать новость' : 'Новая новость'), [mode]);

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

    setSubmitting(true);
    const payload = {
      title,
      content,
      notification_type: form.notification_type,
      image: form.image ?? undefined,
    };
    const res =
      mode === 'edit' && editingId
        ? await updateNews(parseInt(editingId, 10), payload)
        : await createNews(payload);
    setSubmitting(false);

    if (res.ok) {
      showToast({
        title: mode === 'edit' ? 'Сохранено' : 'Создано',
        description: mode === 'edit' ? 'Новость обновлена' : 'Новость добавлена',
        variant: 'success',
      });
      router.back();
    } else {
      setFormError(res.error);
      showToast({ title: 'Ошибка', description: res.error, variant: 'destructive', duration: 4000 });
    }
  }, [form, mode, editingId, router, showToast]);

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

          <View style={styles.field}>
            <ThemedText style={[styles.label, { color: textMuted }]}>Пуш-уведомление</ThemedText>
            <View style={styles.radioRow}>
              {NOTIFICATION_OPTIONS.map((opt) => (
                <Pressable
                  key={opt.value}
                  style={[styles.radio, form.notification_type === opt.value && { backgroundColor: primary }]}
                  onPress={() => setForm((f) => ({ ...f, notification_type: opt.value }))}
                >
                  <ThemedText style={[styles.radioText, form.notification_type === opt.value && styles.radioTextActive]}>
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
            {submitting && (
              <View style={styles.submittingRow}>
                <ActivityIndicator size="small" color={primary} />
                <ThemedText style={[styles.submittingText, { color: textMuted }]}>Пожалуйста, подождите…</ThemedText>
              </View>
            )}
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

