import type { ReactNode } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { useBottomSheetScrollMetrics } from '@/components/requests/use-bottom-sheet-scroll-metrics';
import { useSheetPanDismiss } from '@/components/requests/use-sheet-pan-dismiss';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface FormBottomSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  loading?: boolean;
  onClose: () => void;
  primaryLabel: string;
  onPrimaryPress: () => void | Promise<void>;
  primaryDisabled?: boolean;
  children: ReactNode;
  /** Доп. резерв высоты для расчёта ScrollView (если много полей). */
  chromeExtra?: number;
}

/**
 * Bottom sheet в том же стиле, что «Принять заявку» в разделе заявок:
 * ручка, заголовок без крестика, скролл контента, оранжевая основная кнопка слева.
 */
export function FormBottomSheet({
  visible,
  title,
  subtitle,
  loading = false,
  onClose,
  primaryLabel,
  onPrimaryPress,
  primaryDisabled = false,
  children,
  chromeExtra = 0,
}: FormBottomSheetProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const keyboardHeight = useKeyboardHeight(visible);

  const {
    scrollViewStyle,
    onScrollContentSizeChange,
    scrollEnabled,
    sheetPaddingBottom,
  // Высоту клавиатуры учитываем только в paddingBottom оверлея (подъём шторки),
  // без повторного сжатия ScrollView — иначе поля «уезжают» вверх.
  } = useBottomSheetScrollMetrics({ visible, chromeExtra });

  const { panGesture, sheetAnimatedStyle } = useSheetPanDismiss({
    visible,
    onClose,
    dismissAllowed: !loading,
  });

  const primaryBlocked = loading || primaryDisabled;
  const keyboardOpen = keyboardHeight > 0;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <GestureHandlerRootView style={styles.gestureRoot}>
        <View style={[styles.overlay, keyboardOpen && { paddingBottom: keyboardHeight }]}>
          <Pressable style={styles.backdrop} onPress={loading ? undefined : onClose} />
          <Animated.View
            style={[
              styles.sheet,
              sheetAnimatedStyle,
              {
                backgroundColor: cardBackground,
                borderColor,
                paddingBottom: keyboardOpen ? 8 : sheetPaddingBottom,
              },
            ]}
          >
            <GestureDetector gesture={panGesture}>
              <View style={styles.sheetGrabRegion}>
                <View style={styles.sheetHandleHit}>
                  <View style={styles.handle} />
                </View>
                <ThemedText style={[styles.title, { color: textColor }]}>{title}</ThemedText>
                {subtitle ? (
                  <ThemedText style={[styles.subtitle, { color: mutedColor }]}>{subtitle}</ThemedText>
                ) : null}
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
              {children}
            </ScrollView>

            <View style={styles.actions}>
              <Pressable
                onPress={onPrimaryPress}
                disabled={primaryBlocked}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.saveButton,
                  primaryBlocked && styles.actionButtonDisabled,
                  pressed && !primaryBlocked && styles.actionButtonPressed,
                ]}
              >
                <ThemedText style={[styles.actionLabel, styles.actionLabelPrimary]}>
                  {loading ? 'Сохранение...' : primaryLabel}
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={onClose}
                disabled={loading}
                style={({ pressed }) => [
                  styles.actionButton,
                  styles.actionButtonSecondary,
                  { borderColor },
                  loading && styles.actionButtonDisabled,
                  pressed && !loading && styles.actionButtonPressed,
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

/** Подпись поля над Select / Input — как в модалке принятия заявки. */
export function FormBottomSheetFieldLabel({
  children,
  style,
}: {
  children: ReactNode;
  style?: object;
}) {
  const mutedColor = useThemeColor({}, 'textMuted');
  return (
    <ThemedText style={[formFieldStyles.label, { color: mutedColor }, style]}>{children}</ThemedText>
  );
}

export const formBottomSheetFieldStyles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 48,
    fontSize: 15,
    marginBottom: 8,
  },
});

const formFieldStyles = StyleSheet.create({
  label: {
    fontSize: 13,
    marginBottom: 8,
    marginTop: 6,
  },
});

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
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  content: {},
  contentContainer: {
    paddingBottom: 8,
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
