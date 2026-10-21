import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { getMeetingRoomEquipmentCatalog } from '@/lib/api';
import { EQUIPMENT_CUSTOM_MAX, EQUIPMENT_PRESETS, isPresetEquipment } from '@/lib/booking-flow';

import { equipmentIconName } from './equipment-chips';

type Colors = { text: string; textMuted: string; primary: string; border: string };

const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Оснащение переговорной для админа: готовые пункты переключаются тапом,
 * свои (до 30 символов) добавляются, правятся тапом и удаляются. Подсказки — из общего каталога.
 */
export function RoomEquipmentEditor({
  value,
  onChange,
  colors,
}: {
  value: string[];
  onChange: (next: string[]) => void;
  colors: Colors;
}) {
  const [draft, setDraft] = useState('');
  const [catalog, setCatalog] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    getMeetingRoomEquipmentCatalog().then((res) => {
      if (!cancelled && res.ok) setCatalog(res.data.map((item) => item.name));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const has = (name: string) => value.some((v) => same(v, name));
  const toggle = (name: string) => onChange(has(name) ? value.filter((v) => !same(v, name)) : [...value, name]);
  const add = (raw: string) => {
    const name = raw.trim().slice(0, EQUIPMENT_CUSTOM_MAX);
    if (!name) return;
    if (!has(name)) onChange([...value, name]);
    setDraft('');
  };
  const edit = (name: string) => {
    onChange(value.filter((v) => v !== name));
    setDraft(name);
  };

  const custom = value.filter((v) => !isPresetEquipment(v));
  const query = draft.trim().toLowerCase();
  const suggestions = query
    ? catalog.filter((name) => !isPresetEquipment(name) && !has(name) && name.toLowerCase().includes(query)).slice(0, 5)
    : [];

  return (
    <View style={{ gap: 10 }}>
      <View style={styles.wrap}>
        {EQUIPMENT_PRESETS.map((name) => {
          const on = has(name);
          return (
            <Pressable
              key={name}
              onPress={() => toggle(name)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border }, on && { backgroundColor: `${colors.primary}22` }]}
            >
              <MaterialIcons name={equipmentIconName(name)} size={16} color={on ? colors.primary : colors.textMuted} />
              <Text style={[styles.chipText, { color: on ? colors.primary : colors.text }]}>{name}</Text>
            </Pressable>
          );
        })}
      </View>

      {custom.length ? (
        <View style={styles.wrap}>
          {custom.map((name) => (
            <View key={name} style={[styles.chip, { borderColor: colors.primary }]}>
              <Pressable onPress={() => edit(name)} accessibilityLabel={`Изменить «${name}»`} style={styles.chipInner}>
                <MaterialIcons name="star" size={16} color={colors.primary} />
                <Text style={[styles.chipText, { color: colors.text }]}>{name}</Text>
              </Pressable>
              <Pressable onPress={() => toggle(name)} hitSlop={8} accessibilityLabel={`Удалить «${name}»`}>
                <MaterialIcons name="close" size={16} color={colors.textMuted} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.addRow}>
        <TextInput
          value={draft}
          onChangeText={(t) => setDraft(t.slice(0, EQUIPMENT_CUSTOM_MAX))}
          onSubmitEditing={() => add(draft)}
          placeholder="Своё оснащение"
          placeholderTextColor={colors.textMuted}
          maxLength={EQUIPMENT_CUSTOM_MAX}
          returnKeyType="done"
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          accessibilityLabel="Своё оснащение"
        />
        <Pressable
          onPress={() => add(draft)}
          disabled={!draft.trim()}
          style={[styles.addBtn, { backgroundColor: colors.primary }, !draft.trim() && { opacity: 0.4 }]}
          accessibilityLabel="Добавить оснащение"
        >
          <MaterialIcons name="add" size={20} color="#fff" />
        </Pressable>
      </View>
      <Text style={[styles.hint, { color: colors.textMuted }]}>
        {draft.length}/{EQUIPMENT_CUSTOM_MAX} · нажмите на своё, чтобы изменить
      </Text>
      {suggestions.length ? (
        <View style={styles.wrap}>
          {suggestions.map((name) => (
            <Pressable key={name} onPress={() => add(name)} style={[styles.chip, { borderColor: colors.border }]}>
              <MaterialIcons name="add" size={16} color={colors.textMuted} />
              <Text style={[styles.chipText, { color: colors.text }]}>{name}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1 },
  chipInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 14 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  input: { flex: 1, height: 42, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  addBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 12 },
});
