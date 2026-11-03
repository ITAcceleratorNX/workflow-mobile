import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

export type SurveyBadgeKind = 'survey' | 'completed';

export type SurveyBadgeProps = {
  kind: SurveyBadgeKind;
  style?: StyleProp<ViewStyle>;
};

const LABELS: Record<SurveyBadgeKind, string> = {
  survey: 'Опрос',
  completed: 'Пройдено',
};

/** Compact status pill used on survey cards. */
export function SurveyBadge({ kind, style }: SurveyBadgeProps) {
  const ui = useProductUi();
  const completed = kind === 'completed';

  return (
    <View
      accessibilityRole="text"
      accessibilityLabel={LABELS[kind]}
      style={[
        styles.badge,
        { backgroundColor: completed ? ui.done : ui.accentSoft },
        style,
      ]}
    >
      <Text style={[styles.label, { color: completed ? ui.onAccent : ui.accentOnSoft }]}>{LABELS[kind]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  label: { fontSize: 12, fontWeight: '600', lineHeight: 16 },
});
