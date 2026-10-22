import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import * as Haptics from 'expo-haptics';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useRequestActionCount } from '@/hooks/use-request-action-count';
import { formatRequestActionBadge } from '@/lib/request-action-count';
import { useBookingTabUiStore } from '@/stores/booking-tab-ui-store';

/** Отступ сверху + высота блока иконка+подпись (без safe area). Для `(tabs)/_layout`. */
export const BOTTOM_NAV_TOP_PAD = 10;
/** Пилюля 30 + зазор 4 + подпись 13 (+1 запас на округление шрифта). */
export const BOTTOM_NAV_ROW_HEIGHT = BOTTOM_NAV_TOP_PAD + 48;
/** Чуть уменьшаем системный inset снизу — меньше «воздуха» над жестовой зоной. */
export const BOTTOM_NAV_INSET_TRIM_PX = 8;

export function bottomNavBottomInset(insetBottom: number) {
  return Math.max(insetBottom - BOTTOM_NAV_INSET_TRIM_PX, 0);
}
// Тёмный таб-бар (макет «Таб-бар · тёмный, вариант 3»): активная вкладка — оранжевая пилюля.
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = 'rgba(255, 255, 255, 0.55)';
const BAR_BACKGROUND = '#1C1C1E';
const ACTIVE_PILL = '#F45714';

const NAV_ITEMS: { key: string; routeName: string; label: string; icon: 'home' | 'grid-on' | 'checklist' | 'message' | 'person' }[] = [
  { key: 'home', routeName: 'index', label: 'Главная', icon: 'home' },
  { key: 'booking', routeName: 'booking', label: 'Бронь', icon: 'grid-on' },
  { key: 'requests', routeName: 'requests', label: 'Заявки', icon: 'checklist' },
  { key: 'help', routeName: 'help', label: 'Сообщение', icon: 'message' },
  { key: 'profile', routeName: 'profile', label: 'Профиль', icon: 'person' },
];

/**
 * Структурный тип вместо BottomTabBarProps: expo-router с SDK 57 поставляет
 * собственную копию типов bottom-tabs, несовместимую с @react-navigation.
 * Панели нужны только маршрут и navigate, поэтому не привязываемся ни к одной.
 */
export type BottomNavProps = {
  state: {
    index: number;
    routes: { name: string; state?: unknown }[];
  };
  navigation: { navigate: (name: string) => void };
};

export function BottomNav({ state, navigation }: BottomNavProps) {
  const insets = useSafeAreaInsets();
  const hideBookingForm = useBookingTabUiStore((s) => s.hideBottomNavForBookingForm);
  const requestActionCount = useRequestActionCount();

  const currentRouteName = state.routes[state.index]?.name ?? 'index';
  const currentTabRoute = state.routes[state.index];
  const nestedState = currentTabRoute?.state as { routes: { name: string }[]; index: number } | undefined;
  const nestedRouteName = nestedState?.routes?.[nestedState.index]?.name ?? null;
  /** Вся вкладка «Сообщение» (чат-бот, техподдержка, чат с поддержкой) — без нижней панели, как drill-down. */
  const isHelpTabScreen = currentTabRoute?.name === 'help';
  const isCreateRequestScreen = currentTabRoute?.name === 'requests' && nestedRouteName === 'create';
  /** Имя экрана в nested stack из `requests/_layout.tsx`: `<Stack.Screen name="[id]" />` */
  const isRequestDetailScreen = currentTabRoute?.name === 'requests' && nestedRouteName === '[id]';
  const isBookingFormStep = currentTabRoute?.name === 'booking' && hideBookingForm;

  const handlePress = (routeName: string) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    navigation.navigate(routeName);
  };

  if (
    isHelpTabScreen ||
    isCreateRequestScreen ||
    isRequestDetailScreen ||
    isBookingFormStep
  ) {
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
        const badge = item.key === 'requests' ? formatRequestActionBadge(requestActionCount) : null;
        return (
          <Pressable
            key={item.key}
            onPress={() => handlePress(item.routeName)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
            accessibilityLabel={badge ? `${item.label}, требуют действия: ${requestActionCount}` : item.label}
          >
            <View style={[styles.pill, isActive && styles.pillActive]}>
              <MaterialIcons name={item.icon} size={22} color={color} />
              {badge && (
                <View style={styles.badge} pointerEvents="none">
                  <Text style={styles.badgeText}>{badge}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.label, isActive && styles.labelActive, { color }]}>{item.label}</Text>
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
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.08)',
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
    gap: 4,
  },
  pill: {
    width: 56,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: {
    backgroundColor: ACTIVE_PILL,
  },
  label: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '500',
  },
  labelActive: {
    fontWeight: '600',
  },
  // Бейдж поверх иконки: размеры иконки и панели не меняются.
  badge: {
    position: 'absolute',
    top: -4,
    right: 6,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: BAR_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: ACTIVE_PILL,
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
  },
});
