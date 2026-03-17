import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PullToRefresh } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import * as ImagePicker from 'expo-image-picker';
import {
  type Office,
  type MeetingRoom,
  getOffices,
  getOfficeRooms,
  updateOfficeWorkingHours,
  updateOffice,
  updateOfficeWithPhoto,
  createOffice,
  createOfficeWithPhoto,
  deleteOffice,
  createMeetingRoom,
  updateMeetingRoom,
  deleteMeetingRoom,
} from '@/lib/api';

/** "HH:mm" or "HH:mm:ss" -> "HH:mm:ss" */
function toHHmmss(v: string): string {
  const s = (v || '').trim();
  if (!s) return '';
  const parts = s.split(':');
  if (parts.length >= 3) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:${parts[2].padStart(2, '0')}`;
  if (parts.length === 2) return `${parts[0].padStart(2, '0')}:${parts[1].padStart(2, '0')}:00`;
  if (parts.length === 1 && /^\d{1,2}$/.test(parts[0])) return `${parts[0].padStart(2, '0')}:00:00`;
  return s;
}

/** "HH:mm:ss" -> "HH:mm" for display */
function toHHmm(v: string | null | undefined): string {
  if (!v || typeof v !== 'string') return '';
  const parts = v.trim().split(':');
  if (parts.length >= 2) return `${parts[0]}:${parts[1]}`;
  return v;
}

export default function AdminWorkerOfficeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show } = useToast();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');

  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [startInput, setStartInput] = useState('');
  const [endInput, setEndInput] = useState('');
  const [autoTrack, setAutoTrack] = useState(false);
  const [editName, setEditName] = useState('');
  const [editAddress, setEditAddress] = useState('');
  const [editCity, setEditCity] = useState('');
  const [savingDataId, setSavingDataId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newAddress, setNewAddress] = useState('');
  const [newCity, setNewCity] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [newOfficePhoto, setNewOfficePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);
  const [editOfficePhoto, setEditOfficePhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // Управление комнатами внутри офиса
  const [showAddRoom, setShowAddRoom] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomFloor, setNewRoomFloor] = useState('');
  const [newRoomCapacity, setNewRoomCapacity] = useState('');
  const [roomCreateError, setRoomCreateError] = useState<string | null>(null);
  const [isCreatingRoom, setIsCreatingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<number | null>(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [editRoomFloor, setEditRoomFloor] = useState('');
  const [editRoomCapacity, setEditRoomCapacity] = useState('');
  const [savingRoomId, setSavingRoomId] = useState<number | null>(null);
  const [deletingRoomId, setDeletingRoomId] = useState<number | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    const list = await getOffices();
    setOffices(list);
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const loadRooms = useCallback(async (officeId: number) => {
    setRoomsLoading(true);
    const result = await getOfficeRooms(officeId);
    if (result.ok) setRooms(result.data);
    else setRooms([]);
    setRoomsLoading(false);
  }, []);

  const expand = useCallback(
    async (office: Office) => {
      const id = office.id;
      if (expandedId === id) {
        setExpandedId(null);
        setShowAddRoom(false);
        setEditingRoomId(null);
        setRoomCreateError(null);
        setEditOfficePhoto(null);
        return;
      }
      setExpandedId(id);
      setShowAddRoom(false);
      setEditingRoomId(null);
      setRoomCreateError(null);
      setEditOfficePhoto(null);
      setStartInput(toHHmm(office.working_hours_start ?? ''));
      setEndInput(toHHmm(office.working_hours_end ?? ''));
      setAutoTrack(!!office.auto_track_enabled);
      setEditName(office.name ?? '');
      setEditAddress(office.address ?? '');
      setEditCity(office.city ?? '');
      setRooms([]);
      await loadRooms(id);
    },
    [expandedId, loadRooms]
  );

  const handleAddRoom = useCallback(
    async (officeId: number) => {
      const name = newRoomName.trim();
      if (!name) {
        setRoomCreateError('Введите название комнаты');
        return;
      }
      const floor = parseInt(newRoomFloor, 10);
      const capacity = parseInt(newRoomCapacity, 10);
      if (Number.isNaN(floor) || floor < 0) {
        setRoomCreateError('Этаж — число ≥ 0');
        return;
      }
      if (Number.isNaN(capacity) || capacity < 1) {
        setRoomCreateError('Вместимость — число ≥ 1');
        return;
      }
      setRoomCreateError(null);
      setIsCreatingRoom(true);
      const result = await createMeetingRoom({
        name,
        office_id: officeId,
        floor,
        capacity,
      });
      if (result.ok) {
        show({ title: 'Переговорная добавлена', variant: 'success' });
        setNewRoomName('');
        setNewRoomFloor('');
        setNewRoomCapacity('');
        setShowAddRoom(false);
        await loadRooms(officeId);
      } else {
        setRoomCreateError(result.error);
      }
      setIsCreatingRoom(false);
    },
    [newRoomName, newRoomFloor, newRoomCapacity, show, loadRooms]
  );

  const startEditRoom = useCallback((room: MeetingRoom) => {
    setEditingRoomId(room.id);
    setEditRoomName(room.name ?? '');
    setEditRoomFloor(String(room.floor ?? 0));
    setEditRoomCapacity(String(room.capacity ?? 1));
  }, []);

  const cancelEditRoom = useCallback(() => {
    setEditingRoomId(null);
  }, []);

  const saveRoom = useCallback(
    async (roomId: number, officeId: number) => {
      const name = editRoomName.trim();
      if (!name) {
        show({ title: 'Введите название комнаты', variant: 'destructive' });
        return;
      }
      const floor = parseInt(editRoomFloor, 10);
      const capacity = parseInt(editRoomCapacity, 10);
      if (Number.isNaN(floor) || floor < 0 || Number.isNaN(capacity) || capacity < 1) {
        show({ title: 'Этаж ≥ 0, вместимость ≥ 1', variant: 'destructive' });
        return;
      }
      setSavingRoomId(roomId);
      const result = await updateMeetingRoom(roomId, { name, floor, capacity });
      if (result.ok) {
        show({ title: 'Данные комнаты сохранены', variant: 'success' });
        setEditingRoomId(null);
        await loadRooms(officeId);
      } else {
        show({ title: 'Ошибка', description: result.error, variant: 'destructive' });
      }
      setSavingRoomId(null);
    },
    [editRoomName, editRoomFloor, editRoomCapacity, show, loadRooms]
  );

  const handleDeleteRoom = useCallback(
    (room: MeetingRoom, officeId: number) => {
      Alert.alert(
        'Удалить переговорную?',
        `Комната «${room.name}» будет удалена.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              setDeletingRoomId(room.id);
              const result = await deleteMeetingRoom(room.id);
              if (result.ok) {
                show({ title: 'Переговорная удалена', variant: 'success' });
                await loadRooms(officeId);
              } else {
                show({ title: 'Ошибка', description: result.error, variant: 'destructive' });
              }
              setDeletingRoomId(null);
            },
          },
        ]
      );
    },
    [show, loadRooms]
  );

  const pickPhotoForNew = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      show({ title: 'Нет доступа к галерее', variant: 'destructive' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) setNewOfficePhoto(result.assets[0]);
  }, [show]);

  const pickPhotoForEdit = useCallback(async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      show({ title: 'Нет доступа к галерее', variant: 'destructive' });
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled) setEditOfficePhoto(result.assets[0]);
  }, [show]);

  const saveOfficeData = useCallback(
    async (officeId: number) => {
      if (!editName.trim()) {
        show({ title: 'Введите название офиса', variant: 'destructive' });
        return;
      }
      setSavingDataId(officeId);
      let result;
      if (editOfficePhoto) {
        const fd = new FormData();
        fd.append('name', editName.trim());
        fd.append('address', editAddress.trim());
        fd.append('city', editCity.trim());
        const asset = editOfficePhoto;
        const ext = asset.uri.split('.').pop() || 'jpg';
        fd.append('photo', {
          uri: asset.uri,
          type: (asset as { mimeType?: string }).mimeType || 'image/jpeg',
          name: `photo.${ext}`,
        } as unknown as Blob);
        result = await updateOfficeWithPhoto(officeId, fd);
        setEditOfficePhoto(null);
      } else {
        result = await updateOffice(officeId, {
          name: editName.trim(),
          address: editAddress.trim() || undefined,
          city: editCity.trim() || undefined,
        });
      }
      if (result.ok) {
        show({ title: 'Данные офиса сохранены', variant: 'success' });
        setOffices((prev) =>
          prev.map((o) =>
            o.id === officeId
              ? { ...o, name: editName.trim(), address: editAddress.trim(), city: editCity.trim(), photo: result.ok ? result.data?.photo : o.photo }
              : o
          )
        );
      } else {
        show({ title: 'Ошибка', description: result.error, variant: 'destructive' });
      }
      setSavingDataId(null);
    },
    [editName, editAddress, editCity, editOfficePhoto, show]
  );

  const handleCreateOffice = useCallback(async () => {
    if (!newName.trim() || !newAddress.trim() || !newCity.trim()) {
      setCreateError('Заполните название, адрес и город');
      return;
    }
    setCreateError(null);
    setIsCreating(true);
    let result;
    if (newOfficePhoto) {
      const fd = new FormData();
      fd.append('name', newName.trim());
      fd.append('address', newAddress.trim());
      fd.append('city', newCity.trim());
      const asset = newOfficePhoto;
      const ext = asset.uri.split('.').pop() || 'jpg';
      fd.append('photo', {
        uri: asset.uri,
        type: (asset as { mimeType?: string }).mimeType || 'image/jpeg',
        name: `photo.${ext}`,
      } as unknown as Blob);
      result = await createOfficeWithPhoto(fd);
    } else {
      result = await createOffice({
        name: newName.trim(),
        address: newAddress.trim(),
        city: newCity.trim(),
      });
    }
    if (result.ok) {
      show({ title: 'Офис создан', variant: 'success' });
      setNewName('');
      setNewAddress('');
      setNewCity('');
      setNewOfficePhoto(null);
      setShowCreateForm(false);
      load();
    } else {
      setCreateError(result.error);
    }
    setIsCreating(false);
  }, [newName, newAddress, newCity, newOfficePhoto, show, load]);

  const handleDeleteOffice = useCallback(
    (office: Office) => {
      Alert.alert(
        'Удалить офис?',
        `Офис «${office.name}» будет удалён. Переговорные и привязки тоже могут быть затронуты.`,
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Удалить',
            style: 'destructive',
            onPress: async () => {
              setDeletingId(office.id);
              const result = await deleteOffice(office.id);
              if (result.ok) {
                show({ title: 'Офис удалён', variant: 'success' });
                if (expandedId === office.id) setExpandedId(null);
                load();
              } else {
                show({ title: 'Ошибка', description: result.error, variant: 'destructive' });
              }
              setDeletingId(null);
            },
          },
        ]
      );
    },
    [show, load, expandedId]
  );

  const saveWorkingHours = useCallback(
    async (officeId: number) => {
      const start = toHHmmss(startInput);
      const end = toHHmmss(endInput);
      if (!start || !end) {
        show({ title: 'Введите начало и конец рабочего дня', variant: 'destructive' });
        return;
      }
      setSavingId(officeId);
      const result = await updateOfficeWorkingHours(officeId, {
        working_hours_start: start,
        working_hours_end: end,
        auto_track_enabled: autoTrack,
      });
      if (result.ok) {
        show({ title: 'Часы сохранены', variant: 'success' });
        setOffices((prev) =>
          prev.map((o) =>
            o.id === officeId
              ? {
                  ...o,
                  working_hours_start: start,
                  working_hours_end: end,
                  auto_track_enabled: autoTrack,
                }
              : o
          )
        );
      } else {
        show({ title: 'Ошибка', description: result.error, variant: 'destructive' });
      }
      setSavingId(null);
    },
    [startInput, endInput, autoTrack, show]
  );

  const onRefresh = useCallback(() => load(true), [load]);

  const styles = useMemo(
    () =>
      createOfficeStyles(primary, gray600, screenBg),
    [primary, gray600, screenBg],
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={24} color={primary} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Офис
        </ThemedText>
        <ThemedText style={[styles.subtitle, { color: textMuted }]}>
          Офисы, рабочие часы и переговорные
        </ThemedText>
      </View>

      {loading && offices.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="large" color={primary} />
          <ThemedText style={[styles.loadingText, { color: textMuted }]}>Загрузка...</ThemedText>
        </View>
      ) : error ? (
        <View style={styles.errorBox}>
          <ThemedText style={styles.errorText}>{error}</ThemedText>
          <Pressable style={styles.retryButton} onPress={() => load()}>
            <ThemedText style={styles.retryText}>Повторить</ThemedText>
          </Pressable>
        </View>
      ) : (
        <PullToRefresh
          refreshing={refreshing}
          onRefresh={onRefresh}
          loaderSize={96}
          topOffset={insets.top + 8}
        >
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
            keyboardShouldPersistTaps="handled"
          >
          <Pressable
            style={styles.addOfficeButton}
            onPress={() => {
              if (showCreateForm) setNewOfficePhoto(null);
              setShowCreateForm((v) => !v);
            }}
          >
            <MaterialIcons name="add-business" size={20} color="#fff" />
            <ThemedText style={styles.addOfficeButtonText}>
              {showCreateForm ? 'Отмена' : 'Добавить офис'}
            </ThemedText>
          </Pressable>

          {showCreateForm && (
            <View style={styles.createCard}>
              <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>Новый офис</ThemedText>
              <TextInput
                style={[styles.input, { color: text }]}
                placeholder="Название"
                placeholderTextColor={textMuted}
                value={newName}
                onChangeText={setNewName}
              />
              <TextInput
                style={[styles.input, { color: text }]}
                placeholder="Адрес"
                placeholderTextColor={textMuted}
                value={newAddress}
                onChangeText={setNewAddress}
              />
              <TextInput
                style={[styles.input, { color: text }]}
                placeholder="Город"
                placeholderTextColor={textMuted}
                value={newCity}
                onChangeText={setNewCity}
              />
              <Pressable style={styles.addRoomButton} onPress={pickPhotoForNew}>
                <MaterialIcons name="add-a-photo" size={20} color={primary} />
                <ThemedText style={[styles.addRoomButtonText, { color: primary }]}>
                  {newOfficePhoto ? 'Фото выбрано' : 'Добавить фото офиса'}
                </ThemedText>
              </Pressable>
              {createError ? (
                <ThemedText style={styles.errorText}>{createError}</ThemedText>
              ) : null}
              <Pressable
                style={[styles.saveBtn, isCreating && styles.buttonDisabled]}
                onPress={handleCreateOffice}
                disabled={isCreating}
              >
                {isCreating ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.saveBtnText}>Создать офис</ThemedText>
                )}
              </Pressable>
            </View>
          )}

          {offices.length === 0 ? (
            <ThemedText style={[styles.emptyText, { color: textMuted }]}>Нет офисов</ThemedText>
          ) : (
            offices.map((office) => {
              const isExpanded = expandedId === office.id;
              const hoursStr =
                office.working_hours_start && office.working_hours_end
                  ? `${toHHmm(office.working_hours_start)} – ${toHHmm(office.working_hours_end)}`
                  : '—';
              return (
                <View key={office.id} style={styles.card}>
                  <Pressable
                    style={styles.cardHeader}
                    onPress={() => expand(office)}
                  >
                    <View style={styles.cardHeaderLeft}>
                      <MaterialIcons name="business" size={22} color={primary} />
                      <View style={styles.cardTitleBlock}>
                        <ThemedText style={[styles.cardTitle, { color: text }]} numberOfLines={1}>
                          {office.name}
                        </ThemedText>
                        <ThemedText style={[styles.cardMeta, { color: textMuted }]} numberOfLines={1}>
                          {office.city ?? ''} {office.address ?? ''}
                        </ThemedText>
                        <ThemedText style={[styles.cardHours, { color: textMuted }]}>
                          {hoursStr}
                          {office.auto_track_enabled ? ' · авто-трекер' : ''}
                        </ThemedText>
                      </View>
                    </View>
                    <MaterialIcons
                      name={isExpanded ? 'expand-less' : 'expand-more'}
                      size={24}
                      color={textMuted}
                    />
                  </Pressable>

                  {isExpanded && (
                    <View style={styles.expanded}>
                      <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>
                        Данные офиса
                      </ThemedText>
                      <TextInput
                        style={[styles.input, { color: text }]}
                        placeholder="Название"
                        placeholderTextColor={textMuted}
                        value={editName}
                        onChangeText={setEditName}
                      />
                      <TextInput
                        style={[styles.input, { color: text }]}
                        placeholder="Адрес"
                        placeholderTextColor={textMuted}
                        value={editAddress}
                        onChangeText={setEditAddress}
                      />
                      <TextInput
                        style={[styles.input, { color: text }]}
                        placeholder="Город"
                        placeholderTextColor={textMuted}
                        value={editCity}
                        onChangeText={setEditCity}
                      />
                      <Pressable style={[styles.addRoomButton, { marginBottom: 12 }]} onPress={pickPhotoForEdit}>
                        <MaterialIcons name="add-a-photo" size={20} color={primary} />
                        <ThemedText style={[styles.addRoomButtonText, { color: primary }]}>
                          {editOfficePhoto ? 'Фото выбрано' : 'Изменить фото офиса'}
                        </ThemedText>
                      </Pressable>
                      <Pressable
                        style={[styles.saveBtn, savingDataId === office.id && styles.buttonDisabled]}
                        onPress={() => saveOfficeData(office.id)}
                        disabled={savingDataId === office.id}
                      >
                        {savingDataId === office.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <ThemedText style={styles.saveBtnText}>Сохранить данные офиса</ThemedText>
                        )}
                      </Pressable>

                      <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>
                        Рабочие часы
                      </ThemedText>
                      <View style={styles.row}>
                        <TextInput
                          style={[styles.timeInput, { color: text }]}
                          placeholder="09:00"
                          placeholderTextColor={textMuted}
                          value={startInput}
                          onChangeText={setStartInput}
                          keyboardType="numbers-and-punctuation"
                        />
                        <ThemedText style={[styles.timeSep, { color: textMuted }]}>–</ThemedText>
                        <TextInput
                          style={[styles.timeInput, { color: text }]}
                          placeholder="18:00"
                          placeholderTextColor={textMuted}
                          value={endInput}
                          onChangeText={setEndInput}
                          keyboardType="numbers-and-punctuation"
                        />
                      </View>
                      <View style={styles.switchRow}>
                        <ThemedText style={[styles.switchLabel, { color: text }]}>
                          Авто-трекер по рабочим часам
                        </ThemedText>
                        <Switch
                          value={autoTrack}
                          onValueChange={setAutoTrack}
                          trackColor={{ false: gray600, true: primary }}
                          thumbColor="#fff"
                        />
                      </View>
                      <Pressable
                        style={[styles.saveBtn, savingId === office.id && styles.buttonDisabled]}
                        onPress={() => saveWorkingHours(office.id)}
                        disabled={savingId === office.id}
                      >
                        {savingId === office.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <ThemedText style={styles.saveBtnText}>Сохранить часы</ThemedText>
                        )}
                      </Pressable>

                      <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>
                        Переговорные
                      </ThemedText>
                      {roomsLoading ? (
                        <ActivityIndicator size="small" color={primary} style={styles.roomsLoader} />
                      ) : (
                        <>
                          <View style={styles.roomList}>
                            {rooms.map((r) => (
                              <View key={r.id} style={styles.roomRow}>
                                {editingRoomId === r.id ? (
                                  <View style={styles.roomEditBlock}>
                                    <TextInput
                                      style={[styles.roomInput, { color: text }]}
                                      placeholder="Название"
                                      placeholderTextColor={textMuted}
                                      value={editRoomName}
                                      onChangeText={setEditRoomName}
                                    />
                                    <View style={styles.roomEditRow}>
                                      <TextInput
                                        style={[styles.roomInputSmall, { color: text }]}
                                        placeholder="Этаж"
                                        placeholderTextColor={textMuted}
                                        value={editRoomFloor}
                                        onChangeText={setEditRoomFloor}
                                        keyboardType="number-pad"
                                      />
                                      <TextInput
                                        style={[styles.roomInputSmall, { color: text }]}
                                        placeholder="Вместимость"
                                        placeholderTextColor={textMuted}
                                        value={editRoomCapacity}
                                        onChangeText={setEditRoomCapacity}
                                        keyboardType="number-pad"
                                      />
                                    </View>
                                    <View style={styles.roomEditActions}>
                                      <Pressable
                                        style={[styles.roomActionBtn, savingRoomId === r.id && styles.buttonDisabled]}
                                        onPress={() => saveRoom(r.id, office.id)}
                                        disabled={savingRoomId === r.id}
                                      >
                                        {savingRoomId === r.id ? (
                                          <ActivityIndicator size="small" color="#fff" />
                                        ) : (
                                          <ThemedText style={styles.roomActionBtnText}>Сохранить</ThemedText>
                                        )}
                                      </Pressable>
                                      <Pressable style={styles.roomActionBtnSecondary} onPress={cancelEditRoom}>
                                        <ThemedText style={[styles.roomActionBtnTextSecondary, { color: textMuted }]}>
                                          Отмена
                                        </ThemedText>
                                      </Pressable>
                                    </View>
                                  </View>
                                ) : (
                                  <View style={styles.roomRowContent}>
                                    <View style={styles.roomChip}>
                                      <MaterialIcons name="meeting-room" size={16} color={textMuted} />
                                      <View>
                                        <ThemedText style={[styles.roomChipText, { color: text }]} numberOfLines={1}>
                                          {r.name}
                                        </ThemedText>
                                        <ThemedText style={[styles.roomChipMeta, { color: textMuted }]}>
                                          этаж {r.floor ?? 0} · {r.capacity ?? 0} чел.
                                        </ThemedText>
                                      </View>
                                    </View>
                                    <View style={styles.roomRowActions}>
                                      <Pressable
                                        style={styles.roomIconBtn}
                                        onPress={() => startEditRoom(r)}
                                        disabled={deletingRoomId === r.id}
                                      >
                                        <MaterialIcons name="edit" size={20} color={primary} />
                                      </Pressable>
                                      <Pressable
                                        style={styles.roomIconBtn}
                                        onPress={() => handleDeleteRoom(r, office.id)}
                                        disabled={deletingRoomId === r.id}
                                      >
                                        {deletingRoomId === r.id ? (
                                          <ActivityIndicator size="small" color="#FCA5A5" />
                                        ) : (
                                          <MaterialIcons name="delete-outline" size={20} color="#FCA5A5" />
                                        )}
                                      </Pressable>
                                    </View>
                                  </View>
                                )}
                              </View>
                            ))}
                          </View>
                          {!showAddRoom ? (
                            <Pressable
                              style={styles.addRoomButton}
                              onPress={() => setShowAddRoom(true)}
                            >
                              <MaterialIcons name="add" size={20} color={primary} />
                              <ThemedText style={[styles.addRoomButtonText, { color: primary }]}>
                                Добавить переговорную
                              </ThemedText>
                            </Pressable>
                          ) : (
                            <View style={styles.addRoomCard}>
                              <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>
                                Новая переговорная
                              </ThemedText>
                              <TextInput
                                style={[styles.input, { color: text }]}
                                placeholder="Название"
                                placeholderTextColor={textMuted}
                                value={newRoomName}
                                onChangeText={setNewRoomName}
                              />
                              <View style={styles.row}>
                                <TextInput
                                  style={[styles.timeInput, { color: text }]}
                                  placeholder="Этаж (0)"
                                  placeholderTextColor={textMuted}
                                  value={newRoomFloor}
                                  onChangeText={setNewRoomFloor}
                                  keyboardType="number-pad"
                                />
                                <TextInput
                                  style={[styles.timeInput, { color: text }]}
                                  placeholder="Вместимость (1)"
                                  placeholderTextColor={textMuted}
                                  value={newRoomCapacity}
                                  onChangeText={setNewRoomCapacity}
                                  keyboardType="number-pad"
                                />
                              </View>
                              {roomCreateError ? (
                                <ThemedText style={styles.errorText}>{roomCreateError}</ThemedText>
                              ) : null}
                              <View style={styles.addRoomActions}>
                                <Pressable
                                  style={[styles.saveBtn, isCreatingRoom && styles.buttonDisabled]}
                                  onPress={() => handleAddRoom(office.id)}
                                  disabled={isCreatingRoom}
                                >
                                  {isCreatingRoom ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                  ) : (
                                    <ThemedText style={styles.saveBtnText}>Создать</ThemedText>
                                  )}
                                </Pressable>
                                <Pressable
                                  style={styles.roomActionBtnSecondary}
                                  onPress={() => {
                                    setShowAddRoom(false);
                                    setRoomCreateError(null);
                                    setNewRoomName('');
                                    setNewRoomFloor('');
                                    setNewRoomCapacity('');
                                  }}
                                >
                                  <ThemedText style={[styles.roomActionBtnTextSecondary, { color: textMuted }]}>
                                    Отмена
                                  </ThemedText>
                                </Pressable>
                              </View>
                            </View>
                          )}
                        </>
                      )}

                      <Pressable
                        style={[styles.deleteOfficeBtn, deletingId === office.id && styles.buttonDisabled]}
                        onPress={() => handleDeleteOffice(office)}
                        disabled={deletingId === office.id}
                      >
                        {deletingId === office.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <>
                            <MaterialIcons name="delete-outline" size={18} color="#fff" />
                            <ThemedText style={styles.deleteOfficeBtnText}>Удалить офис</ThemedText>
                          </>
                        )}
                      </Pressable>
                    </View>
                  )}
                </View>
              );
            })
          )}

          <View style={styles.hintBox}>
            <MaterialIcons name="info-outline" size={18} color={primary} />
            <ThemedText style={styles.hintText}>
              Блоки и местонахождения офисов настраиваются в веб-версии.
            </ThemedText>
          </View>
          </ScrollView>
        </PullToRefresh>
      )}
    </ThemedView>
  );
}

function createOfficeStyles(primary: string, gray600: string, screenBg: string) {
  return StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: screenBg,
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 44,
    minHeight: 44,
    marginBottom: 8,
    justifyContent: 'center',
  },
  backLabel: {
    fontSize: 16,
    color: primary,
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
  },
  errorBox: {
    margin: 16,
    padding: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.4)',
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    marginBottom: 12,
  },
  retryButton: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: primary,
    borderRadius: 8,
  },
  retryText: {
    color: '#fff',
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  addOfficeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: primary,
    paddingVertical: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  addOfficeButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  createCard: {
    backgroundColor: gray600,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: screenBg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  emptyText: {
    textAlign: 'center',
    paddingVertical: 32,
    fontSize: 15,
  },
  card: {
    backgroundColor: gray600,
    borderRadius: 16,
    marginBottom: 12,
    overflow: 'hidden',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
  },
  cardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  cardTitleBlock: {
    marginLeft: 12,
    flex: 1,
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
  },
  cardMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  cardHours: {
    fontSize: 12,
    marginTop: 2,
  },
  expanded: {
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.08)',
    padding: 16,
  },
  sectionLabel: {
    fontSize: 13,
    marginBottom: 10,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 14,
  },
  timeInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: screenBg,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  timeSep: {
    fontSize: 16,
  },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  switchLabel: {
    fontSize: 15,
    flex: 1,
    marginRight: 12,
  },
  saveBtn: {
    backgroundColor: primary,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  roomsLoader: {
    marginVertical: 8,
  },
  roomsEmpty: {
    fontSize: 14,
    marginBottom: 8,
  },
  roomList: {
    gap: 10,
    marginBottom: 12,
  },
  roomRow: {
    marginBottom: 8,
  },
  roomEditBlock: {
    backgroundColor: screenBg,
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  roomInput: {
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: gray600,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  roomInputSmall: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: gray600,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
  },
  roomEditRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roomEditActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  roomActionBtn: {
    backgroundColor: primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    minWidth: 100,
    alignItems: 'center',
  },
  roomActionBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  roomActionBtnSecondary: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  roomActionBtnTextSecondary: {
    fontSize: 14,
  },
  roomRowContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: screenBg,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  roomChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  roomChipText: {
    fontSize: 15,
    fontWeight: '500',
  },
  roomChipMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  roomRowActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  roomIconBtn: {
    padding: 8,
  },
  addRoomButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: primary,
    borderRadius: 10,
    marginBottom: 8,
  },
  addRoomButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  addRoomCard: {
    backgroundColor: gray600,
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    gap: 8,
  },
  addRoomActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 4,
  },
  deleteOfficeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 20,
  },
  deleteOfficeBtnText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 15,
  },
  hintBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 8,
    padding: 12,
    backgroundColor: 'rgba(226,91,33,0.12)',
    borderRadius: 10,
  },
  hintText: {
    flex: 1,
    fontSize: 12,
    color: 'rgba(255,255,255,0.75)',
  },
});
}
