import { MaterialIcons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import type { useAssignUserSearchScope } from '@/hooks/use-assign-user-search-scope';
import { useThemeColor } from '@/hooks/use-theme-color';

type ScopeState = ReturnType<typeof useAssignUserSearchScope>;

type Props = {
  filters: ScopeState;
};

export function AssignUserSearchFilters({ filters }: Props) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');

  const {
    canToggleScope,
    scope,
    setScope,
    showCompanyPills,
    showOfficePills,
    showAdminCompanyPills,
    offices,
    companies,
    officeFilterId,
    companyFilterId,
    selectOfficeFilter,
    selectCompanyFilter,
  } = filters;

  const hasFilters =
    canToggleScope || showCompanyPills || showOfficePills || showAdminCompanyPills;

  if (!hasFilters) return null;

  return (
    <View style={styles.wrap}>
      {canToggleScope ? (
        <View style={styles.segmentRow}>
          <Pressable
            onPress={() => setScope('company')}
            style={[
              styles.segmentBtn,
              { borderColor: border },
              scope === 'company' && { backgroundColor: `${primary}22`, borderColor: primary },
            ]}
          >
            <ThemedText
              style={[
                styles.segmentLabel,
                { color: scope === 'company' ? primary : text },
              ]}
            >
              Моя компания
            </ThemedText>
          </Pressable>
          <Pressable
            onPress={() => setScope('office')}
            style={[
              styles.segmentBtn,
              { borderColor: border },
              scope === 'office' && { backgroundColor: `${primary}22`, borderColor: primary },
            ]}
          >
            <ThemedText
              style={[
                styles.segmentLabel,
                { color: scope === 'office' ? primary : text },
              ]}
            >
              Весь офис
            </ThemedText>
          </Pressable>
        </View>
      ) : null}

      {showOfficePills ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => selectOfficeFilter(null)}
            style={[
              styles.pill,
              { borderColor: border },
              officeFilterId === null && {
                backgroundColor: `${primary}22`,
                borderColor: primary,
              },
            ]}
          >
            <ThemedText
              style={{
                color: officeFilterId === null ? primary : text,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              Все офисы
            </ThemedText>
          </Pressable>
          {offices.map((o) => {
            const active = officeFilterId === o.id;
            return (
              <Pressable
                key={o.id}
                onPress={() => selectOfficeFilter(active ? null : o.id)}
                style={[
                  styles.pill,
                  { borderColor: border },
                  active && { backgroundColor: `${primary}22`, borderColor: primary },
                ]}
              >
                <ThemedText
                  style={{ color: active ? primary : text, fontSize: 13, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {o.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {showCompanyPills || showAdminCompanyPills ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pillsRow}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            onPress={() => selectCompanyFilter(null)}
            style={[
              styles.pill,
              { borderColor: border },
              companyFilterId === null && {
                backgroundColor: `${primary}22`,
                borderColor: primary,
              },
            ]}
          >
            <ThemedText
              style={{
                color: companyFilterId === null ? primary : text,
                fontSize: 13,
                fontWeight: '600',
              }}
            >
              Все компании
            </ThemedText>
          </Pressable>
          {companies.map((c) => {
            const active = companyFilterId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => selectCompanyFilter(active ? null : c.id)}
                style={[
                  styles.pill,
                  { borderColor: border },
                  active && { backgroundColor: `${primary}22`, borderColor: primary },
                ]}
              >
                <ThemedText
                  style={{ color: active ? primary : text, fontSize: 13, fontWeight: '600' }}
                  numberOfLines={1}
                >
                  {c.name}
                </ThemedText>
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}

      {showOfficePills && officeFilterId == null ? (
        <View style={styles.hintRow}>
          <MaterialIcons name="info-outline" size={16} color={textMuted} />
          <ThemedText style={[styles.hint, { color: textMuted }]}>
            Выберите офис, чтобы сузить поиск по компании
          </ThemedText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 8,
    marginBottom: 8,
  },
  segmentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  pillsRow: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    maxWidth: 220,
  },
  hintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 2,
  },
  hint: {
    fontSize: 12,
    flex: 1,
  },
});
