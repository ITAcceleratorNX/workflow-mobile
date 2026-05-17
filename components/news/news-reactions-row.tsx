import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { MaterialIcons } from '@expo/vector-icons';

import {
  NEWS_REACTION_OPTIONS,
  normalizeReactionCounts,
  type NewsReactionCounts,
  type NewsReactionKind,
  type NewsReactionMaterialIcon,
} from '@/lib/news-reactions';
import { setNewsReaction } from '@/lib/news-api';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  newsId: number;
  reactionCounts: NewsReactionCounts;
  myReaction: NewsReactionKind | null;
  canInteract: boolean;
  /** Узкий ряд (списки / карточки на главной) */
  compact?: boolean;
  /** Ряд по центру ширины родителя (лента на главной, список новостей) */
  centered?: boolean;
  onUpdated?: (patch: { reaction_counts: NewsReactionCounts; my_reaction: NewsReactionKind | null }) => void;
};

function ReactionIconButton({
  icon,
  selected,
  dimmed,
  compact,
  activeColor,
  inactiveColor,
  onPress,
}: {
  icon: NewsReactionMaterialIcon;
  selected: boolean;
  dimmed: boolean;
  compact: boolean;
  activeColor: string;
  inactiveColor: string;
  onPress: () => void;
}) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    scale.value = withSequence(
      withSpring(1.28, { damping: 9, stiffness: 320 }),
      withSpring(1, { damping: 12, stiffness: 260 })
    );
    onPress();
  }, [onPress, scale]);

  const size = compact ? 22 : 28;
  const color = dimmed ? inactiveColor : selected ? activeColor : inactiveColor;

  return (
    <Pressable onPress={handlePress} disabled={dimmed} hitSlop={8} style={styles.hit}>
      <Animated.View style={[animStyle, { opacity: dimmed ? 0.35 : selected ? 1 : 0.45 }]}>
        <MaterialIcons name={icon} size={size} color={color} />
      </Animated.View>
    </Pressable>
  );
}

export function NewsReactionsRow({
  newsId,
  reactionCounts,
  myReaction,
  canInteract,
  compact = false,
  centered = false,
  onUpdated,
}: Props) {
  const primary = useThemeColor({}, 'primary');
  const textMuted = useThemeColor({}, 'textMuted');

  const counts = normalizeReactionCounts(reactionCounts);

  const handleChoose = useCallback(
    async (kind: NewsReactionKind) => {
      if (!canInteract) return;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      const prev = myReaction;
      const prevCounts = { ...counts };

      if (prev !== kind) {
        const optimisticMy: NewsReactionKind = kind;
        const optimisticCounts = { ...counts };
        if (prev) {
          optimisticCounts[prev] = Math.max(0, optimisticCounts[prev] - 1);
        }
        optimisticCounts[kind] = optimisticCounts[kind] + 1;
        onUpdated?.({ reaction_counts: optimisticCounts, my_reaction: optimisticMy });
      }

      const res = await setNewsReaction(newsId, kind);
      if (res.ok) {
        const data = res.data;
        const rc = normalizeReactionCounts(data.reaction_counts as NewsReactionCounts | undefined);
        const mr = (data.my_reaction as NewsReactionKind | null | undefined) ?? null;
        onUpdated?.({ reaction_counts: rc, my_reaction: mr });
      } else if (prev !== kind) {
        onUpdated?.({ reaction_counts: prevCounts, my_reaction: prev });
      }
    },
    [canInteract, newsId, myReaction, counts, onUpdated]
  );

  return (
    <View style={[styles.row, compact && styles.rowCompact, centered && styles.rowCentered]}>
      {NEWS_REACTION_OPTIONS.map(({ kind, icon }) => (
        <ReactionIconButton
          key={kind}
          icon={icon}
          selected={myReaction === kind}
          dimmed={!canInteract}
          compact={compact}
          activeColor={primary}
          inactiveColor={textMuted}
          onPress={() => void handleChoose(kind)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 14,
    paddingVertical: 4,
  },
  rowCompact: {
    gap: 10,
    paddingVertical: 2,
  },
  rowCentered: {
    justifyContent: 'center',
    alignSelf: 'stretch',
    width: '100%',
  },
  hit: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
