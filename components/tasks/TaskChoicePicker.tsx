import { BottomSheet } from '@/components/ui/bottom-sheet';
import { OptionList, type OptionListItem } from '@/components/ui/option-list';

type TaskChoicePickerProps<T extends string> = {
  visible: boolean;
  onClose: () => void;
  title: string;
  value: T | null;
  options: readonly OptionListItem<T>[];
  /** Called with the new choice; the sheet closes itself. */
  onChange: (value: T) => void;
};

/** One choice for a task field («Напоминание», «Приоритет») in a sheet. */
export function TaskChoicePicker<T extends string>({ visible, onClose, title, value, options, onChange }: TaskChoicePickerProps<T>) {
  return (
    <BottomSheet visible={visible} onClose={onClose} title={title}>
      <OptionList<T>
        accessibilityLabel={title}
        value={value}
        options={options}
        onChange={(next) => {
          onChange(next);
          onClose();
        }}
      />
    </BottomSheet>
  );
}
