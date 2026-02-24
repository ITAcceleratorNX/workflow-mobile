import React from 'react';
import {
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface OtpInputProps {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  label?: string;
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  label,
}: OtpInputProps) {
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const textMuted = useThemeColor({}, 'textMuted');

  const handleChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, length);
    onChange(digits);
  };

  return (
    <View style={styles.wrapper}>
      {label ? (
        <ThemedText style={[styles.label, { color: text }]}>{label}</ThemedText>
      ) : null}
      <TextInput
        style={[
          styles.input,
          {
            color: text,
            borderColor: border,
          },
        ]}
        value={value}
        onChangeText={handleChange}
        keyboardType="number-pad"
        maxLength={length}
        placeholder="6 цифр из SMS"
        placeholderTextColor={textMuted}
        selectTextOnFocus
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 16,
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  input: {
    width: 160,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 24,
    fontWeight: '600',
    textAlign: 'center',
    letterSpacing: 8,
  },
});
