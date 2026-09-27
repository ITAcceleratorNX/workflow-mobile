import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TaskExecutorPickerOverlay } from '@/components/tasks/task-assignment-pickers';
import { ThemedText } from '@/components/themed-text';
import { useKeyboardHeight } from '@/hooks/use-keyboard-height';
import { useTaskRecipients } from '@/hooks/use-task-recipients';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  recipientSelectionLabel,
  type RecipientCompany,
  type RecipientDepartment,
  type RecipientEmployee,
  type RecipientSelection,
} from '@/lib/task-recipients-api';

const SEARCH_EMPLOYEES_LIMIT = 50;

type Props = {
  visible: boolean;
  onClose: () => void;
  currentUserId: number | null;
  value: RecipientSelection | null;
  onConfirm: (selection: RecipientSelection | null) => void;
};

type Entry = { company: RecipientCompany; mine: boolean };

function norm(s: string | null | undefined): string {
  return (s ?? '').toLocaleLowerCase('ru').replace(/ё/g, 'е').trim();
}

function companyRef(c: RecipientCompany) {
  return { id: c.id, name: c.name };
}

/**
 * Выбор получателя задачи: «Моя компания» и «Доступные компании» (только то, что открыто
 * группами взаимодействия). Один тип назначения: компания, отдел или сотрудники одной компании.
 * Содержимое монтируется при каждом открытии: черновик выбора и справочник — с нуля.
 */
export function TaskRecipientPickerOverlay(props: Props) {
  if (!props.visible) return null;
  return <RecipientPicker {...props} />;
}

function RecipientPicker({ onClose, currentUserId, value, onConfirm }: Props) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const keyboardHeight = useKeyboardHeight(true);
  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const { directory, loading, error, reload } = useTaskRecipients();
  const [draft, setDraft] = useState<RecipientSelection | null>(value);
  const [query, setQuery] = useState('');
  const [openCompanyId, setOpenCompanyId] = useState<number | null>(null);

  const entries = useMemo<Entry[]>(() => {
    if (!directory) return [];
    const list: Entry[] = [];
    if (directory.my_company) list.push({ company: directory.my_company, mine: true });
    for (const c of directory.available_companies) list.push({ company: c, mine: false });
    return list;
  }, [directory]);

  const openEntry = useMemo(
    () => entries.find((e) => e.company.id === openCompanyId) ?? null,
    [entries, openCompanyId]
  );

  const scrollMaxHeight = useMemo(() => {
    if (keyboardHeight <= 0) return Math.min(520, windowH * 0.62);
    return Math.max(160, Math.min(520, windowH - keyboardHeight - 200));
  }, [keyboardHeight, windowH]);

  const tap = () => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

  const selectCompany = useCallback((company: RecipientCompany) => {
    tap();
    setDraft((prev) =>
      prev?.type === 'company' && prev.company.id === company.id
        ? null
        : { type: 'company', company: companyRef(company) }
    );
  }, []);

  const selectDepartment = useCallback((company: RecipientCompany, department: RecipientDepartment) => {
    tap();
    setDraft((prev) =>
      prev?.type === 'department' && prev.department.id === department.id
        ? null
        : { type: 'department', company: companyRef(company), department }
    );
  }, []);

  const toggleUser = useCallback(
    (company: RecipientCompany, user: RecipientEmployee) => {
      if (draft?.type === 'users' && draft.company.id !== company.id) {
        Alert.alert(
          'Одна компания',
          `Можно выбрать сотрудников только одной компании. Уже выбраны сотрудники «${draft.company.name}».`
        );
        return;
      }
      tap();
      const person = { id: user.id, full_name: user.full_name };
      if (draft?.type !== 'users') {
        setDraft({
          type: 'users',
          company: companyRef(company),
          users: [person],
        });
        return;
      }
      const has = draft.users.some((u) => u.id === user.id);
      const users = has ? draft.users.filter((u) => u.id !== user.id) : [...draft.users, person];
      setDraft(users.length ? { ...draft, users } : null);
    },
    [draft]
  );

  const isCompanySelected = (id: number) => draft?.type === 'company' && draft.company.id === id;
  const isDepartmentSelected = (id: number) => draft?.type === 'department' && draft.department.id === id;
  const isUserSelected = (id: number) => draft?.type === 'users' && draft.users.some((u) => u.id === id);

  const confirm = useCallback(() => {
    tap();
    onConfirm(draft);
  }, [draft, onConfirm]);

  // Сотрудник без компании в оргструктуре: прежний поиск исполнителя.
  if (directory && !directory.my_company) {
    return (
      <TaskExecutorPickerOverlay
        visible
        onClose={onClose}
        teamScope={false}
        team={null}
        selectedExecutor={value?.type === 'legacy_user' ? value.user : null}
        onSelect={(user) => onConfirm(user ? { type: 'legacy_user', user } : null)}
      />
    );
  }

  const renderRadioRow = (
    key: string,
    label: string,
    subtitle: string | null,
    on: boolean,
    onPress: () => void,
    icon: keyof typeof MaterialIcons.glyphMap
  ) => (
    <Pressable
      key={key}
      style={[styles.row, { borderBottomColor: border }]}
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
    >
      <MaterialIcons name={icon} size={22} color={primary} />
      <View style={styles.rowTextCol}>
        <ThemedText style={[styles.rowLabel, { color: text }]} numberOfLines={2}>
          {label}
        </ThemedText>
        {subtitle ? (
          <ThemedText style={[styles.rowSub, { color: textMuted }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        ) : null}
      </View>
      <MaterialIcons
        name={on ? 'radio-button-checked' : 'radio-button-unchecked'}
        size={22}
        color={on ? primary : textMuted}
      />
    </Pressable>
  );

  const renderUserRow = (company: RecipientCompany, user: RecipientEmployee, subtitle: string | null) => {
    const on = isUserSelected(user.id);
    return (
      <Pressable
        key={`u-${company.id}-${user.id}`}
        style={[styles.row, { borderBottomColor: border }]}
        onPress={() => toggleUser(company, user)}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: on }}
      >
        <MaterialIcons name={on ? 'check-box' : 'check-box-outline-blank'} size={24} color={on ? primary : textMuted} />
        <View style={styles.rowTextCol}>
          <ThemedText style={[styles.rowLabel, { color: text }]} numberOfLines={2}>
            {user.full_name}
          </ThemedText>
          {subtitle ? (
            <ThemedText style={[styles.rowSub, { color: textMuted }]} numberOfLines={1}>
              {subtitle}
            </ThemedText>
          ) : null}
        </View>
      </Pressable>
    );
  };

  const renderCompanyLink = ({ company, mine }: Entry) => {
    const parts: string[] = [];
    if (company.whole) parts.push(mine ? 'Своя компания' : 'Вся компания');
    if (company.departments.length) parts.push(`отделов: ${company.departments.length}`);
    const people = company.employees.filter((e) => e.id !== currentUserId).length;
    if (people) parts.push(`сотрудников: ${people}`);
    const hasSelection = draft != null && draft.type !== 'legacy_user' && draft.company.id === company.id;
    return (
      <Pressable
        key={`c-${company.id}`}
        style={[styles.row, { borderBottomColor: border }]}
        onPress={() => {
          tap();
          setQuery('');
          setOpenCompanyId(company.id);
        }}
      >
        <View style={[styles.iconBox, { backgroundColor: `${primary}22` }]}>
          <MaterialIcons name="business" size={20} color={primary} />
        </View>
        <View style={styles.rowTextCol}>
          <ThemedText style={[styles.rowLabel, { color: text }]} numberOfLines={2}>
            {company.name}
          </ThemedText>
          <ThemedText style={[styles.rowSub, { color: textMuted }]} numberOfLines={1}>
            {parts.join(' · ')}
          </ThemedText>
        </View>
        {hasSelection ? <MaterialIcons name="check-circle" size={20} color={primary} /> : null}
        <MaterialIcons name="chevron-right" size={22} color={textMuted} />
      </Pressable>
    );
  };

  const sectionTitle = (label: string) => (
    <ThemedText key={`h-${label}`} style={[styles.sectionTitle, { color: textMuted }]}>
      {label}
    </ThemedText>
  );

  const renderCompany = ({ company, mine }: Entry) => {
    const deptName = new Map(company.departments.map((dp) => [dp.id, dp.name]));
    const people = company.employees.filter((e) => e.id !== currentUserId);
    const groups: { title: string; list: RecipientEmployee[] }[] = company.departments.map((dp) => ({
      title: dp.name,
      list: people.filter((e) => e.department_id === dp.id),
    }));
    const noDept = people.filter((e) => e.department_id == null);
    const other = people.filter((e) => e.department_id != null && !deptName.has(e.department_id));
    if (noDept.length) groups.push({ title: 'Без отдела', list: noDept });
    if (other.length) groups.push({ title: 'Другие сотрудники', list: other });
    const countIn = (id: number) => company.employees.filter((e) => e.department_id === id).length;

    const out: ReactNode[] = [
      <Pressable
        key="back"
        style={[styles.backRow, { borderBottomColor: border }]}
        onPress={() => setOpenCompanyId(null)}
      >
        <MaterialIcons name="arrow-back" size={20} color={primary} />
        <ThemedText style={[styles.backLabel, { color: primary }]}>
          {mine ? 'Моя компания' : 'Доступные компании'}
        </ThemedText>
      </Pressable>,
      <ThemedText key="title" style={[styles.companyTitle, { color: text }]} numberOfLines={2}>
        {company.name}
      </ThemedText>,
    ];
    if (company.whole) {
      out.push(
        renderRadioRow(
          `c-${company.id}`,
          'Вся компания',
          `Назначить всем сотрудникам (${company.employees.length})`,
          isCompanySelected(company.id),
          () => selectCompany(company),
          'business'
        )
      );
    }
    if (company.departments.length) {
      out.push(sectionTitle('Отделы'));
      for (const dp of company.departments) {
        out.push(
          renderRadioRow(
            `d-${dp.id}`,
            dp.name,
            `Весь отдел · сотрудников: ${countIn(dp.id)}`,
            isDepartmentSelected(dp.id),
            () => selectDepartment(company, dp),
            'apartment'
          )
        );
      }
    }
    const nonEmpty = groups.filter((g) => g.list.length);
    if (nonEmpty.length) {
      out.push(sectionTitle('Сотрудники'));
      for (const g of nonEmpty) {
        out.push(
          <ThemedText key={`g-${g.title}`} style={[styles.groupTitle, { color: textMuted }]}>
            {g.title}
          </ThemedText>
        );
        for (const e of g.list) out.push(renderUserRow(company, e, e.position));
      }
    }
    return out;
  };

  const renderSearch = () => {
    const q = norm(query);
    const out: ReactNode[] = [];
    const companyHits = entries.filter((e) => norm(e.company.name).includes(q));
    for (const e of companyHits) {
      out.push(
        e.company.whole
          ? renderRadioRow(
              `sc-${e.company.id}`,
              e.company.name,
              e.mine ? 'Моя компания · вся компания' : 'Вся компания',
              isCompanySelected(e.company.id),
              () => selectCompany(e.company),
              'business'
            )
          : renderCompanyLink(e)
      );
    }
    for (const e of entries) {
      for (const dp of e.company.departments) {
        if (!norm(dp.name).includes(q)) continue;
        out.push(
          renderRadioRow(
            `sd-${dp.id}`,
            dp.name,
            `Отдел · ${e.company.name}`,
            isDepartmentSelected(dp.id),
            () => selectDepartment(e.company, dp),
            'apartment'
          )
        );
      }
    }
    let shown = 0;
    for (const e of entries) {
      const deptName = new Map(e.company.departments.map((dp) => [dp.id, dp.name]));
      for (const u of e.company.employees) {
        if (u.id === currentUserId || shown >= SEARCH_EMPLOYEES_LIMIT) continue;
        if (!norm(u.full_name).includes(q)) continue;
        shown += 1;
        const dept = u.department_id == null ? 'Без отдела' : deptName.get(u.department_id);
        out.push(renderUserRow(e.company, u, [e.company.name, dept].filter(Boolean).join(' · ')));
      }
    }
    if (!out.length) {
      out.push(
        <ThemedText key="empty" style={[styles.hint, { color: textMuted }]}>
          Ничего не найдено среди доступных получателей
        </ThemedText>
      );
    }
    return out;
  };

  const renderRoot = () => {
    const mine = entries.find((e) => e.mine);
    const external = entries.filter((e) => !e.mine);
    return [
      sectionTitle('Моя компания'),
      mine ? renderCompanyLink(mine) : null,
      sectionTitle('Доступные компании'),
      ...(external.length
        ? external.map(renderCompanyLink)
        : [
            <ThemedText key="no-ext" style={[styles.hint, { color: textMuted }]}>
              Нет доступных компаний. Доступ к другим компаниям настраивает Администратор.
            </ThemedText>,
          ]),
    ];
  };

  let body: ReactNode;
  if (!directory && loading) {
    body = (
      <View style={styles.centerBlock}>
        <ActivityIndicator size="large" color={primary} />
      </View>
    );
  } else if (!directory && error) {
    body = (
      <View style={styles.centerBlock}>
        <ThemedText style={[styles.hint, { color: textMuted, textAlign: 'center' }]}>{error}</ThemedText>
        <Pressable onPress={reload} hitSlop={8}>
          <ThemedText style={{ color: primary, fontWeight: '600' }}>Повторить</ThemedText>
        </Pressable>
      </View>
    );
  } else if (query.trim()) {
    body = renderSearch();
  } else if (openEntry) {
    body = renderCompany(openEntry);
  } else {
    body = renderRoot();
  }

  return (
    <View style={styles.overlayRoot}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Закрыть" />
      <View style={styles.wrap}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: background,
              paddingBottom: Math.max(insets.bottom, 12) + keyboardHeight,
            },
          ]}
        >
          <View style={styles.handleHit}>
            <View style={[styles.grabber, { backgroundColor: primary }]} />
          </View>
          <View style={styles.header}>
            <Pressable onPress={onClose} hitSlop={12} style={styles.headerBtn} accessibilityLabel="Закрыть">
              <MaterialIcons name="close" size={24} color={text} />
            </Pressable>
            <ThemedText style={[styles.headerTitle, { color: text }]}>Исполнитель</ThemedText>
            <Pressable onPress={confirm} hitSlop={12} style={styles.headerBtn} accessibilityLabel="Готово">
              <MaterialIcons name="check" size={24} color={primary} />
            </Pressable>
          </View>

          <View style={styles.topBlock}>
            <View style={[styles.searchCard, { backgroundColor: cardBg, borderColor: border }]}>
              <MaterialIcons name="search" size={22} color={textMuted} />
              <TextInput
                value={query}
                onChangeText={setQuery}
                placeholder="Компания, отдел или сотрудник"
                placeholderTextColor={textMuted}
                style={[styles.searchInput, { color: text }]}
                autoCorrect={false}
              />
              {query ? (
                <Pressable onPress={() => setQuery('')} hitSlop={8} accessibilityLabel="Очистить поиск">
                  <MaterialIcons name="close" size={18} color={textMuted} />
                </Pressable>
              ) : null}
            </View>
            {draft ? (
              <View style={[styles.selectionBar, { borderColor: primary, backgroundColor: `${primary}14` }]}>
                <MaterialIcons
                  name={draft.type === 'company' ? 'business' : draft.type === 'department' ? 'apartment' : 'person'}
                  size={18}
                  color={primary}
                />
                <ThemedText style={[styles.selectionText, { color: text }]} numberOfLines={2}>
                  {draft.type === 'company'
                    ? `Вся компания «${draft.company.name}»`
                    : draft.type === 'department'
                      ? `Весь отдел «${draft.department.name}» · ${draft.company.name}`
                      : draft.type === 'users'
                        ? `Сотрудники (${draft.users.length}): ${recipientSelectionLabel(draft)}`
                        : recipientSelectionLabel(draft)}
                </ThemedText>
                <Pressable onPress={() => setDraft(null)} hitSlop={8} accessibilityLabel="Сбросить выбор">
                  <MaterialIcons name="close" size={18} color={primary} />
                </Pressable>
              </View>
            ) : null}
          </View>

          <ScrollView
            style={[styles.scroll, { maxHeight: scrollMaxHeight }]}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            showsVerticalScrollIndicator={false}
          >
            {body}
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlayRoot: { ...StyleSheet.absoluteFill, zIndex: 1000 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.38)' },
  wrap: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    maxHeight: '92%',
    overflow: 'hidden',
  },
  handleHit: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    minHeight: 36,
  },
  grabber: { width: 42, height: 5, borderRadius: 2.5, opacity: 0.95 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerBtn: { padding: 4 },
  headerTitle: { fontSize: 17, fontWeight: '700' },
  topBlock: { paddingHorizontal: 16, gap: 8, paddingBottom: 4 },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontSize: 16, paddingVertical: 4 },
  selectionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  selectionText: { flex: 1, fontSize: 14, fontWeight: '600' },
  scroll: { paddingHorizontal: 16 },
  scrollContent: { paddingBottom: 20 },
  centerBlock: {
    paddingVertical: 40,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    marginTop: 16,
    marginBottom: 4,
  },
  groupTitle: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 12,
    marginBottom: 2,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  rowTextCol: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 16 },
  rowSub: { fontSize: 13 },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  backLabel: { fontSize: 15, fontWeight: '600' },
  companyTitle: { fontSize: 18, fontWeight: '700', marginTop: 12 },
  hint: { fontSize: 14, lineHeight: 20, paddingVertical: 12 },
});
