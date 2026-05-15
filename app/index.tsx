import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import type { Href } from 'expo-router';
import { Redirect, useRouter } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseRequestDeepLinkUrl } from '@/lib/shareRequest';
import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';

const LOGO_SOURCE = require('@/assets/logo/logo.png');
const LOGO_SIZE = 300;

export default function IndexScreen() {
  const token = useAuthStore((state) => state.token);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const pendingRequestId = useDeepLinkStore((s) => s.pendingRequestId);
  const setPendingRequestId = useDeepLinkStore((s) => s.setPendingRequestId);
  const pendingPostAuthHref = useDeepLinkStore((s) => s.pendingPostAuthHref);
  const setPendingPostAuthHref = useDeepLinkStore((s) => s.setPendingPostAuthHref);
  const [isReady, setIsReady] = useState(false);
  const [initialRequestId, setInitialRequestId] = useState<number | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const effectiveRole = role || user?.role;
  const hasToken = !!token;

  // Читаем начальный URL при холодном старте (как для брони): getInitialURL может прийти позже, чем редирект
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = parseRequestDeepLinkUrl(url);
        if (parsed) setInitialRequestId(parsed.requestId);
      }
    });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsReady(true);
      if (__DEV__) {
        console.log('[Index] Auth state after rehydration:', {
          hasToken: !!token,
          role: role,
          userRole: user?.role,
          userId: user?.id,
        });
      }
    }, 1200);

    return () => clearTimeout(timer);
  }, [token, role, user]);

  // Очищаем pending deep link после редиректа (не в рендере — иначе цикл обновлений)
  useEffect(() => {
    if (pendingRequestId != null && hasToken && effectiveRole) {
      setPendingRequestId(null);
    }
  }, [pendingRequestId, hasToken, effectiveRole, setPendingRequestId]);

  // Холодный старт по пушу: не открывать табы, пока не отработает отложенный маршрут (см. use-push-notifications).
  useEffect(() => {
    if (!isReady || !hasToken || !effectiveRole || !pendingPostAuthHref) return;

    const hrefStr = pendingPostAuthHref.trim();
    setPendingPostAuthHref(null);

    const splitIdx = hrefStr.indexOf('?');
    const path = splitIdx >= 0 ? hrefStr.slice(0, splitIdx) : hrefStr;
    const query = splitIdx >= 0 ? hrefStr.slice(splitIdx + 1) : '';

    if (path === '/client/tasks/details') {
      const taskId = new URLSearchParams(query).get('taskId');
      if (taskId) {
        router.replace({
          pathname: '/client/tasks/details',
          params: { taskId: decodeURIComponent(taskId) },
        });
        return;
      }
    }

    router.replace(hrefStr as Href);
  }, [effectiveRole, hasToken, isReady, pendingPostAuthHref, router, setPendingPostAuthHref]);

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

  if (__DEV__) {
    console.log('[Index] Redirect decision:', { hasToken, effectiveRole });
  }

  if (hasToken && effectiveRole) {
    if (pendingPostAuthHref) {
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

    const requestIdFromLink = initialRequestId ?? pendingRequestId;
    if (requestIdFromLink != null) {
      return <Redirect href={`/(tabs)/requests/${requestIdFromLink}`} />;
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

