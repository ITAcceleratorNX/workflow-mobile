import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Radius, Spacing } from '@/constants/theme';
import { useProductUi } from '@/hooks/use-product-ui';
import type { ClientSurvey } from '@/lib/surveys/types';
import { homeCardSubtitle } from '@/lib/surveys/format';

export type NewSurveyHomeCardProps = {
  survey: ClientSurvey;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
};

/** New survey promo shown between the daily news link and news cards on the home screen. */
export function NewSurveyHomeCard({ survey, onPress, style }: NewSurveyHomeCardProps) {
  const ui = useProductUi();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Новый опрос. ${homeCardSubtitle(survey)}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: ui.accentSoft },
        pressed && styles.pressed,
        style,
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: ui.accent }]}>
        <MaterialIcons name="poll" size={24} color={ui.onAccent} />
      </View>
      <View style={styles.copy}>
        <Text style={[styles.title, { color: ui.fg() }]}>Новый опрос</Text>
        <Text style={[styles.subtitle, { color: ui.accentOnSoft }]} numberOfLines={1}>
          {homeCardSubtitle(survey)}
        </Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color={ui.fg(0.8)} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    minHeight: 74,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
    marginBottom: Spacing.md,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderRadius: Radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconWrap: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  copy: { flex: 1, gap: 3 },
  title: { fontSize: 15, lineHeight: 19, fontWeight: '600' },
  subtitle: { fontSize: 12, lineHeight: 16 },
  pressed: { opacity: 0.82 },
});
