---
apply: always
---

Use only best practices in developing and use DRY for UI elements. Use these rules for react native.

## Styling
- Use React Native **StyleSheet** for styles (not NativeWind/className).
- Use `FontSizes` from `@/constants/theme` for typography (caption: 12, body: 15, title: 17, etc.).
- Touch targets: minimum **44×44 pt** for all interactive elements; use `hitSlop` for icon-only buttons.
