import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import type { ReactNode } from 'react';
import {
  InputAccessoryView,
  Keyboard,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type TextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export const KEYBOARD_DONE_ACCESSORY_ID = 'keyboard-form-done';

export function dismissKeyboard() {
  Keyboard.dismiss();
}

/** «Готово» на iOS для клавиатур без return (phone-pad, number-pad). */
export function KeyboardDoneAccessory() {
  const divider = useThemeColor({}, 'divider');
  const primary = useThemeColor({}, 'primary');
  const surface = useThemeColor({}, 'surface');

  if (Platform.OS !== 'ios') return null;

  return (
    <InputAccessoryView nativeID={KEYBOARD_DONE_ACCESSORY_ID}>
      <View style={[styles.accessory, { borderTopColor: divider, backgroundColor: surface }]}>
        <Pressable onPress={dismissKeyboard} style={styles.doneBtn} hitSlop={8}>
          <MaterialIcons name="check-circle" size={22} color={primary} />
          <ThemedText style={[styles.doneText, { color: primary }]}>Готово</ThemedText>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

type KeyboardDismissOptions = {
  /** phone-pad / number-pad — на iOS нет кнопки return, нужен accessory. */
  numericKeyboard?: boolean;
  multiline?: boolean;
  /** Панель «Готово» над клавиатурой на iOS (для любого keyboardType). */
  iosAccessory?: boolean;
  returnKeyType?: TextInputProps['returnKeyType'];
  blurOnSubmit?: boolean;
  onSubmitEditing?: TextInputProps['onSubmitEditing'];
};

/** returnKeyType «Готово» + закрытие клавиатуры; на iOS — accessory с кнопкой «Готово». */
export function keyboardDismissInputProps(
  options?: KeyboardDismissOptions
): Pick<
  TextInputProps,
  'returnKeyType' | 'blurOnSubmit' | 'onSubmitEditing' | 'inputAccessoryViewID'
> {
  const showAccessory =
    Platform.OS === 'ios' && (options?.numericKeyboard || options?.iosAccessory);
  const defaultReturn = options?.multiline ? 'default' : 'done';

  return {
    returnKeyType: options?.returnKeyType ?? defaultReturn,
    blurOnSubmit: options?.blurOnSubmit ?? !options?.multiline,
    onSubmitEditing: options?.onSubmitEditing ?? dismissKeyboard,
    ...(showAccessory ? { inputAccessoryViewID: KEYBOARD_DONE_ACCESSORY_ID } : {}),
  };
}

/** Только nativeID accessory для iOS (сочетать с returnKeyType="next"). */
export function iosKeyboardAccessoryProps(): Pick<TextInputProps, 'inputAccessoryViewID'> {
  return Platform.OS === 'ios'
    ? { inputAccessoryViewID: KEYBOARD_DONE_ACCESSORY_ID }
    : {};
}

type KeyboardFormOverlayProps = {
  visible: boolean;
  children: ReactNode;
  backgroundColor?: string;
};

/**
 * Полноэкранный оверлей: карточка по центру, при клавиатуре — только нижний inset
 * (без двойного подъёма через KeyboardAvoidingView).
 */
export function KeyboardFormOverlay({
  visible,
  children,
  backgroundColor = 'rgba(0,0,0,0.5)',
}: KeyboardFormOverlayProps) {
  if (!visible) return null;

  return (
    <>
      <KeyboardDoneAccessory />
      <View style={[styles.overlay, { backgroundColor }]}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
          automaticallyAdjustKeyboardInsets
          bounces={false}
        >
          {children}
        </ScrollView>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 100,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 24,
  },
  accessory: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  doneBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneText: {
    fontSize: 17,
    fontWeight: '600',
  },
});
