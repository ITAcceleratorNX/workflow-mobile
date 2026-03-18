import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';

type Props = {
  title: string;
  tag?: string;
  dateLabel?: string | null;
  description?: string;
  imageUrl?: string | null;
  rightSlot?: React.ReactNode;
  onPress?: () => void;
};

export function NewsListItem({
  title,
  tag = 'Новость',
  dateLabel,
  description,
  imageUrl,
  rightSlot,
  onPress,
}: Props) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const content = (
    <View style={[styles.card, { backgroundColor: cardBg, borderColor: border }]}>
      <View style={styles.imageWrap}>
        {imageUrl ? (
          <Image source={{ uri: imageUrl }} style={styles.image} contentFit="cover" />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: '#111827' }]}>
            <MaterialIcons name="image" size={34} color={textMuted} />
          </View>
        )}
        {rightSlot ? <View style={styles.rightSlot}>{rightSlot}</View> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.metaRow}>
          <View style={[styles.tag, { backgroundColor: primary }]}>
            <ThemedText style={styles.tagText}>{tag}</ThemedText>
          </View>
          {dateLabel ? (
            <ThemedText style={[styles.dateText, { color: textMuted }]} numberOfLines={1}>
              {dateLabel}
            </ThemedText>
          ) : null}
        </View>

        <ThemedText style={[styles.title, { color: text }]} numberOfLines={2}>
          {title}
        </ThemedText>

        {description ? (
          <ThemedText style={[styles.desc, { color: textMuted }]} numberOfLines={3}>
            {description}
          </ThemedText>
        ) : null}
      </View>
    </View>
  );

  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ opacity: pressed ? 0.92 : 1 }]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: 16,
    overflow: 'hidden',
  },
  imageWrap: {
    position: 'relative',
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: '#0B1220',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  rightSlot: {
    position: 'absolute',
    right: 10,
    top: 10,
  },
  body: {
    padding: 12,
    gap: 8,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  dateText: {
    fontSize: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '800',
    lineHeight: 20,
  },
  desc: {
    fontSize: 13,
    lineHeight: 18,
  },
});

