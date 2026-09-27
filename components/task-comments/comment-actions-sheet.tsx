import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button, Sheet } from '@/components/ui';
import { Spacing } from '@/constants/theme';
import type { PendingComment } from '@/lib/task-comments/store';
import type { TaskComment } from '@/lib/task-comments/types';

/** Над чем открыто меню: свой комментарий или своё неотправленное сообщение. */
export type CommentMenuTarget = { kind: 'comment'; comment: TaskComment } | { kind: 'pending'; entry: PendingComment };

interface CommentActionsSheetProps {
  target: CommentMenuTarget | null;
  onClose: () => void;
  onEdit: (comment: TaskComment) => void;
  onDelete: (comment: TaskComment) => void;
  onDiscard: (entry: PendingComment) => void;
}

/**
 * Действия со своим комментарием: изменить или удалить, удаление — после подтверждения.
 * Для неотправленного сообщения — только подтверждение удаления: его текст не сохранится.
 */
export function CommentActionsSheet({ target, onClose, onEdit, onDelete, onDiscard }: CommentActionsSheetProps) {
  const [confirming, setConfirming] = useState(target?.kind === 'pending');

  if (target?.kind === 'pending') {
    return (
      <Sheet
        visible
        onClose={onClose}
        title="Удалить неотправленное сообщение?"
        subtitle="Его текст не сохранится."
        scrollable={false}
      >
        <View style={styles.actions}>
          <Button title="Удалить" variant="danger" onPress={() => onDiscard(target.entry)} />
          <Button title="Отмена" variant="ghost" onPress={onClose} />
        </View>
      </Sheet>
    );
  }

  const comment = target?.comment ?? null;
  return (
    <Sheet
      visible={comment !== null}
      onClose={onClose}
      title={confirming ? 'Удалить комментарий?' : 'Комментарий'}
      subtitle={confirming ? 'В ленте на его месте останется строка «Комментарий удалён».' : undefined}
      scrollable={false}
    >
      {comment === null ? null : confirming ? (
        <View style={styles.actions}>
          <Button title="Удалить" variant="danger" onPress={() => onDelete(comment)} />
          <Button title="Отмена" variant="ghost" onPress={onClose} />
        </View>
      ) : (
        <View style={styles.actions}>
          {comment.permissions.can_edit ? (
            <Button title="Изменить" variant="secondary" onPress={() => onEdit(comment)} />
          ) : null}
          {comment.permissions.can_delete ? (
            <Button title="Удалить" variant="outline" onPress={() => setConfirming(true)} />
          ) : null}
          <Button title="Отмена" variant="ghost" onPress={onClose} />
        </View>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: Spacing.sm,
    paddingTop: Spacing.sm,
  },
});
