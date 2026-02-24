import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  onValueChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
}

export function Select({
  value,
  onValueChange,
  options,
  placeholder = 'Выберите',
}: SelectProps) {
  const [open, setOpen] = useState(false);
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const textMuted = useThemeColor({}, 'textMuted');
  const background = useThemeColor({}, 'background');

  const selected = options.find((o) => o.value === value);
  const display = selected?.label ?? placeholder;
  const displayColor = selected ? text : textMuted;

  const handleSelect = (v: string) => {
    onValueChange(v);
    setOpen(false);
  };

  return (
    <View style={styles.wrapper}>
      <Pressable
        onPress={() => setOpen(true)}
        style={[styles.trigger, { borderColor: border }]}
      >
        <ThemedText style={[styles.triggerText, { color: displayColor }]}>
          {display}
        </ThemedText>
        <MaterialIcons name="keyboard-arrow-down" size={20} color={textMuted} />
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable
          style={styles.backdrop}
          onPress={() => setOpen(false)}
        >
          <View style={[styles.dropdown, { backgroundColor: background }]}>
            <FlatList
              data={options}
              keyExtractor={(item) => item.value}
              renderItem={({ item }) => (
                <Pressable
                  style={({ pressed }) => [
                    styles.option,
                    { backgroundColor: pressed ? border : 'transparent' },
                  ]}
                  onPress={() => handleSelect(item.value)}
                >
                  <ThemedText style={{ color: text }}>{item.label}</ThemedText>
                </Pressable>
              )}
              style={styles.list}
            />
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  trigger: {
    height: 48,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  triggerText: {
    fontSize: 16,
    lineHeight: 22,
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  dropdown: {
    borderRadius: 8,
    borderWidth: 1,
    maxHeight: 280,
  },
  list: {
    maxHeight: 276,
  },
  option: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
});
