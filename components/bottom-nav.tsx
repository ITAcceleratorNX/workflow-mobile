import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Отступ сверху + высота блока иконка+подпись (без safe area). Для `(tabs)/_layout`. */
export const BOTTOM_NAV_TOP_PAD = 10;
export const BOTTOM_NAV_ROW_HEIGHT = BOTTOM_NAV_TOP_PAD + 42;
/** Чуть уменьшаем системный inset снизу — меньше «воздуха» над жестовой зоной. */
export const BOTTOM_NAV_INSET_TRIM_PX = 8;

export function bottomNavBottomInset(insetBottom: number) {
  return Math.max(insetBottom - BOTTOM_NAV_INSET_TRIM_PX, 0);
}
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

  const currentRouteName = state.routes[state.index]?.name ?? 'index';
  const currentTabRoute = state.routes[state.index];
  const nestedState = currentTabRoute?.state as { routes: { name: string }[]; index: number } | undefined;
  const nestedRouteName = nestedState?.routes?.[nestedState.index]?.name ?? null;
  const isHelpChatScreen = currentTabRoute?.name === 'help' && nestedRouteName?.startsWith('chat/') === true;
  const isCreateRequestScreen = currentTabRoute?.name === 'requests' && nestedRouteName === 'create';

  const handlePress = (routeName: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate(routeName);
  };

  if (isHelpChatScreen || isCreateRequestScreen) {
    return null;
  }

  const bottomPad = bottomNavBottomInset(insets.bottom);

  return (
    <View
      style={[
        styles.shell,
        { paddingBottom: bottomPad, paddingTop: BOTTOM_NAV_TOP_PAD },
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
  );
}

const styles = StyleSheet.create({
  shell: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
    backgroundColor: BAR_BACKGROUND,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    paddingHorizontal: 8,
  },
  item: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 2,
  },
  label: {
    fontSize: 10,
    fontWeight: '500',
  },
});
