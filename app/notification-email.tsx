import React, { useEffect, useRef, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextInput } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { getCurrentUser } from '@/lib/auth';
import {
  NOTIFICATION_EMAIL_MAX_LENGTH,
  parseNotificationEmail,
} from '@/lib/notification-email';
import { updateNotificationEmail } from '@/lib/profile-api';
import { useAuthStore, type AuthState } from '@/stores/auth-store';

/** admin-worker: адрес, на который приходят письма о новых сервисных заявках. */
export default function NotificationEmailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');
  const { show: showToast } = useToast();

  const token = useAuthStore((s: AuthState) => s.token);
  const isGuest = useAuthStore((s: AuthState) => s.isGuest);
  const updateUser = useAuthStore((s: AuthState) => s.updateUser);

  const [email, setEmail] = useState(
    () => useAuthStore.getState().user?.notification_email ?? ''
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  /** Поле уже правят: ответ с сервера не затирает ввод и не перезаписывает сохранённый адрес. */
  const editedRef = useRef(false);

  // Адрес мог поменяться в веб-админке — берём актуальный, пока на экране значение из store.
  useEffect(() => {
    if (!token || isGuest) return;
    let cancelled = false;
    getCurrentUser(token)
      .then((fresh) => {
        if (cancelled || editedRef.current) return;
        const value = fresh.notification_email ?? null;
        updateUser({ notification_email: value });
        setEmail(value ?? '');
      })
      .catch(() => {
        // Остаётся адрес из store; ошибка сети проявится при сохранении.
      });
    return () => {
      cancelled = true;
    };
  }, [token, isGuest, updateUser]);

  const handleChangeEmail = (value: string) => {
    editedRef.current = true;
    setEmail(value);
    setError('');
  };

  const handleSave = async () => {
    if (saving) return;
    const parsed = parseNotificationEmail(email);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    setError('');
    setSaving(true);
    const result = await updateNotificationEmail(parsed.value);
    setSaving(false);

    if (!result.ok) {
      // 401: authRequest уже очистил сессию и открыл вход.
      if (!result.unauthorized) setError(result.error);
      return;
    }

    const saved = result.data.notification_email ?? null;
    updateUser({ notification_email: saved });
    showToast({
      title: saved ? 'Email для уведомлений сохранён' : 'Email для уведомлений удалён',
      variant: 'success',
    });
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </Pressable>
        <ThemedText style={styles.headerTitle} numberOfLines={1}>
          Email для уведомлений
        </ThemedText>
        <View style={styles.headerRightSpacer} />
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: 32 + insets.bottom },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.card, { borderColor: border }]}>
            <TextInput
              label="Email"
              placeholder="name@company.kz"
              value={email}
              onChangeText={handleChangeEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              textContentType="emailAddress"
              clearButtonMode="while-editing"
              maxLength={NOTIFICATION_EMAIL_MAX_LENGTH}
              returnKeyType="done"
              onSubmitEditing={handleSave}
              editable={!saving}
              errorMessage={error || undefined}
              helperText="Сюда придут письма о новых сервисных заявках. Оставьте поле пустым, чтобы не получать письма."
            />

            <Button title="Сохранить" onPress={handleSave} loading={saving} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  headerRightSpacer: {
    width: 26,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
});
