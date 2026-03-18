import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Button } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  getNewsAdminList,
  createNews,
  updateNews,
  deleteNews,
  hideNews,
  archiveNews,
  unhideNews,
  type NewsDisplayItem,
  type NotificationType,
} from '@/lib/news-api';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatNewsDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_OPTIONS = [
  { value: '', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'hidden', label: 'Скрытые' },
  { value: 'archived', label: 'Архив' },
] as const;

const NOTIFICATION_OPTIONS: { value: NotificationType; label: string }[] = [
  { value: 'none', label: 'Без пуша' },
  { value: 'push_sound', label: 'Пуш со звуком' },
  { value: 'push_silent', label: 'Пуш без звука' },
];

const INITIAL_FORM = {
  title: '',
  content: '',
  notification_type: 'none' as NotificationType,
  image: null as { uri: string; type?: string; name?: string } | null,
};

export default function AdminWorkerNewsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const [items, setItems] = useState<NewsDisplayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<'active' | 'hidden' | 'archived' | ''>('');
  const [modalVisible, setModalVisible] = useState(false);
  const [formMode, setFormMode] = useState<'create' | 'edit'>('create');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(INITIAL_FORM);
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    setLoading(true);
    const status = statusFilter || undefined;
    const res = await getNewsAdminList(status as 'active' | 'hidden' | 'archived' | undefined);
    if (res.ok) setItems(res.data);
    else setItems([]);
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const openCreate = useCallback(() => {
    setFormMode('create');
    setEditingId(null);
    setForm(INITIAL_FORM);
    setEditingImageUrl(null);
    setFormError(null);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((item: NewsDisplayItem) => {
    setFormMode('edit');
    setEditingId(item.id);
    setForm({
      title: item.title,
      content: item.desc,
      notification_type: 'none',
      image: null,
    });
    setEditingImageUrl(item.image);
    setFormError(null);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => {
    setModalVisible(false);
    setEditingId(null);
    setEditingImageUrl(null);
    setFormError(null);
  }, []);

  const pickImage = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      show({ title: 'Ошибка', description: 'Нет доступа к галерее', variant: 'destructive' });
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
  }, [show]);

  const handleSave = useCallback(async () => {
    setFormError(null);
    const { title, content } = form;
    if (!title.trim()) {
      setFormError('Заголовок обязателен');
      return;
    }
    if (!content.trim()) {
      setFormError('Текст новости обязателен');
      return;
    }
    setSubmitting(true);
    const params = {
      title: title.trim(),
      content: content.trim(),
      notification_type: form.notification_type,
      image: form.image ?? undefined,
    };
    const res =
      formMode === 'edit' && editingId
        ? await updateNews(parseInt(editingId, 10), params)
        : await createNews(params);
    setSubmitting(false);
    if (res.ok) {
      show({
        title: formMode === 'edit' ? 'Сохранено' : 'Создано',
        description: formMode === 'edit' ? 'Новость обновлена' : 'Новость добавлена',
        variant: 'success',
      });
      closeModal();
      loadList();
    } else {
      setFormError(res.error);
      show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
    }
  }, [form, formMode, editingId, show, closeModal, loadList]);

  const handleDelete = useCallback(
    (item: NewsDisplayItem) => {
      Alert.alert(
        'Удалить новость?',
        `«${item.title}» будет удалена безвозвратно.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              const numId = parseInt(item.id, 10);
              if (isNaN(numId)) return;
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              setActionId(item.id);
              const res = await deleteNews(numId);
              setActionId(null);
              if (res.ok) {
                show({ title: 'Удалено', description: 'Новость удалена', variant: 'success' });
                loadList();
              } else {
                show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
              }
            },
          },
        ]
      );
    },
    [show, loadList]
  );

  const handleHide = useCallback(
    async (id: string) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActionId(id);
      const res = await hideNews(numId);
      setActionId(null);
      if (res.ok) {
        show({ title: 'Скрыто', description: 'Новость скрыта с главной', variant: 'success' });
        loadList();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    },
    [show, loadList]
  );

  const handleArchive = useCallback(
    async (id: string) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActionId(id);
      const res = await archiveNews(numId);
      setActionId(null);
      if (res.ok) {
        show({ title: 'Архивировано', description: 'Новость архивирована', variant: 'success' });
        loadList();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    },
    [show, loadList]
  );

  const handleUnhide = useCallback(
    async (id: string) => {
      const numId = parseInt(id, 10);
      if (isNaN(numId)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setActionId(id);
      const res = await unhideNews(numId);
      setActionId(null);
      if (res.ok) {
        show({ title: 'Восстановлено', description: 'Новость снова активна', variant: 'success' });
        loadList();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    },
    [show, loadList]
  );

  const sortedItems = [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''));

  const renderItem = useCallback(
    ({ item }: { item: NewsDisplayItem }) => {
      const status = item.status ?? 'active';
      const isBusy = actionId === item.id;
      return (
        <View style={[styles.row, { backgroundColor: gray600, borderColor: border }]}>
          {item.image ? (
            <Image source={{ uri: item.image }} style={styles.rowImage} contentFit="cover" />
          ) : (
            <View style={[styles.rowImagePlaceholder, { backgroundColor: primary }]}>
              <MaterialIcons name="image" size={32} color="#fff" />
            </View>
          )}
          <View style={styles.rowContent}>
            <View style={styles.rowMeta}>
              <View style={[styles.tag, { backgroundColor: primary }]}>
                <ThemedText style={styles.tagText}>{item.tag || 'Новость'}</ThemedText>
              </View>
              <View style={[styles.statusBadge, status === 'active' && styles.statusActive, status === 'hidden' && styles.statusHidden, status === 'archived' && styles.statusArchived]}>
                <ThemedText style={styles.statusText}>
                  {status === 'active' ? 'Активна' : status === 'hidden' ? 'Скрыта' : 'Архив'}
                </ThemedText>
              </View>
            </View>
            <ThemedText style={[styles.rowTitle, { color: text }]} numberOfLines={2}>
              {item.title}
            </ThemedText>
            {item.date && (
              <ThemedText style={[styles.rowDate, { color: textMuted }]}>{formatNewsDate(item.date)}</ThemedText>
            )}
          </View>
          <View style={styles.rowActions}>
            <Pressable
              onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); openEdit(item); }}
              disabled={isBusy}
              style={styles.actionBtn}
            >
              <MaterialIcons name="edit" size={20} color={primary} />
            </Pressable>
            <Pressable onPress={() => handleDelete(item)} disabled={isBusy} style={styles.actionBtn}>
              <MaterialIcons name="delete-outline" size={20} color="#F87171" />
            </Pressable>
            {status === 'active' && (
              <Pressable onPress={() => handleHide(item.id)} disabled={isBusy} style={styles.actionBtn}>
                {isBusy ? <ActivityIndicator size="small" color={textMuted} /> : <MaterialIcons name="visibility-off" size={20} color={textMuted} />}
              </Pressable>
            )}
            {(status === 'active' || status === 'hidden') && (
              <Pressable onPress={() => handleArchive(item.id)} disabled={isBusy} style={styles.actionBtn}>
                <MaterialIcons name="archive" size={20} color="#F59E0B" />
              </Pressable>
            )}
            {(status === 'hidden' || status === 'archived') && (
              <Pressable onPress={() => handleUnhide(item.id)} disabled={isBusy} style={styles.actionBtn}>
                <MaterialIcons name="visibility" size={20} color={primary} />
              </Pressable>
            )}
          </View>
        </View>
      );
    },
    [text, textMuted, primary, gray600, border, openEdit, handleDelete, handleHide, handleArchive, handleUnhide, actionId]
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8, backgroundColor: screenBg }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={24} color={primary} />
          <ThemedText style={[styles.backLabel, { color: primary }]}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Управление новостями
        </ThemedText>
      </View>

      <View style={[styles.filters, { borderColor: border }]}>
        <ThemedText style={[styles.filterLabel, { color: textMuted }]}>Статус</ThemedText>
        <View style={styles.filterChips}>
          {STATUS_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value || 'all'}
              style={[styles.chip, { backgroundColor: statusFilter === opt.value ? primary : gray600 }]}
              onPress={() => setStatusFilter(opt.value as typeof statusFilter)}
            >
              <ThemedText style={styles.chipText}>{opt.label}</ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      <Pressable style={[styles.addBtn, { backgroundColor: primary }]} onPress={openCreate}>
        <MaterialIcons name="add" size={24} color="#fff" />
        <ThemedText style={styles.addBtnText}>Добавить новость</ThemedText>
      </Pressable>

      {loading ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primary} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
        </View>
      ) : (
        <FlatList
          data={sortedItems}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <ThemedText style={[styles.emptyText, { color: textMuted }]}>Нет новостей. Добавьте первую.</ThemedText>
            </View>
          }
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal visible={modalVisible} transparent animationType="fade" onRequestClose={closeModal}>
        <Pressable style={styles.modalOverlay} onPress={closeModal}>
          <Pressable style={[styles.modalContent, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <ThemedText type="title" style={[styles.modalTitle, { color: text }]}>
                {formMode === 'edit' ? 'Редактировать новость' : 'Новая новость'}
              </ThemedText>
              <Pressable onPress={closeModal}>
                <MaterialIcons name="close" size={24} color={textMuted} />
              </Pressable>
            </View>
            <ScrollView style={styles.form} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              {formError && (
                <ThemedText style={[styles.formError, { color: '#F87171' }]}>{formError}</ThemedText>
              )}
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
                  numberOfLines={4}
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
                  ) : formMode === 'edit' && editingImageUrl ? (
                    <View style={styles.pickedImageWrap}>
                      <Image source={{ uri: editingImageUrl }} style={styles.pickedImage} contentFit="cover" />
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
              <View style={styles.modalActions}>
                <Button
                  title={submitting ? (formMode === 'edit' ? 'Сохранение...' : 'Создание...') : (formMode === 'edit' ? 'Сохранить' : 'Создать')}
                  onPress={handleSave}
                  disabled={submitting}
                />
                <Pressable onPress={closeModal} style={styles.cancelBtn}>
                  <ThemedText style={[styles.cancelText, { color: textMuted }]}>Отмена</ThemedText>
                </Pressable>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    marginBottom: 8,
  },
  backLabel: { fontSize: 16, marginLeft: 4 },
  title: { fontSize: 20, fontWeight: 'bold' },
  filters: {
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  filterLabel: { fontSize: 14, marginBottom: 8 },
  filterChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  chipText: { fontSize: 14, color: '#fff' },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  addBtnText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  loadingBox: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 },
  loadingText: { fontSize: 16 },
  listContent: { paddingHorizontal: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
  },
  rowImage: { width: 64, height: 64, borderRadius: 8, marginRight: 12 },
  rowImagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: 8,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowContent: { flex: 1, minWidth: 0 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 },
  tag: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  tagText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#6B7280',
  },
  statusActive: { backgroundColor: '#10B981' },
  statusHidden: { backgroundColor: '#F59E0B' },
  statusArchived: { backgroundColor: '#6B7280' },
  statusText: { fontSize: 10, color: '#fff' },
  rowTitle: { fontSize: 16, fontWeight: '600' },
  rowDate: { fontSize: 12, marginTop: 4 },
  rowActions: { flexDirection: 'row', gap: 4 },
  actionBtn: { padding: 8 },
  separator: { height: 8 },
  empty: { paddingVertical: 48, alignItems: 'center' },
  emptyText: { fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    borderRadius: 20,
    overflow: 'hidden',
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18 },
  form: { padding: 20 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, marginBottom: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  inputMultiline: { minHeight: 100, textAlignVertical: 'top' },
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
    minHeight: 120,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pickedImage: { width: '100%', height: 120, borderRadius: 12 },
  pickedImageWrap: { width: '100%', position: 'relative' },
  imageHint: { fontSize: 12, marginTop: 4, textAlign: 'center' },
  imagePickerText: { fontSize: 14 },
  formError: { fontSize: 14, marginBottom: 12 },
  modalActions: { marginTop: 8, gap: 12 },
  cancelBtn: { alignItems: 'center', paddingVertical: 12 },
  cancelText: { fontSize: 16 },
});
