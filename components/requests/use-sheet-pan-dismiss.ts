import { useCallback, useEffect, useMemo } from 'react';
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

  const flushClose = useCallback(() => onClose(), [onClose]);

  useEffect(() => {
    if (visible) translateY.set(0);
  }, [visible, translateY]);

  useEffect(() => {
    allowed.set(dismissAllowed ? 1 : 0);
  }, [dismissAllowed, allowed]);

  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetY(10)
        .failOffsetX([-24, 24])
        .onUpdate((e) => {
          if (allowed.get() === 0) return;
          const t = e.translationY;
          translateY.set(t > 0 ? t : t * 0.2);
        })
        .onEnd((e) => {
          if (allowed.get() === 0) {
            translateY.set(withSpring(0, { damping: 26, stiffness: 260 }));
            return;
          }
          const y = translateY.get();
          const shouldClose = y > CLOSE_Y || e.velocityY > CLOSE_VY;
          if (shouldClose) {
            translateY.set(withTiming(OFF_SCREEN, { duration: 260 }, (finished) => {
              if (finished) runOnJS(flushClose)();
            }));
          } else {
            translateY.set(withSpring(0, { damping: 26, stiffness: 260 }));
          }
        }),
    [allowed, translateY, flushClose]
  );

  const sheetAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.get() }],
  }));

  return { panGesture, sheetAnimatedStyle };
}
