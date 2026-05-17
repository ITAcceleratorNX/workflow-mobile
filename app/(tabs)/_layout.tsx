import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav, BOTTOM_NAV_ROW_HEIGHT, bottomNavBottomInset } from '@/components/bottom-nav';

/** Совпадает с последним стопом градиента на `(tabs)/booking` — закрашивает запас под absolute BottomNav. */
const BOOKING_TAB_SCENE_UNDERLAY = '#281504';
import { useBookingTabUiStore } from '@/stores/booking-tab-ui-store';
import { usePedometer } from '@/hooks/use-pedometer';
import { useSleepNotifications } from '@/hooks/use-sleep-notifications';
import { useStepsSync } from '@/hooks/use-steps-sync';
import { useDeepLinkStore } from '@/stores/deep-link-store';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const hideBookingFormNav = useBookingTabUiStore((s) => s.hideBottomNavForBookingForm);
  const router = useRouter();
  const pendingRequestId = useDeepLinkStore((s) => s.pendingRequestId);
  const setPendingRequestId = useDeepLinkStore((s) => s.setPendingRequestId);
  const contentPaddingBottom = BOTTOM_NAV_ROW_HEIGHT + bottomNavBottomInset(insets.bottom);

  useEffect(() => {
    if (pendingRequestId != null) {
      setPendingRequestId(null);
      router.replace(`/(tabs)/requests/${pendingRequestId}`);
    }
  }, [pendingRequestId, setPendingRequestId, router]);

  // Сбор данных шагомера (источник: iOS — Motion & Fitness / Core Motion, Android — счётчик шагов)
  usePedometer();
  // Синк шагов на сервер для пуш-уведомлений в фоне
  useStepsSync();
  // Планирование уведомлений сна (Пора ложиться / Оцени сон)
  useSleepNotifications();

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <BottomNav {...props} />}
      screenOptions={({ route }) => {
        const nestedRoute = getFocusedRouteNameFromRoute(route) ?? route.name;
        const isCreateRequest = route.name === 'requests' && nestedRoute === 'create';
        const isRequestDetail = route.name === 'requests' && nestedRoute === '[id]';
        const paddingBottom =
          route.name === 'help'
            ? 0
            : isCreateRequest || isRequestDetail
              ? 0
              : route.name === 'booking' && hideBookingFormNav
                ? 0
                : contentPaddingBottom;
        return {
          headerShown: false,
          tabBarShowLabel: false,
          tabBarTransparent: true,
          tabBarStyle: { position: 'absolute' },
          /** Запас под кастомный absolute BottomNav; 0 там, где навбар скрыт (help, create, карточка заявки). */
          sceneStyle: {
            paddingBottom,
            ...(route.name === 'booking' && paddingBottom > 0
              ? { backgroundColor: BOOKING_TAB_SCENE_UNDERLAY }
              : {}),
          },
        };
      }}>
      <Tabs.Screen name="index" options={{ title: 'Главная' }} />
      <Tabs.Screen name="booking" options={{ title: 'Бронь' }} />
      <Tabs.Screen name="requests" options={{ title: 'Заявки' }} />
      <Tabs.Screen name="help" options={{ title: 'Сообщение' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
