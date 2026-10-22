import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';
import type { Office } from '@/lib/api';
import { getPrimaryPhotoUri } from '@/lib/image-uri';

const ACCENT = '#E35B21';

/** Цвета карточек по макету (тёмная тема) и их светлый вариант. */
const PALETTE = {
  dark: {
    text: '#FFFFFF',
    address: 'rgba(255,255,255,0.78)',
    muted: 'rgba(255,255,255,0.55)',
    heading: 'rgba(255,255,255,0.7)',
    card: 'rgba(255,255,255,0.10)',
    border: 'rgba(255,255,255,0.2)',
    selected: 'rgba(227,91,33,0.18)',
    photo: '#222222',
    icon: 'rgba(255,255,255,0.35)',
  },
  light: {
    text: '#11181C',
    address: 'rgba(17,24,28,0.78)',
    muted: 'rgba(17,24,28,0.55)',
    heading: 'rgba(17,24,28,0.6)',
    card: '#F2F2F7',
    border: 'rgba(15,23,42,0.12)',
    selected: 'rgba(227,91,33,0.12)',
    photo: '#E5E5EA',
    icon: 'rgba(17,24,28,0.3)',
  },
} as const;

function usePalette() {
  return PALETTE[useColorScheme()];
}

function pluralOffices(n: number) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return 'офис';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'офиса';
  return 'офисов';
}

/** «Блок 1 · 1 этаж» — из полей офиса, пусто, если их нет. */
export function officePlaceLine(office: Pick<Office, 'block' | 'floor'>): string {
  const block = office.block?.toString().trim();
  const floor = office.floor?.toString().trim();
  return [block ? `Блок ${block}` : null, floor ? `${floor} этаж` : null].filter(Boolean).join(' · ');
}

/** Офисы по городам в исходном порядке; без города — «Другие». */
export function groupOfficesByCity(offices: Office[]): { city: string; offices: Office[] }[] {
  const groups = new Map<string, Office[]>();
  for (const office of offices) {
    const city = office.city?.trim() || 'Другие';
    groups.set(city, [...(groups.get(city) ?? []), office]);
  }
  return [...groups].map(([city, list]) => ({ city, offices: list }));
}

/** Фото офиса; без фото или при ошибке загрузки — заглушка с иконкой здания. */
export function OfficePhoto({ office, style }: { office: Office; style?: object }) {
  const c = usePalette();
  const uri = getPrimaryPhotoUri(office);
  const [failedUri, setFailedUri] = useState<string | null>(null);
  if (!uri || failedUri === uri) {
    return (
      <View style={[styles.photo, styles.placeholder, { backgroundColor: c.photo }, style]}>
        <MaterialIcons name="apartment" size={30} color={c.icon} />
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[styles.photo, { backgroundColor: c.photo }, style]}
      contentFit="cover"
      transition={150}
      onError={() => setFailedUri(uri)}
      accessibilityIgnoresInvertColors
    />
  );
}

function OfficeCard({ office, selected, onPress }: { office: Office; selected: boolean; onPress: () => void }) {
  const c = usePalette();
  const place = officePlaceLine(office);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={[office.name, office.address, place].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: c.card, borderColor: c.border },
        selected && styles.cardSelected,
        selected && { backgroundColor: c.selected },
        pressed && { opacity: 0.85 },
      ]}
    >
      <OfficePhoto office={office} />
      <View style={styles.info}>
        <Text style={[styles.name, { color: c.text }]} numberOfLines={2}>
          {office.name}
        </Text>
        {office.address ? (
          <View style={styles.addressRow}>
            <MaterialIcons name="place" size={12} color={c.heading} />
            <Text style={[styles.address, { color: c.address }]} numberOfLines={1}>
              {office.address}
            </Text>
          </View>
        ) : null}
        {place ? <Text style={[styles.place, { color: c.muted }]}>{place}</Text> : null}
      </View>
    </Pressable>
  );
}

/**
 * Выбор офиса карточками (макет «Создать заявку — 1. Офис»): по городам, фото, адрес, блок и этаж.
 * `onCardLayout` отдаёт смещение карточки внутри сетки — чтобы доскроллить до выбранной.
 */
export function OfficePickerGrid({
  offices,
  selectedId,
  onSelect,
  onCardLayout,
}: {
  offices: Office[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  onCardLayout?: (officeId: number, y: number) => void;
}) {
  const c = usePalette();
  const [groupY, setGroupY] = useState<Record<string, number>>({});
  return (
    <View style={{ gap: 18 }}>
      {groupOfficesByCity(offices).map((group) => (
        <View
          key={group.city}
          style={{ gap: 14 }}
          onLayout={(e: LayoutChangeEvent) => {
            const y = e.nativeEvent.layout.y;
            setGroupY((prev) => (prev[group.city] === y ? prev : { ...prev, [group.city]: y }));
          }}
        >
          <Text style={[styles.groupTitle, { color: c.heading }]}>
            {group.city} · {group.offices.length} {pluralOffices(group.offices.length)}
          </Text>
          <View style={styles.grid}>
            {group.offices.map((office) => (
              <View
                key={office.id}
                style={styles.cell}
                onLayout={(e) => onCardLayout?.(office.id, (groupY[group.city] ?? 0) + e.nativeEvent.layout.y)}
              >
                <OfficeCard office={office} selected={selectedId === office.id} onPress={() => onSelect(office.id)} />
              </View>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  groupTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 13, columnGap: 13 },
  cell: { width: '48%', flexGrow: 1, maxWidth: '50%' },
  card: {
    flex: 1,
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardSelected: {
    borderWidth: 2,
    borderColor: ACCENT,
  },
  photo: { width: '100%', height: 112 },
  placeholder: { alignItems: 'center', justifyContent: 'center' },
  info: { paddingTop: 11, paddingHorizontal: 11, paddingBottom: 13, gap: 5 },
  name: { fontSize: 15, fontWeight: '600', lineHeight: 19 },
  addressRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  address: { flex: 1, fontSize: 12 },
  place: { fontSize: 11, fontWeight: '500' },
});
