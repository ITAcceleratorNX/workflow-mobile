import { useScopedState } from '@/hooks/use-scoped-state';
import { useEffect } from 'react';
import { Keyboard, Platform } from 'react-native';

/**
 * Высота клавиатуры для сдвига bottom-sheet / модалок, чтобы поле ввода и список не перекрывались.
 */
export function useKeyboardHeight(active: boolean): number {
  const [height, setHeight] = useScopedState(active, 0);

  useEffect(() => {
    if (!active) {
      return;
    }
    const show = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => setHeight(e.endCoordinates.height)
    );
    const hide = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setHeight(0)
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, [active, setHeight]);

  return height;
}
