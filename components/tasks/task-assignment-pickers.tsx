import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { searchUsersForAssign, type UserSearchItem } from '@/lib/api';
import type { Team } from '@/lib/teams-api';

/** Лидер + участники для выбора исполнителя (Team или вложенный `task.team` с API). */
export function collectTeamMemberOptions(
  team:
    | Team
    | { leader?: { id: number; full_name: string } | null; members?: { id: number; full_name: string }[] }
    | null
    | undefined
): { id: number; full_name: string }[] {
  if (!team) return [];
  const map = new Map<number, { id: number; full_name: string }>();
  if (team.leader) map.set(team.leader.id, { id: team.leader.id, full_name: team.leader.full_name });
  for (const m of team.members ?? []) {
    if (!map.has(m.id)) map.set(m.id, { id: m.id, full_name: m.full_name });
  }
  return Array.from(map.values()).sort((a, b) => a.full_name.localeCompare(b.full_name, 'ru'));
}

type TeamPickerProps = {
  visible: boolean;
  onClose: () => void;
  teams: Team[];
  loading: boolean;
  selectedTeamId: number | null;
  onSelect: (teamId: number | null) => void;
};

export function TaskTeamPickerOverlay({
  visible,
  onClose,
  teams,
  loading,
  selectedTeamId,
  onSelect,
}: TeamPickerProps) {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');

  const pick = useCallback(
    (id: number | null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(id);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!visible) return null;

  return (
    <View style={styles.subOverlayRoot}>
      <Pressable style={styles.subBackdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.subScheduleWrap}>
        <View
          style={[
            styles.subScheduleSheet,
            {
              backgroundColor: background,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.sheetHandleHit}>
            <View style={[styles.dragGrabber, { backgroundColor: primary }]} />
          </View>
          <View style={styles.subSheetHeader}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.subSheetHeaderBtn}>
              <MaterialIcons name="close" size={24} color={headerText} />
            </Pressable>
            <ThemedText style={[styles.subSheetHeaderTitle, { color: headerText }]}>Команда</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={styles.subSheetHeaderBtn}>
              <MaterialIcons name="check" size={24} color={primary} />
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.centerBlock}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.pickerScroll}
              contentContainerStyle={styles.pickerScrollContent}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                style={[styles.shortcutRow, { borderBottomColor: border }]}
                onPress={() => pick(null)}
              >
                <MaterialIcons name="person-off" size={22} color={textMuted} />
                <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>Без команды</ThemedText>
                {selectedTeamId == null ? (
                  <MaterialIcons name="check" size={22} color={primary} />
                ) : null}
              </Pressable>

              {teams.length === 0 ? (
                <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
                  Пока нет команд. Создайте команду через панель «Команды» во Входящих.
                </ThemedText>
              ) : (
                teams.map((t) => {
                  const selected = selectedTeamId === t.id;
                  return (
                    <Pressable
                      key={t.id}
                      style={[styles.shortcutRow, { borderBottomColor: border }]}
                      onPress={() => pick(t.id)}
                    >
                      <View style={[styles.teamIconSm, { backgroundColor: `${primary}22` }]}>
                        <MaterialIcons name="groups" size={20} color={primary} />
                      </View>
                      <ThemedText style={[styles.shortcutLabel, { color: headerText }]} numberOfLines={2}>
                        {t.name}
                      </ThemedText>
                      {selected ? <MaterialIcons name="check" size={22} color={primary} /> : null}
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          )}
        </View>
      </View>
    </View>
  );
}

type ExecutorPickerProps = {
  visible: boolean;
  onClose: () => void;
  /** Пользователь выбрал команду — исполнитель только из состава (или ожидание загрузки) */
  teamScope: boolean;
  team: Team | null;
  /** Команда в скоупе, но список команд ещё грузится */
  teamLoading?: boolean;
  selectedExecutor: { id: number; full_name: string } | null;
  onSelect: (executor: { id: number; full_name: string } | null) => void;
};

export function TaskExecutorPickerOverlay({
  visible,
  onClose,
  team,
  teamScope,
  teamLoading = false,
  selectedExecutor,
  onSelect,
}: ExecutorPickerProps) {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const [search, setSearch] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<UserSearchItem[]>([]);

  const teamMode = teamScope && team != null;
  const teamPending = teamScope && team == null && teamLoading;
  const teamMissing = teamScope && team == null && !teamLoading;
  const memberOptions = collectTeamMemberOptions(team ?? undefined);

  useEffect(() => {
    if (!visible) {
      setSearch('');
      setResults([]);
      setSearching(false);
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || teamMode) return;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      const res = await searchUsersForAssign(q);
      setSearching(false);
      if (res.ok) setResults(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [search, visible, teamMode]);

  const pick = useCallback(
    (executor: { id: number; full_name: string } | null) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onSelect(executor);
      onClose();
    },
    [onSelect, onClose]
  );

  if (!visible) return null;

  return (
    <View style={styles.subOverlayRoot}>
      <Pressable style={styles.subBackdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.subScheduleWrap}>
        <View
          style={[
            styles.subScheduleSheet,
            {
              backgroundColor: background,
              paddingBottom: Math.max(insets.bottom, 12),
            },
          ]}
        >
          <View style={styles.sheetHandleHit}>
            <View style={[styles.dragGrabber, { backgroundColor: primary }]} />
          </View>
          <View style={styles.subSheetHeader}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.subSheetHeaderBtn}>
              <MaterialIcons name="close" size={24} color={headerText} />
            </Pressable>
            <ThemedText style={[styles.subSheetHeaderTitle, { color: headerText }]}>Исполнитель</ThemedText>
            <Pressable onPress={onClose} hitSlop={12} style={styles.subSheetHeaderBtn}>
              <MaterialIcons name="check" size={24} color={primary} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.pickerScroll}
            contentContainerStyle={styles.pickerScrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Pressable
              style={[styles.shortcutRow, { borderBottomColor: border }]}
              onPress={() => pick(null)}
            >
              <MaterialIcons name="person-off" size={22} color={textMuted} />
              <ThemedText style={[styles.shortcutLabel, { color: headerText }]}>Без исполнителя</ThemedText>
              {selectedExecutor == null ? <MaterialIcons name="check" size={22} color={primary} /> : null}
            </Pressable>

            {teamPending ? (
              <View style={styles.centerBlock}>
                <ActivityIndicator size="large" color={primary} />
                <ThemedText style={[styles.hint, { color: textMuted }]}>Загрузка команды…</ThemedText>
              </View>
            ) : teamMissing ? (
              <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
                Команда не найдена. Закройте окно и выберите команду снова.
              </ThemedText>
            ) : teamMode ? (
              memberOptions.length === 0 ? (
                <ThemedText style={[styles.emptyHint, { color: textMuted }]}>
                  В команде нет участников. Добавьте их в настройках команды.
                </ThemedText>
              ) : (
                memberOptions.map((m) => {
                  const selected = selectedExecutor?.id === m.id;
                  return (
                    <Pressable
                      key={m.id}
                      style={[styles.shortcutRow, { borderBottomColor: border }]}
                      onPress={() => pick(m)}
                    >
                      <MaterialIcons name="person" size={22} color={primary} />
                      <ThemedText style={[styles.shortcutLabel, { color: headerText }]} numberOfLines={2}>
                        {m.full_name}
                      </ThemedText>
                      {selected ? <MaterialIcons name="check" size={22} color={primary} /> : null}
                    </Pressable>
                  );
                })
              )
            ) : (
              <>
                <View style={[styles.searchCard, { backgroundColor: cardBg, borderColor: border }]}>
                  <MaterialIcons name="search" size={22} color={textMuted} />
                  <TextInput
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Поиск по имени (от 2 символов)"
                    placeholderTextColor={textMuted}
                    style={[styles.searchInput, { color: headerText }]}
                  />
                </View>
                {searching ? (
                  <ThemedText style={[styles.hint, { color: textMuted }]}>Поиск…</ThemedText>
                ) : null}
                {results.map((u) => {
                  const selected = selectedExecutor?.id === u.id;
                  return (
                    <Pressable
                      key={u.id}
                      style={[styles.shortcutRow, { borderBottomColor: border }]}
                      onPress={() => pick({ id: u.id, full_name: u.full_name })}
                    >
                      <MaterialIcons name="person" size={22} color={primary} />
                      <ThemedText style={[styles.shortcutLabel, { color: headerText }]} numberOfLines={2}>
                        {u.full_name}
                      </ThemedText>
                      {selected ? <MaterialIcons name="check" size={22} color={primary} /> : null}
                    </Pressable>
                  );
                })}
                {search.trim().length >= 2 && !searching && results.length === 0 ? (
                  <ThemedText style={[styles.hint, { color: textMuted }]}>Никого не найдено</ThemedText>
                ) : null}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  subOverlayRoot: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
  },
  subBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  subScheduleWrap: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  subScheduleSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '88%',
    overflow: 'hidden',
  },
  sheetHandleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 36,
  },
  dragGrabber: {
    width: 42,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.95,
  },
  subSheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  subSheetHeaderBtn: { padding: 4 },
  subSheetHeaderTitle: { fontSize: 17, fontWeight: '700' },
  pickerScroll: { maxHeight: 420, paddingHorizontal: 16 },
  pickerScrollContent: { paddingBottom: 20 },
  centerBlock: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shortcutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  shortcutLabel: { flex: 1, fontSize: 16 },
  teamIconSm: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyHint: {
    fontSize: 14,
    lineHeight: 20,
    paddingVertical: 12,
    paddingHorizontal: 4,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    marginBottom: 8,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  hint: { fontSize: 14, paddingVertical: 8 },
});
