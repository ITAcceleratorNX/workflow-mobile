import { useMemo, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  FlatList,
  Pressable,
  TextInput as RNTextInput,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader, Select, Button } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTodoStore, type TodoItem, getTaskDate } from '@/stores/todo-store';
import { formatDateForApi } from '@/lib/dateTimeUtils';

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];

function formatTaskDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  const today = new Date();
  const todayKey = formatDateForApi(today);
  if (dateStr === todayKey) return 'Сегодня';
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (dateStr === formatDateForApi(yesterday)) return 'Вчера';
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const STATUS_OPTIONS = [
  { value: 'all', label: 'Все' },
  { value: 'active', label: 'Активные' },
  { value: 'completed', label: 'Выполненные' },
];

const DATE_OPTIONS = [
  { value: 'all', label: 'Все даты' },
  { value: 'today', label: 'Сегодня' },
  { value: 'week', label: 'Эта неделя' },
  { value: 'overdue', label: 'Просроченные' },
];

interface TaskRowProps {
  item: TodoItem;
  onToggle: () => void;
  onRemove: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
}

function TaskRow({ item, onToggle, onRemove, textColor, textMuted, primary, borderColor }: TaskRowProps) {
  const dateStr = getTaskDate(item);
  const today = formatDateForApi(new Date());
  const isOverdue = dateStr < today && !item.completed;

  return (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onToggle();
      }}
      style={[styles.row, { borderBottomColor: borderColor }]}
    >
      <View style={[styles.checkbox, { borderColor: item.completed ? primary : borderColor }, item.completed && { backgroundColor: primary }]}>
        {item.completed && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
      </View>
      <View style={styles.rowContent}>
        <ThemedText
          style={[styles.rowText, { color: item.completed ? textMuted : textColor }, item.completed && styles.textCompleted]}
          numberOfLines={2}
        >
          {item.text}
        </ThemedText>
        <ThemedText style={[styles.rowDate, { color: textMuted }, isOverdue && { color: '#EF4444' }]}>
          {formatTaskDate(dateStr)}
          {isOverdue && ' • Просрочено'}
        </ThemedText>
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRemove();
        }}
        hitSlop={12}
        style={styles.removeBtn}
      >
        <MaterialIcons name="close" size={20} color={textMuted} />
      </Pressable>
    </Pressable>
  );
}

export default function TasksScreen() {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const { items, addItem, removeItem, toggleItem } = useTodoStore();
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterDate, setFilterDate] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [addModalVisible, setAddModalVisible] = useState(false);
  const [addInputText, setAddInputText] = useState('');

  const todayKey = formatDateForApi(new Date());
  const weekStart = (() => {
    const d = new Date();
    const day = d.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    return monday;
  })();
  const weekStartKey = formatDateForApi(weekStart);

  const filteredItems = useMemo(() => {
    let list = [...items];
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      list = list.filter((i) => i.text.toLowerCase().includes(q));
    }
    if (filterStatus === 'active') list = list.filter((i) => !i.completed);
    else if (filterStatus === 'completed') list = list.filter((i) => i.completed);
    if (filterDate === 'today') {
      list = list.filter((i) => getTaskDate(i) === todayKey);
    } else if (filterDate === 'week') {
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      const weekEndKey = formatDateForApi(weekEnd);
      list = list.filter((i) => {
        const d = getTaskDate(i);
        return d >= weekStartKey && d <= weekEndKey;
      });
    } else if (filterDate === 'overdue') {
      list = list.filter((i) => getTaskDate(i) < todayKey && !i.completed);
    }
    return list.sort((a, b) => {
      const da = getTaskDate(a);
      const db = getTaskDate(b);
      if (da !== db) return da.localeCompare(db);
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [items, filterStatus, filterDate, searchQuery, todayKey, weekStartKey]);

  const handleAddTask = useCallback(() => {
    const trimmed = addInputText.trim();
    if (!trimmed) return;
    addItem(trimmed, formatDateForApi(new Date()));
    setAddInputText('');
    setAddModalVisible(false);
  }, [addInputText, addItem]);

  const renderItem = useCallback(
    ({ item }: { item: TodoItem }) => (
      <TaskRow
        item={item}
        onToggle={() => toggleItem(item.id)}
        onRemove={() => removeItem(item.id)}
        textColor={headerText}
        textMuted={headerSubtitle}
        primary={primary}
        borderColor={border}
      />
    ),
    [toggleItem, removeItem, headerText, headerSubtitle, primary, border]
  );

  const ListEmpty = (
    <View style={styles.empty}>
      <MaterialIcons name="assignment" size={48} color={headerSubtitle} />
      <ThemedText style={[styles.emptyTitle, { color: headerText }]}>Нет задач</ThemedText>
      <ThemedText style={[styles.emptySubtitle, { color: headerSubtitle }]}>
        Создайте задачу в Todo list на главной
      </ThemedText>
    </View>
  );

  const addButton = (
    <Pressable
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        setAddModalVisible(true);
      }}
      style={({ pressed }) => [styles.headerAddBtn, { opacity: pressed ? 0.8 : 1 }]}
    >
      <MaterialIcons name="add" size={24} color={primary} />
    </Pressable>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Все задачи" rightSlot={addButton} />
      <View style={[styles.searchRow, { backgroundColor: cardBg, borderColor: border }]}>
        <MaterialIcons name="search" size={20} color={headerSubtitle} />
        <RNTextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Поиск задач..."
          placeholderTextColor={headerSubtitle}
          style={[styles.searchInput, { color: headerText }]}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')} hitSlop={8}>
            <MaterialIcons name="close" size={20} color={headerSubtitle} />
          </Pressable>
        )}
      </View>
      <View style={[styles.filters, { borderBottomColor: border }]}>
        <View style={styles.filterRow}>
          <ThemedText style={[styles.filterLabel, { color: headerSubtitle }]}>Статус</ThemedText>
          <View style={styles.selectWrap}>
            <Select
              value={filterStatus}
              options={STATUS_OPTIONS}
              onValueChange={setFilterStatus}
              placeholder="Все"
            />
          </View>
        </View>
        <View style={styles.filterRow}>
          <ThemedText style={[styles.filterLabel, { color: headerSubtitle }]}>Дата</ThemedText>
          <View style={styles.selectWrap}>
            <Select
              value={filterDate}
              options={DATE_OPTIONS}
              onValueChange={setFilterDate}
              placeholder="Все даты"
            />
          </View>
        </View>
      </View>
      <FlatList
        data={filteredItems}
        renderItem={renderItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + 24 }]}
        ListEmptyComponent={ListEmpty}
        showsVerticalScrollIndicator={false}
      />

      <Modal
        visible={addModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setAddModalVisible(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setAddModalVisible(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.modalKeyboard}
          >
            <Pressable
              style={[styles.modalContent, { backgroundColor: cardBg }]}
              onPress={(e) => e.stopPropagation()}
            >
              <ThemedText style={[styles.modalTitle, { color: headerText }]}>Новая задача</ThemedText>
              <RNTextInput
                value={addInputText}
                onChangeText={setAddInputText}
                placeholder="Введите задачу..."
                placeholderTextColor={headerSubtitle}
                onSubmitEditing={handleAddTask}
                returnKeyType="done"
                autoFocus
                style={[styles.modalInput, { color: headerText, borderColor: border }]}
              />
              <View style={styles.modalActions}>
                <Button
                  title="Отмена"
                  variant="secondary"
                  onPress={() => setAddModalVisible(false)}
                />
                <Button
                  title="Добавить"
                  onPress={handleAddTask}
                  disabled={!addInputText.trim()}
                />
              </View>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerAddBtn: {
    padding: 8,
    minWidth: 44,
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginTop: 12,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  filters: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  filterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
  },
  filterLabel: { fontSize: 14, marginRight: 12, minWidth: 70 },
  selectWrap: { flex: 1 },
  listContent: { paddingHorizontal: 16, paddingTop: 16 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    marginBottom: 8,
    borderBottomWidth: 0,
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
  rowContent: { flex: 1, minWidth: 0 },
  rowText: { fontSize: 16 },
  textCompleted: { textDecorationLine: 'line-through' },
  rowDate: { fontSize: 12, marginTop: 4 },
  removeBtn: { padding: 4 },
  empty: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginTop: 16 },
  emptySubtitle: { fontSize: 14, marginTop: 4 },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalKeyboard: { width: '100%' },
  modalContent: {
    borderRadius: 16,
    padding: 20,
  },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalInput: {
    fontSize: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'flex-end',
  },
});
