import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing, getShadow } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

type Variant =
  /** Плоская карточка на `surface`, тонкий divider — основной вариант. */
  | 'default'
  /** Карточка с лёгкой тенью на `surfaceElevated`. */
  | 'elevated'
  /** Без бордера и тени, только фон + radius. */
  | 'flat';

type Padding = 'none' | 'sm' | 'md' | 'lg' | 'xl';

const PADDINGS: Record<Padding, number> = {
  none: 0,
  sm: Spacing.sm,
  md: Spacing.md,
  lg: Spacing.lg,
  xl: Spacing.xl,
};

export interface CardProps {
  children: React.ReactNode;
  variant?: Variant;
  padding?: Padding;
  /** Если задан — карточка нажимная (Pressable). Также добавляет accessibilityRole="button". */
  onPress?: () => void;
  disabled?: boolean;
  /** Радиус скругления (по умолчанию `Radius.md`). */
  radius?: number;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/**
 * Унифицированная карточка с одинаковыми отступами, радиусом и тенью
 * по всему приложению. Использует семантические токены (`surface`,
 * `surfaceElevated`, `divider`) и `Shadow.card`.
 */
export function Card({
  children,
  variant = 'default',
  padding = 'lg',
  onPress,
  disabled = false,
  radius = Radius.md,
  style,
  accessibilityLabel,
  testID,
}: CardProps) {
  const scheme = useColorScheme() ?? 'light';
  const surface = useThemeColor({}, 'surface');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const divider = useThemeColor({}, 'divider');

  const computed: ViewStyle = (() => {
    switch (variant) {
      case 'elevated':
        return {
          backgroundColor: surfaceElevated,
          borderRadius: radius,
          padding: PADDINGS[padding],
          ...getShadow('card', scheme),
        };
      case 'flat':
        return {
          backgroundColor: surface,
          borderRadius: radius,
          padding: PADDINGS[padding],
        };
      case 'default':
      default:
        return {
          backgroundColor: surface,
          borderRadius: radius,
          padding: PADDINGS[padding],
          borderWidth: StyleSheet.hairlineWidth,
          borderColor: divider,
        };
    }
  })();

  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled }}
        testID={testID}
        style={({ pressed }) => [
          computed,
          style,
          { opacity: disabled ? 0.5 : pressed ? 0.92 : 1 },
        ]}
      >
        {children}
      </Pressable>
    );
  }

  return (
    <View style={[computed, style]} testID={testID}>
      {children}
    </View>
  );
}
