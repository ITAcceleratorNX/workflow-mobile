import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View, type StyleProp, type TextStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

interface ScreenHeaderProps {
  title: string;
  /** Подзаголовок под title (только если не inlineTitle). */
  subtitle?: string;
  onBack?: () => void;
  rightSlot?: React.ReactNode;
  /** Hide the "Назад" label and show only the icon */
  hideBackLabel?: boolean;
  /** Render title on the same row as back button */
  inlineTitle?: boolean;
  /** Доп. стили заголовка (например увеличенный шрифт на отдельном экране). */
  titleStyle?: StyleProp<TextStyle>;
}

export function ScreenHeader({
  title,
  subtitle,
  onBack,
  rightSlot,
  hideBackLabel = false,
  inlineTitle = false,
  titleStyle,
}: ScreenHeaderProps) {
  const router = useRouter();
  const primary = useThemeColor({}, 'primary');
  const textMuted = useThemeColor({}, 'textMuted');

  const handleBack = onBack ?? (() => router.back());

  return (
    <View style={styles.header}>
      <View style={[styles.topRow, inlineTitle && styles.topRowInline]}>
        <Pressable onPress={handleBack} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={28} color={primary} />
          {!hideBackLabel && <ThemedText style={[styles.backLabel, { color: primary }]}>Назад</ThemedText>}
        </Pressable>
        {inlineTitle ? (
          <ThemedText type="title" style={[styles.title, styles.titleInline, titleStyle]}>
            {title}
          </ThemedText>
        ) : null}
        {rightSlot ? (
          <View style={inlineTitle ? styles.rightSlotInline : styles.rightSlot}>
            {rightSlot}
          </View>
        ) : null}
      </View>
      {!inlineTitle ? (
        <>
          <ThemedText type="title" style={[styles.title, titleStyle]}>
            {title}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>{subtitle}</ThemedText>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  topRow: {
    position: 'relative',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginBottom: 8,
  },
  topRowInline: {
    marginBottom: 0,
    paddingBottom: 6,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
  },
  backLabel: {
    fontSize: 16,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 6,
  },
  titleInline: {
    flex: 1,
    marginLeft: 8,
    fontSize: 20,
    fontWeight: '800',
  },
  rightSlot: {
    position: 'absolute',
    right: 16,
    top: 0,
  },
  rightSlotInline: {
    marginLeft: 8,
    alignSelf: 'center',
  },
});
