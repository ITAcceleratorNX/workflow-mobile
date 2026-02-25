import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

export type ProfileTab = 'profile' | 'password' | 'notifications' | 'logs';

const BASE_TABS: { key: ProfileTab; label: string }[] = [
  { key: 'profile', label: 'Профиль' },
  { key: 'password', label: 'Пароль' },
  { key: 'notifications', label: 'Уведомления' },
];

const LOGS_TAB: { key: ProfileTab; label: string } = { key: 'logs', label: 'Логи' };

const ROLES_WITH_LOGS = ['admin-worker', 'department-head', 'manager'];

export interface ProfileTabsProps {
  activeTab: ProfileTab;
  onTabChange: (tab: ProfileTab) => void;
  role?: string | null;
}

export function ProfileTabs({ activeTab, onTabChange, role }: ProfileTabsProps) {
  const { width } = useWindowDimensions();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');

  const showLogs = role && ROLES_WITH_LOGS.includes(role);
  const tabs = showLogs ? [...BASE_TABS, LOGS_TAB] : BASE_TABS;

  const tabCount = tabs.length;
  const minTabWidth = 72;
  const totalMinWidth = tabCount * minTabWidth + (tabCount - 1) * 8 + 32;
  const useScroll = width < totalMinWidth;

  const tabContent = tabs.map((tab) => {
    const isActive = activeTab === tab.key;
    return (
      <Pressable
        key={tab.key}
        onPress={() => onTabChange(tab.key)}
        style={[
          styles.tab,
          { minWidth: minTabWidth },
          !useScroll && styles.tabFlex,
          isActive && { backgroundColor: border },
        ]}
      >
        <ThemedText
          style={[styles.tabLabel, { color: isActive ? text : textMuted }]}
          numberOfLines={1}
        >
          {tab.label}
        </ThemedText>
      </Pressable>
    );
  });

  return (
    <View style={[styles.wrapper, { borderColor: border }]}>
      {useScroll ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {tabContent}
        </ScrollView>
      ) : (
        <View style={styles.tabsRow}>{tabContent}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 4,
    overflow: 'hidden',
  },
  scrollContent: {
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 4,
  },
  tabsRow: {
    flexDirection: 'row',
    gap: 4,
  },
  tab: {
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabFlex: {
    flex: 1,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
});
