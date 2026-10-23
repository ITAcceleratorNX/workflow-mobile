import { useMemo } from 'react';

import { ProductUi, type ProductUiPalette } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export type ProductUiTheme = ProductUiPalette & {
  scheme: 'light' | 'dark';
  /** Основной цвет с прозрачностью: `fg(0.6)` — вторичный текст, `fg(0.1)` — линия. */
  fg: (alpha?: number) => string;
};

/** Палитра экранов задач для текущей темы приложения (Figma «workflow»). */
export function useProductUi(): ProductUiTheme {
  const scheme = useColorScheme() ?? 'dark';
  return useMemo(() => {
    const palette = ProductUi[scheme];
    return { ...palette, scheme, fg: (alpha = 1) => `rgba(${palette.fgRgb}, ${alpha})` };
  }, [scheme]);
}
