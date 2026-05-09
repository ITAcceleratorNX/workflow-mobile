import { useEffect, useState } from 'react';
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
  REQUEST_TYPE_OPTIONS,
  SLA_OPTIONS,
} from '@/constants/requests';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { AcceptSubRequestPayload, Office, RequestGroup } from '@/lib/api';

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
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onAccept: (payload: AdminAcceptRequestPayload) => Promise<void>;
}

export function AdminAcceptRequestModal({
  visible,
  request,
  offices,
  loading = false,
  error,
  onClose,
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

  useEffect(() => {
    if (!visible || !request) return;
    setRequestType(request.request_type ?? 'normal');
    setLocationDetail(request.location_detail ?? '');
    setOfficeId(String(request.office_id ?? ''));
    setSubSettings({});
    setLocalError(null);
  }, [visible, request]);

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

  const handleAccept = async () => {
    if (!request) return;
    if (requestType !== 'planned') {
      const allHave = (request.requests ?? []).every((sr) => {
        const s = subSettings[sr.id];
        return s?.sla && s?.complexity;
      });
      if (!allHave) {
        setLocalError('Укажите время выполнения и сложность для всех подзаявок');
        return;
      }
    }
    setLocalError(null);
    const sub_requests: AcceptSubRequestPayload[] = (request.requests ?? []).map((sr) => {
      const s = subSettings[sr.id];
      return {
        id: sr.id,
        sla: requestType === 'planned' ? null : s?.sla ?? null,
        complexity: requestType === 'planned' ? null : s?.complexity ?? null,
        category_id: sr.category_id,
      };
    });
    const parsedOffice = Number(officeId);
    const payload: AdminAcceptRequestPayload = {
      request_type: requestType,
      location_detail: locationDetail.trim() || undefined,
      office_id: Number.isInteger(parsedOffice) ? parsedOffice : request.office_id,
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
                <ThemedText style={[styles.title, { color: textColor }]}>Принять заявку</ThemedText>
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

            {requestType !== 'planned' && (
              <>
                <ThemedText style={[styles.label, { color: mutedColor }]}>
                  Время и сложность по подзаявкам
                </ThemedText>
                {(request?.requests ?? []).map((sr) => (
                  <View key={sr.id} style={[styles.subBlock, { borderColor }]}>
                    <ThemedText style={[styles.subTitle, { color: textColor }]}>
                      {sr.title || `Подзаявка #${sr.id}`}
                    </ThemedText>
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
                  </View>
                ))}
              </>
            )}

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
                {loading ? 'Отправка...' : 'Принять'}
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
