import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';

const LOGO_SOURCE = require('@/assets/logo/logo.png');
const LOGO_SIZE = 300;

export default function IndexScreen() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const pendingRequestId = useDeepLinkStore((s) => s.pendingRequestId);
  const setPendingRequestId = useDeepLinkStore((s) => s.setPendingRequestId);
  const [isReady, setIsReady] = useState(false);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      console.log('[Index] Auth state after rehydration:', {
        hasToken: !!token,
        role: role,
        userRole: user?.role,
        userId: user?.id,
      });
    }, 1200);

    return () => clearTimeout(timer);
  }, [token, role, user]);

  if (!isReady) {
    return (
      <View style={[styles.loaderContainer, isDark ? styles.bgDark : styles.bgLight]}>
        <Image
          source={LOGO_SOURCE}
          style={[styles.logo, { width: LOGO_SIZE, height: LOGO_SIZE }]}
          contentFit="contain"
          tintColor={isDark ? '#FFFFFF' : '#1a1a1a'}
        />
      </View>
    );
  }

  // Проверяем и token, и role - но role может быть в user.role
  const effectiveRole = role || user?.role;
  const hasToken = !!token;

  console.log('[Index] Redirect decision:', { hasToken, effectiveRole });

  if (hasToken && effectiveRole) {
    if (pendingRequestId != null) {
      setPendingRequestId(null);
      return <Redirect href={`/(tabs)/requests/${pendingRequestId}`} />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  loaderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgDark: {
    backgroundColor: '#040404',
  },
  bgLight: {
    backgroundColor: '#f5f5f5',
  },
  logo: {
    width: LOGO_SIZE,
    height: LOGO_SIZE,
  },
});

