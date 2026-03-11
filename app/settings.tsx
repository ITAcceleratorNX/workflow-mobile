import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useColorScheme, setAppColorScheme } from '@/hooks/use-color-scheme';

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const colorScheme = useColorScheme();

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={8}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Настройки</ThemedText>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Уведомления */}
        <Pressable
          onPress={() => router.push('/notification-settings')}
          style={({ pressed }) => [
            styles.item,
            { borderColor: border },
            pressed && styles.itemPressed,
          ]}
        >
          <View style={styles.itemIcon}>
            <MaterialIcons name="notifications" size={22} color={primary} />
          </View>
          <View style={styles.itemText}>
            <ThemedText style={styles.itemTitle}>Уведомления</ThemedText>
            <ThemedText style={[styles.itemSubtitle, { color: muted }]}>
              Email, безопасность и маркетинг
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={muted} />
        </Pressable>

        {/* Пароль */}
        <Pressable
          onPress={() => router.push('/change-password')}
          style={({ pressed }) => [
            styles.item,
            { borderColor: border },
            pressed && styles.itemPressed,
          ]}
        >
          <View style={styles.itemIcon}>
            <MaterialIcons name="lock" size={22} color={primary} />
          </View>
          <View style={styles.itemText}>
            <ThemedText style={styles.itemTitle}>Пароль</ThemedText>
            <ThemedText style={[styles.itemSubtitle, { color: muted }]}>
              Смена пароля аккаунта
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={22} color={muted} />
        </Pressable>

        {/* Тема / цвет */}
        <View style={[styles.item, { borderColor: border }]}>
          <View style={styles.itemIcon}>
            <MaterialIcons name="palette" size={22} color={primary} />
          </View>
          <View style={styles.itemText}>
            <ThemedText style={styles.itemTitle}>Тема приложения</ThemedText>
            <ThemedText style={[styles.itemSubtitle, { color: muted }]}>
              Светлая или тёмная тема
            </ThemedText>

            <View style={styles.themeRow}>
              <Pressable
                onPress={() => setAppColorScheme('light')}
                style={[
                  styles.themeChip,
                  { borderColor: border },
                  colorScheme === 'light' && styles.themeChipActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.themeChipLabel,
                    colorScheme === 'light' && styles.themeChipLabelActive,
                  ]}
                >
                  Светлая
                </ThemedText>
              </Pressable>
              <Pressable
                onPress={() => setAppColorScheme('dark')}
                style={[
                  styles.themeChip,
                  { borderColor: border },
                  colorScheme === 'dark' && styles.themeChipActive,
                ]}
              >
                <ThemedText
                  style={[
                    styles.themeChipLabel,
                    colorScheme === 'dark' && styles.themeChipLabelActive,
                  ]}
                >
                  Тёмная
                </ThemedText>
              </Pressable>
            </View>
          </View>
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  itemPressed: {
    opacity: 0.85,
  },
  itemIcon: {
    width: 32,
    alignItems: 'center',
  },
  itemText: {
    flex: 1,
    gap: 2,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '500',
  },
  itemSubtitle: {
    fontSize: 13,
  },
  themeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  themeChipActive: {
    opacity: 0.95,
  },
  themeChipLabel: {
    fontSize: 14,
  },
  themeChipLabelActive: {
    fontWeight: '600',
  },
});

