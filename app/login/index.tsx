import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button, TextInput } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatPhone, PHONE_REGEX } from '@/lib';
import { getCurrentUser, loginWithPhone } from '@/lib/auth';
import { useAuthStore } from '@/stores/auth-store';

export default function LoginScreen() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const setGuestAuth = useAuthStore((state) => state.setGuestAuth);
  const errorColor = useThemeColor({}, 'error');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [phoneError, setPhoneError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [formError, setFormError] = useState('');
  const [loading, setLoading] = useState(false);

  const validate = useCallback(() => {
    let valid = true;
    setPhoneError('');
    setPasswordError('');
    setFormError('');

    if (!PHONE_REGEX.test(phone)) {
      setPhoneError('Введите корректный номер телефона в формате +7 XXX XXX XX XX');
      valid = false;
    }

    if (!password || password.length < 6) {
      setPasswordError('Пароль должен содержать минимум 6 символов');
      valid = false;
    }

    return valid;
  }, [phone, password]);

  const handleLogin = useCallback(async () => {
    if (!validate()) return;

    setLoading(true);
    setFormError('');

    try {
      const authData = await loginWithPhone(phone, password);
      const user = await getCurrentUser(authData.token);
      const role = authData.role ?? 'client';

      setAuth(authData.token, role, user);
      router.replace('/(tabs)/profile');
    } catch (error) {
      setFormError(
        error instanceof Error ? error.message : 'Произошла ошибка при входе. Попробуйте позже.'
      );
    } finally {
      setLoading(false);
    }
  }, [phone, password, validate, setAuth, router]);

  const handlePhoneChange = useCallback((text: string) => {
    setPhone(formatPhone(text));
    setPhoneError('');
  }, []);

  const handlePasswordChange = useCallback((text: string) => {
    setPassword(text);
    setPasswordError('');
  }, []);

  const handleDemoLogin = useCallback(() => {
    setGuestAuth();
    router.replace('/(tabs)');
  }, [router, setGuestAuth]);

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              Вход
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              Войдите в свою учетную запись
            </ThemedText>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <TextInput
                label="Номер телефона"
                placeholder="+7 XXX XXX XX XX"
                value={phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={19}
              />
              {phoneError ? (
                <ThemedText style={[styles.errorText, { color: errorColor }]}>{phoneError}</ThemedText>
              ) : null}
            </View>

            <View style={styles.field}>
              <View style={styles.passwordRow}>
                <ThemedText style={styles.label}>Пароль</ThemedText>
                <Pressable onPress={() => router.push('/reset-password')}>
                  <ThemedText style={[styles.linkText, { color: errorColor }]}>
                    Забыли пароль?
                  </ThemedText>
                </Pressable>
              </View>
              <TextInput
                placeholder="••••••••"
                value={password}
                onChangeText={handlePasswordChange}
                secureTextEntry
              />
              {passwordError ? (
                <ThemedText style={[styles.errorText, { color: errorColor }]}>
                  {passwordError}
                </ThemedText>
              ) : null}
            </View>

            {formError ? (
                <ThemedText style={[styles.formErrorText, { color: errorColor }]}>
                  {formError}
                </ThemedText>
            ) : null}

            <Button
              title={loading ? 'Вход...' : 'Войти'}
              onPress={handleLogin}
              disabled={loading}
            />

            <Button
              title="Открыть демо-режим"
              onPress={handleDemoLogin}
              variant="secondary"
            />

            <Button
              title="Запросить регистрацию"
              onPress={() => router.push('/register')}
              variant="secondary"
            />

            <Pressable style={styles.privacyLink} onPress={() => router.push('/privacy')}>
              <ThemedText style={[styles.privacyText, { color: textMuted }]}>
                Политика конфиденциальности
              </ThemedText>
            </Pressable>
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
  keyboard: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 40,
  },
  header: {
    marginBottom: 32,
    gap: 12,
  },
  title: {
    fontSize: 28,
    lineHeight: 40,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
  },
  form: {
    gap: 24,
  },
  field: {
    gap: 8,
  },
  passwordRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  linkText: {
    fontSize: 12,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 12,
  },
  privacyLink: {
    alignSelf: 'center',
    paddingVertical: 8,
  },
  privacyText: {
    fontSize: 16,
    textAlign: 'center',
  },
  formErrorContainer: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  formErrorText: {
    fontSize: 14,
    textAlign: 'center',
  },
});
