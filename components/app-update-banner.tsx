import { MaterialIcons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { Radius, Spacing } from '@/constants/theme';
import { useAppUpdate } from '@/hooks/use-app-update';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Плавающая кнопка, которая появляется поверх интерфейса, когда доступно
 * OTA-обновление (EAS Update). Нажатие скачивает обновление и перезапускает
 * приложение с новой версией.
 */
export function AppUpdateBanner() {
  const { isAvailable, isApplying, applyUpdate } = useAppUpdate();
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');

  if (!isAvailable) return null;

  return (
    <View
      style={[styles.container, { bottom: insets.bottom + Spacing.lg }]}
      pointerEvents="box-none"
    >
      <View style={[styles.card, { backgroundColor: background }]}>
        <Button
          title={isApplying ? 'Обновление…' : 'Обновить'}
          onPress={applyUpdate}
          loading={isApplying}
          leftIcon={
            !isApplying ? (
              <MaterialIcons name="system-update" size={18} color={primary} />
            ) : undefined
          }
          variant="outline"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: Spacing.lg,
    right: Spacing.lg,
    alignItems: 'stretch',
  },
  card: {
    borderRadius: Radius.sm,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
});
