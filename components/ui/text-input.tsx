import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export interface TextInputProps
  extends Pick<
    RNTextInputProps,
    | 'onBlur'
    | 'onFocus'
    | 'editable'
    | 'keyboardType'
    | 'maxLength'
    | 'autoCapitalize'
  > {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  /** When true, input flexes to fill parent (e.g. in a row). Helps with long text on small screens. */
  flex?: boolean;
}

export function TextInput({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  onBlur,
  onFocus,
  editable = true,
  keyboardType = 'default',
  maxLength,
  autoCapitalize = 'none',
  flex = false,
}: TextInputProps) {
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const textMuted = useThemeColor({}, 'textMuted');
  const [showPassword, setShowPassword] = useState(false);
  const isPassword = secureTextEntry;
  const showToggle = isPassword && value.length > 0;

  return (
    <View style={[styles.wrapper, flex && styles.wrapperFlex]}>
      {label ? (
        <ThemedText style={[styles.label, { color: text }]}>{label}</ThemedText>
      ) : null}
      <View style={[styles.inputRow, flex && styles.inputRowFlex]}>
        <RNTextInput
          style={[
            styles.input,
            flex && styles.inputFlex,
            {
              color: text,
              borderColor: border,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !showPassword}
          onBlur={onBlur}
          onFocus={onFocus}
          editable={editable}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
        />
        {showToggle ? (
          <Pressable
            onPress={() => setShowPassword((p) => !p)}
            style={styles.eyeButton}
            hitSlop={12}
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={24}
              color={textMuted}
            />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  wrapperFlex: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  inputRow: {
    position: 'relative',
  },
  inputRowFlex: {
    flex: 1,
    minWidth: 0,
  },
  input: {
    height: 48,
    paddingHorizontal: 16,
    paddingRight: 48,
    borderRadius: 8,
    borderWidth: 1,
    fontSize: 16,
    lineHeight: 22,
  },
  inputFlex: {
    width: '100%',
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
});
