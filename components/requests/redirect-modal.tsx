import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { ServiceCategory } from '@/lib/api';
import type { SubRequest } from '@/lib/api';

interface RedirectModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (categoryId: number) => Promise<void>;
  subRequest: SubRequest | null;
  categories: ServiceCategory[];
  loading?: boolean;
  error?: string | null;
}

export function RedirectModal({
  visible,
  onClose,
  onSubmit,
  subRequest,
  categories,
  loading = false,
  error,
}: RedirectModalProps) {
  const [categoryId, setCategoryId] = useState('');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const options = categories
    .filter((c) => c.id !== subRequest?.category_id)
    .map((c) => ({ value: String(c.id), label: c.name }));

  const handleSubmit = async () => {
    const id = parseInt(categoryId, 10);
    if (!id) return;
    await onSubmit(id);
    setCategoryId('');
    onClose();
  };

  const handleClose = () => {
    setCategoryId('');
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
            Перенаправить к другой категории
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: textMuted }]}>
            Выберите категорию для подзаявки #{subRequest.id}
          </ThemedText>
          <View style={styles.selectWrap}>
            <Select
              value={categoryId}
              onValueChange={setCategoryId}
              options={options}
              placeholder="Выберите категорию"
            />
          </View>
          {error && (
            <ThemedText style={styles.error}>{error}</ThemedText>
          )}
          <Button
            title={loading ? 'Перенаправление...' : 'Перенаправить'}
            onPress={handleSubmit}
            variant="primary"
            disabled={!categoryId || loading}
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
  selectWrap: {
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
