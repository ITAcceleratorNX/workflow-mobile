import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextInput } from '@/components/ui';
import { LogsViewer } from '@/components/logs-viewer';
import { NotificationsList } from '@/components/notifications-list';
import { ProfileTabs, type ProfileTab } from '@/components/profile-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ROLE_TRANSLATIONS } from '@/constants/profile';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  changePassword,
  sendEmailVerificationCode,
  updateNotificationsSettings,
  updateProfile,
  verifyEmail,
} from '@/lib/profile-api';
import { formatPhone } from '@/lib';
import { unregisterPushTokenFromBackend } from '@/lib/pushNotifications';
import { useAuthStore, type AuthState } from '@/stores/auth-store';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state: AuthState) => state.user);
  const role = useAuthStore((state: AuthState) => state.role);
  const updateUser = useAuthStore((state: AuthState) => state.updateUser);
  const clearAuth = useAuthStore((state: AuthState) => state.clearAuth);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const errorColor = useThemeColor({}, 'error');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');
  const { show: showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');

  // Profile tab state
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Email verification state
  const [email, setEmail] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  // Password tab state
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Notifications tab state
  const [notificationError, setNotificationError] = useState('');
  const [notificationSuccess, setNotificationSuccess] = useState('');
  const [isSavingNotifications, setIsSavingNotifications] = useState(false);

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    if (user?.email) setEmail(user.email);
  }, [user?.email]);

  useEffect(() => {
    if (
      activeTab === 'logs' &&
      (!role || !['admin-worker', 'department-head', 'manager'].includes(role))
    ) {
      setActiveTab('profile');
    }
  }, [activeTab, role]);

  useEffect(() => {
    if (!user) {
      router.replace('/login');
    }
  }, [user, router]);

  const handleUnauthorized = useCallback(() => {
    router.replace('/login');
  }, [router]);

  const handlePhoneChange = useCallback(
    (value: string) => {
      const formatted = formatPhone(value);
      updateUser((prev) => (prev ? { ...prev, phone: formatted } : null));
    },
    [updateUser]
  );

  const handleSaveProfile = useCallback(async () => {
    if (!user) return;
    setProfileError('');
    setProfileSuccess('');
    if (!user.full_name || !user.phone) {
      setProfileError('ФИО и Номер обязательны.');
      return;
    }

    setIsSavingProfile(true);
    const result = await updateProfile(user.id, {
      full_name: user.full_name,
      phone: user.phone,
    });
    setIsSavingProfile(false);

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
        return;
      }
      setProfileError(result.error);
      return;
    }
    setProfileSuccess('Профиль обновлён.');
    showToast({
      title: 'Профиль обновлён',
      variant: 'success',
    });
  }, [user, handleUnauthorized]);

  const handleSendVerificationCode = useCallback(async () => {
    const emailToSend = email || user?.email;
    if (!emailToSend) {
      setEmailError('Введите email');
      return;
    }
    if (user?.email_verified && emailToSend === user?.email) {
      setEmailError('Email уже верифицирован');
      return;
    }

    setIsSendingCode(true);
    setEmailError('');
    setEmailSuccess('');
    const result = await sendEmailVerificationCode(emailToSend);
    setIsSendingCode(false);

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
        return;
      }
      setEmailError(result.error);
      return;
    }
    setEmail(emailToSend);
    setEmailSuccess('Код верификации отправлен на email');
    showToast({
      title: 'Код отправлен',
      description: 'Код верификации отправлен на email',
      variant: 'success',
    });
  }, [email, user?.email, user?.email_verified, handleUnauthorized]);

  const handleVerifyEmail = useCallback(async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setEmailError('Введите 6-значный код');
      return;
    }

    setIsVerifying(true);
    setEmailError('');
    const result = await verifyEmail(verificationCode);
    setIsVerifying(false);

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
        return;
      }
      setEmailError(result.error);
      return;
    }
    const emailToUpdate = email || user?.email;
    updateUser((prev) =>
      prev ? { ...prev, email: emailToUpdate ?? '', email_verified: true } : null
    );
    setVerificationCode('');
    setEmailSuccess('Email верифицирован');
    showToast({
      title: 'Email верифицирован',
      variant: 'success',
    });
  }, [verificationCode, email, user?.email, updateUser, handleUnauthorized]);

  const handleChangePassword = useCallback(async () => {
    setPasswordError('');
    if (!oldPassword || !newPassword || !confirmPassword) {
      setPasswordError('Заполните все поля.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('Пароли не совпадают.');
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError('Пароль должен быть минимум 6 символов.');
      return;
    }

    setIsChangingPassword(true);
    const result = await changePassword({
      currentPassword: oldPassword,
      newPassword,
    });
    setIsChangingPassword(false);

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
        return;
      }
      setPasswordError(result.error);
      return;
    }
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    showToast({
      title: 'Пароль изменён',
      variant: 'success',
    });
  }, [oldPassword, newPassword, confirmPassword, handleUnauthorized]);

  const handleSaveNotifications = useCallback(async () => {
    if (!user) return;

    setIsSavingNotifications(true);
    setNotificationError('');
    setNotificationSuccess('');
    const result = await updateNotificationsSettings({
      emailNotifications: user.email_notifications,
      securityNotifications: user.security_notifications,
      marketingNotifications: user.marketing_notifications,
    });
    setIsSavingNotifications(false);

    if (!result.ok) {
      if (result.unauthorized) {
        handleUnauthorized();
        return;
      }
      setNotificationError(result.error);
      return;
    }
    setNotificationSuccess('Настройки уведомлений сохранены');
    showToast({
      title: 'Настройки уведомлений сохранены',
      variant: 'success',
    });
  }, [user, handleUnauthorized]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      await unregisterPushTokenFromBackend();
    } finally {
      clearAuth();
      router.replace('/login');
    }
  }, [clearAuth, router]);

  if (!user) {
    return null;
  }

  const showEmailVerificationBlock =
    (email || user?.email) &&
    (!user?.email_verified || emailSuccess?.includes('Код верификации отправлен'));

  return (
    <ThemedView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboard}
      >
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingTop: 24 + insets.top },
          ]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <ThemedText style={styles.headerTitle}>Профиль</ThemedText>
            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={8}
              style={styles.settingsButton}
            >
              <MaterialIcons name="settings" size={22} color={text} />
            </Pressable>
          </View>

          <ProfileTabs
            activeTab={activeTab}
            onTabChange={setActiveTab}
            role={role}
          />

          {activeTab === 'profile' && (
            <View style={[styles.card, { borderColor: border }]}>
              <ThemedText style={styles.sectionTitle}>Данные клиента</ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: textMuted }]}>
                Редактирование профиля
              </ThemedText>

              <TextInput
                label="ФИО"
                value={user?.full_name ?? ''}
                onChangeText={(t) =>
                  updateUser((prev) =>
                    prev ? { ...prev, full_name: t } : null
                  )
                }
              />
              <TextInput
                label="Номер телефона"
                placeholder="+7 XXX XXX XX XX"
                value={user?.phone ?? ''}
                onChangeText={handlePhoneChange}
                keyboardType="phone-pad"
                maxLength={19}
              />

              <View style={styles.field}>
                <View style={styles.labelRow}>
                  <ThemedText style={[styles.label, { color: text }]}>
                    Email
                  </ThemedText>
                  {user?.email_verified && (
                    <View style={[styles.verifiedBadge, { backgroundColor: `${success}26` }]}>
                      <MaterialIcons
                        name="check-circle"
                        size={14}
                        color={success}
                      />
                      <ThemedText style={[styles.verifiedText, { color: success }]}>
                        Верифицирован
                      </ThemedText>
                    </View>
                  )}
                </View>
                <View style={styles.emailColumn}>
                  <View style={styles.emailInputFullWidth}>
                    <TextInput
                      placeholder="example@mail.com"
                      value={email || user?.email || ''}
                      onChangeText={(t) => {
                        setEmail(t);
                        setEmailError('');
                        setEmailSuccess('');
                      }}
                      keyboardType="email-address"
                      editable={!isSendingCode && !isVerifying}
                    />
                  </View>
                  <Pressable
                    onPress={handleSendVerificationCode}
                    disabled={
                      isSendingCode ||
                      isVerifying ||
                      (!email && !user?.email) ||
                      (user?.email_verified &&
                        (email || user?.email) === user?.email)
                    }
                    style={({ pressed }) => [
                      styles.codeButtonWrapper,
                      styles.codeButton,
                      { borderColor: border },
                      (isSendingCode || isVerifying || (!email && !user?.email) ||
                        (user?.email_verified &&
                          (email || user?.email) === user?.email)) &&
                        styles.buttonDisabled,
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    {isSendingCode ? (
                      <MaterialIcons
                        name="hourglass-empty"
                        size={20}
                        color={textMuted}
                      />
                    ) : (
                      <MaterialIcons name="mail" size={20} color={text} />
                    )}
                    <ThemedText style={[styles.codeButtonText, { color: text }]}>
                      {isSendingCode ? 'Отправка...' : 'Код'}
                    </ThemedText>
                  </Pressable>
                </View>
                {emailSuccess ? (
                  <ThemedText style={[styles.successText, { color: success }]}>
                    {emailSuccess}
                  </ThemedText>
                ) : null}
                {emailError ? (
                  <ThemedText style={[styles.errorText, { color: errorColor }]}>
                    {emailError}
                  </ThemedText>
                ) : null}
                {showEmailVerificationBlock && (
                  <View style={[styles.verificationBlock, { borderColor: border }]}>
                    <ThemedText style={[styles.label, { color: text }]}>
                      Код верификации
                    </ThemedText>
                    <View style={styles.verificationRow}>
                      <View style={styles.codeInputWrapper}>
                        <TextInput
                          placeholder="000000"
                          value={verificationCode}
                          onChangeText={(t) => {
                            setVerificationCode(t.replace(/\D/g, '').slice(0, 6));
                            setEmailError('');
                          }}
                          keyboardType="number-pad"
                          maxLength={6}
                          editable={!isVerifying}
                        />
                      </View>
                      <Pressable
                        onPress={handleVerifyEmail}
                        disabled={
                          isVerifying || verificationCode.length !== 6
                        }
                        style={({ pressed }) => [
                          styles.okButton,
                          { backgroundColor: primary },
                          (isVerifying || verificationCode.length !== 6) &&
                            styles.buttonDisabled,
                          pressed && styles.buttonPressed,
                        ]}
                      >
                        {isVerifying ? (
                          <MaterialIcons
                            name="hourglass-empty"
                            size={18}
                            color="#fff"
                          />
                        ) : (
                          <ThemedText style={styles.okButtonText}>OK</ThemedText>
                        )}
                      </Pressable>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: text }]}>Роль</ThemedText>
                <View style={[styles.roleBadge, { borderColor: border }]}>
                  <ThemedText style={[styles.roleText, { color: text }]}>
                    {role && ROLE_TRANSLATIONS[role]
                      ? ROLE_TRANSLATIONS[role]
                      : role ?? '—'}
                  </ThemedText>
                </View>
              </View>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: text }]}>Офис</ThemedText>
                <ThemedText style={[styles.readOnlyValue, { color: textMuted }]}>
                  {user?.office?.name ?? '—'}
                </ThemedText>
              </View>

              <View style={styles.field}>
                <ThemedText style={[styles.label, { color: text }]}>ID</ThemedText>
                <ThemedText style={[styles.idValue, { color: textMuted }]}>
                  #{user?.id}
                </ThemedText>
              </View>

              <Button
                title={isSavingProfile ? 'Сохранение...' : 'Сохранить'}
                onPress={handleSaveProfile}
                disabled={isSavingProfile}
              />
              {profileError ? (
                <ThemedText style={[styles.errorText, { color: errorColor }]}>
                  {profileError}
                </ThemedText>
              ) : null}
              {profileSuccess ? (
                <ThemedText style={[styles.successText, { color: success }]}>{profileSuccess}</ThemedText>
              ) : null}

              <Button
                title={isLoggingOut ? 'Выходим...' : 'Выйти из аккаунта'}
                onPress={handleLogout}
                variant="secondary"
                disabled={isLoggingOut}
              />
            </View>
          )}

          {activeTab === 'password' && (
            <View style={[styles.card, { borderColor: border }]}>
              <ThemedText style={styles.sectionTitle}>Смена пароля</ThemedText>
              <TextInput
                label="Старый пароль"
                placeholder="••••••••"
                value={oldPassword}
                onChangeText={setOldPassword}
                secureTextEntry
              />
              <TextInput
                label="Новый пароль"
                placeholder="••••••••"
                value={newPassword}
                onChangeText={setNewPassword}
                secureTextEntry
              />
              <TextInput
                label="Подтверждение"
                placeholder="••••••••"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
              />
              <Button
                title={
                  isChangingPassword ? 'Смена...' : 'Сменить пароль'
                }
                onPress={handleChangePassword}
                disabled={isChangingPassword}
              />
              {passwordError ? (
                <ThemedText style={[styles.errorText, { color: errorColor }]}>
                  {passwordError}
                </ThemedText>
              ) : null}
            </View>
          )}

          {activeTab === 'logs' && role && ['admin-worker', 'department-head', 'manager'].includes(role) && (
            <LogsViewer userRole={role} />
          )}

          {activeTab === 'notifications' && (
            <View style={[styles.card, { borderColor: border }]}>
              <ThemedText style={styles.sectionTitle}>
                Уведомления
              </ThemedText>
              <ThemedText style={[styles.sectionSubtitle, { color: textMuted }]}>
                История последних уведомлений
              </ThemedText>
              <NotificationsList />
            </View>
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
    paddingHorizontal: 20,
    paddingBottom: 32,
    gap: 24,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 24,
    lineHeight: 32,
    fontWeight: '600',
  },
  settingsButton: {
    padding: 4,
  },
  header: {
    gap: 8,
  },
  title: {
    fontSize: 28,
    lineHeight: 40,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 24,
  },
  card: {
    padding: 20,
    borderRadius: 12,
    borderWidth: 1,
    gap: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  sectionSubtitle: {
    fontSize: 14,
    marginTop: -8,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '500',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  verifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '500',
  },
  emailColumn: {
    gap: 12,
  },
  emailInputFullWidth: {
    width: '100%',
  },
  codeButtonWrapper: {
    alignSelf: 'flex-start',
  },
  codeInputWrapper: {
    flex: 1,
  },
  codeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minWidth: 72,
  },
  codeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  verificationBlock: {
    marginTop: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
  },
  verificationRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  okButton: {
    height: 48,
    paddingHorizontal: 20,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 60,
  },
  okButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  roleText: {
    fontSize: 14,
    fontWeight: '500',
  },
  readOnlyValue: {
    fontSize: 16,
  },
  idValue: {
    fontSize: 14,
    fontFamily: 'monospace',
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  switchLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  errorText: {
    fontSize: 14,
  },
  successText: {
    fontSize: 14,
  },
});
