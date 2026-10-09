import { MaterialIcons } from '@expo/vector-icons';
import { useCallback } from 'react';
import { Linking, Modal, Platform, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { storeUrl, storeWebUrl } from '@/lib/app-version';
import { useRequiredUpdate } from '@/hooks/use-required-update';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Полноэкранное окно «Обновите приложение», когда эта версия больше не
 * поддерживается бэкендом. Закрыть его нельзя — только перейти в стор.
 */
export function ForceUpdateGate() {
  const required = useRequiredUpdate();
  const background = useThemeColor({}, 'background');
  const iconBackground = useThemeColor({}, 'surfaceMuted');
  const primary = useThemeColor({}, 'primary');

  const openStore = useCallback(async () => {
    try {
      await Linking.openURL(storeUrl(Platform.OS));
    } catch {
      await Linking.openURL(storeWebUrl(Platform.OS)).catch(() => {});
    }
  }, []);

  return (
    <Modal
      visible={required}
      animationType="fade"
      statusBarTranslucent
      // Android «Назад» не закрывает окно.
      onRequestClose={() => {}}
    >
      <View style={[styles.screen, { backgroundColor: background }]}>
        <View style={[styles.icon, { backgroundColor: iconBackground }]}>
          <MaterialIcons name="system-update" size={40} color={primary} />
        </View>
        <ThemedText type="title" style={styles.center}>
          Доступна новая версия
        </ThemedText>
        <ThemedText colorName="textMuted" style={styles.center}>
          Эта версия приложения больше не поддерживается. Обновите Workflow, чтобы продолжить работу.
        </ThemedText>
        <Button title="Обновить" onPress={openStore} containerStyle={styles.button} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xxl,
    gap: Spacing.lg,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  center: {
    textAlign: 'center',
  },
  button: {
    alignSelf: 'stretch',
    marginTop: Spacing.sm,
  },
});
