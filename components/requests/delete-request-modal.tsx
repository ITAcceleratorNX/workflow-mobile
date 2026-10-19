import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Сервер принимает причину не длиннее 1000 символов. */
const REASON_MAX_LENGTH = 1000;

interface DeleteRequestModalProps {
  visible: boolean;
  requestId: number | null;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  /** Причина необязательна: пустая строка уходит как null. */
  onConfirm: (reason: string | null) => Promise<void>;
}

/**
 * Подтверждение удаления заявки Руководителем платформы. Удаление логическое:
 * заявка пропадает из списков, а запись с причиной остаётся в журнале удалений.
 */
export function DeleteRequestModal({
  visible,
  requestId,
  loading = false,
  error,
  onClose,
  onConfirm,
}: DeleteRequestModalProps) {
  const [reason, setReason] = useState('');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const danger = useThemeColor({}, 'danger');

  const handleClose = () => {
    if (loading) return;
    setReason('');
    onClose();
  };

  if (requestId == null) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable
            style={[styles.content, { backgroundColor: cardBackground, borderColor: border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={[styles.title, { color: text }]}>
              Удалить заявку #{requestId}?
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              Заявка пропадёт из списков. Запись об удалении сохранится в журнале удалений.
            </ThemedText>
            <ThemedText style={[styles.label, { color: textMuted }]}>
              Причина удаления (необязательно)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: text, borderColor: border, backgroundColor: background },
              ]}
              placeholder="Например, дубликат заявки"
              placeholderTextColor={textMuted}
              value={reason}
              onChangeText={setReason}
              maxLength={REASON_MAX_LENGTH}
              editable={!loading}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            {error ? (
              <ThemedText style={[styles.error, { color: danger }]}>{error}</ThemedText>
            ) : null}
            <Button
              title={loading ? 'Удаление...' : 'Удалить'}
              onPress={() => void onConfirm(reason.trim() || null)}
              variant="danger"
              disabled={loading}
            />
            <Button
              title="Отмена"
              onPress={handleClose}
              variant="ghost"
              disabled={loading}
              style={styles.cancelBtn}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
  },
  cancelBtn: {
    marginTop: 8,
  },
});
