import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import {
  FontSizes,
  LineHeights,
  Radius,
  Spacing,
  getShadow,
} from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface SheetProps {
  /** Видимость bottom sheet. */
  visible: boolean;
  /** Колбэк закрытия (тап по backdrop, кнопка «Назад» Android, крестик). */
  onClose: () => void;
  /** Заголовок над контентом. Если не задан — заголовок не рисуется. */
  title?: string;
  /** Подзаголовок (мелкий, под заголовком). */
  subtitle?: string;
  /** Содержимое sheet. */
  children?: React.ReactNode;
  /**
   * Вариант layout:
   * - `default` — высота по контенту, до 92% экрана
   * - `full` — растягивается на всю доступную высоту
   */
  layout?: 'default' | 'full';
  /** Если true (по умолчанию), контент оборачивается в ScrollView. */
  scrollable?: boolean;
  /** Если true, поверх клавиатуры подъезжает `KeyboardAvoidingView`. */
  avoidKeyboard?: boolean;
  /** Скрыть кнопку-крестик в заголовке. */
  hideCloseButton?: boolean;
  /** Кастомные стили surface-карты. */
  style?: StyleProp<ViewStyle>;
  /** Кастомные стили внутреннего контейнера. */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Дополнительные пропсы скролла (если `scrollable`). */
  scrollViewProps?: Omit<ScrollViewProps, 'children' | 'contentContainerStyle'>;
  /** Закрытие по тапу на backdrop (по умолчанию true). */
  dismissOnBackdropPress?: boolean;
  testID?: string;
}

/**
 * Унифицированный bottom-sheet. Заменяет дублирование backdrop+content
 * в десятках модалок. Использует `surface` темы, `Shadow.sheet`,
 * `Radius.xl` сверху, учитывает `useSafeAreaInsets().bottom`.
 *
 * Пример:
 * ```tsx
 * <Sheet visible={open} onClose={close} title="Назначить">
 *   <Text>Содержимое</Text>
 *   <Button title="Подтвердить" onPress={...} />
 * </Sheet>
 * ```
 */
export function Sheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  layout = 'default',
  scrollable = true,
  avoidKeyboard = true,
  hideCloseButton = false,
  style,
  contentContainerStyle,
  scrollViewProps,
  dismissOnBackdropPress = true,
  testID,
}: SheetProps) {
  const scheme = useColorScheme() ?? 'light';
  const surface = useThemeColor({}, 'surface');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const divider = useThemeColor({}, 'divider');
  const insets = useSafeAreaInsets();

  const sheetShadow = getShadow('sheet', scheme);
  const bottomPadding = Spacing.lg + (insets.bottom > 0 ? insets.bottom : Spacing.md);

  const Body = (
    <View
      style={[
        styles.surface,
        {
          backgroundColor: surface,
          paddingBottom: bottomPadding,
          ...sheetShadow,
        },
        layout === 'full' && styles.surfaceFull,
        style,
      ]}
      // Останавливаем закрытие по тапу внутри панели.
      onStartShouldSetResponder={() => true}
    >
      <View style={styles.handleWrap}>
        <View style={[styles.handle, { backgroundColor: divider }]} />
      </View>

      {(title || !hideCloseButton) && (
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            {title ? (
              <ThemedText style={[styles.title, { color: text }]}>
                {title}
              </ThemedText>
            ) : null}
            {subtitle ? (
              <ThemedText style={[styles.subtitle, { color: textMuted }]}>
                {subtitle}
              </ThemedText>
            ) : null}
          </View>
          {!hideCloseButton ? (
            <Pressable
              onPress={onClose}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel="Закрыть"
              style={styles.closeBtn}
            >
              <MaterialIcons name="close" size={22} color={textMuted} />
            </Pressable>
          ) : null}
        </View>
      )}

      {scrollable ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[styles.contentContainer, contentContainerStyle]}
          {...scrollViewProps}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.contentContainer, contentContainerStyle]}>
          {children}
        </View>
      )}
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <Pressable
        style={styles.backdrop}
        onPress={dismissOnBackdropPress ? onClose : undefined}
        accessibilityRole="button"
        accessibilityLabel="Закрыть"
      >
        {avoidKeyboard ? (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={[
              styles.kavWrapper,
              layout === 'full' && styles.kavWrapperFull,
            ]}
            pointerEvents="box-none"
          >
            {Body}
          </KeyboardAvoidingView>
        ) : (
          Body
        )}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  kavWrapper: {
    justifyContent: 'flex-end',
  },
  kavWrapperFull: {
    flex: 1,
  },
  surface: {
    borderTopLeftRadius: Radius.xl,
    borderTopRightRadius: Radius.xl,
    maxHeight: '92%',
  },
  surfaceFull: {
    flex: 1,
    maxHeight: undefined,
  },
  handleWrap: {
    alignItems: 'center',
    paddingTop: Spacing.sm + 2,
    paddingBottom: Spacing.xs + 2,
  },
  handle: {
    width: 44,
    height: 4,
    borderRadius: Radius.pill,
    opacity: 0.6,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  titleBlock: {
    flex: 1,
    gap: Spacing.xs,
  },
  title: {
    fontSize: FontSizes.titleLarge,
    lineHeight: LineHeights.titleLarge,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  closeBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentContainer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    gap: Spacing.md,
  },
});
