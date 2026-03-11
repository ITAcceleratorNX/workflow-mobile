import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { Linking } from 'react-native';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { ToastProvider } from '@/context/toast-context';
import { useDeepLinkStore } from '@/stores/deep-link-store';
import { parseRequestDeepLinkUrl } from '@/lib/shareRequest';

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const router = useRouter();
  const setPendingRequestId = useDeepLinkStore((s) => s.setPendingRequestId);

  usePushNotifications();

  useEffect(() => {
    const handleUrl = (url: string) => {
      const parsed = parseRequestDeepLinkUrl(url);
      if (!parsed) return;
      router.replace(`/(tabs)/requests/${parsed.requestId}`);
    };

    Linking.getInitialURL().then((url) => {
      if (url) {
        const parsed = parseRequestDeepLinkUrl(url);
        if (parsed) setPendingRequestId(parsed.requestId);
      }
    });

    const sub = Linking.addEventListener('url', ({ url }) => handleUrl(url));
    return () => sub.remove();
  }, [router, setPendingRequestId]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <ToastProvider>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login/index" />
          <Stack.Screen name="register/index" />
          <Stack.Screen name="reset-password/index" />
          <Stack.Screen name="privacy/index" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="steps" />
        </Stack>
        <StatusBar style="auto" />
      </ToastProvider>
    </ThemeProvider>
  );
}
