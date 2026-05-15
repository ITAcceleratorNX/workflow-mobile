import React, { useCallback, useMemo } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import type { SleepRating } from '@/stores/sleep-store';
import { getScheduledSleepMinutes, useSleepStore } from '@/stores/sleep-store';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

import { formatDateForApi } from '@/lib/dateTimeUtils';

/** Коэффициент оценки: насколько фактический сон отличается от запланированного */
const RATING_FACTOR: Record<SleepRating, number> = {
  good: 1.0,
  ok: 0.85,
  poor: 0.70,
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
  const colorScheme = useColorScheme() ?? 'light';
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const surfaceMuted = useThemeColor({ dark: '#333333' }, 'surfaceMuted');
  const border = useThemeColor({}, 'border');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');

  const overlayScrim = colorScheme === 'dark' ? 'rgba(0,0,0,0.65)' : 'rgba(15,23,42,0.38)';

  const palette = useMemo(
    () => ({
      overlayScrim,
      card: surfaceElevated,
      optionBg: surfaceMuted,
      optionBorder: border,
      text,
      textMuted,
      accent: primary,
    }),
    [overlayScrim, surfaceElevated, surfaceMuted, border, text, textMuted, primary]
  );

  const setSleepRating = useSleepStore((s) => s.setSleepRating);
  const setLastNightSleep = useSleepStore((s) => s.setLastNightSleep);
  const settings = useSleepStore((s) => s.settings);

  const handleSelect = useCallback(
    (rating: SleepRating) => {
      const dateKey = formatDateForApi(new Date());
      setSleepRating(dateKey, rating);

      const scheduled = getScheduledSleepMinutes(settings);
      if (scheduled > 0) {
        setLastNightSleep(Math.round(scheduled * RATING_FACTOR[rating]));
      }

      onClose();
    },
    [setSleepRating, setLastNightSleep, settings, onClose]
  );

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={[styles.overlay, { backgroundColor: palette.overlayScrim }]} onPress={onClose}>
        <Pressable style={[styles.card, { backgroundColor: palette.card }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.header}>
            <MaterialIcons name="bed" size={28} color={palette.accent} />
            <ThemedText style={[styles.title, { color: palette.text }]}>Как спал?</ThemedText>
            <ThemedText style={[styles.subtitle, { color: palette.textMuted }]}>
              Оцените качество сна
            </ThemedText>
          </View>
          <View style={styles.options}>
            {RATING_OPTIONS.map((opt) => (
              <Pressable
                key={opt.value}
                style={({ pressed }) => [
                  styles.option,
                  {
                    backgroundColor: palette.optionBg,
                    borderColor: palette.optionBorder,
                    opacity: pressed ? 0.88 : 1,
                  },
                ]}
                onPress={() => handleSelect(opt.value)}
              >
                <MaterialIcons name={opt.icon} size={28} color={palette.accent} />
                <ThemedText style={[styles.optionLabel, { color: palette.text }]}>{opt.label}</ThemedText>
              </Pressable>
            ))}
          </View>
          <Pressable onPress={onClose} style={styles.skipBtn}>
            <ThemedText style={[styles.skipText, { color: palette.textMuted }]}>Позже</ThemedText>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  card: {
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
    marginTop: 12,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  options: {
    gap: 12,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    gap: 14,
  },
  optionLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  skipBtn: {
    alignSelf: 'center',
    marginTop: 20,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  skipText: {
    fontSize: 15,
  },
});
