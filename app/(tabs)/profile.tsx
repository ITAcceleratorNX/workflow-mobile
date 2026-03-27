import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOTTOM_NAV_ROW_HEIGHT, bottomNavBottomInset } from '@/components/bottom-nav';
import { Button, TextInput } from '@/components/ui';
import { LogsViewer } from '@/components/logs-viewer';
import { ProfileTabs, type ProfileTab } from '@/components/profile-tabs';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ROLE_TRANSLATIONS } from '@/constants/profile';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  changePassword,
  sendEmailVerificationCode,
  updateProfile,
  verifyEmail,
} from '@/lib/profile-api';
import { calculateDeskHeights } from '@/lib/desk-height-utils';
import { formatPhone } from '@/lib';
import { unregisterPushTokenFromBackend } from '@/lib/pushNotifications';
import { useAuthStore, type AuthState } from '@/stores/auth-store';
import { useStepsStore } from '@/stores/steps-store';

export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((state: AuthState) => state.user);
  const role = useAuthStore((state: AuthState) => state.role);
  const updateUser = useAuthStore((state: AuthState) => state.updateUser);
  const clearAuth = useAuthStore((state: AuthState) => state.clearAuth);
  const isGuest = useAuthStore((state: AuthState) => state.isGuest);

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const errorColor = useThemeColor({}, 'error');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');
  const { show: showToast } = useToast();

  const [activeTab, setActiveTab] = useState<ProfileTab>('profile');

  // Profile tab state
  const [isEditingProfile, setIsEditingProfile] = useState(false);
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

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const deskHeights = useMemo(() => {
    if (heightCm == null) return null;
    return calculateDeskHeights(heightCm, weightKg);
  }, [heightCm, weightKg]);

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

  const handleSaveProfile = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setProfileError('');
    setProfileSuccess('');
    if (!user.full_name || !user.phone) {
      setProfileError('ФИО и Номер обязательны.');
      return false;
    }

    // Демо-профиль: не отправляем запросы на реальный backend
    if (isGuest) {
      setProfileSuccess('Демо: профиль обновлён локально.');
      showToast({
        title: 'Демо режим',
        description: 'Изменения сохранены только на этом устройстве.',
        variant: 'success',
      });
      return true;
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
        return false;
      }
      setProfileError(result.error);
      return false;
    }
    setProfileSuccess('Профиль обновлён.');
    showToast({
      title: 'Профиль обновлён',
      variant: 'success',
    });
    return true;
  }, [user, handleUnauthorized, isGuest, showToast]);

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

    // В демо-режиме не отправляем код на сервер
    if (isGuest) {
      setEmailSuccess('Демо: код "отправлен" (заглушка).');
      showToast({
        title: 'Демо режим',
        description: 'Код не отправляется на сервер в демо-версии.',
        variant: 'success',
      });
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
  }, [email, user?.email, user?.email_verified, handleUnauthorized, isGuest, showToast]);

  const handleVerifyEmail = useCallback(async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setEmailError('Введите 6-значный код');
      return;
    }

    // В демо-режиме просто помечаем email как верифицированный локально
    if (isGuest) {
      const emailToUpdate = email || user?.email;
      updateUser((prev) =>
        prev ? { ...prev, email: emailToUpdate ?? '', email_verified: true } : null
      );
      setVerificationCode('');
      setEmailSuccess('Демо: email помечен как верифицированный.');
      showToast({
        title: 'Демо режим',
        description: 'Статус верификации изменён только локально.',
        variant: 'success',
      });
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
  }, [verificationCode, email, user?.email, updateUser, handleUnauthorized, isGuest, showToast]);

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

    // В демо-режиме не отправляем смену пароля на сервер
    if (isGuest) {
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast({
        title: 'Демо режим',
        description: 'Смена пароля недоступна в демо-версии.',
        variant: 'default',
      });
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
  }, [oldPassword, newPassword, confirmPassword, handleUnauthorized, isGuest, showToast]);

  const handleLogout = useCallback(async () => {
    setIsLoggingOut(true);
    try {
      // В демо-режиме не дергаем backend при выходе
      if (!isGuest) {
        await unregisterPushTokenFromBackend();
      }
    } finally {
      clearAuth();
      router.replace('/login');
    }
  }, [clearAuth, router, isGuest]);

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
            {
              paddingTop: 12 + insets.top,
              paddingHorizontal: 18,
              paddingBottom:
                18 +
                BOTTOM_NAV_ROW_HEIGHT +
                bottomNavBottomInset(insets.bottom),
            },
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
            <>
              {/* Режим просмотра — без карточек, на всю ширину */}
              {!isEditingProfile && (
                <>
                  <ThemedText style={styles.profileName}>
                    {user?.full_name || '—'}
                  </ThemedText>
                  <ThemedText style={[styles.profileSubtitle, { color: textMuted }]}>
                    {role && ROLE_TRANSLATIONS[role] ? ROLE_TRANSLATIONS[role] : role ?? '—'}
                  </ThemedText>

                  <View style={styles.profileBlock}>
                    <View style={[styles.infoRow, styles.infoRowBorder, { borderBottomColor: border }]}>
                      <MaterialIcons name="phone" size={22} color={textMuted} />
                      <ThemedText style={[styles.infoLabel, { color: textMuted }]}>Телефон</ThemedText>
                      <ThemedText style={[styles.infoValue, { color: text }]} numberOfLines={1}>
                        {user?.phone || '—'}
                      </ThemedText>
                    </View>
                    <View style={[styles.infoRow, styles.infoRowBorder, { borderBottomColor: border }]}>
                      <MaterialIcons name="email" size={22} color={textMuted} />
                      <ThemedText style={[styles.infoLabel, { color: textMuted }]}>Email</ThemedText>
                      <View style={styles.infoValueWrap}>
                        <ThemedText style={[styles.infoValue, { color: text }]} numberOfLines={1}>
                          {user?.email || '—'}
                        </ThemedText>
                        {user?.email_verified && (
                          <MaterialIcons name="check-circle" size={20} color={success} />
                        )}
                      </View>
                    </View>
                    <View style={[styles.infoRow, styles.infoRowBorder, { borderBottomColor: border }]}>
                      <MaterialIcons name="business" size={22} color={textMuted} />
                      <ThemedText style={[styles.infoLabel, { color: textMuted }]}>Офис</ThemedText>
                      <ThemedText style={[styles.infoValue, { color: text }]} numberOfLines={1}>
                        {user?.office?.name ?? '—'}
                      </ThemedText>
                    </View>
                    <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
                      <MaterialIcons name="tag" size={22} color={textMuted} />
                      <ThemedText style={[styles.infoLabel, { color: textMuted }]}>ID</ThemedText>
                      <ThemedText style={[styles.infoValue, styles.idValue, { color: textMuted }]}>
                        #{user?.id}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={[styles.deskSection, { borderColor: border }]}>
                    <View style={styles.deskSectionHeader}>
                      <MaterialIcons name="event-seat" size={22} color={textMuted} />
                      <ThemedText style={[styles.deskSectionTitle, { color: text }]}>
                        Высота рабочего стола
                      </ThemedText>
                    </View>
                    {deskHeights ? (
                      <>
                        <ThemedText style={[styles.deskMeta, { color: textMuted }]}>
                          По данным из «Шаги»: рост {heightCm} см
                          {weightKg != null ? `, вес ${weightKg} кг` : ''}
                          {weightKg == null
                            ? '. Вес необязателен — с ним точнее высота для работы стоя.'
                            : '.'}
                        </ThemedText>
                        <View style={styles.deskHeightsRow}>
                          <View style={[styles.deskHeightCard, { borderColor: border }]}>
                            <ThemedText style={[styles.deskHeightLabel, { color: textMuted }]}>Сидя</ThemedText>
                            <ThemedText style={[styles.deskHeightValue, { color: text }]}>
                              {deskHeights.sitting} см
                            </ThemedText>
                          </View>
                          <View style={[styles.deskHeightCard, { borderColor: border }]}>
                            <ThemedText style={[styles.deskHeightLabel, { color: textMuted }]}>Стоя</ThemedText>
                            <ThemedText style={[styles.deskHeightValue, { color: text }]}>
                              {deskHeights.standing} см
                            </ThemedText>
                          </View>
                        </View>
                        <Pressable
                          onPress={() => router.push('/steps')}
                          style={({ pressed }) => [
                            styles.deskStepsLink,
                            { borderColor: border },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText style={[styles.deskStepsLinkText, { color: primary }]}>
                            Изменить рост и вес в «Шаги»
                          </ThemedText>
                          <MaterialIcons name="chevron-right" size={20} color={primary} />
                        </Pressable>
                      </>
                    ) : (
                      <>
                        <ThemedText style={[styles.deskMeta, { color: textMuted }]}>
                          {heightCm != null
                            ? 'Рост должен быть в диапазоне 100–250 см. Исправьте значение в настройках «Шаги».'
                            : 'Укажите рост (и при желании вес) в экране «Шаги» — здесь появятся рекомендуемые высоты стола сидя и стоя.'}
                        </ThemedText>
                        <Pressable
                          onPress={() => router.push('/steps')}
                          style={({ pressed }) => [
                            styles.deskStepsLink,
                            { borderColor: border },
                            pressed && styles.buttonPressed,
                          ]}
                        >
                          <ThemedText style={[styles.deskStepsLinkText, { color: primary }]}>
                            Открыть «Шаги»
                          </ThemedText>
                          <MaterialIcons name="chevron-right" size={20} color={primary} />
                        </Pressable>
                      </>
                    )}
                  </View>

                  <Pressable
                    onPress={() => setIsEditingProfile(true)}
                    style={({ pressed }) => [
                      styles.editButton,
                      { borderColor: primary },
                      pressed && styles.buttonPressed,
                    ]}
                  >
                    <MaterialIcons name="edit" size={20} color={primary} />
                    <ThemedText style={[styles.editButtonText, { color: primary }]}>
                      Редактировать профиль
                    </ThemedText>
                  </Pressable>

                  <Button
                    title={isLoggingOut ? 'Выходим...' : 'Выйти из аккаунта'}
                    onPress={handleLogout}
                    variant="secondary"
                    disabled={isLoggingOut}
                  />
                </>
              )}

              {/* Режим редактирования */}
              {isEditingProfile && (
                <>
                  <ThemedText style={styles.sectionTitle}>Редактирование профиля</ThemedText>
                  <ThemedText style={[styles.sectionSubtitle, { color: textMuted }]}>
                    Измените данные и нажмите «Сохранить»
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
                        <MaterialIcons name="check-circle" size={20} color={success} />
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
                          <MaterialIcons name="hourglass-empty" size={20} color={textMuted} />
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
                            disabled={isVerifying || verificationCode.length !== 6}
                            style={({ pressed }) => [
                              styles.okButton,
                              { backgroundColor: primary },
                              (isVerifying || verificationCode.length !== 6) && styles.buttonDisabled,
                              pressed && styles.buttonPressed,
                            ]}
                          >
                            {isVerifying ? (
                              <MaterialIcons name="hourglass-empty" size={18} color="#fff" />
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

                  <View style={styles.editActions}>
                    <Pressable
                      onPress={() => {
                        setIsEditingProfile(false);
                        setProfileError('');
                        setProfileSuccess('');
                      }}
                      style={({ pressed }) => [
                        styles.cancelButton,
                        { borderColor: border },
                        pressed && styles.buttonPressed,
                      ]}
                    >
                      <ThemedText style={[styles.cancelButtonText, { color: text }]}>
                        Отмена
                      </ThemedText>
                    </Pressable>
                    <View style={styles.saveButtonWrap}>
                      <Button
                        title={isSavingProfile ? 'Сохранение...' : 'Сохранить'}
                        onPress={async () => {
                          const ok = await handleSaveProfile();
                          if (ok) setIsEditingProfile(false);
                        }}
                        disabled={isSavingProfile}
                      />
                    </View>
                  </View>
                  {profileError ? (
                    <ThemedText style={[styles.errorText, { color: errorColor }]}>
                      {profileError}
                    </ThemedText>
                  ) : null}
                  {profileSuccess ? (
                    <ThemedText style={[styles.successText, { color: success }]}>
                      {profileSuccess}
                    </ThemedText>
                  ) : null}
                </>
              )}
            </>
          )}

          {activeTab === 'password' && (
            <>
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
            </>
          )}

          {activeTab === 'logs' && role && ['admin-worker', 'department-head', 'manager'].includes(role) && (
            <LogsViewer userRole={role} />
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
    gap: 22,
    flexGrow: 1,
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
  profileName: {
    fontSize: 22,
    fontWeight: '600',
  },
  profileSubtitle: {
    fontSize: 15,
    marginTop: -8,
  },
  profileBlock: {
    width: '100%',
    marginTop: 4,
  },
  deskSection: {
    width: '100%',
    marginTop: 8,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  deskSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  deskSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  deskMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  deskHeightsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  deskHeightCard: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 4,
  },
  deskHeightLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  deskHeightValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  deskStepsLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  deskStepsLinkText: {
    fontSize: 15,
    fontWeight: '600',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    gap: 12,
    minHeight: 52,
  },
  infoRowBorder: {
    borderBottomWidth: 1,
  },
  infoLabel: {
    fontSize: 15,
    minWidth: 72,
  },
  infoValue: {
    flex: 1,
    fontSize: 16,
    fontWeight: '500',
    textAlign: 'right',
    flexShrink: 1,
  },
  infoValueWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    marginTop: 8,
  },
  editButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  editActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'stretch',
    flexWrap: 'wrap',
  },
  cancelButton: {
    flex: 1,
    minWidth: 100,
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  saveButtonWrap: {
    flex: 1,
    minWidth: 100,
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
  errorText: {
    fontSize: 14,
  },
  successText: {
    fontSize: 14,
  },
});
