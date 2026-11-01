import { MaterialIcons } from '@expo/vector-icons';
import { Card, SurveyBadge } from '@/components/ui';
import { Radius, Spacing } from '@/constants/theme';
import { useProductUi } from '@/hooks/use-product-ui';
import type { ClientSurvey } from '@/lib/surveys/types';
import { durationLabel, questionsCountLabel } from '@/lib/surveys/format';
import { formatWithOptions } from '@/lib/dateTimeUtils';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

type ClientSurveyCardProps = {
  survey: ClientSurvey;
  completedLabel?: string | null;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
};

function publicationDate(value: string) {
  return formatWithOptions(value, { day: 'numeric', month: 'short', year: 'numeric' })
    .replaceAll('.', '')
    .replace(/\sг$/, '');
}

/** Survey card for the client list; completed surveys remain visible as history. */
export function ClientSurveyCard({ survey, completedLabel, onPress, style }: ClientSurveyCardProps) {
  const ui = useProductUi();
  const completed = survey.state === 'completed';
  const date = publicationDate(survey.published_at);

  return (
    <Card
      variant="flat"
      padding="none"
      radius={Radius.md}
      onPress={onPress}
      style={[styles.card, { backgroundColor: ui.surface, borderColor: ui.fg(0.06) }, style]}
      accessibilityLabel={onPress ? `${survey.title}, ${questionsCountLabel(survey.questions_count)}` : survey.title}
    >
      <View style={styles.content}>
        <View style={styles.topRow}>
          <SurveyBadge kind="survey" />
          {completed ? (
            <SurveyBadge kind="completed" />
          ) : (
            <Text style={[styles.date, { color: ui.fg(0.55) }]}>{date}</Text>
          )}
        </View>
        <Text style={[styles.title, { color: ui.fg() }]} numberOfLines={2}>{survey.title}</Text>
        {completedLabel ? (
          <Text style={[styles.description, { color: ui.fg(0.58) }]} numberOfLines={2}>{completedLabel}</Text>
        ) : survey.description ? (
          <Text style={[styles.description, { color: ui.fg(0.58) }]} numberOfLines={2}>{survey.description}</Text>
        ) : null}
      </View>
      <View style={[styles.footer, { borderTopColor: ui.fg(0.06) }]}>
        <View style={styles.metaItem}>
          <MaterialIcons name="checklist" size={16} color={ui.fg(0.62)} />
          <Text style={[styles.metaText, { color: ui.fg(0.62) }]}>{questionsCountLabel(survey.questions_count)}</Text>
        </View>
        {survey.estimated_minutes != null ? (
          <View style={styles.metaItem}>
            <MaterialIcons name="schedule" size={16} color={ui.fg(0.62)} />
            <Text style={[styles.metaText, { color: ui.fg(0.62) }]}>{durationLabel(survey.estimated_minutes)}</Text>
          </View>
        ) : null}
        {onPress ? <MaterialIcons name="chevron-right" size={20} color={ui.fg(0.45)} style={styles.chevron} /> : null}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden' },
  content: { padding: Spacing.md, gap: 10 },
  topRow: { minHeight: 30, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  date: { fontSize: 12, lineHeight: 18 },
  title: { fontSize: 17, fontWeight: '600', lineHeight: 23 },
  description: { fontSize: 14, lineHeight: 21 },
  footer: {
    minHeight: 45,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { fontSize: 13, lineHeight: 17 },
  chevron: { marginLeft: 'auto' },
});
