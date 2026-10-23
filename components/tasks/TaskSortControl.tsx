import { useState } from 'react';
import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import { Sheet } from '@/components/ui/sheet';
import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { TASK_SORT_OPTIONS, type TaskSortValue } from '@/lib/task-list-sort';

export function TaskSortControl({ value, onChange }: { value: TaskSortValue; onChange: (value: TaskSortValue) => void }) {
  const [open, setOpen] = useState(false);
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'cardBackground');
  const label = TASK_SORT_OPTIONS.find((option) => option.value === value)?.label;

  return (
    <View style={styles.container}>
      <ThemedText style={[styles.label, { color: muted }]}>Сортировка</ThemedText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Сортировка: ${label}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, { borderColor: border, backgroundColor: background }, pressed && styles.pressed]}
      >
        <MaterialIcons name="sort" size={22} color={primary} accessible={false} />
        <ThemedText style={[styles.text, { color: text }]}>{label}</ThemedText>
        <MaterialIcons name="expand-more" size={22} color={muted} accessible={false} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title="Сортировка" avoidKeyboard={false}>
        {TASK_SORT_OPTIONS.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityState={{ checked: option.value === value }}
            accessibilityLabel={option.label}
            onPress={() => { onChange(option.value); setOpen(false); }}
            style={({ pressed }) => [styles.option, { borderColor: border }, pressed && styles.pressed]}
          >
            <ThemedText style={[styles.text, { color: text }]}>{option.label}</ThemedText>
            <MaterialIcons name={option.value === value ? 'radio-button-checked' : 'radio-button-unchecked'} size={24} color={option.value === value ? primary : muted} accessible={false} />
          </Pressable>
        ))}
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 12, gap: 6 },
  label: { fontSize: 13 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8 },
  text: { flex: 1, fontSize: 14 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  pressed: { opacity: 0.65 },
});
