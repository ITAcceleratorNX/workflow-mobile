import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, FontWeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ExecutorAssignRole = 'executor' | 'leader';

export interface ExecutorAssignCardProps {
  fullName: string;
  specialty?: string;
  role: ExecutorAssignRole;
  onRoleChange: (role: ExecutorAssignRole) => void;
  onRemove: () => void;
}

export function ExecutorAssignCard({
  fullName,
  specialty,
  role,
  onRoleChange,
  onRemove,
}: ExecutorAssignCardProps) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const danger = useThemeColor({}, 'danger');

  return (
    <View style={[styles.card, { borderColor: border, backgroundColor: surfaceMuted }]}>
      <View style={styles.headerRow}>
        <View style={styles.identity}>
          <ThemedText style={[styles.name, { color: text }]} numberOfLines={2}>
            {fullName}
          </ThemedText>
          {specialty ? (
            <ThemedText style={[styles.specialty, { color: textMuted }]} numberOfLines={2}>
              {specialty}
            </ThemedText>
          ) : null}
        </View>
        <Pressable
          onPress={onRemove}
          hitSlop={10}
          accessibilityLabel="Убрать исполнителя"
          style={({ pressed }) => [
            styles.removeBtn,
            { borderColor: border, opacity: pressed ? 0.65 : 1 },
          ]}
        >
          <MaterialIcons name="close" size={18} color={danger} />
        </Pressable>
      </View>

      <View style={[styles.roleSegment, { backgroundColor: border }]}>
        {(['leader', 'executor'] as const).map((option) => {
          const active = role === option;
          return (
            <Pressable
              key={option}
              onPress={() => onRoleChange(option)}
              style={({ pressed }) => [
                styles.roleOption,
                active && { backgroundColor: primary },
                pressed && !active && styles.roleOptionPressed,
              ]}
            >
              <ThemedText
                style={[
                  styles.roleLabel,
                  { color: active ? onPrimary : textMuted },
                ]}
              >
                {option === 'leader' ? 'Лидер' : 'Исполнитель'}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  name: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
    lineHeight: 22,
  },
  specialty: {
    fontSize: FontSizes.bodySmall,
    lineHeight: 20,
  },
  removeBtn: {
    width: 32,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  roleSegment: {
    flexDirection: 'row',
    borderRadius: Radius.md,
    padding: 3,
    gap: 3,
  },
  roleOption: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.sm,
  },
  roleOptionPressed: {
    opacity: 0.85,
  },
  roleLabel: {
    fontSize: FontSizes.bodySmall,
    fontWeight: FontWeights.medium,
  },
});
