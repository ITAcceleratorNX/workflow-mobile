import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { normalizeUserSearchItem, searchUsersForAssign, type UserSearchItem } from '@/lib/api';
import { bumpTeamsCache, createTeam, deleteTeam, getTeam, updateTeam } from '@/lib/teams-api';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/context/toast-context';

type Person = { id: number; full_name: string };

type TeamFormScreenProps = {
  /** Если задан — режим редактирования */
  teamId?: number;
};

export function TeamFormScreen({ teamId }: TeamFormScreenProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show } = useToast();
  const isGuest = useAuthStore((s) => s.isGuest);
  const currentUserId = useAuthStore((s) => s.user?.id ?? null);

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const isEdit = teamId != null && Number.isFinite(teamId);

  const [loadingTeam, setLoadingTeam] = useState(!!isEdit);
  const [name, setName] = useState('');
  const [leader, setLeader] = useState<Person | null>(null);
  const [members, setMembers] = useState<Person[]>([]);

  const [leaderSearch, setLeaderSearch] = useState('');
  const [leaderResults, setLeaderResults] = useState<UserSearchItem[]>([]);
  const [leaderSearching, setLeaderSearching] = useState(false);

  const [memberSearch, setMemberSearch] = useState('');
  const [memberResults, setMemberResults] = useState<UserSearchItem[]>([]);
  const [memberSearching, setMemberSearching] = useState(false);

  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  /** С бэкенда: удалять могут только создатель и руководитель */
  const [teamMeta, setTeamMeta] = useState<{ created_by: number; leader_id: number } | null>(null);

  useEffect(() => {
    if (!isEdit || !teamId) return;
    let cancelled = false;
    (async () => {
      setLoadingTeam(true);
      const res = await getTeam(teamId);
      setLoadingTeam(false);
      if (cancelled) return;
      if (!res.ok) {
        show({ title: 'Не удалось загрузить команду', description: res.error, variant: 'destructive' });
        router.back();
        return;
      }
      const t = res.data;
      setName(t.name);
      setTeamMeta({ created_by: t.created_by, leader_id: t.leader_id });
      const l = t.leader;
      if (l) setLeader({ id: l.id, full_name: l.full_name });
      const mem = t.members ?? [];
      const rest = mem.filter((m) => m.id !== t.leader_id);
      setMembers(rest.map((m) => ({ id: m.id, full_name: m.full_name })));
    })();
    return () => {
      cancelled = true;
    };
  }, [isEdit, teamId, router, show]);

  useEffect(() => {
    const q = leaderSearch.trim();
    if (q.length < 2) {
      setLeaderResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setLeaderSearching(true);
      const res = await searchUsersForAssign(q);
      setLeaderSearching(false);
      if (res.ok) setLeaderResults(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [leaderSearch]);

  useEffect(() => {
    const q = memberSearch.trim();
    if (q.length < 2) {
      setMemberResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setMemberSearching(true);
      const res = await searchUsersForAssign(q);
      setMemberSearching(false);
      if (res.ok) setMemberResults(res.data);
    }, 300);
    return () => clearTimeout(t);
  }, [memberSearch]);

  const memberIdsForSubmit = useMemo(() => {
    const ids = new Set<number>();
    if (leader) ids.add(leader.id);
    members.forEach((m) => ids.add(m.id));
    return Array.from(ids);
  }, [leader, members]);

  const canDeleteTeam = useMemo(() => {
    if (currentUserId == null || teamMeta == null) return false;
    return teamMeta.created_by === currentUserId || teamMeta.leader_id === currentUserId;
  }, [currentUserId, teamMeta]);

  const pickLeader = useCallback((u: UserSearchItem) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const n = normalizeUserSearchItem(u);
    setLeader({ id: n.id, full_name: n.full_name });
    setMembers((prev) => prev.filter((p) => p.id !== n.id));
    setLeaderSearch('');
    setLeaderResults([]);
  }, []);

  const addMember = useCallback(
    (u: UserSearchItem) => {
      const n = normalizeUserSearchItem(u);
      if (leader && n.id === leader.id) return;
      if (members.some((m) => m.id === n.id)) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setMembers((prev) => [...prev, { id: n.id, full_name: n.full_name }]);
      setMemberSearch('');
      setMemberResults([]);
    },
    [leader, members]
  );

  const removeMember = useCallback((id: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  }, []);

  const clearLeader = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setLeader(null);
  }, []);

  const handleSave = useCallback(async () => {
    if (isGuest) {
      show({ title: 'Недоступно', description: 'Войдите в аккаунт', variant: 'destructive' });
      return;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      show({ title: 'Название', description: 'Введите название команды', variant: 'destructive' });
      return;
    }
    if (!leader) {
      show({ title: 'Руководитель', description: 'Выберите руководителя команды', variant: 'destructive' });
      return;
    }
    if (saving) return;
    setSaving(true);
    if (isEdit && teamId) {
      const res = await updateTeam(teamId, {
        name: trimmed,
        leader_id: leader.id,
        member_ids: memberIdsForSubmit,
      });
      setSaving(false);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        bumpTeamsCache();
        show({ title: 'Сохранено', variant: 'default', duration: 2000 });
        router.back();
      } else {
        show({ title: 'Ошибка', description: res.error, variant: 'destructive' });
      }
    } else {
      const res = await createTeam({
        name: trimmed,
        leader_id: leader.id,
        member_ids: memberIdsForSubmit,
      });
      setSaving(false);
      if (res.ok) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        bumpTeamsCache();
        router.back();
      } else {
        show({ title: 'Не удалось создать', description: res.error, variant: 'destructive' });
      }
    }
  }, [
    isGuest,
    name,
    leader,
    saving,
    isEdit,
    teamId,
    memberIdsForSubmit,
    show,
    router,
  ]);

  const handleDelete = useCallback(async () => {
    if (!teamId || !isEdit) return;
    if (isGuest) return;
    if (!canDeleteTeam) return;
    setDeleting(true);
    const res = await deleteTeam(teamId);
    setDeleting(false);
    if (res.ok) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      bumpTeamsCache();
      router.back();
    } else {
      show({ title: 'Не удалось удалить', description: res.error, variant: 'destructive' });
    }
  }, [teamId, isEdit, isGuest, canDeleteTeam, router, show]);

  if (isGuest) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
        <ScreenHeader title={isEdit ? 'Команда' : 'Новая команда'} />
        <View style={styles.center}>
          <ThemedText style={{ color: textMuted }}>Войдите в аккаунт, чтобы управлять командами</ThemedText>
        </View>
      </ThemedView>
    );
  }

  if (loadingTeam) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
        <ScreenHeader title={isEdit ? 'Команда' : 'Новая команда'} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color={primary} />
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title={isEdit ? 'Редактировать команду' : 'Новая команда'} />

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Название</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Например, Отдел продаж"
              placeholderTextColor={textMuted}
              style={[styles.input, { color: text }]}
              maxLength={255}
            />
          </View>

          <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Руководитель</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TextInput
              value={leaderSearch}
              onChangeText={setLeaderSearch}
              placeholder="Поиск по имени (от 2 символов)"
              placeholderTextColor={textMuted}
              style={[styles.input, { color: text }]}
            />
            {leaderSearching ? (
              <ThemedText style={[styles.hint, { color: textMuted }]}>Поиск…</ThemedText>
            ) : null}
            {leaderResults.length > 0 ? (
              <View style={[styles.results, { borderColor: border }]}>
                {leaderResults.map((u) => (
                  <Pressable
                    key={u.id}
                    onPress={() => pickLeader(u)}
                    style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.75 }]}
                  >
                    <ThemedText style={{ color: text }} numberOfLines={1}>
                      {u.full_name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            ) : null}
            {leader ? (
              <View style={styles.chipsRow}>
                <View style={[styles.chip, { borderColor: primary, backgroundColor: `${primary}18` }]}>
                  <MaterialIcons name="star" size={16} color={primary} />
                  <ThemedText
                    style={[styles.chipText, { color: text }]}
                    numberOfLines={1}
                    ellipsizeMode="tail"
                  >
                    {leader.full_name?.trim() || `#${leader.id}`}
                  </ThemedText>
                  <Pressable onPress={clearLeader} hitSlop={8}>
                    <MaterialIcons name="close" size={18} color={primary} />
                  </Pressable>
                </View>
              </View>
            ) : (
              <ThemedText style={[styles.hint, { color: textMuted }]}>
                Выберите руководителя из результатов поиска
              </ThemedText>
            )}
          </View>

          <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Участники</ThemedText>
          <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
            <TextInput
              value={memberSearch}
              onChangeText={setMemberSearch}
              placeholder="Добавить участника (поиск от 2 символов)"
              placeholderTextColor={textMuted}
              style={[styles.input, { color: text }]}
            />
            {memberSearching ? (
              <ThemedText style={[styles.hint, { color: textMuted }]}>Поиск…</ThemedText>
            ) : null}
            {memberResults.length > 0 ? (
              <View style={[styles.results, { borderColor: border }]}>
                {memberResults
                  .filter((u) => (!leader || u.id !== leader.id) && !members.some((m) => m.id === u.id))
                  .map((u) => (
                    <Pressable
                      key={u.id}
                      onPress={() => addMember(u)}
                      style={({ pressed }) => [styles.resultRow, pressed && { opacity: 0.75 }]}
                    >
                      <ThemedText style={{ color: text }} numberOfLines={1}>
                        {u.full_name}
                      </ThemedText>
                    </Pressable>
                  ))}
              </View>
            ) : null}
            {members.length > 0 ? (
              <View style={styles.chipsWrap}>
                {members.map((m) => (
                  <View
                    key={m.id}
                    style={[styles.chip, { borderColor: border, backgroundColor: `${primary}10` }]}
                  >
                    <ThemedText
                      style={[styles.chipText, { color: text }]}
                      numberOfLines={1}
                      ellipsizeMode="tail"
                    >
                      {m.full_name?.trim() || `#${m.id}`}
                    </ThemedText>
                    <Pressable onPress={() => removeMember(m.id)} hitSlop={8}>
                      <MaterialIcons name="close" size={18} color={textMuted} />
                    </Pressable>
                  </View>
                ))}
              </View>
            ) : (
              <ThemedText style={[styles.hint, { color: textMuted }]}>
                Необязательно: добавьте остальных участников команды
              </ThemedText>
            )}
          </View>

          {isEdit && canDeleteTeam ? (
            <Pressable
              onPress={handleDelete}
              disabled={deleting}
              style={({ pressed }) => [
                styles.deleteBtn,
                { borderColor: '#EF4444', opacity: deleting ? 0.6 : pressed ? 0.85 : 1 },
              ]}
            >
              {deleting ? (
                <ActivityIndicator color="#EF4444" />
              ) : (
                <>
                  <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
                  <ThemedText style={styles.deleteText}>Удалить команду</ThemedText>
                </>
              )}
            </Pressable>
          ) : null}
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: border, paddingBottom: Math.max(insets.bottom, 12) }]}>
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              styles.saveBtn,
              { backgroundColor: primary, opacity: saving ? 0.7 : pressed ? 0.92 : 1 },
            ]}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.saveBtnText}>{isEdit ? 'Сохранить' : 'Создать команду'}</ThemedText>
            )}
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 8 },
  sectionLabel: {
    fontSize: 13,
    fontWeight: '700',
    marginTop: 18,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  card: {
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  input: {
    fontSize: 16,
    paddingVertical: 4,
    minHeight: 40,
  },
  hint: { fontSize: 13 },
  results: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  resultRow: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(128,128,128,0.25)',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chipsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: '100%',
    /** иначе при flex:1 у текста строка схлопывается по ширине до ~0 — имена не видны */
    alignSelf: 'flex-start',
  },
  chipText: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
    minWidth: 0,
  },
  deleteBtn: {
    marginTop: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  deleteText: { color: '#EF4444', fontSize: 16, fontWeight: '600' },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  saveBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderRadius: 14,
  },
  saveBtnText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
