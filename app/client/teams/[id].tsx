import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ScreenHeader } from '@/components/ui';
import { TeamFormScreen } from '@/components/teams/TeamFormScreen';
import { useThemeColor } from '@/hooks/use-theme-color';

export default function TeamEditScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const teamId = id ? parseInt(id, 10) : NaN;
  const insets = useSafeAreaInsets();
  const background = useThemeColor({}, 'background');
  const textMuted = useThemeColor({}, 'textMuted');

  if (!Number.isFinite(teamId)) {
    return (
      <ThemedView style={{ flex: 1, paddingTop: insets.top, backgroundColor: background }}>
        <ScreenHeader title="Команда" />
        <View style={{ padding: 16 }}>
          <ThemedText style={{ color: textMuted }}>Некорректная ссылка</ThemedText>
        </View>
      </ThemedView>
    );
  }

  return <TeamFormScreen teamId={teamId} />;
}
