import { useEffect, useState } from 'react';
import { useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Params = {
  visible: boolean;
  keyboardVisible: boolean;
  /** Доп. резерв под хром (px), если шапка/футер отличаются от типового */
  chromeExtra?: number;
};

/**
 * Высота ScrollView в bottom sheet: по контенту, без лишней пустоты;
 * при превышении экрана — ограничение и scrollEnabled.
 */
export function useBottomSheetScrollMetrics({
  visible,
  keyboardVisible,
  chromeExtra = 0,
}: Params) {
  const { height: winH } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [innerContentHeight, setInnerContentHeight] = useState(0);

  useEffect(() => {
    if (!visible) setInnerContentHeight(0);
  }, [visible]);

  const keyboardReserve = keyboardVisible ? 44 : 0;
  /** paddingTop + ручка + заголовок + футер кнопок + paddingBottom шита (без области ScrollView) */
  const baseChrome = 138 + chromeExtra + keyboardReserve + insets.bottom;
  const scrollCap = Math.max(160, Math.floor(winH * 0.92 - baseChrome));

  const onScrollContentSizeChange = (_w: number, h: number) => {
    setInnerContentHeight(h);
  };

  const scrollViewStyle = {
    maxHeight: scrollCap,
    ...(innerContentHeight > 0
      ? { height: Math.min(innerContentHeight, scrollCap) }
      : {}),
  };

  const scrollEnabled = innerContentHeight > scrollCap + 2;

  return {
    scrollViewStyle,
    onScrollContentSizeChange,
    scrollEnabled,
    sheetPaddingBottom: 16 + insets.bottom,
  };
}
