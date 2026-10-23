import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { useProductUi } from '@/hooks/use-product-ui';

type ConfirmSheetProps = {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** `danger` — an irreversible action such as deletion. */
  tone?: 'danger' | 'accent';
  onConfirm: () => void;
  /** The action is running: buttons are locked and the confirm button shows a spinner. */
  busy?: boolean;
};

/** A question before an action (Figma «Удалить задачу?»): a sheet with full-width buttons. */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Отмена',
  tone = 'danger',
  onConfirm,
  busy = false,
}: ConfirmSheetProps) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  const close = () => {
    if (!busy) onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: ui.scrim }]} onPress={close} accessibilityLabel={cancelLabel} />
        <View accessibilityViewIsModal style={[styles.sheet, { backgroundColor: ui.surface, paddingBottom: Math.max(insets.bottom, 16) + 14 }]}>
          <View style={[styles.grabber, { backgroundColor: ui.fg(0.3) }]} />
          <Text accessibilityRole="header" style={[styles.title, { color: ui.fg() }]}>
            {title}
          </Text>
          <Text style={[styles.message, { color: ui.fg(0.7) }]}>{message}</Text>
          <Button
            title={confirmLabel}
            onPress={onConfirm}
            variant={tone === 'danger' ? 'destructive' : 'accent'}
            size="block"
            loading={busy}
          />
          <Button title={cancelLabel} onPress={close} variant="raised" size="block" disabled={busy} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingTop: 10, paddingHorizontal: 20, gap: 16 },
  grabber: { alignSelf: 'center', width: 36, height: 5, borderRadius: 3 },
  title: { fontSize: 22, fontWeight: '700' },
  message: { fontSize: 15, lineHeight: 18 },
});
