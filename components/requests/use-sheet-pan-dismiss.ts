import { useCallback, useEffect, useMemo, useRef } from 'react';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

type Options = {
  visible: boolean;
  onClose: () => void;
  /** false — нельзя закрыть жестом (например идёт отправка формы) */
  dismissAllowed?: boolean;
};

const OFF_SCREEN = 900;
const CLOSE_Y = 96;
const CLOSE_VY = 520;

/**
 * Сдвиг шторки вниз для закрытия, как в TaskAddSheet (ручка + pan).
 */
export function useSheetPanDismiss({ visible, onClose, dismissAllowed = true }: Options) {
  const translateY = useSharedValue(0);
  const allowed = useSharedValue(1);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const flushClose = useCallback(() => {
    onCloseRef.current();
  }, []);

  useEffect(() => {
    if (visible) translateY.value = 0;
  }, [visible, translateY]);

  useEffect(() => {
    allowed.value = dismissAllowed ? 1 : 0;
  }, [dismissAllowed, allowed]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          if (allowed.value === 0) return;
          const t = e.translationY;
          translateY.value = t > 0 ? t : t * 0.2;
        })
        .onEnd((e) => {
          if (allowed.value === 0) {
            translateY.value = withSpring(0, { damping: 26, stiffness: 260 });
            return;
          }
          const y = translateY.value;
          const shouldClose = y > CLOSE_Y || e.velocityY > CLOSE_VY;
          if (shouldClose) {
            translateY.value = withTiming(OFF_SCREEN, { duration: 260 }, (finished) => {
              if (finished) runOnJS(flushClose)();
            });
          } else {
            translateY.value = withSpring(0, { damping: 26, stiffness: 260 });
          }
        }),
    // allowed / translateY — shared values, стабильны; gesture создаём один раз
    // eslint-disable-next-line react-hooks/exhaustive-deps -- see above
    [flushClose]
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return { panGesture, sheetAnimatedStyle };
}
