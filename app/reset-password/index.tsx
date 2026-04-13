import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput as RNTextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { formatPhone, PHONE_REGEX } from '@/lib';
import { resetPassword, sendVerificationCode, verifyCode } from '@/lib/auth';

type Step = 1 | 2 | 3 | 4;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const errorColor = useThemeColor({}, 'error');
  const primary = useThemeColor({}, 'primary');

  const [step, setStep] = useState<Step>(1);
  const [phone, setPhone] = useState('');
  const phoneRef = useRef('');
  const [verificationCode, setVerificationCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [error, setError] = useState('');
  const [otpDigits, setOtpDigits] = useState<string[]>(['', '', '', '', '', '']);
  const otpRefs = useRef<(RNTextInput | null)[]>([]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const isPhoneValid = PHONE_REGEX.test(phone);

  const handleSendVerificationCode = async () => {
    const currentPhone = phoneRef.current || phone;
    if (!PHONE_REGEX.test(currentPhone)) {
      setError('Введите корректный номер телефона в формате +7 XXX XXX XX XX');
      return;
    }
    setIsSendingCode(true);
    setError('');
    const result = await sendVerificationCode(currentPhone, 'password_reset');
    setIsSendingCode(false);
    if (!result.success) {
      setError(result.message ?? 'Ошибка при отправке SMS. Попробуйте позже.');
      return;
    }
    setStep(2);
    setCountdown(60);
  };

  const handleOtpChange = (index: number, value: string) => {
    const digit = value.replace(/\D/g, '').slice(-1);
    const next = [...otpDigits];
    next[index] = digit;
    setOtpDigits(next);
    setVerificationCode(next.join(''));
    setError('');
    if (digit && index < otpRefs.current.length - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (index: number, key: string) => {
    if (key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleVerifyCode = async () => {
    if (verificationCode.length !== 6) {
      setError('Введите код из 6 цифр');
      return;
    }
    setError('');
    const result = await verifyCode(phone, verificationCode, 'password_reset');
    if (!result.success) {
      setError(result.message ?? 'Неверный код верификации');
      return;
    }
    setStep(3);
  };

  const handleResetPassword = async () => {
    setError('');
    if (!newPassword || newPassword.length < 6) {
      setError('Пароль должен содержать минимум 6 символов');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Пароли не совпадают');
      return;
    }
    setLoading(true);
    try {
      await resetPassword(phone, verificationCode, newPassword);
      setStep(4);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Ошибка при сбросе пароля. Попробуйте позже.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { color: text, borderColor: border };
  const placeholderColor = textMuted;

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <ThemedText style={styles.title}>
            {step === 1 && 'Восстановление пароля'}
            {step === 2 && 'Верификация номера'}
            {step === 3 && 'Новый пароль'}
            {step === 4 && 'Пароль изменен'}
          </ThemedText>
          <ThemedText style={[styles.subtitle, { color: textMuted }]}>
            {step === 1 && 'Введите номер телефона для восстановления пароля'}
            {step === 2 && 'Введите код из SMS'}
            {step === 3 && 'Придумайте новый пароль'}
            {step === 4 && 'Ваш пароль успешно изменен'}
          </ThemedText>

          {step === 1 && (
            <View style={[styles.block, { borderColor: border }]}>
              <ThemedText style={styles.label}>Номер телефона</ThemedText>
              <RNTextInput
                value={phone}
                onChangeText={(v) => {
                  const next = formatPhone(v);
                  phoneRef.current = next;
                  setPhone(next);
                  setError('');
                }}
                keyboardType="phone-pad"
                placeholder="+7 XXX XXX XX XX"
                placeholderTextColor={placeholderColor}
                maxLength={16}
                style={[styles.input, inputStyle]}
              />
              {error ? <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText> : null}
              <Pressable
                style={[styles.primaryButton, { backgroundColor: primary }, isSendingCode && styles.disabled]}
                onPress={handleSendVerificationCode}
                disabled={isSendingCode || !isPhoneValid}
              >
                <ThemedText style={styles.primaryButtonText}>
                  {isSendingCode ? 'Отправка...' : 'Отправить код'}
                </ThemedText>
              </Pressable>
              <Pressable style={[styles.secondaryButton, { borderColor: border }]} onPress={() => router.replace('/login')}>
                <ThemedText style={[styles.secondaryText, { color: textMuted }]}>Вернуться к входу</ThemedText>
              </Pressable>
            </View>
          )}

          {step === 2 && (
            <View style={[styles.block, { borderColor: border }]}>
              <ThemedText style={[styles.otpHint, { color: textMuted }]}>
                Мы отправили SMS с кодом верификации на номер {phone}
              </ThemedText>
              <ThemedText style={[styles.label, styles.center]}>Введите код из SMS</ThemedText>
              <View style={styles.otpRow}>
                {otpDigits.map((digit, index) => (
                  <RNTextInput
                    key={index}
                    ref={(ref) => { otpRefs.current[index] = ref; }}
                    value={digit}
                    onChangeText={(v) => handleOtpChange(index, v)}
                    onKeyPress={({ nativeEvent }) => handleOtpKeyPress(index, nativeEvent.key)}
                    keyboardType="number-pad"
                    maxLength={1}
                    style={[styles.otpInput, inputStyle]}
                  />
                ))}
              </View>
              {error ? <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText> : null}
              <Pressable style={[styles.primaryButton, { backgroundColor: primary }]} onPress={handleVerifyCode}>
                <ThemedText style={styles.primaryButtonText}>Подтвердить</ThemedText>
              </Pressable>
              <Pressable
                style={[styles.secondaryButton, { borderColor: border }]}
                disabled={isSendingCode || countdown > 0}
                onPress={handleSendVerificationCode}
              >
                <ThemedText style={[styles.secondaryText, { color: textMuted }]}>
                  {isSendingCode ? 'Отправка...' : countdown > 0 ? `Отправить повторно (${countdown}с)` : 'Отправить код повторно'}
                </ThemedText>
              </Pressable>
              <Pressable
                style={styles.ghostButton}
                onPress={() => {
                  setStep(1);
                  setError('');
                  setOtpDigits(['', '', '', '', '', '']);
                  setVerificationCode('');
                }}
              >
                <ThemedText style={[styles.ghostText, { color: textMuted }]}>Назад</ThemedText>
              </Pressable>
            </View>
          )}

          {step === 3 && (
            <View style={[styles.block, { borderColor: border }]}>
              <ThemedText style={styles.label}>Новый пароль</ThemedText>
              <View style={styles.inputWrapper}>
                <RNTextInput
                  value={newPassword}
                  onChangeText={(v) => { setNewPassword(v); setError(''); }}
                  secureTextEntry={!showPassword}
                  placeholder="Минимум 6 символов"
                  placeholderTextColor={placeholderColor}
                  style={[styles.inputWithIcon, inputStyle]}
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowPassword((p) => !p)}>
                  <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={textMuted} />
                </Pressable>
              </View>
              <ThemedText style={styles.label}>Подтвердите пароль</ThemedText>
              <View style={styles.inputWrapper}>
                <RNTextInput
                  value={confirmPassword}
                  onChangeText={(v) => { setConfirmPassword(v); setError(''); }}
                  secureTextEntry={!showConfirmPassword}
                  placeholder="Повторите пароль"
                  placeholderTextColor={placeholderColor}
                  style={[styles.inputWithIcon, inputStyle]}
                />
                <Pressable style={styles.eyeButton} onPress={() => setShowConfirmPassword((p) => !p)}>
                  <Ionicons name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'} size={22} color={textMuted} />
                </Pressable>
              </View>
              {error ? <ThemedText style={[styles.error, { color: errorColor }]}>{error}</ThemedText> : null}
              <Pressable style={[styles.primaryButton, { backgroundColor: primary }, loading && styles.disabled]} disabled={loading} onPress={handleResetPassword}>
                <ThemedText style={styles.primaryButtonText}>{loading ? 'Сохранение...' : 'Изменить пароль'}</ThemedText>
              </Pressable>
              <Pressable style={styles.ghostButton} onPress={() => { setStep(2); setError(''); }}>
                <ThemedText style={[styles.ghostText, { color: textMuted }]}>Назад</ThemedText>
              </Pressable>
            </View>
          )}

          {step === 4 && (
            <View style={[styles.block, { borderColor: border }]}>
              <ThemedText style={[styles.successIcon, { color: primary }]}>✓</ThemedText>
              <ThemedText style={[styles.otpHint, styles.center, { color: textMuted }]}>
                Ваш пароль успешно изменен. Теперь вы можете войти в систему с новым паролем.
              </ThemedText>
              <Pressable style={[styles.primaryButton, { backgroundColor: primary }]} onPress={() => router.replace('/login')}>
                <ThemedText style={styles.primaryButtonText}>Перейти к входу</ThemedText>
              </Pressable>
            </View>
          )}

        </ScrollView>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  keyboard: { flex: 1 },
  scroll: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 28,
    gap: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 8,
  },
  block: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 16,
    gap: 12,
  },
  label: { fontSize: 14, fontWeight: '600' },
  center: { textAlign: 'center' },
  input: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    paddingHorizontal: 14,
  },
  inputWrapper: { position: 'relative' },
  inputWithIcon: {
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    fontSize: 16,
    paddingLeft: 14,
    paddingRight: 48,
  },
  eyeButton: {
    position: 'absolute',
    right: 14,
    top: 13,
  },
  otpHint: { fontSize: 14, lineHeight: 20 },
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  otpInput: {
    width: 46,
    height: 48,
    borderWidth: 1,
    borderRadius: 8,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '600',
  },
  primaryButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 48,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  secondaryText: { fontSize: 16, fontWeight: '500' },
  ghostButton: { height: 48, justifyContent: 'center', alignItems: 'center' },
  ghostText: { fontSize: 16 },
  error: { fontSize: 14 },
  successIcon: { textAlign: 'center', fontSize: 48, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
