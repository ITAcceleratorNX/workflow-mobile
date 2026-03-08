import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Tabs } from 'expo-router';
import React from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BottomNav } from '@/components/bottom-nav';
import { useAutoStartWorkingHours } from '@/hooks/use-auto-start-working-hours';
import { usePedometer } from '@/hooks/use-pedometer';
import { useStepsSync } from '@/hooks/use-steps-sync';

const NAV_BAR_HEIGHT = 70;
const NAV_BAR_MARGIN = 12;

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  const contentPaddingBottom = NAV_BAR_HEIGHT + NAV_BAR_MARGIN + insets.bottom;

  // Автовключение трекера в рабочие часы офиса (только для клиента с office_id)
  useAutoStartWorkingHours();
  // Сбор данных шагомера (источник: iOS — Motion & Fitness / Core Motion, Android — счётчик шагов)
  usePedometer();
  // Синк шагов на сервер для пуш-уведомлений в фоне
  useStepsSync();

  return (
    <Tabs
      tabBar={(props: BottomTabBarProps) => <BottomNav {...props} />}
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarShowLabel: false,
        sceneStyle: {
          paddingBottom: route.name === 'help' ? 0 : contentPaddingBottom,
        },
      })}>
      <Tabs.Screen name="index" options={{ title: 'Главная' }} />
      <Tabs.Screen name="booking" options={{ title: 'Бронь' }} />
      <Tabs.Screen name="requests" options={{ title: 'Заявки' }} />
      <Tabs.Screen name="help" options={{ title: 'Сообщение' }} />
      <Tabs.Screen name="profile" options={{ title: 'Профиль' }} />
    </Tabs>
  );
}
