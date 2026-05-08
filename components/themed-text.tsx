import {
  StyleSheet,
  Text,
  type StyleProp,
  type TextProps,
  type TextStyle,
} from 'react-native';

import {
  FontSizes,
  FontWeights,
  LineHeights,
  type ThemeColorName,
} from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

type Variant =
  /** Историческое поведение: 16/24, regular. Используется по умолчанию. */
  | 'default'
  /** 16/24, semibold. */
  | 'defaultSemiBold'
  /** 32, bold — крупный экранный заголовок (legacy). */
  | 'title'
  /** 20, bold — подзаголовок (legacy). */
  | 'subtitle'
  /** Текст-ссылка, цвет берётся из темы (`primary`). */
  | 'link'
  /** 12/16 — мелкий вспомогательный текст. */
  | 'caption'
  /** 15/22 — основной текст iOS HIG. */
  | 'body'
  /** 14/20. */
  | 'bodySmall'
  /** 17/22, semibold — заголовок разделов / cards. */
  | 'sectionTitle'
  /** 20/26, semibold — крупный заголовок. */
  | 'titleLarge'
  /** 22/28, semibold — заголовок экрана. */
  | 'headline'
  /** 28/34, bold — display. */
  | 'display';

export type ThemedTextProps = TextProps & {
  /** Жёсткое значение цвета для светлой темы (приоритет выше, чем `colorName`). */
  lightColor?: string;
  /** Жёсткое значение цвета для тёмной темы (приоритет выше, чем `colorName`). */
  darkColor?: string;
  /** Стилевой пресет. */
  type?: Variant;
  /**
   * Семантический ключ цвета из темы. По умолчанию `text`.
   * Полезные значения: `textMuted`, `textSecondary`, `primary`, `danger`, `success`.
   */
  colorName?: ThemeColorName;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  colorName = 'text',
  ...rest
}: ThemedTextProps) {
  const color = useThemeColor({ light: lightColor, dark: darkColor }, colorName);
  const linkColor = useThemeColor({}, 'primary');

  const variantStyle: StyleProp<TextStyle> =
    type === 'link' ? [styles.link, { color: linkColor }] : VARIANT_STYLES[type];

  return <Text style={[{ color }, variantStyle, style]} {...rest} />;
}

const VARIANT_STYLES: Record<Exclude<Variant, 'link'>, TextStyle> = {
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: FontWeights.semibold,
  },
  title: {
    fontSize: 32,
    lineHeight: 32,
    fontWeight: FontWeights.bold,
  },
  subtitle: {
    fontSize: 20,
    fontWeight: FontWeights.bold,
  },
  caption: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
  },
  body: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
  },
  bodySmall: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  sectionTitle: {
    fontSize: FontSizes.title,
    lineHeight: LineHeights.title,
    fontWeight: FontWeights.semibold,
  },
  titleLarge: {
    fontSize: FontSizes.titleLarge,
    lineHeight: LineHeights.titleLarge,
    fontWeight: FontWeights.semibold,
  },
  headline: {
    fontSize: FontSizes.headline,
    lineHeight: LineHeights.headline,
    fontWeight: FontWeights.semibold,
  },
  display: {
    fontSize: FontSizes.display,
    lineHeight: LineHeights.display,
    fontWeight: FontWeights.bold,
  },
};

const styles = StyleSheet.create({
  link: {
    fontSize: 16,
    lineHeight: 30,
    textDecorationLine: 'underline',
  },
});
