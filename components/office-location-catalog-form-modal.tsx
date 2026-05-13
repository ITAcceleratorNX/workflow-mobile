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
import { useBottomSheetScrollMetrics } from '@/components/requests/use-bottom-sheet-scroll-metrics';
import { useSheetPanDismiss } from '@/components/requests/use-sheet-pan-dismiss';
import { useThemeColor } from '@/hooks/use-theme-color';

export type OfficeLocationCatalogFormValues = {
  block: string;
  floor_zone: string;
  room: string;
  sort_order: number;
};

export interface OfficeLocationCatalogFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  loading?: boolean;
  error?: string | null;
  defaultBlock?: string;
  defaultFloorZone?: string;
  defaultRoom?: string;
  defaultSortOrder?: number;
  onClose: () => void;
  onSubmit: (values: OfficeLocationCatalogFormValues) => Promise<void>;
}

/**
 * Форма шаблона локации в стиле нижней шторки «Редактировать заявку» (edit-request-group-modal).
 */
export function OfficeLocationCatalogFormModal({
  visible,
  mode,
  loading = false,
  error,
  defaultBlock = '',
  defaultFloorZone = '',
  defaultRoom = '',
  defaultSortOrder = 0,
  onClose,
  onSubmit,
}: OfficeLocationCatalogFormModalProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const [block, setBlock] = useState('');
  const [floorZone, setFloorZone] = useState('');
  const [room, setRoom] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

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
    setBlock(defaultBlock);
    setFloorZone(defaultFloorZone);
    setRoom(defaultRoom);
    setSortOrder(String(defaultSortOrder ?? 0));
    setLocalError(null);
  }, [visible, defaultBlock, defaultFloorZone, defaultRoom, defaultSortOrder]);

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

  const title = mode === 'create' ? 'Новый шаблон локации' : 'Редактирование шаблона';

  const handleSave = async () => {
    setLocalError(null);
    const n = Number(sortOrder);
    if (Number.isNaN(n)) {
      setLocalError('Укажите число для порядка сортировки');
      return;
    }
    await onSubmit({
      block: block.trim(),
      floor_zone: floorZone.trim(),
      room: room.trim(),
      sort_order: n,
    });
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
                <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>
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
              <ThemedText style={[styles.label, { color: mutedColor }]}>Блок</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                placeholder="Например: А"
                placeholderTextColor={mutedColor}
                value={block}
                onChangeText={setBlock}
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <ThemedText style={[styles.label, { color: mutedColor }]}>Этаж / зона</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                placeholder="Например: 2 этаж"
                placeholderTextColor={mutedColor}
                value={floorZone}
                onChangeText={setFloorZone}
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <ThemedText style={[styles.label, { color: mutedColor }]}>Помещение</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                placeholder="Название помещения"
                placeholderTextColor={mutedColor}
                value={room}
                onChangeText={setRoom}
                returnKeyType="next"
                blurOnSubmit={false}
              />

              <ThemedText style={[styles.label, { color: mutedColor }]}>Порядок сортировки</ThemedText>
              <TextInput
                style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                placeholder="0"
                placeholderTextColor={mutedColor}
                value={sortOrder}
                onChangeText={setSortOrder}
                keyboardType="number-pad"
                returnKeyType="done"
                blurOnSubmit
                onSubmitEditing={Keyboard.dismiss}
              />

              {error || localError ? (
                <ThemedText style={styles.error}>{error || localError}</ThemedText>
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
  gestureRoot: { flex: 1 },
  overlay: { flex: 1, justifyContent: 'flex-end' },
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
  contentContainer: { paddingBottom: 8 },
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
  actionButtonPressed: { opacity: 0.8 },
  actionButtonDisabled: { opacity: 0.5 },
  actionLabel: {
    fontSize: 14,
    fontWeight: '700',
  },
  actionLabelPrimary: { color: '#FFF' },
});
