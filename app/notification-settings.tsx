import React, { useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import { updateNotificationsSettings } from '@/lib/profile-api';
import { useAuthStore, type AuthState } from '@/stores/auth-store';

export default function NotificationSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const { show: showToast } = useToast();

  const user = useAuthStore((s: AuthState) => s.user);
  const updateUser = useAuthStore((s: AuthState) => s.updateUser);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!user) {
    return null;
  }

  const handleToggle = (key: 'email_notifications' | 'security_notifications' | 'marketing_notifications', value: boolean) => {
    updateUser((prev) =>
      prev ? { ...prev, [key]: value } as any : prev
    );
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    setError('');
    const result = await updateNotificationsSettings({
      emailNotifications: user.email_notifications,
      securityNotifications: user.security_notifications,
      marketingNotifications: user.marketing_notifications,
    });
    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    showToast({
      title: 'Настройки уведомлений сохранены',
      variant: 'success',
    });
    router.back();
  };

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Уведомления</ThemedText>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.row, { borderColor: border }]}>
          <View style={styles.rowText}>
            <ThemedText style={styles.rowTitle}>Email уведомления</ThemedText>
            <ThemedText style={[styles.rowSubtitle, { color: muted }]}>
              Статусы заявок и бронирований
            </ThemedText>
          </View>
          <Switch
            value={user.email_notifications ?? false}
            onValueChange={(v) => handleToggle('email_notifications', v)}
            trackColor={{ false: border, true: primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.row, { borderColor: border }]}>
          <View style={styles.rowText}>
            <ThemedText style={styles.rowTitle}>Безопасность</ThemedText>
            <ThemedText style={[styles.rowSubtitle, { color: muted }]}>
              Входы, подозрительная активность
            </ThemedText>
          </View>
          <Switch
            value={user.security_notifications ?? false}
            onValueChange={(v) => handleToggle('security_notifications', v)}
            trackColor={{ false: border, true: primary }}
            thumbColor="#fff"
          />
        </View>

        <View style={[styles.row, { borderColor: border }]}>
          <View style={styles.rowText}>
            <ThemedText style={styles.rowTitle}>Маркетинг</ThemedText>
            <ThemedText style={[styles.rowSubtitle, { color: muted }]}>
              Новости и предложения
            </ThemedText>
          </View>
          <Switch
            value={user.marketing_notifications ?? false}
            onValueChange={(v) => handleToggle('marketing_notifications', v)}
            trackColor={{ false: border, true: primary }}
            thumbColor="#fff"
          />
        </View>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={({ pressed }) => [
            styles.saveButton,
            { backgroundColor: primary },
            saving && styles.saveButtonDisabled,
            pressed && !saving && styles.saveButtonPressed,
          ]}
        >
          <ThemedText style={styles.saveButtonText}>
            {saving ? 'Сохранение...' : 'Сохранить'}
          </ThemedText>
        </Pressable>

        {error ? (
          <ThemedText style={[styles.errorText, { color: 'red' }]}>
            {error}
          </ThemedText>
        ) : null}
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
    padding: 4,
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
    gap: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: 13,
  },
  saveButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonPressed: {
    opacity: 0.9,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    marginTop: 8,
    fontSize: 14,
  },
});

