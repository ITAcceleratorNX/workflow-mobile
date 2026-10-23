import { MaterialIcons } from '@expo/vector-icons';
import { Children, Fragment, isValidElement, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

type ListGroupProps = {
  children: ReactNode;
  /** `raised` — a group inside a sheet that already sits on the surface color. */
  tone?: 'surface' | 'raised';
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

/** Grouped rows on one rounded card, separated by thin lines (Figma rows «Исполнитель», «Срок»). */
export function ListGroup({ children, tone = 'surface', style, accessibilityLabel }: ListGroupProps) {
  const ui = useProductUi();
  const rows = Children.toArray(children).filter(isValidElement);
  return (
    <View
      accessibilityLabel={accessibilityLabel}
      style={[styles.group, tone === 'raised' ? { backgroundColor: ui.raised, borderRadius: 14 } : { backgroundColor: ui.surface }, style]}
    >
      {rows.map((row, index) => (
        <Fragment key={row.key ?? index}>
          {index > 0 ? <View style={[styles.separator, { backgroundColor: ui.fg(0.06) }]} /> : null}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

type ListRowProps = {
  label: string;
  icon?: IconName;
  value?: string | null;
  /** Value color: `danger` for an overdue date. */
  valueTone?: 'muted' | 'danger' | 'default';
  /** Label color: `accent` and `danger` rows are actions («Передать задачу», «Удалить»). */
  tone?: 'default' | 'accent' | 'danger';
  onPress?: () => void;
  /** Shows the chevron of a row that opens something; true by default for pressable rows. */
  chevron?: boolean;
  /** Content at the end instead of the chevron (a check mark, a spinner). */
  trailing?: ReactNode;
  disabled?: boolean;
  /** Bold label of the chosen option. */
  selected?: boolean;
  accessibilityHint?: string;
};

/** One row of a ListGroup: icon, label, value and chevron. Pressable when it has `onPress`. */
export function ListRow({
  label,
  icon,
  value,
  valueTone = 'muted',
  tone = 'default',
  onPress,
  chevron,
  trailing,
  disabled = false,
  selected = false,
  accessibilityHint,
}: ListRowProps) {
  const ui = useProductUi();
  const toneColor = tone === 'accent' ? ui.accent : tone === 'danger' ? ui.danger : null;
  const showChevron = trailing == null && (chevron ?? onPress != null);
  const content = (
    <>
      {icon ? <MaterialIcons name={icon} size={20} color={toneColor ?? ui.fg(0.7)} /> : null}
      <Text style={[styles.label, { color: toneColor ?? ui.fg() }, selected && styles.labelStrong]} numberOfLines={1}>
        {label}
      </Text>
      {value != null ? (
        <Text
          style={[styles.value, { color: valueTone === 'danger' ? ui.danger : valueTone === 'default' ? ui.fg() : ui.fg(0.55) }]}
          numberOfLines={1}
        >
          {value}
        </Text>
      ) : null}
      {trailing}
      {showChevron ? <MaterialIcons name="chevron-right" size={20} color={ui.fg(0.35)} /> : null}
    </>
  );

  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={value ? `${label}: ${value}` : label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: ui.fg(0.06) }, disabled && styles.disabled]}
    >
      {content}
    </Pressable>
  );
}

/** Small caption above a group («Приоритет», «Сортировать по»). */
export function ListGroupLabel({ children }: { children: string }) {
  const ui = useProductUi();
  return <Text style={[styles.caption, { color: ui.fg(0.55) }]}>{children}</Text>;
}

/** Uppercase caption of a section («НЕДАВНИЕ», «СРЕДА, 21 ОКТЯБРЯ»). */
export function SectionCaption({ children }: { children: string }) {
  const ui = useProductUi();
  return (
    <Text accessibilityRole="header" style={[styles.sectionCaption, { color: ui.fg(0.5) }]}>
      {children.toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  group: { borderRadius: 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginLeft: 14 },
  row: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, paddingLeft: 14, paddingRight: 12 },
  disabled: { opacity: 0.5 },
  label: { flex: 1, fontSize: 16 },
  labelStrong: { fontWeight: '600' },
  value: { maxWidth: '55%', fontSize: 15, textAlign: 'right' },
  caption: { fontSize: 13, fontWeight: '500' },
  sectionCaption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.96 },
});
