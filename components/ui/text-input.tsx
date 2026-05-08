import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, { useState, useCallback } from 'react';
import {
  Pressable,
  TextInput as RNTextInput,
  StyleSheet,
  View,
  type TextInputProps as RNTextInputProps,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
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
    | 'returnKeyType'
    | 'onSubmitEditing'
    | 'blurOnSubmit'
    | 'multiline'
    | 'numberOfLines'
    | 'autoComplete'
    | 'textContentType'
  > {
  label?: string;
  placeholder?: string;
  value: string;
  onChangeText: (text: string) => void;
  secureTextEntry?: boolean;
  /** When true, input flexes to fill parent (e.g. in a row). Helps with long text on small screens. */
  flex?: boolean;
  /**
   * Сообщение об ошибке. Если задано — рамка инпута становится `danger`,
   * под полем выводится подсказка.
   */
  errorMessage?: string;
  /** Текст-подсказка под полем (выводится, если нет `errorMessage`). */
  helperText?: string;
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
  errorMessage,
  helperText,
  returnKeyType,
  onSubmitEditing,
  blurOnSubmit,
  multiline,
  numberOfLines,
  autoComplete,
  textContentType,
}: TextInputProps) {
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const accent = useThemeColor({}, 'accent');
  const danger = useThemeColor({}, 'danger');
  const surface = useThemeColor({}, 'surface');
  const textMuted = useThemeColor({}, 'textMuted');
  const [showPassword, setShowPassword] = useState(false);
  const [focused, setFocused] = useState(false);

  const isPassword = secureTextEntry;
  const showToggle = isPassword && value.length > 0;
  const hasError = !!errorMessage;

  const handleFocus = useCallback<NonNullable<RNTextInputProps['onFocus']>>(
    (e) => {
      setFocused(true);
      onFocus?.(e);
    },
    [onFocus]
  );

  const handleBlur = useCallback<NonNullable<RNTextInputProps['onBlur']>>(
    (e) => {
      setFocused(false);
      onBlur?.(e);
    },
    [onBlur]
  );

  const dynamicBorderColor = hasError
    ? danger
    : focused
      ? accent
      : border;

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
            multiline && styles.inputMultiline,
            {
              color: text,
              borderColor: dynamicBorderColor,
              backgroundColor: surface,
            },
          ]}
          placeholder={placeholder}
          placeholderTextColor={textMuted}
          value={value}
          onChangeText={onChangeText}
          secureTextEntry={isPassword && !showPassword}
          onBlur={handleBlur}
          onFocus={handleFocus}
          editable={editable}
          keyboardType={keyboardType}
          maxLength={maxLength}
          autoCapitalize={autoCapitalize}
          returnKeyType={returnKeyType}
          onSubmitEditing={onSubmitEditing}
          blurOnSubmit={blurOnSubmit}
          multiline={multiline}
          numberOfLines={numberOfLines}
          autoComplete={autoComplete}
          textContentType={textContentType}
          accessibilityLabel={label ?? placeholder}
          accessibilityState={{ disabled: !editable }}
        />
        {showToggle ? (
          <Pressable
            onPress={() => setShowPassword((p) => !p)}
            style={styles.eyeButton}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={
              showPassword ? 'Скрыть пароль' : 'Показать пароль'
            }
          >
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={24}
              color={textMuted}
            />
          </Pressable>
        ) : null}
      </View>
      {hasError ? (
        <ThemedText style={[styles.helper, { color: danger }]}>
          {errorMessage}
        </ThemedText>
      ) : helperText ? (
        <ThemedText style={[styles.helper, { color: textMuted }]}>
          {helperText}
        </ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: Spacing.sm,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  wrapperFlex: {
    flex: 1,
    minWidth: 0,
    alignSelf: 'stretch',
  },
  label: {
    fontSize: FontSizes.body + 1,
    lineHeight: LineHeights.body + 2,
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
    minHeight: 44,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.sm + 2,
    paddingRight: Spacing.giant,
    borderRadius: Radius.sm,
    borderWidth: 1,
    fontSize: FontSizes.body + 1,
    lineHeight: LineHeights.body,
  },
  inputFlex: {
    width: '100%',
  },
  inputMultiline: {
    minHeight: 96,
    textAlignVertical: 'top',
    paddingTop: Spacing.md,
  },
  eyeButton: {
    position: 'absolute',
    right: 12,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
  },
  helper: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
  },
});
