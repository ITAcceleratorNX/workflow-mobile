import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';

interface RatingModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment?: string) => Promise<void>;
  title?: string;
  subRequestId?: number;
}

export function RatingModal({
  visible,
  onClose,
  onSubmit,
  title = 'Оценить работу',
  subRequestId,
}: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const handleSubmit = async () => {
    if (rating < 1 || rating > 5) return;
    setLoading(true);
    try {
      await onSubmit(rating, comment.trim() || undefined);
      setRating(0);
      setComment('');
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRating(0);
    setComment('');
    onClose();
  };

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
          <ThemedText style={[styles.title, { color: text }]}>{title}</ThemedText>
          {subRequestId && (
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              Подзаявка #{subRequestId}
            </ThemedText>
          )}
          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((v) => (
              <Pressable
                key={v}
                onPress={() => setRating(v)}
                style={styles.starBtn}
              >
                <MaterialIcons
                  name={rating >= v ? 'star' : 'star-border'}
                  size={36}
                  color={rating >= v ? primary : textMuted}
                />
              </Pressable>
            ))}
          </View>
          <Button
            title={loading ? 'Отправка...' : 'Отправить'}
            onPress={handleSubmit}
            variant="primary"
            disabled={rating < 1 || loading}
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
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  starsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 24,
  },
  starBtn: {
    padding: 4,
  },
  cancelBtn: {
    marginTop: 8,
  },
});
