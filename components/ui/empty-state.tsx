import { MaterialIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

type EmptyStateProps = {
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  title: string;
  description?: string;
  /** An action under the text, e.g. an outlined «Открыть входящие» button. */
  action?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** Empty list or a failed load (Figma «На сегодня задач нет»). */
export function EmptyState({ icon, title, description, action, style }: EmptyStateProps) {
  const ui = useProductUi();
  return (
    <View style={[styles.root, style]} accessibilityRole="summary">
      <MaterialIcons name={icon} size={44} color={ui.fg(0.3)} />
      <Text style={[styles.title, { color: ui.fg() }]}>{title}</Text>
      {description ? <Text style={[styles.description, { color: ui.fg(0.55) }]}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  title: { fontSize: 18, fontWeight: '600', textAlign: 'center', marginTop: 2 },
  description: { fontSize: 14, lineHeight: 17, textAlign: 'center' },
  action: { marginTop: 4 },
});
