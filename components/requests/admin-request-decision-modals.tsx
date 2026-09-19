import { useCallback, useEffect, useMemo, useState } from 'react';
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
import {
  COMPLEXITY_OPTIONS,
  formatServiceCategoryDisplayName,
  matchServiceCategoryInOffice,
  REQUEST_TYPE_OPTIONS,
  SLA_OPTIONS,
  type OfficeServiceCategory,
} from '@/constants/requests';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  getSubRequestCategoryId,
  type AcceptSubRequestPayload,
  type Office,
  type RequestGroup,
} from '@/lib/api';

import { useBottomSheetScrollMetrics } from './use-bottom-sheet-scroll-metrics';
import { useSheetPanDismiss } from './use-sheet-pan-dismiss';

export type AdminAcceptRequestPayload = {
  request_type: string;
  location_detail?: string;
  office_id: number;
  sub_requests: AcceptSubRequestPayload[];
};

interface AdminAcceptRequestModalProps {
  visible: boolean;
  request: RequestGroup | null;
  offices: Office[];
  /** Категории выбранного офиса: грузятся родителем по onOfficeChange. */
  categories: OfficeServiceCategory[];
  categoriesLoading?: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Офис, выбранный в модалке (null — не выбран): родитель грузит его категории. */
  onOfficeChange: (officeId: number | null) => void;
  onAccept: (payload: AdminAcceptRequestPayload) => Promise<void>;
}

export function AdminAcceptRequestModal({
  visible,
  request,
  offices,
  categories,
  categoriesLoading = false,
  loading = false,
  error,
  onClose,
  onOfficeChange,
  onAccept,
}: AdminAcceptRequestModalProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const dangerColor = useThemeColor({}, 'danger');

  const [requestType, setRequestType] = useState('normal');
  const [locationDetail, setLocationDetail] = useState('');
  const [officeId, setOfficeId] = useState('');
  const [subSettings, setSubSettings] = useState<
    Record<number, { sla: string; complexity: string }>
  >({});
  /** category_id подзаявки в выбранном офисе (строка — значение Select). */
  const [subCategoryIds, setSubCategoryIds] = useState<Record<number, string>>({});
  const [localError, setLocalError] = useState<string | null>(null);
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

  const officeOptions = offices.map((o) => ({ value: String(o.id), label: o.name }));

  const subRequests = useMemo(() => request?.requests ?? [], [request]);

  const keepsOriginalOffice =
    request != null && Number(officeId) === Number(request.office_id);

  /**
   * Категории выбранного офиса. Для родного офиса заявки добавляем её текущую
   * категорию, даже если её нет в справочнике (переименована / удалена), —
   * иначе принять заявку без смены офиса стало бы невозможно.
   */
  const availableCategories = useMemo(() => {
    const byId = new Map(categories.map((c) => [c.id, { id: c.id, name: c.name }]));
    if (keepsOriginalOffice) {
      subRequests.forEach((sr) => {
        const id = getSubRequestCategoryId(sr);
        if (id != null && !byId.has(id)) {
          byId.set(id, { id, name: sr.category?.name ?? `Категория #${id}` });
        }
      });
    }
    return [...byId.values()];
  }, [categories, keepsOriginalOffice, subRequests]);

  const categoryOptions = useMemo(
    () =>
      availableCategories.map((c) => ({
        value: String(c.id),
        label: formatServiceCategoryDisplayName(c.name),
      })),
    [availableCategories]
  );

  useEffect(() => {
    if (!visible || !request) return;
    setRequestType(request.request_type ?? 'normal');
    setLocationDetail(request.location_detail ?? '');
    setOfficeId(String(request.office_id ?? ''));
    setSubSettings({});
    setSubCategoryIds({});
    setLocalError(null);
  }, [visible, request]);

  /** Родитель грузит категории выбранного офиса: они нужны для подзаявок. */
  useEffect(() => {
    if (!visible) return;
    const parsed = Number(officeId);
    onOfficeChange(Number.isInteger(parsed) && parsed > 0 ? parsed : null);
  }, [visible, officeId, onOfficeChange]);

  /**
   * Категории принадлежат офису, поэтому при смене офиса подбираем категорию
   * нового офиса по направлению заявки; своя категория офиса остаётся как есть.
   */
  useEffect(() => {
    if (!visible || categoriesLoading) return;
    setSubCategoryIds(() => {
      const next: Record<number, string> = {};
      subRequests.forEach((sr) => {
        const currentId = getSubRequestCategoryId(sr);
        const keepsCurrent =
          currentId != null && availableCategories.some((c) => c.id === currentId);
        const matchedId = keepsCurrent
          ? currentId
          : matchServiceCategoryInOffice(sr.category?.name, availableCategories);
        next[sr.id] = matchedId != null ? String(matchedId) : '';
      });
      return next;
    });
  }, [visible, availableCategories, categoriesLoading, subRequests]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShowSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const onHideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      onShowSub.remove();
      onHideSub.remove();
    };
  }, []);

  const displayError = localError ?? error;

  const setSubCategory = useCallback((subRequestId: number, value: string) => {
    setSubCategoryIds((prev) => ({ ...prev, [subRequestId]: value }));
  }, []);

  const handleAccept = async () => {
    if (!request) return;
    const parsedOffice = Number(officeId);
    if (!Number.isInteger(parsedOffice) || parsedOffice <= 0) {
      setLocalError('Выберите офис');
      return;
    }
    if (categoriesLoading) {
      setLocalError('Категории офиса ещё загружаются');
      return;
    }
    if (requestType !== 'planned') {
      const allHave = subRequests.every((sr) => {
        const s = subSettings[sr.id];
        return s?.sla && s?.complexity;
      });
      if (!allHave) {
        setLocalError('Укажите время выполнения и сложность для всех подзаявок');
        return;
      }
    }
    // Категория чужого офиса оставит заявку на исполнителях прежнего офиса.
    const allHaveCategory = subRequests.every((sr) => {
      const picked = Number(subCategoryIds[sr.id]);
      return Number.isInteger(picked) && availableCategories.some((c) => c.id === picked);
    });
    if (!allHaveCategory) {
      setLocalError('Выберите категорию выбранного офиса для всех подзаявок');
      return;
    }
    setLocalError(null);
    const sub_requests: AcceptSubRequestPayload[] = subRequests.map((sr) => {
      const s = subSettings[sr.id];
      return {
        id: sr.id,
        sla: requestType === 'planned' ? null : s?.sla ?? null,
        complexity: requestType === 'planned' ? null : s?.complexity ?? null,
        category_id: Number(subCategoryIds[sr.id]),
      };
    });
    const payload: AdminAcceptRequestPayload = {
      request_type: requestType,
      location_detail: locationDetail.trim() || undefined,
      office_id: parsedOffice,
      sub_requests,
    };
    await onAccept(payload);
  };

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
                  Передать Офис-менеджеру
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
            />

            <ThemedText style={[styles.label, { color: mutedColor }]}>Офис</ThemedText>
            <Select
              value={officeId}
              onValueChange={setOfficeId}
              options={officeOptions}
              placeholder="Выберите офис"
            />

            {!categoriesLoading && categoryOptions.length === 0 ? (
              <ThemedText style={[styles.hint, { color: mutedColor }]}>
                В выбранном офисе нет категорий услуг — заявку нельзя направить в этот
                офис.
              </ThemedText>
            ) : null}

            <ThemedText style={[styles.label, { color: mutedColor }]}>
              {requestType === 'planned'
                ? 'Категория по подзаявкам'
                : 'Категория, время и сложность по подзаявкам'}
            </ThemedText>
            {subRequests.map((sr) => (
              <View key={sr.id} style={[styles.subBlock, { borderColor }]}>
                <ThemedText style={[styles.subTitle, { color: textColor }]}>
                  {sr.title || `Подзаявка #${sr.id}`}
                </ThemedText>
                <ThemedText style={[styles.subLabel, { color: mutedColor }]}>
                  Категория
                </ThemedText>
                <Select
                  value={subCategoryIds[sr.id] ?? ''}
                  onValueChange={(v) => setSubCategory(sr.id, v)}
                  options={categoryOptions}
                  placeholder={categoriesLoading ? 'Загрузка...' : 'Выберите категорию'}
                  disabled={categoriesLoading || categoryOptions.length === 0}
                />
                {requestType !== 'planned' && (
                  <View style={styles.row}>
                    <View style={styles.rowField}>
                      <ThemedText style={[styles.subLabel, { color: mutedColor }]}>
                        Время (SLA)
                      </ThemedText>
                      <Select
                        value={subSettings[sr.id]?.sla ?? ''}
                        onValueChange={(v) =>
                          setSubSettings((prev) => ({
                            ...prev,
                            [sr.id]: {
                              sla: v,
                              complexity: prev[sr.id]?.complexity ?? '',
                            },
                          }))
                        }
                        options={SLA_OPTIONS}
                        placeholder="Выберите"
                      />
                    </View>
                    <View style={styles.rowField}>
                      <ThemedText style={[styles.subLabel, { color: mutedColor }]}>
                        Сложность
                      </ThemedText>
                      <Select
                        value={subSettings[sr.id]?.complexity ?? ''}
                        onValueChange={(v) =>
                          setSubSettings((prev) => ({
                            ...prev,
                            [sr.id]: {
                              sla: prev[sr.id]?.sla ?? '',
                              complexity: v,
                            },
                          }))
                        }
                        options={COMPLEXITY_OPTIONS}
                        placeholder="Выберите"
                      />
                    </View>
                  </View>
                )}
              </View>
            ))}

            <ThemedText style={[styles.label, { color: mutedColor }]}>
              Локация в офисе (необязательно)
            </ThemedText>
            <TextInput
              style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
              placeholder="Укажите локацию"
              placeholderTextColor={mutedColor}
              value={locationDetail}
              onChangeText={setLocationDetail}
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />

            {displayError ? (
              <ThemedText style={[styles.error, { color: dangerColor }]}>{displayError}</ThemedText>
            ) : null}
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
                <ThemedText style={[styles.keyboardDoneLabel, { color: textColor }]}>Готово</ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={handleAccept}
              disabled={loading}
              style={({ pressed }) => [
                styles.actionButton,
                styles.saveButton,
                loading && styles.actionButtonDisabled,
                pressed && !loading && styles.actionButtonPressed,
              ]}
            >
              <ThemedText style={[styles.actionLabel, styles.actionLabelPrimary]}>
                {loading ? 'Отправка...' : 'Передать'}
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

interface AdminRejectRequestModalProps {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onReject: (reason: string) => Promise<void>;
}

export function AdminRejectRequestModal({
  visible,
  loading = false,
  error,
  onClose,
  onReject,
}: AdminRejectRequestModalProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const dangerColor = useThemeColor({}, 'danger');

  const [reason, setReason] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);
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
    if (!visible) return;
    setReason('');
    setLocalError(null);
  }, [visible]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const onShowSub = Keyboard.addListener(showEvent, () => setKeyboardVisible(true));
    const onHideSub = Keyboard.addListener(hideEvent, () => setKeyboardVisible(false));
    return () => {
      onShowSub.remove();
      onHideSub.remove();
    };
  }, []);

  const displayError = localError ?? error;

  const handleReject = async () => {
    const t = reason.trim();
    if (!t) {
      setLocalError('Укажите причину отклонения');
      return;
    }
    setLocalError(null);
    await onReject(t);
  };

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
                <ThemedText style={[styles.title, { color: textColor }]}>Отклонить заявку</ThemedText>
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
            <ThemedText style={[styles.label, { color: mutedColor }]}>
              Укажите причину отклонения
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                styles.descriptionInput,
                { color: textColor, borderColor, backgroundColor },
              ]}
              placeholder="Причина отклонения..."
              placeholderTextColor={mutedColor}
              value={reason}
              onChangeText={setReason}
              multiline
              returnKeyType="done"
              blurOnSubmit
              onSubmitEditing={Keyboard.dismiss}
            />

            {displayError ? (
              <ThemedText style={[styles.error, { color: dangerColor }]}>{displayError}</ThemedText>
            ) : null}
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
                <ThemedText style={[styles.keyboardDoneLabel, { color: textColor }]}>Готово</ThemedText>
              </Pressable>
            </View>
          )}

          <View style={styles.actions}>
            <Pressable
              onPress={handleReject}
              disabled={loading || !reason.trim()}
              style={({ pressed }) => [
                styles.actionButton,
                styles.rejectPrimaryButton,
                (loading || !reason.trim()) && styles.actionButtonDisabled,
                pressed && !loading && reason.trim() && styles.actionButtonPressed,
              ]}
            >
              <ThemedText style={[styles.actionLabel, styles.actionLabelPrimary]}>
                {loading ? 'Отправка...' : 'Отклонить'}
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
    minHeight: 120,
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
    fontSize: 13,
    marginTop: 10,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
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
  rejectPrimaryButton: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
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
