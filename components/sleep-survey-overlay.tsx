import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import type { SleepRating } from '@/stores/sleep-store';
import { useSleepStore } from '@/stores/sleep-store';

import { formatDateForApi } from '@/lib/dateTimeUtils';

const COLORS = {
  overlay: 'rgba(0,0,0,0.6)',
  card: '#2a2a2a',
  text: '#ffffff',
  textMuted: '#888888',
  accent: '#FF5722',
  optionBg: '#333333',
  optionBorder: '#444444',
};

const RATING_OPTIONS: { value: SleepRating; label: string; icon: React.ComponentProps<typeof MaterialIcons>['name'] }[] = [
  { value: 'poor', label: 'Не выспался', icon: 'mood-bad' },
  { value: 'ok', label: 'Можно и лучше', icon: 'sentiment-neutral' },
  { value: 'good', label: 'Выспался', icon: 'mood' },
];

export interface SleepSurveyOverlayProps {
  visible: boolean;
  onClose: () => void;
}

export function SleepSurveyOverlay({ visible, onClose }: SleepSurveyOverlayProps) {
  const setSleepRating = useSleepStore((s) => s.setSleepRating);

  const handleSelect = useCallback(
    (rating: SleepRating) => {
      const dateKey = formatDateForApi(new Date());
      setSleepRating(dateKey, rating);
      onClose();
    },
    [setSleepRating, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialIcons name="bed" size={28} color={COLORS.accent} />
            <ThemedText style={styles.title}>Как спал?</ThemedText>
            <ThemedText style={styles.subtitle}>
              Оцените качество сна
            </ThemedText>
          </View>
          <View style={styles.options}>
            {RATING_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.option,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => handleSelect(opt.value)}
              >
                <MaterialIcons
                  name={opt.icon}
                  size={28}
                  color={COLORS.accent}
                />
                <ThemedText style={styles.optionLabel}>{opt.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.skipBtn}>
            <ThemedText style={styles.skipText}>Позже</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    color: COLORS.textMuted,
    marginTop: 4,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.optionBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.optionBorder,
    gap: 14,
  },
  optionPressed: {
    opacity: 0.8,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: COLORS.text,
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
    color: COLORS.textMuted,
  },
});
