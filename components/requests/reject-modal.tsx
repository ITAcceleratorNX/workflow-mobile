import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { SubRequest } from '@/lib/api';

interface RejectModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
  subRequest: SubRequest | null;
  loading?: boolean;
  error?: string | null;
}

export function RejectModal({
  visible,
  onClose,
  onSubmit,
  subRequest,
  loading = false,
  error,
}: RejectModalProps) {
  const [reason, setReason] = useState('');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const handleSubmit = async () => {
    if (!reason.trim()) return;
    await onSubmit(reason.trim());
    setReason('');
    onClose();
  };

  const handleClose = () => {
    setReason('');
    onClose();
  };

  if (!subRequest) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.content, { backgroundColor: cardBackground, borderColor: border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ThemedText style={[styles.title, { color: text }]}>
            Отклонить подзаявку
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: textMuted }]}>
            Подзаявка #{subRequest.id}: {subRequest.title || 'Без названия'}
          </ThemedText>
          <ThemedText style={[styles.label, { color: textMuted }]}>
            Причина отклонения (обязательно)
          </ThemedText>
          <TextInput
            style={[
              styles.input,
              { color: text, borderColor: border, backgroundColor: background },
            ]}
            placeholder="Укажите причину"
            placeholderTextColor={textMuted}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
          />
          {error && (
            <ThemedText style={styles.error}>{error}</ThemedText>
          )}
          <Button
            title={loading ? 'Отклонение...' : 'Отклонить'}
            onPress={handleSubmit}
            variant="primary"
            disabled={!reason.trim() || loading}
          />
          <Button
            title="Отмена"
            onPress={handleClose}
            variant="ghost"
            style={styles.cancelBtn}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
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
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  cancelBtn: {
    marginTop: 8,
  },
});
