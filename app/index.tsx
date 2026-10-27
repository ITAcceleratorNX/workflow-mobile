import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { parseRequestDeepLinkUrl } from '@/lib/shareRequest';
import { canOpenWidgetDestination, isWidgetAppHref } from '@/lib/widgets/model';
import { openAppHref, rememberWidgetUrl } from '@/lib/widgets/navigation';
import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';

const LOGO_SOURCE = require('@/assets/logo/logo.png');
const LOGO_SIZE = 300;

export default function IndexScreen() {
  const token = useAuthStore((state) => state.token);
  const isGuest = useAuthStore((state) => state.isGuest);
  const role = useAuthStore((state) => state.role);
  const user = useAuthStore((state) => state.user);
  const router = useRouter();
  const pendingRequestId = useDeepLinkStore((s) => s.pendingRequestId);
  const setPendingRequestId = useDeepLinkStore((s) => s.setPendingRequestId);
  const pendingPostAuthHref = useDeepLinkStore((s) => s.pendingPostAuthHref);
  const setPendingPostAuthHref = useDeepLinkStore((s) => s.setPendingPostAuthHref);
  const [isReady, setIsReady] = useState(false);
  const [initialUrlChecked, setInitialUrlChecked] = useState(false);
  const [initialRequestId, setInitialRequestId] = useState<number | null>(null);
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const effectiveRole = role || user?.role;
  const hasToken = !!token;

  // Читаем начальный URL при холодном старте (как для брони): getInitialURL может прийти позже, чем редирект
  useEffect(() => {
    let active = true;
    Linking.getInitialURL()
      .then((url) => {
        if (!active || !url) return;
        if (rememberWidgetUrl(url)) return;
        const parsed = parseRequestDeepLinkUrl(url);
        if (parsed) setInitialRequestId(parsed.requestId);
      })
      .finally(() => {
        if (active) setInitialUrlChecked(true);
      });
    return () => {
      active = false;
    };
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
  const widgetNeedsLogin =
    !!pendingPostAuthHref &&
    isWidgetAppHref(pendingPostAuthHref) &&
    !canOpenWidgetDestination({ token, isGuest });

  useEffect(() => {
    if (!isReady || !initialUrlChecked || !hasToken || !effectiveRole || !pendingPostAuthHref) return;
    if (widgetNeedsLogin) return;

    const hrefStr = pendingPostAuthHref.trim();
    setPendingPostAuthHref(null);
    openAppHref(router, hrefStr);
  }, [
    effectiveRole,
    hasToken,
    initialUrlChecked,
    isReady,
    pendingPostAuthHref,
    router,
    setPendingPostAuthHref,
    widgetNeedsLogin,
  ]);

  if (!isReady || !initialUrlChecked) {
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

  if (widgetNeedsLogin) {
    return <Redirect href="/login" />;
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

