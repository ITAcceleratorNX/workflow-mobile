import React, { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, TextInput } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { changePassword } from '@/lib/profile-api';

export default function ChangePasswordScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const text = useThemeColor({}, 'text');
  const errorColor = useThemeColor({}, 'error');
  const border = useThemeColor({}, 'border');
  const { show: showToast } = useToast();

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  const handleChangePassword = async () => {
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
        <ThemedText style={styles.headerTitle}>Смена пароля</ThemedText>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.card, { borderColor: border }]}>
          <ThemedText style={styles.sectionTitle}>Новый пароль</ThemedText>

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
            title={isChangingPassword ? 'Смена...' : 'Сменить пароль'}
            onPress={handleChangePassword}
            disabled={isChangingPassword}
          />
          {passwordError ? (
            <ThemedText style={[styles.errorText, { color: errorColor }]}>
              {passwordError}
            </ThemedText>
          ) : null}
        </View>
      </ScrollView>
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
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 32,
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
    marginBottom: 4,
  },
  errorText: {
    fontSize: 14,
    marginTop: 8,
  },
});

