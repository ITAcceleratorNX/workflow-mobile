import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { SectionCaption } from '@/components/ui/list-group';
import { useProductUi } from '@/hooks/use-product-ui';
import { useRecipientPickerData } from '@/hooks/use-recipient-picker-data';
import {
  hasResults,
  recipientPickerSections,
  selectionKey,
  type RecipientPickerEntry,
  type RecipientPickerMode,
} from '@/lib/task-recipient-search';
import type { RecipientSelection } from '@/lib/task-recipients-api';

const KIND_ICONS: Record<RecipientPickerEntry['kind'], React.ComponentProps<typeof MaterialIcons>['name']> = {
  self: 'person',
  user: 'person',
  department: 'groups',
  team: 'groups',
  company: 'business',
};

type RecipientPickerScreenProps = {
  visible: boolean;
  onClose: () => void;
  value: RecipientSelection | null;
  onSelect: (selection: RecipientSelection | null) => void;
  mode?: RecipientPickerMode;
  title?: string;
};

/** Screen «Исполнитель» (Figma «Задачи · Выбор исполнителя»): search, «Недавние», results. */
export function RecipientPickerScreen({ visible, onClose, value, onSelect, mode = 'assign', title = 'Исполнитель' }: RecipientPickerScreenProps) {
  const ui = useProductUi();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: ui.canvas, paddingTop: insets.top + 12 }]}>
        <View style={styles.header}>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Назад" style={styles.back}>
            <MaterialIcons name="chevron-left" size={28} color={ui.accent} />
            <Text style={[styles.backLabel, { color: ui.accent }]}>Назад</Text>
          </Pressable>
          <Text accessibilityRole="header" style={[styles.title, { color: ui.fg() }]}>
            {title}
          </Text>
        </View>
        {visible ? (
          <PickerBody
            value={value}
            mode={mode}
            bottomInset={insets.bottom}
            onSelect={(selection) => {
              void Haptics.selectionAsync();
              onSelect(selection);
              onClose();
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

function PickerBody({
  value,
  mode,
  bottomInset,
  onSelect,
}: {
  value: RecipientSelection | null;
  mode: RecipientPickerMode;
  bottomInset: number;
  onSelect: (selection: RecipientSelection | null) => void;
}) {
  const ui = useProductUi();
  const [query, setQuery] = useState('');
  const data = useRecipientPickerData(query, { includeTeams: mode === 'assign' });
  const sections = useMemo(
    () => recipientPickerSections(query, mode, data.recentOptions, data.results),
    [query, mode, data.recentOptions, data.results]
  );
  const chosen = mode === 'assign' ? selectionKey(value) : null;
  const empty = query.trim() ? !hasResults(data.results) : sections.length === 0;

  let status: React.ReactNode = null;
  if (data.error) {
    status = (
      <View style={styles.status}>
        <Text style={[styles.statusText, { color: ui.fg(0.7) }]}>{data.error}</Text>
        <Pressable onPress={data.reload} accessibilityRole="button" hitSlop={8}>
          <Text style={[styles.retry, { color: ui.accent }]}>Повторить</Text>
        </Pressable>
      </View>
    );
  } else if (data.needsMoreLetters) {
    status = <Text style={[styles.statusText, { color: ui.fg(0.55) }]}>Введите ещё одну букву</Text>;
  } else if (data.searching || (!query.trim() && data.recentLoading && mode === 'transfer')) {
    status = <ActivityIndicator color={ui.accent} style={styles.spinner} />;
  } else if (empty && query.trim()) {
    status = <Text style={[styles.statusText, { color: ui.fg(0.55) }]}>Никого не нашли по запросу «{query.trim()}»</Text>;
  } else if (empty) {
    status = <Text style={[styles.statusText, { color: ui.fg(0.55) }]}>Начните вводить имя, отдел или компанию</Text>;
  }

  return (
    <>
      <View style={[styles.search, { backgroundColor: ui.surface }]}>
        <MaterialIcons name="search" size={20} color={ui.fg(0.5)} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Поиск по имени или отделу"
          placeholderTextColor={ui.fg(0.4)}
          accessibilityLabel="Поиск получателя"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={[styles.searchInput, { color: ui.fg() }]}
        />
      </View>
      <ScrollView
        style={styles.list}
        contentContainerStyle={[styles.listContent, { paddingBottom: bottomInset + 24 }]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {status}
        {sections.map((section) => (
          <View key={section.title} style={styles.section}>
            <SectionCaption>{section.title}</SectionCaption>
            <View style={[styles.group, { backgroundColor: ui.surface }]}>
              {section.entries.map((entry, index) => {
                const selected = entry.key === chosen;
                return (
                  <Pressable
                    key={entry.key}
                    onPress={() => onSelect(entry.selection)}
                    accessibilityRole="button"
                    accessibilityState={{ selected }}
                    accessibilityLabel={entry.subtitle ? `${entry.title}, ${entry.subtitle}` : entry.title}
                    style={({ pressed }) => [
                      styles.entry,
                      index > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: ui.fg(0.06) },
                      pressed && { backgroundColor: ui.fg(0.06) },
                    ]}
                  >
                    <View style={[styles.avatar, { backgroundColor: ui.fg(0.08) }]}>
                      <MaterialIcons name={KIND_ICONS[entry.kind]} size={18} color={ui.fg(0.75)} />
                    </View>
                    <View style={styles.entryText}>
                      <Text style={[styles.entryTitle, { color: ui.fg() }, selected && styles.entryTitleStrong]} numberOfLines={1}>
                        {entry.title}
                      </Text>
                      {entry.subtitle ? (
                        <Text style={[styles.entrySubtitle, { color: ui.fg(0.5) }]} numberOfLines={1}>
                          {entry.subtitle}
                        </Text>
                      ) : null}
                    </View>
                    {selected ? <MaterialIcons name="check" size={22} color={ui.accent} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 16, gap: 16 },
  header: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  back: { position: 'absolute', left: -6, flexDirection: 'row', alignItems: 'center' },
  backLabel: { fontSize: 18 },
  title: { fontSize: 17, fontWeight: '600' },
  search: { minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  searchInput: { flex: 1, fontSize: 15, paddingVertical: 10 },
  list: { flex: 1, marginHorizontal: -16 },
  listContent: { paddingHorizontal: 16, gap: 16 },
  section: { gap: 8 },
  group: { borderRadius: 16, overflow: 'hidden' },
  entry: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, paddingHorizontal: 14 },
  avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  entryText: { flex: 1, gap: 2 },
  entryTitle: { fontSize: 16 },
  entryTitleStrong: { fontWeight: '600' },
  entrySubtitle: { fontSize: 13 },
  status: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  statusText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  retry: { fontSize: 14, fontWeight: '600' },
  spinner: { paddingVertical: 20 },
});
