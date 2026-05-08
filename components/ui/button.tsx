import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type Variant = 'primary' | 'secondary' | 'ghost' | 'outline' | 'danger';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /**
   * Показывает спиннер слева от текста и блокирует повторные нажатия.
   * При этом `disabled` тоже трактуется как нажатие невозможно.
   */
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  /** Доп. стили контейнера (например flex для ряда кнопок) */
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * Переопределить цвет текста (например, '#FFFFFF' для контраста на оранжевом).
   * Обычно НЕ нужен — варианты сами выставляют корректный цвет на основании темы.
   */
  labelColor?: string;
  /** Иконка слева от текста (например, <MaterialIcons …/>). */
  leftIcon?: React.ReactNode;
  /** Иконка справа от текста. */
  rightIcon?: React.ReactNode;
  /** Доступности. */
  accessibilityLabel?: string;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  containerStyle,
  labelColor,
  leftIcon,
  rightIcon,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const primary = useThemeColor({}, 'primary');
  const accentSoft = useThemeColor({}, 'accentSoft');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const border = useThemeColor({}, 'border');
  const danger = useThemeColor({}, 'danger');
  const textMuted = useThemeColor({}, 'textMuted');
  const text = useThemeColor({}, 'text');

  const isDisabled = disabled || loading;

  const { backgroundColor, foreground, borderColor, borderWidth } =
    resolveVariant(variant, {
      primary,
      accentSoft,
      onPrimary,
      border,
      danger,
      textMuted,
      text,
    });

  const fg = labelColor ?? foreground;

  return (
    <Pressable
      onPress={onPress}
      disabled={isDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor, borderColor, borderWidth },
        style,
        containerStyle,
        // Состояние нажатия/disabled применяется ПОСЛЕДНИМ,
        // чтобы пользовательский style не «съел» визуальный отклик.
        { opacity: isDisabled ? 0.5 : pressed ? 0.85 : 1 },
      ]}
    >
      <View style={styles.row}>
        {loading ? (
          <ActivityIndicator size="small" color={fg} style={styles.spinner} />
        ) : leftIcon ? (
          <View style={styles.iconLeft}>{leftIcon}</View>
        ) : null}
        {labelColor != null ? (
          <Text
            style={[styles.label, styles.labelStrong, { color: fg }]}
            numberOfLines={2}
            allowFontScaling
          >
            {title}
          </Text>
        ) : (
          <ThemedText
            style={[
              styles.label,
              variant !== 'ghost' && styles.labelStrong,
              { color: fg },
            ]}
            numberOfLines={2}
            allowFontScaling
          >
            {title}
          </ThemedText>
        )}
        {!loading && rightIcon ? (
          <View style={styles.iconRight}>{rightIcon}</View>
        ) : null}
      </View>
    </Pressable>
  );
}

function resolveVariant(
  variant: Variant,
  c: {
    primary: string;
    accentSoft: string;
    onPrimary: string;
    border: string;
    danger: string;
    textMuted: string;
    text: string;
  }
) {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: c.primary,
        foreground: c.onPrimary,
        borderColor: 'transparent',
        borderWidth: 0,
      };
    case 'secondary':
      return {
        backgroundColor: c.border,
        foreground: c.text,
        borderColor: 'transparent',
        borderWidth: 0,
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        foreground: c.primary,
        borderColor: c.primary,
        borderWidth: StyleSheet.hairlineWidth + 1,
      };
    case 'danger':
      return {
        backgroundColor: c.danger,
        foreground: c.onPrimary,
        borderColor: 'transparent',
        borderWidth: 0,
      };
    case 'ghost':
    default:
      return {
        backgroundColor: 'transparent',
        foreground: c.textMuted,
        borderColor: 'transparent',
        borderWidth: 0,
      };
  }
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: Spacing.xxl,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.sm,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: FontSizes.body + 1,
    lineHeight: LineHeights.body,
    textAlign: 'center',
  },
  labelStrong: {
    fontWeight: '600',
  },
  iconLeft: {
    marginRight: Spacing.sm,
  },
  iconRight: {
    marginLeft: Spacing.sm,
  },
  spinner: {
    marginRight: Spacing.sm,
  },
});
