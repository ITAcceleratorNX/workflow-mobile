/**
 * Below are the colors that are used in the app. The colors are defined in the light and dark mode.
 * There are many other ways to style your app. For example, [Nativewind](https://www.nativewind.dev/), [Tamagui](https://tamagui.dev/), [unistyles](https://reactnativeunistyles.vercel.app), etc.
 *
 * Тема приложения построена на семантических токенах. Старые ключи (`tint`, `icon`,
 * `cardBackground`, `gray600`, `screenBackgroundDark` и т.п.) оставлены для обратной
 * совместимости и помечены как `legacy*` в комментариях — постепенно мигрируем экраны
 * на семантические токены ниже.
 */

import { Platform, type ViewStyle } from 'react-native';

const tintColorLight = '#0a7ea4';
const tintColorDark = '#fff';

const primaryAccent = '#E25B21';
const borderSecondary = '#212121';
const borderLight = '#E5E5EA';
const textMuted = '#6E6E6E';
const errorColor = '#F35713';
const successColor = '#22c55e';
const gray600 = '#3A3A3C';
const screenBackgroundDark = '#1C1C1E';

export const Colors = {
  light: {
    // ── Surfaces ────────────────────────────────────────────────────────────
    background: '#FFFFFF',
    surface: '#FFFFFF',
    surfaceElevated: '#F8F9FB',
    surfaceMuted: '#F2F2F7',
    /** legacy alias of surfaceMuted */
    cardBackground: '#F2F2F7',

    // ── Text ────────────────────────────────────────────────────────────────
    text: '#11181C',
    /** legacy alias of text */
    textPrimary: '#11181C',
    textSecondary: '#3C3C43',
    textMuted,

    // ── Lines / dividers ────────────────────────────────────────────────────
    border: borderLight,
    divider: 'rgba(15, 23, 42, 0.08)',

    // ── Brand ───────────────────────────────────────────────────────────────
    primary: primaryAccent,
    /** alias for primary, used for accents */
    accent: primaryAccent,
    accentSoft: 'rgba(226, 91, 33, 0.12)',
    /** color of text/icons placed on top of `primary` */
    onPrimary: '#FFFFFF',

    // ── Status / semantic ───────────────────────────────────────────────────
    success: successColor,
    successSoft: 'rgba(34, 197, 94, 0.14)',
    warning: '#CA8A04',
    warningSoft: 'rgba(202, 138, 4, 0.14)',
    danger: '#DC2626',
    dangerSoft: 'rgba(220, 38, 38, 0.12)',
    error: errorColor,
    info: '#0284C7',
    infoSoft: 'rgba(2, 132, 199, 0.14)',

    // ── Shadows ─────────────────────────────────────────────────────────────
    shadow: '#000000',

    // ── Misc / icons / nav ──────────────────────────────────────────────────
    tint: tintColorLight,
    icon: '#687076',
    tabIconDefault: '#687076',
    tabIconSelected: tintColorLight,

    // ── Legacy ──────────────────────────────────────────────────────────────
    gray600,
    /**
     * @deprecated use `surface`/`surfaceElevated` instead.
     * Сохранено для дашбордов admin/manager/executor — выровняем на Этапе 3.
     */
    screenBackgroundDark,
  },
  dark: {
    // ── Surfaces ────────────────────────────────────────────────────────────
    background: '#040404',
    surface: '#1A1A1A',
    surfaceElevated: '#242424',
    surfaceMuted: '#0F0F0F',
    /** legacy alias of surface */
    cardBackground: '#1a1a1a',

    // ── Text ────────────────────────────────────────────────────────────────
    text: '#ECEDEE',
    textPrimary: '#ECEDEE',
    textSecondary: '#A0A0A5',
    textMuted,

    // ── Lines / dividers ────────────────────────────────────────────────────
    border: borderSecondary,
    divider: 'rgba(255, 255, 255, 0.08)',

    // ── Brand ───────────────────────────────────────────────────────────────
    primary: primaryAccent,
    accent: primaryAccent,
    accentSoft: 'rgba(226, 91, 33, 0.18)',
    onPrimary: '#FFFFFF',

    // ── Status / semantic ───────────────────────────────────────────────────
    success: successColor,
    successSoft: 'rgba(34, 197, 94, 0.18)',
    warning: '#FACC15',
    warningSoft: 'rgba(250, 204, 21, 0.18)',
    danger: '#F87171',
    dangerSoft: 'rgba(248, 113, 113, 0.18)',
    error: errorColor,
    info: '#38BDF8',
    infoSoft: 'rgba(56, 189, 248, 0.18)',

    // ── Shadows ─────────────────────────────────────────────────────────────
    shadow: '#000000',

    // ── Misc / icons / nav ──────────────────────────────────────────────────
    tint: tintColorDark,
    icon: '#9BA1A6',
    tabIconDefault: '#9BA1A6',
    tabIconSelected: tintColorDark,

    // ── Legacy ──────────────────────────────────────────────────────────────
    gray600,
    /**
     * @deprecated use `surface`/`surfaceElevated` instead.
     */
    screenBackgroundDark,
  },
} as const;

/**
 * Семантический ключ темы. Все ключи ОБЯЗАНЫ присутствовать и в `light`,
 * и в `dark` — это проверяется типом ниже.
 */
export type ThemeColorName = keyof (typeof Colors)['light'] &
  keyof (typeof Colors)['dark'];

// ─────────────────────────────────────────────────────────────────────────────
// Spacing scale (4-pt base). Используем как отступы / гэпы.
// ─────────────────────────────────────────────────────────────────────────────

export const Spacing = {
  /** 4 */ xs: 4,
  /** 8 */ sm: 8,
  /** 12 */ md: 12,
  /** 16 */ lg: 16,
  /** 20 */ xl: 20,
  /** 24 */ xxl: 24,
  /** 32 */ huge: 32,
  /** 48 */ giant: 48,
} as const;

export type SpacingKey = keyof typeof Spacing;

// ─────────────────────────────────────────────────────────────────────────────
// Radius scale.
// ─────────────────────────────────────────────────────────────────────────────

export const Radius = {
  /** 6 */ xs: 6,
  /** 8 */ sm: 8,
  /** 12 */ md: 12,
  /** 16 */ lg: 16,
  /** 20 */ xl: 20,
  /** pill */ pill: 999,
} as const;

export type RadiusKey = keyof typeof Radius;

// ─────────────────────────────────────────────────────────────────────────────
// Shadows. Возвращаем готовые ViewStyle-фрагменты, чтобы экраны не
// дублировали shadowOffset/Opacity/Radius в каждом StyleSheet.create.
// На Android используем `elevation`, на iOS — стандартные shadow* поля.
// ─────────────────────────────────────────────────────────────────────────────

export type ShadowLevel = 'none' | 'card' | 'modal' | 'sheet';

const SHADOWS_LIGHT: Record<ShadowLevel, ViewStyle> = {
  none: {},
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
    elevation: 12,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 10,
  },
};

const SHADOWS_DARK: Record<ShadowLevel, ViewStyle> = {
  none: {},
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.32,
    shadowRadius: 8,
    elevation: 2,
  },
  modal: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 12,
  },
  sheet: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.45,
    shadowRadius: 14,
    elevation: 10,
  },
};

/** Получить тень для указанного уровня и темы. */
export function getShadow(
  level: ShadowLevel,
  scheme: 'light' | 'dark'
): ViewStyle {
  return scheme === 'dark' ? SHADOWS_DARK[level] : SHADOWS_LIGHT[level];
}

// ─────────────────────────────────────────────────────────────────────────────
// Typography.
// ─────────────────────────────────────────────────────────────────────────────

/** Шкала размеров шрифтов для мобильных (Apple HIG / Material) */
export const FontSizes = {
  caption: 12,
  body: 15,
  bodySmall: 14,
  title: 17,
  titleLarge: 20,
  headline: 22,
  display: 28,
} as const;

export type FontSizeKey = keyof typeof FontSizes;

/** Высота строки, согласованная с FontSizes (1.3-1.4× для читаемости). */
export const LineHeights = {
  caption: 16,
  body: 22,
  bodySmall: 20,
  title: 22,
  titleLarge: 26,
  headline: 28,
  display: 34,
} as const;

/** Веса шрифта (RN сейчас принимает строковые числовые значения). */
export const FontWeights = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontWeightKey = keyof typeof FontWeights;

export const Fonts = Platform.select({
  ios: {
    /** iOS `UIFontDescriptorSystemDesignDefault` */
    sans: 'system-ui',
    /** iOS `UIFontDescriptorSystemDesignSerif` */
    serif: 'ui-serif',
    /** iOS `UIFontDescriptorSystemDesignRounded` */
    rounded: 'ui-rounded',
    /** iOS `UIFontDescriptorSystemDesignMonospaced` */
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
