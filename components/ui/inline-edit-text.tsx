import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type StyleProp, type TextStyle } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';

type InlineEditTextProps = {
  value: string;
  /** Saves the trimmed text; false keeps the field open (the caller has shown why). */
  onSave: (next: string) => Promise<boolean>;
  editable: boolean;
  /** Accessible name of the field («Название задачи»). */
  label: string;
  /** New lines are allowed; the field saves when it loses focus. */
  multiline?: boolean;
  /** Required text: an empty value is refused with this message. */
  requiredMessage?: string;
  maxLength?: number;
  /** Shown instead of an empty value when the text can be edited («Добавить описание»). */
  emptyLabel?: string;
  textStyle: StyleProp<TextStyle>;
};

/**
 * Text that turns into a field on tap (title and description of a task card). «Готово» on the
 * keyboard or leaving the field saves; a refused save keeps the field with the typed text.
 */
export function InlineEditText({ value, onSave, editable, label, multiline = false, requiredMessage, maxLength, emptyLabel, textStyle }: InlineEditTextProps) {
  const ui = useProductUi();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const commit = async () => {
    if (saving) return;
    const next = draft.trim();
    if (next === value.trim()) {
      setEditing(false);
      setError(null);
      return;
    }
    if (!next && requiredMessage) {
      setError(requiredMessage);
      return;
    }
    setSaving(true);
    const ok = await onSave(next);
    setSaving(false);
    if (ok) {
      setEditing(false);
      setError(null);
    }
  };

  if (!editing) {
    const text = value.trim();
    if (!text && !editable) return null;
    if (!editable) return <Text style={textStyle}>{text}</Text>;
    return (
      <Pressable
        onPress={() => {
          setDraft(value);
          setEditing(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${text || 'пусто'}`}
        accessibilityHint="Изменить"
        style={({ pressed }) => pressed && { opacity: 0.7 }}
      >
        <Text style={[textStyle, !text && { color: ui.fg(0.4) }]}>{text || emptyLabel}</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.editor}>
      <TextInput
        value={draft}
        onChangeText={(next) => {
          setDraft(next);
          if (error) setError(null);
        }}
        onBlur={() => void commit()}
        onSubmitEditing={multiline ? undefined : () => void commit()}
        autoFocus
        multiline={multiline}
        blurOnSubmit={!multiline}
        returnKeyType={multiline ? 'default' : 'done'}
        editable={!saving}
        maxLength={maxLength}
        accessibilityLabel={label}
        style={[textStyle, styles.input, { backgroundColor: ui.fg(0.05), borderColor: ui.accent }]}
      />
      {error ? (
        <Text accessibilityRole="alert" style={[styles.error, { color: ui.danger }]}>
          {error}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: 4 },
  input: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 4, marginHorizontal: -6, textAlignVertical: 'top' },
  error: { fontSize: 13 },
});
