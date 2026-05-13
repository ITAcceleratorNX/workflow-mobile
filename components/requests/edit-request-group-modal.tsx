import { useEffect, useMemo, useState } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { Select } from '@/components/ui';
import { COMPLEXITY_OPTIONS, REQUEST_TYPE_OPTIONS, SLA_OPTIONS } from '@/constants/requests';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { RequestGroup, UpdateRequestGroupPayload } from '@/lib/api';

import { useBottomSheetScrollMetrics } from './use-bottom-sheet-scroll-metrics';
import { useSheetPanDismiss } from './use-sheet-pan-dismiss';

type EditableSubRequestState = {
  title: string;
  description: string;
  complexity: string;
  sla: string;
  category_id?: number;
};

interface EditRequestGroupModalProps {
  visible: boolean;
  request: RequestGroup | null;
  categories: { id: number; name: string }[];
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (body: UpdateRequestGroupPayload) => Promise<void>;
}

export function EditRequestGroupModal({
  visible,
  request,
  categories,
  loading = false,
  error,
  onClose,
  onSubmit,
}: EditRequestGroupModalProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const [requestType, setRequestType] = useState('normal');
  const [locationDetail, setLocationDetail] = useState('');
  const [subRequests, setSubRequests] = useState<Record<number, EditableSubRequestState>>({});
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  const {
    scrollViewStyle,
    onScrollContentSizeChange,
    scrollEnabled,
    sheetPaddingBottom,
  } = useBottomSheetScrollMetrics({ visible, keyboardVisible });

  const { panGesture, sheetAnimatedStyle } = useSheetPanDismiss({
    visible,
    onClose,
    dismissAllowed: !loading,
  });

  useEffect(() => {
    if (!visible || !request) return;
    setRequestType(request.request_type ?? 'normal');
    setLocationDetail(request.location_detail ?? '');
    const next: Record<number, EditableSubRequestState> = {};
    (request.requests ?? []).forEach((sr) => {
      next[sr.id] = {
        title: sr.title ?? '',
        description: sr.description ?? '',
        complexity: sr.complexity ?? '',
        sla: sr.sla ?? '',
        category_id: sr.category_id ?? undefined,
      };
    });
    setSubRequests(next);
  }, [visible, request]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShowSub = Keyboard.addListener(showEvent, () => {
      setKeyboardVisible(true);
    });
    const onHideSub = Keyboard.addListener(hideEvent, () => {
      setKeyboardVisible(false);
    });
    return () => {
      onShowSub.remove();
      onHideSub.remove();
    };
  }, []);

  const categoryOptions = useMemo(
    () => categories.map((c) => ({ value: String(c.id), label: c.name })),
    [categories]
  );

  const updateSubRequest = (
    subRequestId: number,
    key: keyof EditableSubRequestState,
    value: string | number | undefined
  ) => {
    setSubRequests((prev) => ({
      ...prev,
      [subRequestId]: {
        ...(prev[subRequestId] ?? {
          title: '',
          description: '',
          complexity: '',
          sla: '',
          category_id: undefined,
        }),
        [key]: value,
      },
    }));
  };

  const handleSave = async () => {
    if (!request) return;

    const updateData: UpdateRequestGroupPayload = {};

    if (requestType && requestType !== request.request_type) {
      updateData.request_type = requestType;
    }

    const normalizedLocationDetail = locationDetail.trim();
    if (normalizedLocationDetail !== (request.location_detail ?? '')) {
      updateData.location_detail = normalizedLocationDetail;
    }

    const subRequestUpdates: NonNullable<UpdateRequestGroupPayload['sub_requests']> = [];

    (request.requests ?? []).forEach((sr) => {
      const editable = subRequests[sr.id];
      if (!editable) return;

      const hasChanges =
        editable.title !== (sr.title ?? '') ||
        editable.description !== (sr.description ?? '') ||
        editable.complexity !== (sr.complexity ?? '') ||
        editable.sla !== (sr.sla ?? '') ||
        (editable.category_id ?? null) !== (sr.category_id ?? null);

      if (!hasChanges) return;

      const updateItem: NonNullable<UpdateRequestGroupPayload['sub_requests']>[number] = {
        id: sr.id,
      };

      if (editable.title !== (sr.title ?? '')) updateItem.title = editable.title;
      if (editable.description !== (sr.description ?? '')) {
        updateItem.description = editable.description;
      }
      if (editable.complexity !== (sr.complexity ?? '')) {
        updateItem.complexity = editable.complexity;
      }
      if (editable.sla !== (sr.sla ?? '')) updateItem.sla = editable.sla;
      if ((editable.category_id ?? null) !== (sr.category_id ?? null) && editable.category_id) {
        updateItem.category_id = editable.category_id;
      }

      subRequestUpdates.push(updateItem);
    });

    if (subRequestUpdates.length > 0) {
      updateData.sub_requests = subRequestUpdates;
    }

    if (Object.keys(updateData).length === 0) {
      onClose();
      return;
    }

    await onSubmit(updateData);
  };

  const typeDisabled = request?.request_type === 'planned';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={styles.overlay}>
          <Pressable style={styles.backdrop} onPress={onClose} />
          <Animated.View
            style={[
              styles.sheet,
              sheetAnimatedStyle,
              {
                backgroundColor: cardBackground,
                borderColor,
                paddingBottom: sheetPaddingBottom,
              },
            ]}
          >
            <GestureDetector gesture={panGesture}>
              <View style={styles.sheetGrabRegion}>
                <View style={styles.sheetHandleHit}>
                  <View style={styles.handle} />
                </View>
                <ThemedText style={[styles.title, { color: textColor }]}>
                  Редактировать заявку
                </ThemedText>
              </View>
            </GestureDetector>

            <ScrollView
              style={[styles.content, scrollViewStyle]}
              scrollEnabled={scrollEnabled}
              bounces={scrollEnabled && Platform.OS === 'ios'}
              alwaysBounceVertical={scrollEnabled && Platform.OS === 'ios'}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
              contentContainerStyle={styles.contentContainer}
              onContentSizeChange={onScrollContentSizeChange}
            >
              <ThemedText style={[styles.label, { color: mutedColor }]}>Тип заявки</ThemedText>
              <Select
                value={requestType}
                onValueChange={setRequestType}
                options={REQUEST_TYPE_OPTIONS}
                placeholder="Выберите тип"
                disabled={typeDisabled}
              />

              <ThemedText style={[styles.label, { color: mutedColor }]}>
                Локация в офисе
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: textColor, borderColor, backgroundColor },
                ]}
                placeholder="Укажите локацию"
                placeholderTextColor={mutedColor}
                value={locationDetail}
                onChangeText={setLocationDetail}
                multiline
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />

              {(request?.requests ?? []).map((sr) => {
                const editable = subRequests[sr.id];
                if (!editable) return null;
                return (
                  <View key={sr.id} style={[styles.subBlock, { borderColor }]}>
                    <ThemedText style={[styles.subTitle, { color: textColor }]}>
                      {sr.title || `Подзаявка #${sr.id}`}
                    </ThemedText>

                    <ThemedText style={[styles.subLabel, { color: mutedColor }]}>Название</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        { color: textColor, borderColor, backgroundColor },
                      ]}
                      value={editable.title}
                      onChangeText={(v) => updateSubRequest(sr.id, 'title', v)}
                      placeholder="Название подзаявки"
                      placeholderTextColor={mutedColor}
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    <ThemedText style={[styles.subLabel, { color: mutedColor }]}>Описание</ThemedText>
                    <TextInput
                      style={[
                        styles.input,
                        styles.descriptionInput,
                        { color: textColor, borderColor, backgroundColor },
                      ]}
                      value={editable.description}
                      onChangeText={(v) => updateSubRequest(sr.id, 'description', v)}
                      placeholder="Описание подзаявки"
                      placeholderTextColor={mutedColor}
                      multiline
                      returnKeyType="done"
                      blurOnSubmit
                      onSubmitEditing={Keyboard.dismiss}
                    />

                    <ThemedText style={[styles.subLabel, { color: mutedColor }]}>Категория</ThemedText>
                    <Select
                      value={editable.category_id ? String(editable.category_id) : ''}
                      onValueChange={(v) => updateSubRequest(sr.id, 'category_id', Number(v))}
                      options={categoryOptions}
                      placeholder="Выберите категорию"
                    />

                    <View style={styles.row}>
                      <View style={styles.rowField}>
                        <ThemedText style={[styles.subLabel, { color: mutedColor }]}>
                          Время (SLA)
                        </ThemedText>
                        <Select
                          value={editable.sla}
                          onValueChange={(v) => updateSubRequest(sr.id, 'sla', v)}
                          options={SLA_OPTIONS}
                          placeholder="Выберите"
                        />
                      </View>
                      <View style={styles.rowField}>
                        <ThemedText style={[styles.subLabel, { color: mutedColor }]}>
                          Сложность
                        </ThemedText>
                        <Select
                          value={editable.complexity}
                          onValueChange={(v) => updateSubRequest(sr.id, 'complexity', v)}
                          options={COMPLEXITY_OPTIONS}
                          placeholder="Выберите"
                        />
                      </View>
                    </View>
                  </View>
                );
              })}

              {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}
          </ScrollView>

          {keyboardVisible && (
            <View style={styles.keyboardToolbar}>
              <Pressable
                onPress={Keyboard.dismiss}
                style={({ pressed }) => [
                  styles.keyboardDoneButton,
                  { borderColor },
                  pressed && styles.actionButtonPressed,
                ]}
              >
                <ThemedText style={[styles.keyboardDoneLabel, { color: textColor }]}>
                  Готово
                </ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={handleSave}
              disabled={loading}
              style={({ pressed }) => [
                styles.actionButton,
                styles.saveButton,
                loading && styles.actionButtonDisabled,
                pressed && !loading && styles.actionButtonPressed,
              ]}
            >
              <ThemedText style={[styles.actionLabel, styles.actionLabelPrimary]}>
                {loading ? 'Сохранение...' : 'Сохранить'}
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={onClose}
              disabled={loading}
              style={({ pressed }) => [
                styles.actionButton,
                styles.actionButtonSecondary,
                { borderColor },
                pressed && styles.actionButtonPressed,
              ]}
            >
              <ThemedText style={[styles.actionLabel, { color: textColor }]}>Отмена</ThemedText>
            </Pressable>
          </View>
          </Animated.View>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    maxHeight: '92%',
  },
  sheetGrabRegion: {
    marginHorizontal: -16,
    paddingHorizontal: 16,
  },
  sheetHandleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 4,
    paddingBottom: 8,
    minHeight: 36,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(148,163,184,0.8)',
    alignSelf: 'center',
  },
  title: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '700',
    marginBottom: 12,
  },
  content: {},
  contentContainer: {
    paddingBottom: 8,
  },
  keyboardToolbar: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  keyboardDoneButton: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  keyboardDoneLabel: {
    fontSize: 13,
    fontWeight: '600',
  },
  label: {
    fontSize: 13,
    marginBottom: 8,
    marginTop: 6,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    fontSize: 15,
    marginBottom: 8,
  },
  descriptionInput: {
    minHeight: 96,
    textAlignVertical: 'top',
  },
  subBlock: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginTop: 14,
    marginBottom: 4,
  },
  subTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  subLabel: {
    fontSize: 12,
    marginBottom: 6,
    marginTop: 4,
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  rowField: {
    flex: 1,
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 10,
  },
  actions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    borderRadius: 10,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionButtonSecondary: {
    backgroundColor: 'transparent',
  },
  saveButton: {
    backgroundColor: '#B8400E',
    borderColor: '#B8400E',
  },
  actionButtonPressed: {
    opacity: 0.8,
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionLabelPrimary: {
    color: '#FFF',
  },
});
