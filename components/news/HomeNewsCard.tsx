import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { useCallback, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { useProductUi } from '@/hooks/use-product-ui';
import { normalizeReactionCounts, type NewsReactionCounts, type NewsReactionKind } from '@/lib/news-reactions';
import { setNewsReaction, type NewsDisplayItem } from '@/lib/news-api';

const HOME_REACTIONS: { kind: NewsReactionKind; icon: 'thumb-up' | 'favorite' | 'whatshot' }[] = [
  { kind: 'thumb', icon: 'thumb-up' },
  { kind: 'heart', icon: 'favorite' },
  { kind: 'fire', icon: 'whatshot' },
];

type EngagementPatch = { reaction_counts: NewsReactionCounts; my_reaction: NewsReactionKind | null };

type Props = {
  item: NewsDisplayItem;
  canInteract: boolean;
  onPress: () => void;
  onUpdated: (patch: EngagementPatch) => void;
};

function dateLabel(item: NewsDisplayItem): string {
  const raw = item.publishedAtIso ?? item.date;
  if (!raw) return '';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(raw);
  if (!match) return '';
  const months = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
  return `${Number(match[3])} ${months[Number(match[2]) - 1] ?? ''}`.trim();
}

export function HomeNewsCard({ item, canInteract, onPress, onUpdated }: Props) {
  const ui = useProductUi();
  const { width: viewportWidth } = useWindowDimensions();
  const cardRef = useRef<View>(null);
  const [picker, setPicker] = useState<{ left: number; top: number } | null>(null);
  const counts = normalizeReactionCounts(item.reaction_counts);
  const cardWidth = Math.max(252, viewportWidth - 88);
  const menuWidth = 180;

  const openPicker = useCallback(() => {
    if (!canInteract) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    cardRef.current?.measureInWindow((x, y, measuredWidth) => {
      setPicker({
        left: Math.max(12, Math.min(x + measuredWidth / 2 - menuWidth / 2, viewportWidth - menuWidth - 12)),
        top: Math.max(12, y - 66),
      });
    });
  }, [canInteract, menuWidth, viewportWidth]);

  const chooseReaction = useCallback(async (kind: NewsReactionKind) => {
    setPicker(null);
    const previous = normalizeReactionCounts(item.reaction_counts);
    const previousReaction = item.my_reaction ?? null;
    const next = { ...previous };
    if (previousReaction !== kind) {
      if (previousReaction) next[previousReaction] = Math.max(0, next[previousReaction] - 1);
      next[kind] += 1;
      onUpdated({ reaction_counts: next, my_reaction: kind });
    }
    const result = await setNewsReaction(Number(item.id), kind);
    if (result.ok) {
      onUpdated({
        reaction_counts: normalizeReactionCounts(result.data.reaction_counts),
        my_reaction: result.data.my_reaction ?? null,
      });
    } else if (previousReaction !== kind) {
      onUpdated({ reaction_counts: previous, my_reaction: previousReaction });
    }
  }, [item.id, item.my_reaction, item.reaction_counts, onUpdated]);

  return (
    <View ref={cardRef} style={[styles.card, { width: cardWidth, backgroundColor: ui.surface, borderColor: ui.fg(0.06) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${item.title}. ${dateLabel(item)}. Нажмите, чтобы открыть новость${canInteract ? ', или удерживайте для выбора реакции' : ''}`}
        onPress={onPress}
        onLongPress={openPicker}
        delayLongPress={350}
        style={({ pressed }) => [styles.cardPressable, pressed && styles.pressed]}
      >
        {item.image ? (
          <Image source={{ uri: item.image }} style={styles.thumbnail} contentFit="cover" transition={150} />
        ) : (
          <View accessibilityElementsHidden style={[styles.thumbnail, { backgroundColor: ui.raised }]} />
        )}
        <View style={styles.copy}>
          {dateLabel(item) ? <Text style={[styles.date, { color: ui.fg(0.5) }]}>{dateLabel(item)}</Text> : null}
          <Text numberOfLines={2} style={[styles.title, { color: ui.fg() }]}>{item.title}</Text>
          <View style={styles.reactions}>
            {HOME_REACTIONS.map(({ kind, icon }) => {
              const selected = item.my_reaction === kind;
              return (
                <View key={kind} style={styles.reaction}>
                  <MaterialIcons name={icon} size={19} color={selected ? ui.accent : ui.fg(0.48)} />
                  <Text style={[styles.reactionCount, { color: selected ? ui.accent : ui.fg(0.48) }]}>{counts[kind]}</Text>
                </View>
              );
            })}
          </View>
        </View>
      </Pressable>

      <Modal transparent visible={picker != null} animationType="fade" statusBarTranslucent onRequestClose={() => setPicker(null)}>
        <View style={styles.modalRoot}>
          <Pressable accessibilityRole="button" accessibilityLabel="Закрыть выбор реакции" onPress={() => setPicker(null)} style={StyleSheet.absoluteFill} />
          {picker ? (
            <View style={[styles.picker, { left: picker.left, top: picker.top, width: menuWidth, backgroundColor: ui.raised, borderColor: ui.fg(0.08) }]}>
              {HOME_REACTIONS.map(({ kind, icon }) => {
                const selected = item.my_reaction === kind;
                return (
                  <Pressable
                    key={kind}
                    accessibilityRole="button"
                    accessibilityLabel={`${kind === 'thumb' ? 'Нравится' : kind === 'heart' ? 'Сердце' : 'Огонь'}${selected ? ', выбрано' : ''}`}
                    onPress={() => void chooseReaction(kind)}
                    style={({ pressed }) => [styles.pickerOption, selected && { backgroundColor: ui.accentSoft }, pressed && styles.pressed]}
                  >
                    <MaterialIcons name={icon} size={27} color={selected ? ui.accent : ui.fg()} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  cardPressable: { minHeight: 104, flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10 },
  pressed: { opacity: 0.78 },
  thumbnail: { width: 84, height: 84, borderRadius: 14 },
  copy: { flex: 1, minWidth: 0, alignSelf: 'stretch', justifyContent: 'center', gap: 4 },
  date: { fontSize: 13, lineHeight: 17 },
  title: { fontSize: 16, lineHeight: 21, fontWeight: '600' },
  reactions: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 1 },
  reaction: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  reactionCount: { fontSize: 13, lineHeight: 18 },
  modalRoot: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.58)' },
  picker: { position: 'absolute', height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around', borderRadius: 30, borderWidth: 1, paddingHorizontal: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.3, shadowRadius: 14, elevation: 8 },
  pickerOption: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
});
