import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';

export default function IndexScreen() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Даем время для rehydration из AsyncStorage
    // Zustand persist загружает данные асинхронно, поэтому нужна небольшая задержка
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 200);

    return () => clearTimeout(timer);
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#F35713" />
      </View>
    );
  }

  if (token && role) {
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

