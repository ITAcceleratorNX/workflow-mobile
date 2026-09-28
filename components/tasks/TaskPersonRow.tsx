import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { TaskExecutorRef } from '@/lib/user-tasks-api';

type Props = {
  icon: keyof typeof MaterialIcons.glyphMap;
  title: string;
  person: Pick<TaskExecutorRef, 'full_name' | 'position'> | null | undefined;
  /** Когда сотрудника нет: «—», «Не назначен». */
  emptyLabel?: string;
  /** Строка открывает выбор (передача, ответственный); без onPress — только чтение. */
  onPress?: () => void;
  /** Показать стрелку: действие доступно. Иначе строка приглушена, но нажатие объясняет почему. */
  actionable?: boolean;
  /** Строка не нажимается вовсе. */
  disabled?: boolean;
};

/**
 * Сотрудник в карточке открытой задачи (автор, исполнитель, ответственный): ФИО — основная
 * строка, должность — под ней. Пустая должность не выводится.
 */
export function TaskPersonRow({ icon, title, person, emptyLabel = '—', onPress, actionable = false, disabled }: Props) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const position = person?.position?.trim();

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || !onPress}
      style={({ pressed }) => [
        styles.row,
        pressed && actionable && styles.pressed,
        onPress && !actionable && !disabled && styles.dimmed,
      ]}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={[title, person?.full_name ?? emptyLabel, position].filter(Boolean).join(', ')}
    >
      <View style={styles.left}>
        <MaterialIcons name={icon} size={20} color={textMuted} />
        <ThemedText style={[styles.title, { color: text }]}>{title}</ThemedText>
      </View>
      <View style={styles.right}>
        <View style={styles.valueCol}>
          <ThemedText style={[styles.name, { color: person ? text : textMuted }]} numberOfLines={1}>
            {person?.full_name ?? emptyLabel}
          </ThemedText>
          {position ? (
            <ThemedText style={[styles.position, { color: textMuted }]} numberOfLines={1}>
              {position}
            </ThemedText>
          ) : null}
        </View>
        {actionable ? <MaterialIcons name="chevron-right" size={22} color={textMuted} /> : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 10,
  },
  pressed: { opacity: 0.65 },
  dimmed: { opacity: 0.85 },
  left: { flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 0 },
  title: { fontSize: 15, fontWeight: '600' },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    flex: 1,
    justifyContent: 'flex-end',
    minWidth: 0,
  },
  valueCol: { flexShrink: 1, alignItems: 'flex-end', gap: 2 },
  name: { fontSize: 13 },
  position: { fontSize: 12 },
});
