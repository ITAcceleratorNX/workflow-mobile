import { useCallback } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

import {
  NEWS_REACTION_OPTIONS,
  normalizeReactionCounts,
  type NewsReactionCounts,
  type NewsReactionKind,
} from '@/lib/news-reactions';
import { setNewsReaction } from '@/lib/news-api';

type Props = {
  newsId: number;
  reactionCounts: NewsReactionCounts;
  myReaction: NewsReactionKind | null;
  canInteract: boolean;
  /** Узкий ряд (списки / карточки на главной) */
  compact?: boolean;
  onUpdated?: (patch: { reaction_counts: NewsReactionCounts; my_reaction: NewsReactionKind | null }) => void;
};

function ReactionEmojiButton({
  emoji,
  selected,
  dimmed,
  compact,
  onPress,
}: {
  emoji: string;
  selected: boolean;
  dimmed: boolean;
  compact: boolean;
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

  const fontSize = compact ? 22 : 28;

  return (
    <Pressable onPress={handlePress} disabled={dimmed} hitSlop={8} style={styles.hit}>
      <Animated.Text style={[animStyle, { fontSize, opacity: selected ? 1 : 0.42 }]}>{emoji}</Animated.Text>
    </Pressable>
  );
}

export function NewsReactionsRow({
  newsId,
  reactionCounts,
  myReaction,
  canInteract,
  compact = false,
  onUpdated,
}: Props) {
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
    <View style={[styles.row, compact && styles.rowCompact]}>
      {NEWS_REACTION_OPTIONS.map(({ kind, emoji }) => (
        <ReactionEmojiButton
          key={kind}
          emoji={emoji}
          selected={myReaction === kind}
          dimmed={!canInteract}
          compact={compact}
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
  hit: {
    minWidth: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
