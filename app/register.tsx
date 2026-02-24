import {
  getOffices,
  getServiceCategoriesPublic,
  createRegistrationRequest,
  sendVerificationCode,
  verifyCode,
  formatPhone,
  PHONE_REGEX,
  REGISTRATION_ROLES,
  INITIAL_REGISTRATION_FORM,
  type Office,
  type ServiceCategory,
} from '@/lib';
import {
  Button,
  OtpInput,
  Select,
  SuccessModal,
  TextInput,
} from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

export default function RegisterScreen() {
  const router = useRouter();
  const errorColor = useThemeColor({}, 'error');
  const textMuted = useThemeColor({}, 'textMuted');

  const [formData, setFormData] = useState(INITIAL_REGISTRATION_FORM);
  const [offices, setOffices] = useState<Office[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [successVisible, setSuccessVisible] = useState(false);

  useEffect(() => {
    getOffices().then(setOffices);
    getServiceCategoriesPublic().then(setCategories);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handlePhoneChange = useCallback((text: string) => {
    const formatted = formatPhone(text);
    setFormData((prev) => ({ ...prev, phone: formatted }));
    setFormErrors(null);
    setCodeSent(false);
    setVerificationCode('');
  }, []);

  const goToStep2AndSendCode = useCallback(async () => {
    if (!formData.phone) {
      setFormErrors('Введите номер телефона');
      return;
    }
    if (!PHONE_REGEX.test(formData.phone)) {
      setFormErrors('Введите корректный номер телефона');
      return;
    }
    setFormErrors(null);
    setIsSendingCode(true);
    const result = await sendVerificationCode(formData.phone, 'registration');
    setIsSendingCode(false);
    if (result.success) {
      setCodeSent(true);
      setCountdown(60);
      setStep(2);
    } else {
      setFormErrors(result.message ?? 'Ошибка при отправке SMS. Попробуйте позже.');
    }
  }, [formData.phone]);

  const handleVerifyCode = useCallback(async () => {
    if (verificationCode.length !== 6) {
      setFormErrors('Введите код из 6 цифр');
      return;
    }
    setFormErrors(null);
    const result = await verifyCode(formData.phone, verificationCode, 'registration');
    if (result.success) setStep(3);
    else setFormErrors(result.message ?? 'Неверный код верификации');
  }, [formData.phone, verificationCode]);

  const handleResendCode = useCallback(async () => {
    if (isSendingCode || countdown > 0) return;
    setFormErrors(null);
    setIsSendingCode(true);
    const result = await sendVerificationCode(formData.phone, 'registration');
    setIsSendingCode(false);
    if (result.success) setCountdown(60);
    else setFormErrors(result.message ?? 'Ошибка при отправке SMS.');
  }, [formData.phone, isSendingCode, countdown]);

  const handleSubmit = useCallback(async () => {
    if (formData.password !== formData.confirm_password) {
      setFormErrors('Пароли не совпадают');
      return;
    }
    if (formData.password.length < 6) {
      setFormErrors('Пароль должен содержать минимум 6 символов');
      return;
    }
    setFormErrors(null);
    setLoading(true);
    const body = {
      phone: formData.phone,
      full_name: formData.full_name,
      office_id: parseInt(formData.office_id, 10),
      role: formData.role as 'client' | 'executor',
      password: formData.password,
    };
    if (formData.role === 'executor' && formData.service_category_id) {
      (body as Record<string, unknown>).service_category_id = parseInt(
        formData.service_category_id,
        10
      );
    }
    const result = await createRegistrationRequest(body);
    setLoading(false);
    if (result.ok) {
      setFormData(INITIAL_REGISTRATION_FORM);
      setStep(1);
      setVerificationCode('');
      setCodeSent(false);
      setCountdown(0);
      setSuccessVisible(true);
    } else {
      setFormErrors(result.error);
    }
  }, [formData]);

  const handleSuccessClose = useCallback(() => {
    setSuccessVisible(false);
    router.replace('/');
  }, [router]);

  const step1Valid =
    formData.phone &&
    formData.full_name.trim() &&
    formData.office_id &&
    formData.role &&
    (formData.role !== 'executor' || formData.service_category_id);

  const stepTitles = ['Регистрация', 'Верификация', 'Создание пароля'];
  const stepSubtitles = [
    'Заполните форму для регистрации',
    'Введите код из SMS',
    'Придумайте надёжный пароль',
  ];

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
              {stepTitles[step - 1]}
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              {stepSubtitles[step - 1]}
            </ThemedText>
          </View>

          {step === 1 && (
            <View style={styles.form}>
              <TextInput
                label="Номер телефона"
                placeholder="+7 700 123 45 67"
                value={formData.phone}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={19}
              />
              <TextInput
                label="ФИО"
                placeholder="Ахметов Айдос Ерланұлы "
                value={formData.full_name}
                onChangeText={(t) =>
                  setFormData((p) => ({ ...p, full_name: t }))
                }
              />
              <View style={styles.field}>
                <ThemedText style={styles.label}>Офис</ThemedText>
                <Select
                  value={formData.office_id}
                  onValueChange={(v) =>
                    setFormData((p) => ({ ...p, office_id: v }))
                  }
                  options={offices.map((o) => ({
                    value: String(o.id),
                    label: o.name,
                  }))}
                  placeholder="Выберите офис из списка"
                />
              </View>
              <View style={styles.field}>
                <ThemedText style={styles.label}>Роль</ThemedText>
                <Select
                  value={formData.role}
                  onValueChange={(v) =>
                    setFormData((p) => ({
                      ...p,
                      role: v,
                      service_category_id: '',
                    }))
                  }
                  options={[...REGISTRATION_ROLES]}
                  placeholder="Клиент или исполнитель"
                />
              </View>
              {formData.role === 'executor' && (
                <View style={styles.field}>
                  <ThemedText style={styles.label}>Категория услуг</ThemedText>
                  <Select
                    value={formData.service_category_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, service_category_id: v }))
                    }
                    options={categories.map((c) => ({
                      value: String(c.id),
                      label: c.name,
                    }))}
                    placeholder="Категория услуг"
                  />
                </View>
              )}
              {formErrors ? (
                <ThemedText style={[styles.error, { color: errorColor }]}>
                  {formErrors}
                </ThemedText>
              ) : null}
              <Button
                title="Далее"
                onPress={goToStep2AndSendCode}
                disabled={!step1Valid || isSendingCode}
              />
            </View>
          )}

          {step === 2 && (
            <View style={styles.form}>
              <ThemedText
                style={[styles.smsHint, { color: textMuted }]}
              >
                Мы отправили SMS с кодом на номер {formData.phone}
              </ThemedText>
              <OtpInput
                value={verificationCode}
                onChange={(v) => {
                  setVerificationCode(v);
                  setFormErrors(null);
                }}
                label="Введите код"
              />
              {formErrors ? (
                <ThemedText
                  style={[styles.error, styles.errorCenter, { color: errorColor }]}
                >
                  {formErrors}
                </ThemedText>
              ) : null}
              <Button
                title="Подтвердить"
                onPress={handleVerifyCode}
                disabled={verificationCode.length !== 6}
              />
              <Button
                title={
                  isSendingCode
                    ? 'Отправка...'
                    : countdown > 0
                      ? `Отправить повторно (${countdown}с)`
                      : 'Отправить код повторно'
                }
                onPress={handleResendCode}
                variant="secondary"
                disabled={isSendingCode || countdown > 0}
              />
              <Button
                title="Назад"
                onPress={() => {
                  setStep(1);
                  setFormErrors(null);
                  setVerificationCode('');
                }}
                variant="ghost"
              />
            </View>
          )}

          {step === 3 && (
            <View style={styles.form}>
              <TextInput
                label="Пароль"
                placeholder="Не менее 6 символов"
                value={formData.password}
                onChangeText={(t) =>
                  setFormData((p) => ({ ...p, password: t }))
                }
                secureTextEntry
              />
              <TextInput
                label="Подтвердите пароль"
                placeholder="Введите пароль ещё раз"
                value={formData.confirm_password}
                onChangeText={(t) =>
                  setFormData((p) => ({ ...p, confirm_password: t }))
                }
                secureTextEntry
              />
              {formErrors ? (
                <ThemedText style={[styles.error, { color: errorColor }]}>
                  {formErrors}
                </ThemedText>
              ) : null}
              <Button
                title={loading ? 'Отправка...' : 'Отправить запрос'}
                onPress={handleSubmit}
                disabled={loading}
              />
              <Button
                title="Назад"
                onPress={() => {
                  setStep(2);
                  setFormErrors(null);
                }}
                variant="ghost"
              />
            </View>
          )}

          <View style={styles.footer}>
            <Button
              title="Вернуться к входу"
              onPress={() => router.replace('/')}
              variant="secondary"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <SuccessModal
        visible={successVisible}
        onClose={handleSuccessClose}
        title="Успешно"
        message="Запрос на регистрацию отправлен. Ожидайте одобрения администратора."
      />
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
    paddingHorizontal: 20,
    paddingTop: 32,
    paddingBottom: 40,
    gap: 32,
  },
  header: {
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
  label: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  smsHint: {
    fontSize: 14,
    textAlign: 'center',
  },
  error: {
    fontSize: 12,
  },
  errorCenter: {
    textAlign: 'center',
  },
  footer: {
    marginTop: 8,
  },
});
