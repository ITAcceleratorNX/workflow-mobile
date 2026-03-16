import { useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  TextInput as RNTextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoStore, type TodoItem } from '@/stores/todo-store';
import { formatDateForApi } from '@/lib/dateTimeUtils';

interface TodoRowProps {
  item: TodoItem;
  onToggle: () => void;
  onRemove: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
}

function TodoRow({ item, onToggle, onRemove, textColor, textMuted, primary, borderColor }: TodoRowProps) {
  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={styles.todoRow}
    >
      <View style={[styles.checkbox, { borderColor: item.completed ? primary : borderColor }, item.completed && { backgroundColor: primary }]}>
        {item.completed && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
      </View>
      <ThemedText
        style={[
          styles.todoText,
          { color: item.completed ? textMuted : textColor },
          item.completed && styles.todoTextCompleted,
        ]}
        numberOfLines={2}
      >
        {item.text}
      </ThemedText>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRemove();
        }}
        hitSlop={12}
        style={styles.removeButton}
      >
        <MaterialIcons name="close" size={20} color={textMuted} />
      </Pressable>
    </Pressable>
  );
}

export default function TodoListScreen() {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { items, addItem, removeItem, toggleItem, clearCompleted } = useTodoStore();
  const [inputText, setInputText] = useState('');

  const handleAdd = useCallback(() => {
    addItem(inputText, formatDateForApi(new Date()), '09:00');
    setInputText('');
  }, [inputText, addItem]);

  const completedCount = items.filter((i) => i.completed).length;
  const hasCompleted = completedCount > 0;

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Todo list" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <View style={[styles.inputRow, { backgroundColor: cardBg, borderColor: border }]}>
          <RNTextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Добавить задачу..."
            placeholderTextColor={headerSubtitle}
            onSubmitEditing={handleAdd}
            returnKeyType="done"
            style={[styles.input, { color: headerText }]}
          />
          <Pressable
            onPress={handleAdd}
            style={[styles.addButton, { backgroundColor: primary }]}
            disabled={!inputText.trim()}
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </Pressable>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
        >
          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="format-list-bulleted" size={48} color={headerSubtitle} />
              <ThemedText style={[styles.emptyTitle, { color: headerText }]}>Нет задач</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: headerSubtitle }]}>
                Добавьте задачу выше
              </ThemedText>
            </View>
          ) : (
            <View style={[styles.listBlock, { backgroundColor: cardBg }]}>
              {items.map((item) => (
                <TodoRow
                  key={item.id}
                  item={item}
                  onToggle={() => toggleItem(item.id)}
                  onRemove={() => removeItem(item.id)}
                  textColor={headerText}
                  textMuted={headerSubtitle}
                  primary={primary}
                  borderColor={border}
                />
              ))}
            </View>
          )}

          {hasCompleted && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                clearCompleted();
              }}
              style={styles.clearButton}
            >
              <ThemedText style={[styles.clearButtonText, { color: primary }]}>
                Очистить выполненные ({completedCount})
              </ThemedText>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 16,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    marginTop: 4,
  },
  listBlock: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoText: {
    flex: 1,
    fontSize: 16,
  },
  todoTextCompleted: {
    textDecorationLine: 'line-through',
  },
  removeButton: {
    padding: 4,
  },
  clearButton: {
    alignSelf: 'flex-end',
    marginTop: 16,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
});
