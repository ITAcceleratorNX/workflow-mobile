import type { ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSheetPanDismiss } from '@/components/requests/use-sheet-pan-dismiss';
import { useProductUi } from '@/hooks/use-product-ui';

type SheetAction = { label: string; onPress: () => void; disabled?: boolean };

type BottomSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  /** Text action in the header, e.g. «Готово». */
  action?: SheetAction;
  children: ReactNode;
  /** false — the content manages its own scrolling. */
  scrollable?: boolean;
};

/**
 * Sheet from the bottom of the screen (Figma «Шторка»): a grabber, the title with an optional text
 * action, then the content. A tap on the dimmed screen, the back button or a swipe down close it.
 */
export function BottomSheet({ visible, onClose, title, action, children, scrollable = true }: BottomSheetProps) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const { panGesture, sheetAnimatedStyle } = useSheetPanDismiss({ visible, onClose });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: ui.scrim }]} onPress={onClose} accessibilityLabel="Закрыть" />
        <Animated.View
          accessibilityViewIsModal
          style={[styles.sheet, { backgroundColor: ui.surface, paddingBottom: Math.max(insets.bottom, 16) + 14 }, sheetAnimatedStyle]}
        >
          <GestureDetector gesture={panGesture}>
            <View style={styles.header}>
              <View style={[styles.grabber, { backgroundColor: ui.fg(0.3) }]} />
              <View style={styles.titleRow}>
                <Text accessibilityRole="header" style={[styles.title, { color: ui.fg() }]}>
                  {title}
                </Text>
                {action ? (
                  <Pressable
                    onPress={action.onPress}
                    disabled={action.disabled}
                    hitSlop={10}
                    accessibilityRole="button"
                    style={({ pressed }) => [pressed && { opacity: 0.6 }, action.disabled && { opacity: 0.4 }]}
                  >
                    <Text style={[styles.action, { color: ui.accent }]}>{action.label}</Text>
                  </Pressable>
                ) : null}
              </View>
            </View>
          </GestureDetector>
          {scrollable ? (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" bounces={false}>
              {children}
            </ScrollView>
          ) : (
            <View style={styles.content}>{children}</View>
          )}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '92%' },
  header: { paddingTop: 10, paddingHorizontal: 20, gap: 16, paddingBottom: 16 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { flex: 1, fontSize: 20, fontWeight: '700' },
  action: { fontSize: 16, fontWeight: '600' },
  scroll: { flexGrow: 0 },
  content: { paddingHorizontal: 20, gap: 16 },
});
