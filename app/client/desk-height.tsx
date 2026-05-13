import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScrollView } from 'react-native';

import { SmartDeskCalculator } from '@/components/smart-office/smart-desk-calculator';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';

/**
 * Отдельный экран с полным калькулятором высоты стола (данные из «Шаги»).
 * Вход: умный офис, настройки шагов или прямой переход.
 */
export default function ClientDeskHeightScreen() {
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');

  return (
    <ThemedView style={{ flex: 1, paddingTop: insets.top, backgroundColor: background }}>
      <ScreenHeader title="Высота рабочего стола" />
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: insets.bottom + 24, flexGrow: 1 }}
        showsVerticalScrollIndicator={false}
      >
        <SmartDeskCalculator variant="smartOffice" containerStyle={{ marginHorizontal: 16, marginTop: 8 }} />
      </ScrollView>
    </ThemedView>
  );
}
