import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useThemeColor } from '@/hooks/use-theme-color';

const NAV_BAR_HEIGHT = 70;
const NAV_BAR_RADIUS = 25;
const NAV_BAR_MARGIN = 12;
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.55)';
const BAR_BACKGROUND = '#F35713';

const NAV_ITEMS: { key: string; routeName: string; label: string; icon: 'home' | 'grid-on' | 'build' | 'message' | 'person' }[] = [
  { key: 'home', routeName: 'index', label: 'Главная', icon: 'home' },
  { key: 'booking', routeName: 'booking', label: 'Бронь', icon: 'grid-on' },
  { key: 'requests', routeName: 'requests', label: 'Заявки', icon: 'build' },
  { key: 'help', routeName: 'help', label: 'Сообщение', icon: 'message' },
  { key: 'profile', routeName: 'profile', label: 'Профиль', icon: 'person' },
];

export function BottomNav({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const underlayBackground = useThemeColor({}, 'background');
  const bottomInset = insets.bottom;
  const barBottom = NAV_BAR_MARGIN + bottomInset;
  const underlayHeight = NAV_BAR_HEIGHT + NAV_BAR_MARGIN + bottomInset;

  const currentRouteName = state.routes[state.index]?.name ?? 'index';

  const handlePress = (routeName: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate(routeName);
  };

  return (
    <>
      <View
        style={[
          styles.underlay,
          {
            height: underlayHeight,
            backgroundColor: underlayBackground,
          },
        ]}
      />
      <View
        style={[
          styles.bar,
          {
            left: NAV_BAR_MARGIN,
            right: NAV_BAR_MARGIN,
            bottom: barBottom,
            height: NAV_BAR_HEIGHT,
          },
        ]}
      >
        {NAV_ITEMS.map((item) => {
          const isActive = currentRouteName === item.routeName;
          const color = isActive ? ACTIVE_COLOR : INACTIVE_COLOR;
          return (
            <Pressable
              key={item.key}
              onPress={() => handlePress(item.routeName)}
              style={styles.item}
            >
              <MaterialIcons name={item.icon} size={24} color={color} />
              <Text style={[styles.label, { color }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  underlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 40,
  },
  bar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 50,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    backgroundColor: BAR_BACKGROUND,
    borderRadius: NAV_BAR_RADIUS,
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
