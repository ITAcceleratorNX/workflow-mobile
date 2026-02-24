import { Pressable, StyleSheet, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type Variant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}: ButtonProps) {
  const primary = useThemeColor({}, 'primary');
  const background = useThemeColor({}, 'background');
  const border = useThemeColor({}, 'border');
  const textMuted = useThemeColor({}, 'textMuted');
  const text = useThemeColor({}, 'text');

  const bg =
    variant === 'primary'
      ? primary
      : variant === 'secondary'
        ? border
        : 'transparent';
  const fg =
    variant === 'ghost' ? textMuted : variant === 'primary' ? '#FFFFFF' : textMuted;
  const borderWidth = variant === 'ghost' ? 0 : 0;
  const borderColor = variant === 'secondary' ? border : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderWidth,
          borderColor,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      <ThemedText
        style={[
          styles.label,
          { color: fg },
          variant === 'primary' && styles.labelPrimary,
        ]}
        numberOfLines={2}
        allowFontScaling
      >
        {title}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
  },
  labelPrimary: {
    fontWeight: '600',
  },
});
