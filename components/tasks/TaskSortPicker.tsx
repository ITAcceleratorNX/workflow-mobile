import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ListGroupLabel } from '@/components/ui/list-group';
import { OptionList } from '@/components/ui/option-list';
import { useProductUi } from '@/hooks/use-product-ui';
import {
  TASK_SORT_DIRECTIONS,
  TASK_SORT_FIELDS,
  taskSortLabel,
  type TaskSort,
  type TaskSortDirection,
  type TaskSortField,
} from '@/lib/task-list-sort';

const FIELD_OPTIONS = TASK_SORT_FIELDS.map((item) => ({ value: item.value, label: item.label }));
const DIRECTION_OPTIONS = TASK_SORT_DIRECTIONS.map((item) => ({
  value: item.value,
  label: item.label,
  icon: item.value === 'asc' ? ('arrow-upward' as const) : ('arrow-downward' as const),
}));

/** «По сроку ↑» — the order of «Входящие» and «Сегодня» (Figma «Сортировка»), applied with «Готово». */
export function TaskSortPicker({ value, onChange }: { value: TaskSort; onChange: (sort: TaskSort) => void }) {
  const ui = useProductUi();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const directionLabel = TASK_SORT_DIRECTIONS.find((item) => item.value === value.direction)?.label ?? '';

  return (
    <>
      <Pressable
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Сортировка: ${taskSortLabel(value)}, ${directionLabel.toLowerCase()}`}
        style={({ pressed }) => [styles.trigger, { backgroundColor: ui.surface, borderColor: ui.fg(0.1) }, pressed && { opacity: 0.7 }]}
      >
        <MaterialIcons name="sort" size={16} color={ui.accent} />
        <Text style={[styles.triggerLabel, { color: ui.fg(0.9) }]}>{taskSortLabel(value)}</Text>
        <MaterialIcons name={value.direction === 'asc' ? 'arrow-upward' : 'arrow-downward'} size={14} color={ui.fg(0.7)} />
      </Pressable>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Сортировка"
        action={{
          label: 'Готово',
          onPress: () => {
            onChange(draft);
            setOpen(false);
          },
        }}
      >
        <ListGroupLabel>Сортировать по</ListGroupLabel>
        <OptionList<TaskSortField>
          accessibilityLabel="Сортировать по"
          value={draft.field}
          options={FIELD_OPTIONS}
          onChange={(field) => setDraft((current) => ({ ...current, field }))}
        />
        <ListGroupLabel>Направление</ListGroupLabel>
        <OptionList<TaskSortDirection>
          variant="compact"
          accessibilityLabel="Направление"
          value={draft.direction}
          options={DIRECTION_OPTIONS}
          onChange={(direction) => setDraft((current) => ({ ...current, direction }))}
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: {
    minHeight: 30,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 14,
    borderWidth: 1,
    paddingLeft: 10,
    paddingRight: 12,
  },
  triggerLabel: { fontSize: 13, fontWeight: '500' },
});
