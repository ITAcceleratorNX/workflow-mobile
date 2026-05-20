import { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, FontWeights, Radius, Spacing } from '@/constants/theme';

export type EditableCatalogRowProps = {
  icon: keyof typeof MaterialIcons.glyphMap;
  iconBackgroundColor: string;
  iconColor: string;
  name: string;
  subtitle?: string;
  isEditing: boolean;
  draft: string;
  isSaving: boolean;
  cardBackgroundColor: string;
  borderColor: string;
  textColor: string;
  textMutedColor: string;
  primaryColor: string;
  dangerColor: string;
  surfaceColor: string;
  onStartEdit: () => void;
  onChangeDraft: (value: string) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
};

export function EditableCatalogRow({
  icon,
  iconBackgroundColor,
  iconColor,
  name,
  subtitle,
  isEditing,
  draft,
  isSaving,
  cardBackgroundColor,
  borderColor,
  textColor,
  textMutedColor,
  primaryColor,
  dangerColor,
  surfaceColor,
  onStartEdit,
  onChangeDraft,
  onSave,
  onCancel,
  onDelete,
}: EditableCatalogRowProps) {
  const inputRef = useRef<RNTextInput>(null);

  useEffect(() => {
    if (isEditing) {
      const t = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(t);
    }
  }, [isEditing]);

  const canSave = draft.trim().length > 0 && !isSaving;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: cardBackgroundColor,
          borderColor: isEditing ? primaryColor : borderColor,
          borderWidth: isEditing ? 2 : 1,
        },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBackgroundColor }]}>
        <MaterialIcons name={icon} size={22} color={iconColor} />
      </View>

      {isEditing ? (
        <View style={styles.editBlock}>
          <RNTextInput
            ref={inputRef}
            style={[
              styles.inlineInput,
              {
                color: textColor,
                borderColor: borderColor,
                backgroundColor: surfaceColor,
              },
            ]}
            value={draft}
            onChangeText={onChangeDraft}
            placeholder="Название"
            placeholderTextColor={textMutedColor}
            editable={!isSaving}
            returnKeyType="done"
            onSubmitEditing={() => {
              if (canSave) onSave();
            }}
            blurOnSubmit={false}
            maxLength={255}
            accessibilityLabel="Новое название"
          />
          <View style={styles.editActions}>
            <Pressable
              onPress={onSave}
              disabled={!canSave}
              style={({ pressed }) => [
                styles.iconAction,
                styles.saveAction,
                { backgroundColor: primaryColor, opacity: !canSave ? 0.45 : pressed ? 0.85 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Сохранить"
            >
              {isSaving ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <MaterialIcons name="check" size={22} color="#fff" />
              )}
            </Pressable>
            <Pressable
              onPress={onCancel}
              disabled={isSaving}
              style={({ pressed }) => [
                styles.iconAction,
                { borderColor: borderColor, opacity: isSaving ? 0.45 : pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Отмена"
            >
              <MaterialIcons name="close" size={22} color={textMutedColor} />
            </Pressable>
          </View>
        </View>
      ) : (
        <>
          <Pressable
            style={({ pressed }) => [
              styles.content,
              { opacity: pressed ? 0.75 : 1 },
            ]}
            onPress={onStartEdit}
            accessibilityRole="button"
            accessibilityLabel={`Изменить название: ${name}`}
            accessibilityHint="Откроет поле для редактирования"
          >
            <ThemedText style={[styles.name, { color: textColor }]} numberOfLines={3}>
              {name}
            </ThemedText>
            {subtitle ? (
              <ThemedText style={[styles.subtitle, { color: textMutedColor }]} numberOfLines={1}>
                {subtitle}
              </ThemedText>
            ) : null}
          </Pressable>
          <Pressable
            onPress={onDelete}
            hitSlop={12}
            style={({ pressed }) => [
              styles.iconAction,
              { borderColor: borderColor, opacity: pressed ? 0.7 : 1 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Удалить"
          >
            <MaterialIcons name="delete-outline" size={22} color={dangerColor} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    borderRadius: Radius.lg,
    padding: Spacing.md,
    gap: Spacing.md,
    minWidth: 0,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  content: {
    flex: 1,
    minWidth: 0,
    gap: 2,
    paddingVertical: 2,
  },
  name: {
    fontSize: FontSizes.body,
    fontWeight: FontWeights.semibold,
  },
  subtitle: {
    fontSize: FontSizes.caption,
    marginTop: 2,
  },
  editBlock: {
    flex: 1,
    minWidth: 0,
    gap: Spacing.sm,
  },
  inlineInput: {
    minHeight: 44,
    borderRadius: Radius.sm,
    borderWidth: 1,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSizes.body,
    width: '100%',
  },
  editActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    alignSelf: 'flex-end',
  },
  iconAction: {
    width: 40,
    height: 40,
    borderRadius: Radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveAction: {
    borderWidth: 0,
  },
});
