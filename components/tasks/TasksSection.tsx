import { View, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { TasksTodayCard } from './TasksTodayCard';
import { useThemeColor } from '@/hooks/use-theme-color';

export type TasksSectionLayout = 'standalone' | 'embedded';

type TasksSectionProps = {
  /**
   * `embedded` — внутри ScrollView, у которого уже есть горизонтальные отступы (как сетка карточек на главной admin/executor).
   * Иначе заголовок и карточка получают лишний inset и сужаются относительно соседних карточек.
   */
  layout?: TasksSectionLayout;
};

export function TasksSection({ layout = 'standalone' }: TasksSectionProps) {
  const router = useRouter();

  const text = useThemeColor({}, 'text');
  const embedded = layout === 'embedded';

  return (
    <View style={[styles.section, embedded && styles.sectionEmbedded]}>
      <ThemedText style={[styles.sectionTitle, embedded && styles.sectionTitleEmbedded, { color: text }]}>
        Задачи
      </ThemedText>

      <TasksTodayCard
        flushHorizontal={embedded}
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          router.push({ pathname: '/client/tasks', params: { view: 'list', tab: 'today' } });
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginBottom: 24,
  },
  /** Как блок «Smart Control» на главной клиента: отступ сверху от предыдущего контента, без двойного padding по горизонтали */
  sectionEmbedded: {
    marginTop: 24,
    marginBottom: 0,
    alignSelf: 'stretch',
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  /** Совпадает с `sectionTitle` главной клиента (рядом со Smart Control): без лишнего inset, жирный заголовок секции */
  sectionTitleEmbedded: {
    paddingHorizontal: 0,
    marginBottom: 16,
    fontWeight: '700',
  },
});
