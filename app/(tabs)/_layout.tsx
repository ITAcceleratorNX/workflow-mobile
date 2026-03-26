import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { Tabs, useRouter } from 'expo-router';
import React, { useEffect } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/bottom-nav';
import { usePedometer } from '@/hooks/use-pedometer';
import { useSleepNotifications } from '@/hooks/use-sleep-notifications';
import { useStepsSync } from '@/hooks/use-steps-sync';
import { useDeepLinkStore } from '@/stores/deep-link-store';

const NAV_BAR_HEIGHT = 70;
const NAV_BAR_MARGIN = 12;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const pendingRequestId = useDeepLinkStore((s) => s.pendingRequestId);
  const setPendingRequestId = useDeepLinkStore((s) => s.setPendingRequestId);
  const contentPaddingBottom = NAV_BAR_HEIGHT + NAV_BAR_MARGIN + insets.bottom;

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
        const paddingBottom =
          route.name === 'help' ? 0 : isCreateRequest ? 0 : contentPaddingBottom;
        return {
          headerShown: false,
            tabBarShowLabel: false,
            tabBarTransparent: true,
            tabBarStyle: { position: 'absolute' },
            sceneStyle: { paddingBottom: 0 },
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
