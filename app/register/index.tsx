import { useAsyncResource } from '@/hooks/use-async-resource';
import {
  getOffices,
  getOfficeCompanies,
  getServiceCategoriesPublic,
  createRegistrationRequest,
  sendVerificationCode,
  verifyCode,
  formatPhone,
  PHONE_REGEX,
  REGISTRATION_ROLES,
  INITIAL_REGISTRATION_FORM,
  COMPANY_OTHER_VALUE,
  type Office,
  type ServiceCategory,
  type Company,
  type CreateRegistrationRequestBody,
} from '@/lib';
import {
  Button,
  OtpInput,
  Select,
  TextInput,
} from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FontSizes, LineHeights, Spacing } from '@/constants/theme';
import { formatServiceCategoryDisplayName, isExecutorServiceCategory } from '@/constants/requests';

export default function RegisterScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const errorColor = useThemeColor({}, 'error');
  const textMuted = useThemeColor({}, 'textMuted');
  const accent = useThemeColor({}, 'accent');
  const accentSoft = useThemeColor({}, 'accentSoft');

  const [formData, setFormData] = useState(INITIAL_REGISTRATION_FORM);
  const [offices, setOffices] = useState<Office[]>([]);

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [formErrors, setFormErrors] = useState<string | null>(null);
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [countdown, setCountdown] = useState(0);
  /** Запрос отправлен — показывается финальный экран; withoutSms — без SMS-подтверждения. */
  const [submitted, setSubmitted] = useState<{ withoutSms: boolean } | null>(null);
  /** SMS не удалось отправить — можно продолжить без него. */
  const [smsSendFailed, setSmsSendFailed] = useState(false);
  /** Шаг, с которого пользователь продолжил без SMS (запрос подтвердит Администратор). */
  const [smsSkippedFrom, setSmsSkippedFrom] = useState<1 | 2 | null>(null);
  const smsSkipped = smsSkippedFrom != null;

  useEffect(() => {
    getOffices().then(setOffices);
  }, []);

  const loadOfficeOptions = useCallback(async () => {
    const officeId = Number(formData.office_id);
    if (!Number.isInteger(officeId) || officeId <= 0) return { categories: [], companies: [] };
    const [categories, response] = await Promise.all([getServiceCategoriesPublic(officeId), getOfficeCompanies(officeId)]);
    return { categories, companies: response.ok ? response.data : [] };
  }, [formData.office_id]);
  const { data: { categories, companies } } = useAsyncResource<{ categories: ServiceCategory[]; companies: Company[] }>(loadOfficeOptions, { categories: [], companies: [] });

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const handlePhoneChange = useCallback((text: string) => {
    const formatted = formatPhone(text);
    setFormData((prev) => ({ ...prev, phone: formatted }));
    setFormErrors(null);
    setVerificationCode('');
    setSmsSendFailed(false);
    setSmsSkippedFrom(null);
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
      setSmsSendFailed(false);
      setCountdown(60);
      setStep(2);
    } else {
      setSmsSendFailed(true);
      setFormErrors(result.message ?? 'Ошибка при отправке SMS. Попробуйте позже.');
    }
  }, [formData.phone]);

  /**
   * SMS не приходит: шаг кода пропускается, запрос уходит Администратору,
   * он подтверждает регистрацию вручную («Подтвердить без SMS»).
   */
  const handleSkipSms = useCallback((fromStep: 1 | 2) => {
    setSmsSkippedFrom(fromStep);
    setVerificationCode('');
    setFormErrors(null);
    setStep(3);
  }, []);

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
    if (result.success) {
      setSmsSendFailed(false);
      setCountdown(60);
    } else {
      setSmsSendFailed(true);
      setFormErrors(result.message ?? 'Ошибка при отправке SMS.');
    }
  }, [formData.phone, isSendingCode, countdown]);

  const handleSubmit = useCallback(async () => {
    if (formData.role !== 'client' && formData.role !== 'executor') {
      setFormErrors('Выберите роль');
      return;
    }
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
    const body: CreateRegistrationRequestBody = {
      phone: formData.phone,
      full_name: formData.full_name,
      office_id: parseInt(formData.office_id, 10),
      role: formData.role,
      password: formData.password,
    };
    if (formData.role === 'executor' && formData.service_category_id) {
      body.service_category_id = parseInt(formData.service_category_id, 10);
    }
    if (formData.role === 'client') {
      if (formData.company_id === COMPANY_OTHER_VALUE) {
        const otherName = formData.company_other_name.trim();
        if (otherName) {
          body.company_other_name = otherName;
        }
      } else if (formData.company_id) {
        const cid = parseInt(formData.company_id, 10);
        if (Number.isFinite(cid) && cid > 0) {
          body.company_id = cid;
        }
      }
    }
    const result = await createRegistrationRequest(body);
    setLoading(false);
    if (result.ok) {
      setFormData(INITIAL_REGISTRATION_FORM);
      setStep(1);
      setVerificationCode('');
      setCountdown(0);
      setSmsSendFailed(false);
      setSmsSkippedFrom(null);
      setSubmitted({ withoutSms: smsSkipped });
    } else {
      setFormErrors(result.error);
    }
  }, [formData, smsSkipped]);

  const step1Valid =
    formData.phone &&
    formData.full_name.trim() &&
    formData.office_id &&
    formData.role &&
    (formData.role !== 'executor' || formData.service_category_id) &&
    (formData.role !== 'client' ||
      (formData.company_id !== '' &&
        (formData.company_id !== COMPANY_OTHER_VALUE ||
          formData.company_other_name.trim().length > 0)));

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
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingTop: Math.max(insets.top, Spacing.huge) + Spacing.md,
              paddingBottom: Math.max(insets.bottom, Spacing.huge) + Spacing.md,
            },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {submitted ? (
            <View style={styles.success} accessibilityRole="summary">
              <View style={[styles.successIcon, { backgroundColor: accentSoft }]}>
                <MaterialIcons name="check" size={32} color={accent} />
              </View>
              <ThemedText type="title" style={[styles.title, styles.successText]}>
                Запрос отправлен
              </ThemedText>
              <ThemedText style={[styles.successMessage, { color: textMuted }]}>
                {submitted.withoutSms
                  ? 'Номер не подтверждён по SMS — администратор проверит данные и подтвердит регистрацию вручную.'
                  : 'Администратор проверит данные и откроет доступ.'}
              </ThemedText>
              <ThemedText style={[styles.successMessage, { color: textMuted }]}>
                После одобрения войдите по номеру телефона и паролю.
              </ThemedText>
              <View style={styles.successAction}>
                <Button title="Перейти ко входу" onPress={() => router.replace('/login')} />
              </View>
            </View>
          ) : (
            <>
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
                    setFormData((p) => ({
                      ...p,
                      office_id: v,
                      service_category_id: '',
                      company_id: '',
                      company_other_name: '',
                    }))
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
                      company_id: v === 'client' ? p.company_id : '',
                      company_other_name:
                        v === 'client' ? p.company_other_name : '',
                    }))
                  }
                  options={[...REGISTRATION_ROLES]}
                  placeholder="Клиент или исполнитель"
                />
              </View>
              {formData.role === 'client' && formData.office_id !== '' && (
                <View style={styles.field}>
                  <ThemedText style={styles.label}>Компания</ThemedText>
                  <Select
                    value={formData.company_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({
                        ...p,
                        company_id: v,
                        company_other_name:
                          v === COMPANY_OTHER_VALUE ? p.company_other_name : '',
                      }))
                    }
                    options={[
                      ...companies.map((c) => ({
                        value: String(c.id),
                        label: c.name,
                      })),
                      { value: COMPANY_OTHER_VALUE, label: 'Другое' },
                    ]}
                    placeholder="Выберите компанию"
                  />
                </View>
              )}
              {formData.role === 'client' &&
                formData.company_id === COMPANY_OTHER_VALUE && (
                  <TextInput
                    label="Название компании"
                    placeholder="Введите название вашей компании"
                    value={formData.company_other_name}
                    onChangeText={(t) =>
                      setFormData((p) => ({ ...p, company_other_name: t }))
                    }
                  />
                )}
              {formData.role === 'executor' && (
                <View style={styles.field}>
                  <ThemedText style={styles.label}>Категория услуг</ThemedText>
                  <Select
                    value={formData.service_category_id}
                    onValueChange={(v) =>
                      setFormData((p) => ({ ...p, service_category_id: v }))
                    }
                    // Категории выбирает только Исполнитель: «Администрацию» ведёт Офис-менеджер.
                    options={categories
                      .filter((c) => isExecutorServiceCategory(c.name))
                      .map((c) => ({
                        value: String(c.id),
                        label: formatServiceCategoryDisplayName(c.name),
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
              {smsSendFailed ? (
                <Button
                  title="Продолжить без SMS"
                  onPress={() => handleSkipSms(1)}
                  variant="ghost"
                  disabled={!step1Valid}
                />
              ) : null}
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
              {!isSendingCode && countdown === 0 ? (
                <Button
                  title="Не приходит SMS? Отправить без SMS"
                  onPress={() => handleSkipSms(2)}
                  variant="ghost"
                />
              ) : null}
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
              {smsSkipped ? (
                <ThemedText style={[styles.smsHint, { color: textMuted }]}>
                  Запрос будет отправлен без SMS-подтверждения. Его подтвердит администратор.
                </ThemedText>
              ) : null}
              <TextInput
                label="Пароль"
                placeholder="Не менее 6 символов"
                value={formData.password}
                onChangeText={(t) =>
                  setFormData((p) => ({ ...p, password: t }))
                }
                secureTextEntry
                textContentType="newPassword"
                autoComplete="password-new"
              />
              <TextInput
                label="Подтвердите пароль"
                placeholder="Введите пароль ещё раз"
                value={formData.confirm_password}
                onChangeText={(t) =>
                  setFormData((p) => ({ ...p, confirm_password: t }))
                }
                secureTextEntry
                textContentType="newPassword"
                autoComplete="password-new"
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
                  setFormErrors(null);
                  // Назад туда, где SMS пропустили: к коду или к форме, если SMS не ушло.
                  setStep(smsSkippedFrom ?? 2);
                  setSmsSkippedFrom(null);
                }}
                variant="ghost"
              />
            </View>
          )}

          <View style={styles.footer}>
            <Button
              title="Вернуться к входу"
              onPress={() => router.replace('/login')}
              variant="secondary"
            />
          </View>
            </>
          )}
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
    paddingHorizontal: Spacing.xl,
    gap: Spacing.huge,
  },
  header: {
    gap: Spacing.md,
  },
  title: {
    fontSize: 28,
    lineHeight: 40,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FontSizes.title + 1,
    lineHeight: LineHeights.headline,
  },
  form: {
    gap: Spacing.xxl,
  },
  field: {
    gap: Spacing.sm,
  },
  label: {
    fontSize: FontSizes.body + 1,
    lineHeight: LineHeights.body + 2,
    fontWeight: '500',
  },
  smsHint: {
    fontSize: FontSizes.bodySmall,
    textAlign: 'center',
  },
  error: {
    fontSize: FontSizes.caption,
  },
  errorCenter: {
    textAlign: 'center',
  },
  footer: {
    marginTop: Spacing.sm,
  },
  success: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  successText: {
    textAlign: 'center',
  },
  successMessage: {
    fontSize: FontSizes.body + 1,
    lineHeight: LineHeights.body + 4,
    textAlign: 'center',
  },
  successAction: {
    alignSelf: 'stretch',
    marginTop: Spacing.xl,
  },
});
