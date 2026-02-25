import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';

export default function IndexScreen() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Даем время для rehydration из AsyncStorage
    // Zustand persist загружает данные асинхронно, поэтому нужна небольшая задержка
    const timer = setTimeout(() => {
      setIsReady(true);
      // Debug logging
      console.log('[Index] Auth state after rehydration:', {
        hasToken: !!token,
        role: role,
        userRole: user?.role,
        userId: user?.id,
      });
    }, 500); // Увеличили время для надежности

    return () => clearTimeout(timer);
  }, [token, role, user]);

  if (!isReady) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#F35713" />
      </View>
    );
  }

  // Проверяем и token, и role - но role может быть в user.role
  const effectiveRole = role || user?.role;
  const hasToken = !!token;

  console.log('[Index] Redirect decision:', { hasToken, effectiveRole });

  if (hasToken && effectiveRole) {
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#040404',
  },
});

