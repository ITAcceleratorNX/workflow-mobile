import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { equipmentIconKey, type EquipmentIconKey } from '@/lib/booking-flow';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

const ICONS: Record<EquipmentIconKey, IconName> = {
  projector: 'cast',
  screen: 'tv',
  video: 'videocam',
  board: 'edit',
  flipchart: 'article',
  audio: 'mic',
  power: 'power',
  climate: 'ac-unit',
  custom: 'star',
};

export function equipmentIconName(name: string): IconName {
  return ICONS[equipmentIconKey(name)];
}

/** Оснащение переговорной: чипы с иконками; `max` — первые N и «+ ещё». */
export function EquipmentChips({ items, max }: { items?: string[] | null; max?: number }) {
  if (!items?.length) return null;
  const shown = max ? items.slice(0, max) : items;
  const rest = items.length - shown.length;
  return (
    <View style={styles.row} accessibilityLabel="Оснащение">
      {shown.map((name) => (
        <View key={name} style={styles.chip}>
          <MaterialIcons name={equipmentIconName(name)} size={16} color="#fff" />
          <Text style={styles.text}>{name}</Text>
        </View>
      ))}
      {rest > 0 && (
        <View style={styles.chip}>
          <MaterialIcons name="add" size={16} color="#fff" />
          <Text style={styles.text}>ещё {rest}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    backgroundColor: 'rgba(255,255,255,0.15)',
  },
  text: { color: '#fff', fontSize: 14 },
});
