import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';

import { BottomSheet } from '@/components/ui/bottom-sheet';
import { ListGroup, ListRow } from '@/components/ui/list-group';
import { useProductUi } from '@/hooks/use-product-ui';

type TaskMoreMenuProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onOpenStats: () => void;
  onOpenTeams: () => void;
};

/** «•••» of the tasks screen: the task statistics and the user's teams. */
export function TaskMoreMenu({ open, onOpenChange, onOpenStats, onOpenTeams }: TaskMoreMenuProps) {
  const ui = useProductUi();
  return (
    <>
      <Pressable
        onPress={() => onOpenChange(true)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Ещё: статистика и команды"
        style={({ pressed }) => [styles.trigger, pressed && { opacity: 0.6 }]}
      >
        <MaterialIcons name="more-horiz" size={28} color={ui.accent} />
      </Pressable>
      <BottomSheet visible={open} onClose={() => onOpenChange(false)} title="Ещё">
        <ListGroup tone="raised">
          <ListRow icon="bar-chart" label="Статистика" onPress={onOpenStats} />
          <ListRow icon="groups" label="Команды" onPress={onOpenTeams} />
        </ListGroup>
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  trigger: { width: 40, height: 44, alignItems: 'center', justifyContent: 'center' },
});
