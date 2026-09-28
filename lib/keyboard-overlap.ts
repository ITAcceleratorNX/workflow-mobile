/**
 * Сколько снизу закрывает клавиатура экран, который заходит под системную полосу внизу: панель
 * навигации Android при edge-to-edge или полосу «Домой» iOS. `bottomInset` — её высота из safe
 * area. React Native на Android сообщает высоту клавиатуры без панели навигации под ней, а на
 * iOS — от нижнего края экрана.
 */
export function keyboardOverlap(keyboardHeight: number, bottomInset: number, os: string): number {
  if (keyboardHeight <= 0) return 0;
  return os === 'android' ? keyboardHeight + bottomInset : keyboardHeight;
}
