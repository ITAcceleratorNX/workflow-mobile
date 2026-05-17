import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

import { ThemedText } from '@/components/themed-text';
import { KeyboardFormOverlay, keyboardDismissInputProps } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';

export type OfficeLocationCatalogFormValues = {
  block: string;
  floor_zone: string;
  room: string;
  sort_order: number;
};

export interface OfficeLocationCatalogFormModalProps {
  visible: boolean;
  mode: 'create' | 'edit';
  loading?: boolean;
  error?: string | null;
  defaultBlock?: string;
  defaultFloorZone?: string;
  defaultRoom?: string;
  defaultSortOrder?: number;
  onClose: () => void;
  onSubmit: (values: OfficeLocationCatalogFormValues) => Promise<void>;
}

export function OfficeLocationCatalogFormModal({
  visible,
  mode,
  loading = false,
  error,
  defaultBlock = '',
  defaultFloorZone = '',
  defaultRoom = '',
  defaultSortOrder = 0,
  onClose,
  onSubmit,
}: OfficeLocationCatalogFormModalProps) {
  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const [block, setBlock] = useState('');
  const [floorZone, setFloorZone] = useState('');
  const [room, setRoom] = useState('');
  const [sortOrder, setSortOrder] = useState('0');
  const [localError, setLocalError] = useState<string | null>(null);

  const floorRef = useRef<TextInput>(null);
  const roomRef = useRef<TextInput>(null);
  const sortRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setBlock(defaultBlock);
    setFloorZone(defaultFloorZone);
    setRoom(defaultRoom);
    setSortOrder(String(defaultSortOrder ?? 0));
    setLocalError(null);
  }, [visible, defaultBlock, defaultFloorZone, defaultRoom, defaultSortOrder]);

  const title = mode === 'create' ? 'Новый шаблон' : 'Редактирование';

  const handleSave = async () => {
    setLocalError(null);
    const n = Number(sortOrder);
    if (Number.isNaN(n)) {
      setLocalError('Укажите число для порядка сортировки');
      return;
    }
    await onSubmit({
      block: block.trim(),
      floor_zone: floorZone.trim(),
      room: room.trim(),
      sort_order: n,
    });
  };

  return (
    <KeyboardFormOverlay visible={visible} backgroundColor="rgba(0,0,0,0.5)">
      <View style={[styles.card, { backgroundColor: surfaceElevated }]}>
        <View style={styles.header}>
          <ThemedText type="subtitle" style={{ color: textColor, flex: 1 }}>
            {title}
          </ThemedText>
          <Pressable onPress={onClose} hitSlop={12} disabled={loading}>
            <MaterialIcons name="close" size={26} color={mutedColor} />
          </Pressable>
        </View>

        <ThemedText style={[styles.hint, { color: mutedColor }]}>
          Блок, этаж и помещение — как в форме заявки клиента
        </ThemedText>

        <ThemedText style={[styles.label, { color: mutedColor }]}>Блок</ThemedText>
        <TextInput
          style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
          placeholder="Например: А"
          placeholderTextColor={mutedColor}
          value={block}
          onChangeText={setBlock}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => floorRef.current?.focus()}
        />

        <ThemedText style={[styles.label, { color: mutedColor }]}>Этаж / зона</ThemedText>
        <TextInput
          ref={floorRef}
          style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
          placeholder="Например: 2 этаж"
          placeholderTextColor={mutedColor}
          value={floorZone}
          onChangeText={setFloorZone}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => roomRef.current?.focus()}
        />

        <ThemedText style={[styles.label, { color: mutedColor }]}>Помещение</ThemedText>
        <TextInput
          ref={roomRef}
          style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
          placeholder="Название помещения"
          placeholderTextColor={mutedColor}
          value={room}
          onChangeText={setRoom}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => sortRef.current?.focus()}
        />

        <ThemedText style={[styles.label, { color: mutedColor }]}>Порядок сортировки</ThemedText>
        <TextInput
          ref={sortRef}
          style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
          placeholder="0"
          placeholderTextColor={mutedColor}
          value={sortOrder}
          onChangeText={setSortOrder}
          keyboardType="numeric"
          {...keyboardDismissInputProps()}
        />

        {error || localError ? (
          <ThemedText style={styles.error}>{error || localError}</ThemedText>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            onPress={handleSave}
            disabled={loading}
            style={({ pressed }) => [
              styles.btn,
              { backgroundColor: primary, borderColor: primary },
              loading && styles.btnDisabled,
              pressed && !loading && styles.btnPressed,
            ]}
          >
            {loading ? (
              <ThemedText style={{ color: onPrimary, fontWeight: '600' }}>Сохранение...</ThemedText>
            ) : (
              <ThemedText style={{ color: onPrimary, fontWeight: '600' }}>Сохранить</ThemedText>
            )}
          </Pressable>
          <Pressable
            onPress={onClose}
            disabled={loading}
            style={({ pressed }) => [
              styles.btn,
              { borderColor },
              pressed && styles.btnPressed,
            ]}
          >
            <ThemedText style={{ color: textColor, fontWeight: '600' }}>Отмена</ThemedText>
          </Pressable>
        </View>
      </View>
    </KeyboardFormOverlay>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    padding: 20,
    gap: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 4,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
    marginTop: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
    minHeight: 44,
  },
  error: {
    color: '#DC2626',
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  btn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
  btnPressed: { opacity: 0.85 },
  btnDisabled: { opacity: 0.5 },
});
