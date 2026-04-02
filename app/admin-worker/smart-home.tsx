import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  type Office,
  type MeetingRoom,
  type RoomDeviceLink,
  type YandexDevice,
  type ClientRoomSubscription,
  type OfficeUser,
  getOffices,
  getYandexTokens,
  refreshYandexTokens,
  deleteYandexTokens,
  getYandexDevicesList,
  getAllRoomDevices,
  createRoomDevice,
  deleteRoomDevice,
  getMeetingRooms,
  getOfficeUsers,
  getAllClientRoomSubscriptions,
  createClientRoomSubscription,
  deleteClientRoomSubscription,
} from '@/lib/api';


function formatExpiresAt(iso: string | null): string {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    const now = new Date();
    if (d < now) return `Истёк ${d.toLocaleDateString('ru-RU')}`;
    return `До ${d.toLocaleDateString('ru-RU')} ${d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}`;
  } catch {
    return iso;
  }
}

export default function AdminWorkerSmartHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { show: showToast } = useToast();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const gray600 = useThemeColor({}, 'gray600');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');

  // ——— Токены ———
  const [tokensMeta, setTokensMeta] = useState<{ id: number; expires_at: string | null } | null>(null);
  const [tokensLoading, setTokensLoading] = useState(true);
  const [tokensError, setTokensError] = useState<string | null>(null);
  const [tokenAction, setTokenAction] = useState<'refresh' | 'delete' | null>(null);

  const loadTokens = useCallback(async () => {
    setTokensLoading(true);
    setTokensError(null);
    const result = await getYandexTokens();
    if (result.ok) setTokensMeta(result.data ?? null);
    else setTokensError(result.error);
    setTokensLoading(false);
  }, []);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  const handleRefreshTokens = useCallback(async () => {
    setTokenAction('refresh');
    const result = await refreshYandexTokens();
    if (result.ok) {
      showToast({ title: 'Токены обновлены', variant: 'success' });
      loadTokens();
    } else {
      showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
    }
    setTokenAction(null);
  }, [showToast, loadTokens]);

  const handleDeleteTokens = useCallback(async () => {
    setTokenAction('delete');
    const result = await deleteYandexTokens();
    if (result.ok) {
      showToast({ title: 'Токены удалены', variant: 'success' });
      setTokensMeta(null);
    } else {
      showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
    }
    setTokenAction(null);
  }, [showToast]);

  // ——— Офис (шаг 1, как в браузере) ———
  const [offices, setOffices] = useState<Office[]>([]);
  const [officesLoading, setOfficesLoading] = useState(true);
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | null>(null);
  const [showOfficeDropdown, setShowOfficeDropdown] = useState(false);

  useEffect(() => {
    setOfficesLoading(true);
    getOffices().then((list) => {
      setOffices(list ?? []);
      setOfficesLoading(false);
    });
  }, []);

  // ——— Комнаты выбранного офиса ———
  const [rooms, setRooms] = useState<MeetingRoom[]>([]);
  const [roomsLoading, setRoomsLoading] = useState(false);

  useEffect(() => {
    if (selectedOfficeId == null) {
      setRooms([]);
      return;
    }
    setRoomsLoading(true);
    getMeetingRooms(selectedOfficeId).then((res) => {
      if (res.ok) setRooms(res.data);
      else setRooms([]);
      setRoomsLoading(false);
    });
  }, [selectedOfficeId]);

  // ——— Комнаты и устройства ———
  const [roomDevices, setRoomDevices] = useState<RoomDeviceLink[]>([]);
  const [yandexDevices, setYandexDevices] = useState<YandexDevice[]>([]);
  const [linksLoading, setLinksLoading] = useState(true);
  const [devicesListLoading, setDevicesListLoading] = useState(false);
  const [showRoomDropdown, setShowRoomDropdown] = useState(false);
  const [showDeviceDropdown, setShowDeviceDropdown] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<YandexDevice | null>(null);
  const [isLinking, setIsLinking] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const loadRoomDevices = useCallback(async () => {
    setLinksLoading(true);
    const result = await getAllRoomDevices();
    if (result.ok) setRoomDevices(result.data);
    else setRoomDevices([]);
    setLinksLoading(false);
  }, []);

  useEffect(() => {
    loadRoomDevices();
  }, [loadRoomDevices]);

  const loadYandexDevices = useCallback(async () => {
    setDevicesListLoading(true);
    const result = await getYandexDevicesList();
    if (result.ok) setYandexDevices(result.data);
    else {
      setYandexDevices([]);
      showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
    }
    setDevicesListLoading(false);
  }, [showToast]);

  const handleAddDeviceToRoom = useCallback(async () => {
    if (!selectedRoomId || !selectedDevice) return;
    setLinkError(null);
    setIsLinking(true);
    const result = await createRoomDevice({
      meeting_room_id: selectedRoomId,
      device_id: selectedDevice.id,
      device_name: selectedDevice.name,
      device_type: selectedDevice.type,
    });
    if (result.ok) {
      showToast({ title: 'Устройство привязано к комнате', variant: 'success' });
      setSelectedRoomId(null);
      setSelectedDevice(null);
      setShowRoomDropdown(false);
      setShowDeviceDropdown(false);
      loadRoomDevices();
    } else {
      setLinkError(result.error);
    }
    setIsLinking(false);
  }, [selectedRoomId, selectedDevice, show, loadRoomDevices]);

  const handleUnlink = useCallback(
    async (id: number) => {
      setDeletingId(id);
      const result = await deleteRoomDevice(id);
      if (result.ok) {
        showToast({ title: 'Устройство отвязано', variant: 'success' });
        loadRoomDevices();
      } else {
      showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
      }
      setDeletingId(null);
    },
    [showToast, loadRoomDevices]
  );

  // Список привязок только по выбранному офису
  const roomDevicesForOffice = useMemo(() => {
    if (selectedOfficeId == null) return [];
    return roomDevices.filter((link) => {
      const officeId = link.meetingRoom?.office_id ?? link.meetingRoom?.office?.id;
      return officeId === selectedOfficeId;
    });
  }, [roomDevices, selectedOfficeId]);

  const groupedByRoom = useMemo(() => {
    const map = new Map<number, { roomName: string; links: RoomDeviceLink[] }>();
    for (const link of roomDevicesForOffice) {
      const roomName = link.meetingRoom?.name ?? `Комната ${link.meeting_room_id}`;
      if (!map.has(link.meeting_room_id)) {
        map.set(link.meeting_room_id, { roomName, links: [] });
      }
      map.get(link.meeting_room_id)!.links.push(link);
    }
    return Array.from(map.entries()).map(([roomId, val]) => ({ roomId, ...val }));
  }, [roomDevicesForOffice]);

  const selectedOffice = useMemo(
    () => offices.find((o) => o.id === selectedOfficeId) ?? null,
    [offices, selectedOfficeId]
  );

  const selectedRoomName = useMemo(
    () => rooms.find((r) => r.id === selectedRoomId)?.name ?? null,
    [rooms, selectedRoomId]
  );

  const alreadyLinkedDeviceIds = useMemo(
    () => new Set(roomDevices.map((l) => l.device_id)),
    [roomDevices]
  );
  const availableYandexDevices = useMemo(
    () => yandexDevices.filter((d) => !alreadyLinkedDeviceIds.has(d.id)),
    [yandexDevices, alreadyLinkedDeviceIds]
  );

  // ——— Привязка клиента/сотрудника к комнате (доступ к управлению умным домом) ———
  const [subscriptions, setSubscriptions] = useState<ClientRoomSubscription[]>([]);
  const [subscriptionsLoading, setSubscriptionsLoading] = useState(true);
  const [officeUsers, setOfficeUsers] = useState<OfficeUser[]>([]);
  const [officeUsersLoading, setOfficeUsersLoading] = useState(false);
  const [selectedRoomIdForSub, setSelectedRoomIdForSub] = useState<number | null>(null);
  const [selectedUserIdForSub, setSelectedUserIdForSub] = useState<number | null>(null);
  const [showRoomSubDropdown, setShowRoomSubDropdown] = useState(false);
  const [showUserSubDropdown, setShowUserSubDropdown] = useState(false);
  const [isCreatingSub, setIsCreatingSub] = useState(false);
  const [subError, setSubError] = useState<string | null>(null);
  const [deletingSubId, setDeletingSubId] = useState<number | null>(null);

  const loadSubscriptions = useCallback(async () => {
    setSubscriptionsLoading(true);
    const result = await getAllClientRoomSubscriptions();
    if (result.ok) setSubscriptions(result.data);
    else setSubscriptions([]);
    setSubscriptionsLoading(false);
  }, []);

  useEffect(() => {
    loadSubscriptions();
  }, [loadSubscriptions]);

  useEffect(() => {
    if (selectedOfficeId == null) {
      setOfficeUsers([]);
      setSelectedRoomIdForSub(null);
      setSelectedUserIdForSub(null);
      setShowRoomSubDropdown(false);
      setShowUserSubDropdown(false);
      setSubError(null);
      return;
    }
    setOfficeUsersLoading(true);
    setSelectedRoomIdForSub(null);
    setSelectedUserIdForSub(null);
    setShowRoomSubDropdown(false);
    setShowUserSubDropdown(false);
    setSubError(null);
    getOfficeUsers(selectedOfficeId).then((res) => {
      if (res.ok) setOfficeUsers(res.data);
      else setOfficeUsers([]);
      setOfficeUsersLoading(false);
    });
  }, [selectedOfficeId]);

  const subscriptionsForOffice = useMemo(() => {
    if (selectedOfficeId == null) return [];
    return subscriptions.filter((s) => {
      const officeId = s.meetingRoom?.office_id ?? s.meetingRoom?.office?.id;
      return officeId === selectedOfficeId;
    });
  }, [subscriptions, selectedOfficeId]);

  const selectedRoomNameForSub = useMemo(
    () => rooms.find((r) => r.id === selectedRoomIdForSub)?.name ?? null,
    [rooms, selectedRoomIdForSub]
  );
  const selectedUserNameForSub = useMemo(
    () => officeUsers.find((u) => u.id === selectedUserIdForSub)?.full_name ?? null,
    [officeUsers, selectedUserIdForSub]
  );

  const handleCreateSubscription = useCallback(async () => {
    if (!selectedRoomIdForSub || !selectedUserIdForSub) return;
    setSubError(null);
    setIsCreatingSub(true);
    const result = await createClientRoomSubscription({
      client_id: selectedUserIdForSub,
      meeting_room_id: selectedRoomIdForSub,
    });
    if (result.ok) {
      showToast({
        title: 'Доступ добавлен',
        description: 'Пользователь может управлять умным домом в этой комнате',
        variant: 'success',
      });
      setSelectedRoomIdForSub(null);
      setSelectedUserIdForSub(null);
      setShowRoomSubDropdown(false);
      setShowUserSubDropdown(false);
      loadSubscriptions();
    } else {
      setSubError(result.error);
    }
    setIsCreatingSub(false);
  }, [selectedRoomIdForSub, selectedUserIdForSub, showToast, loadSubscriptions]);

  const handleDeleteSubscription = useCallback(
    async (id: number) => {
      setDeletingSubId(id);
      const result = await deleteClientRoomSubscription(id);
      if (result.ok) {
        showToast({ title: 'Доступ удалён', variant: 'success' });
        loadSubscriptions();
      } else {
        showToast({ title: 'Ошибка', description: result.error, variant: 'destructive', duration: 4000 });
      }
      setDeletingSubId(null);
    },
    [showToast, loadSubscriptions]
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <MaterialIcons name="chevron-left" size={24} color={primary} />
          <ThemedText style={styles.backLabel}>Назад</ThemedText>
        </Pressable>
        <ThemedText type="title" style={styles.title}>
          Умный дом
        </ThemedText>
        <ThemedText style={[styles.headerDescription, { color: textMuted }]}>
          Управление Яндекс.Умный дом: токены и привязка устройств к переговорным комнатам
        </ThemedText>
      </View>

      <ScrollView
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >

        {/* Токены */}
        <View style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: text }]}>Токены Яндекс</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
            Токены настраиваются в веб-версии через OAuth. Здесь можно обновить или удалить.
          </ThemedText>
          {tokensLoading ? (
            <ActivityIndicator size="small" color={primary} style={styles.loader} />
          ) : tokensError ? (
            <View style={styles.errorBox}>
              <ThemedText style={styles.errorBoxText}>{tokensError}</ThemedText>
            </View>
          ) : tokensMeta ? (
            <>
              <View style={styles.tokenRow}>
                <ThemedText style={[styles.tokenLabel, { color: textMuted }]}>Статус</ThemedText>
                <ThemedText style={[styles.tokenValue, { color: text }]}>Токены настроены</ThemedText>
              </View>
              <View style={styles.tokenRow}>
                <ThemedText style={[styles.tokenLabel, { color: textMuted }]}>Срок действия</ThemedText>
                <ThemedText style={[styles.tokenValue, { color: text }]}>
                  {formatExpiresAt(tokensMeta.expires_at)}
                </ThemedText>
              </View>
              <View style={styles.tokenActions}>
                <Pressable
                  style={[styles.primaryButton, styles.buttonHalf, tokenAction && styles.buttonDisabled]}
                  onPress={handleRefreshTokens}
                  disabled={!!tokenAction}
                >
                  {tokenAction === 'refresh' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.primaryButtonText}>Обновить токены</ThemedText>
                  )}
                </Pressable>
                <Pressable
                  style={[styles.dangerButton, styles.buttonHalf, tokenAction && styles.buttonDisabled]}
                  onPress={handleDeleteTokens}
                  disabled={!!tokenAction}
                >
                  {tokenAction === 'delete' ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <ThemedText style={styles.dangerButtonText}>Удалить токены</ThemedText>
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <ThemedText style={[styles.tokenValue, { color: textMuted }]}>
              Токены не настроены. Добавьте их в веб-версии.
            </ThemedText>
          )}
        </View>

        {/* Офис — как в браузере: Card + Label + Select */}
        <View style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: text }]}>Офис</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
            Сначала выберите офис, затем управляйте привязкой устройств к переговорным этого офиса.
          </ThemedText>
          {officesLoading ? (
            <ActivityIndicator size="small" color={primary} style={styles.loader} />
          ) : (
            <>
              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Выберите офис</ThemedText>
              <Pressable
                style={styles.selectTrigger}
                onPress={() => setShowOfficeDropdown((v) => !v)}
              >
              <ThemedText
                style={[styles.selectTriggerText, { color: selectedOffice ? text : textMuted }]}
              >
                {selectedOffice
                  ? `${selectedOffice.name}${selectedOffice.city ? ` · ${selectedOffice.city}` : ''}`
                  : 'Выберите офис'}
              </ThemedText>
              <MaterialIcons
                name={showOfficeDropdown ? 'expand-less' : 'expand-more'}
                size={22}
                color={textMuted}
              />
            </Pressable>
            {showOfficeDropdown && (
              <View style={styles.dropdown}>
                <Pressable
                  style={[styles.dropdownItem, selectedOfficeId == null && styles.dropdownItemActive]}
                  onPress={() => {
                    setSelectedOfficeId(null);
                    setShowOfficeDropdown(false);
                    setSelectedRoomId(null);
                    setSelectedDevice(null);
                  }}
                >
                  <ThemedText style={styles.dropdownItemText}>Не выбран</ThemedText>
                </Pressable>
                {offices.map((o) => (
                  <Pressable
                    key={o.id}
                    style={[styles.dropdownItem, o.id === selectedOfficeId && styles.dropdownItemActive]}
                    onPress={() => {
                      setSelectedOfficeId(o.id);
                      setShowOfficeDropdown(false);
                      setSelectedRoomId(null);
                      setSelectedDevice(null);
                    }}
                  >
                    <ThemedText style={styles.dropdownItemText} numberOfLines={1}>
                      {o.name}
                      {o.city ? ` · ${o.city}` : ''}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
            </>
          )}
        </View>

        {/* Комнаты и устройства — как в браузере: список по комнатам + форма добавления */}
        <View style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: text }]}>Комнаты и устройства</ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
            Привязка устройств Яндекс к переговорным комнатам выбранного офиса.
          </ThemedText>

          {selectedOfficeId == null ? (
            <ThemedText style={[styles.placeholderText, { color: textMuted }]}>
              Сначала выберите офис выше.
            </ThemedText>
          ) : linksLoading ? (
            <ActivityIndicator size="small" color={primary} style={styles.loader} />
          ) : (
            <>
              {selectedOffice && (
                <ThemedText style={[styles.officeSectionTitle, { color: textMuted }]}>
                  Офис: {selectedOffice.name}
                </ThemedText>
              )}

              {groupedByRoom.length > 0 ? (
                <View style={styles.groupList}>
                  {groupedByRoom.map(({ roomId, roomName, links }) => (
                    <View key={roomId} style={styles.roomGroup}>
                      <ThemedText style={[styles.roomGroupTitle, { color: text }]}>
                        {roomName}
                      </ThemedText>
                      {links.map((link) => (
                        <View key={link.id} style={styles.linkRow}>
                          <ThemedText style={[styles.linkDeviceName, { color: text }]} numberOfLines={1}>
                            {link.device_name}
                          </ThemedText>
                          <Pressable
                            style={[styles.unlinkBtn, deletingId === link.id && styles.buttonDisabled]}
                            onPress={() => handleUnlink(link.id)}
                            disabled={deletingId === link.id}
                          >
                            {deletingId === link.id ? (
                              <ActivityIndicator size="small" color="#fff" />
                            ) : (
                              <MaterialIcons name="link-off" size={18} color="#fff" />
                            )}
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ))}
                </View>
              ) : (
                <ThemedText style={[styles.placeholderText, { color: textMuted }]}>
                  Нет привязанных устройств. Добавьте устройство ниже.
                </ThemedText>
              )}

              <ThemedText style={[styles.sectionLabel, styles.contentBlock, { color: textMuted }]}>Добавить устройство в комнату</ThemedText>
              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Комната</ThemedText>
              <Pressable
                style={styles.selectTrigger}
                onPress={() => rooms.length > 0 && setShowRoomDropdown((v) => !v)}
              >
                <ThemedText style={[styles.selectTriggerText, { color: selectedRoomName ? text : textMuted }]}>
                  {selectedRoomName ?? (roomsLoading ? 'Загрузка комнат...' : 'Выберите комнату')}
                </ThemedText>
                <MaterialIcons name={showRoomDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
              </Pressable>
              {showRoomDropdown && (
                <View style={styles.dropdown}>
                  {rooms.length === 0 ? (
                    <ThemedText style={[styles.dropdownItemText, { color: textMuted }]}>
                      В этом офисе нет переговорных
                    </ThemedText>
                  ) : (
                    rooms.map((r) => (
                      <Pressable
                        key={r.id}
                        style={[styles.dropdownItem, r.id === selectedRoomId && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedRoomId(r.id);
                          setShowRoomDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>{r.name}</ThemedText>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              {selectedRoomId && (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Устройство</ThemedText>
                  <Pressable
                    style={styles.selectTrigger}
                    onPress={() => {
                      if (!devicesListLoading && yandexDevices.length === 0) loadYandexDevices();
                      setShowDeviceDropdown((v) => !v);
                    }}
                  >
                    <ThemedText
                      style={[styles.selectTriggerText, { color: selectedDevice ? text : textMuted }]}
                    >
                      {selectedDevice
                        ? selectedDevice.name
                        : devicesListLoading
                          ? 'Загрузка устройств...'
                          : showDeviceDropdown && availableYandexDevices.length === 0
                            ? 'Нет доступных устройств'
                            : 'Выберите устройство'}
                    </ThemedText>
                    <MaterialIcons
                      name={showDeviceDropdown ? 'expand-less' : 'expand-more'}
                      size={22}
                      color={textMuted}
                    />
                  </Pressable>
                  {showDeviceDropdown && (
                    <View style={styles.dropdown}>
                      {!devicesListLoading && yandexDevices.length === 0 && (
                        <Pressable style={styles.dropdownItem} onPress={loadYandexDevices}>
                          <ThemedText style={styles.dropdownItemText}>Загрузить список устройств</ThemedText>
                        </Pressable>
                      )}
                      {availableYandexDevices.map((d) => (
                        <Pressable
                          key={d.id}
                          style={[styles.dropdownItem, d.id === selectedDevice?.id && styles.dropdownItemActive]}
                          onPress={() => {
                            setSelectedDevice(d);
                            setShowDeviceDropdown(false);
                          }}
                        >
                          <ThemedText style={styles.dropdownItemText} numberOfLines={1}>
                            {d.name}
                          </ThemedText>
                        </Pressable>
                      ))}
                    </View>
                  )}
                </>
              )}

              {linkError ? (
                <View style={styles.errorBox}>
                  <ThemedText style={styles.errorBoxText}>{linkError}</ThemedText>
                </View>
              ) : null}
              <Pressable
                style={[
                  styles.primaryButton,
                  (!selectedRoomId || !selectedDevice || isLinking) && styles.buttonDisabled,
                ]}
                onPress={handleAddDeviceToRoom}
                disabled={!selectedRoomId || !selectedDevice || isLinking}
              >
                {isLinking ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Привязать к комнате</ThemedText>
                )}
              </Pressable>
            </>
          )}
        </View>

        {/* Привязать клиента или сотрудника к комнате — как в браузере: Card + описание + инфо-блок + список + форма */}
        <View style={styles.card}>
          <ThemedText style={[styles.cardTitle, { color: text }]}>
            Доступ к управлению умным домом
          </ThemedText>
          <ThemedText style={[styles.cardSubtitle, { color: textMuted }]}>
            Привяжите клиента или сотрудника к комнате (кабинету). Управление устройствами станет доступно в приложении.
          </ThemedText>

          {selectedOfficeId == null ? (
            <ThemedText style={[styles.placeholderText, { color: textMuted }]}>
              Сначала выберите офис выше.
            </ThemedText>
          ) : (
            <>
              <View style={styles.infoBox}>
                <MaterialIcons name="info-outline" size={20} color="#3B82F6" />
                <ThemedText style={styles.infoBoxText}>
                  Пользователь, привязанный к комнате, сможет управлять светом и другими устройствами умного дома в этой комнате из приложения.
                </ThemedText>
              </View>

              {subscriptionsLoading ? (
                <ActivityIndicator size="small" color={primary} style={styles.loader} />
              ) : subscriptionsForOffice.length > 0 ? (
                <View style={styles.groupList}>
                  <ThemedText style={[styles.officeSectionTitle, { color: textMuted }]}>
                    Кто привязан к комнатам
                  </ThemedText>
                  {subscriptionsForOffice.map((sub) => (
                    <View key={sub.id} style={styles.linkRow}>
                      <ThemedText style={[styles.linkDeviceName, { color: text }]} numberOfLines={1}>
                        {sub.subscribedClient?.full_name ?? `Пользователь #${sub.client_id}`} — {sub.meetingRoom?.name ?? `Комната #${sub.meeting_room_id}`}
                      </ThemedText>
                      <Pressable
                        style={[styles.unlinkBtn, deletingSubId === sub.id && styles.buttonDisabled]}
                        onPress={() => handleDeleteSubscription(sub.id)}
                        disabled={deletingSubId === sub.id}
                      >
                        {deletingSubId === sub.id ? (
                          <ActivityIndicator size="small" color="#fff" />
                        ) : (
                          <MaterialIcons name="link-off" size={18} color="#fff" />
                        )}
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : null}

              <ThemedText style={[styles.sectionLabel, styles.contentBlock, { color: textMuted }]}>
                Привязать пользователя к комнате
              </ThemedText>
              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Комната / кабинет</ThemedText>
              <Pressable
                style={styles.selectTrigger}
                onPress={() => rooms.length > 0 && setShowRoomSubDropdown((v) => !v)}
              >
                <ThemedText style={[styles.selectTriggerText, { color: selectedRoomNameForSub ? text : textMuted }]}>
                  {selectedRoomNameForSub ?? (roomsLoading ? 'Загрузка...' : 'Выберите комнату')}
                </ThemedText>
                <MaterialIcons name={showRoomSubDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
              </Pressable>
              {showRoomSubDropdown && (
                <View style={styles.dropdown}>
                  {rooms.length === 0 ? (
                    <ThemedText style={[styles.dropdownItemText, { color: textMuted }]}>
                      В этом офисе нет переговорных
                    </ThemedText>
                  ) : (
                    rooms.map((r) => (
                      <Pressable
                        key={r.id}
                        style={[styles.dropdownItem, r.id === selectedRoomIdForSub && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedRoomIdForSub(r.id);
                          setShowRoomSubDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText}>{r.name}</ThemedText>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              <ThemedText style={[styles.fieldLabel, { color: textMuted }]}>Клиент или сотрудник</ThemedText>
              <Pressable
                style={styles.selectTrigger}
                onPress={() => setShowUserSubDropdown((v) => !v)}
              >
                <ThemedText style={[styles.selectTriggerText, { color: selectedUserNameForSub ? text : textMuted }]}>
                  {officeUsersLoading ? 'Загрузка...' : selectedUserNameForSub ?? 'Выберите пользователя'}
                </ThemedText>
                <MaterialIcons name={showUserSubDropdown ? 'expand-less' : 'expand-more'} size={22} color={textMuted} />
              </Pressable>
              {showUserSubDropdown && (
                <View style={styles.dropdown}>
                  {officeUsers.length === 0 && !officeUsersLoading ? (
                    <ThemedText style={[styles.dropdownItemText, { color: textMuted }]}>
                      Нет пользователей в этом офисе
                    </ThemedText>
                  ) : (
                    officeUsers.map((u) => (
                      <Pressable
                        key={u.id}
                        style={[styles.dropdownItem, u.id === selectedUserIdForSub && styles.dropdownItemActive]}
                        onPress={() => {
                          setSelectedUserIdForSub(u.id);
                          setShowUserSubDropdown(false);
                        }}
                      >
                        <ThemedText style={styles.dropdownItemText} numberOfLines={1}>
                          {u.full_name} {u.role ? ` · ${u.role}` : ''}
                        </ThemedText>
                      </Pressable>
                    ))
                  )}
                </View>
              )}

              {subError ? (
                <View style={styles.errorBox}>
                  <ThemedText style={styles.errorBoxText}>{subError}</ThemedText>
                </View>
              ) : null}
              <Pressable
                style={[
                  styles.primaryButton,
                  (!selectedRoomIdForSub || !selectedUserIdForSub || isCreatingSub) && styles.buttonDisabled,
                ]}
                onPress={handleCreateSubscription}
                disabled={!selectedRoomIdForSub || !selectedUserIdForSub || isCreatingSub}
              >
                {isCreatingSub ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.primaryButtonText}>Привязать к комнате</ThemedText>
                )}
              </Pressable>
            </>
          )}
        </View>

        <ThemedText style={[styles.footerNote, { color: textMuted }]}>
          Полная настройка сценариев и OAuth — в веб-версии.
        </ThemedText>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1C1C1E',
  },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
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
    color: '#E25B21',
    marginLeft: 4,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerDescription: {
    fontSize: 13,
    marginTop: 4,
    lineHeight: 18,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: '#3A3A3C',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    marginBottom: 12,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 8,
  },
  sectionLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    marginTop: 4,
  },
  contentBlock: {
    marginTop: 16,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    backgroundColor: 'rgba(59,130,246,0.12)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(59,130,246,0.3)',
  },
  infoBoxText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
    color: '#93C5FD',
  },
  loader: {
    marginVertical: 8,
  },
  tokenRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  tokenLabel: {
    fontSize: 14,
  },
  tokenValue: {
    fontSize: 14,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
  },
  buttonHalf: {
    flex: 1,
  },
  primaryButton: {
    backgroundColor: '#E25B21',
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 12,
  },
  dangerButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    minHeight: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  dangerButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  errorText: {
    fontSize: 14,
    color: '#FCA5A5',
    marginTop: 8,
  },
  errorBox: {
    backgroundColor: 'rgba(239,68,68,0.12)',
    borderRadius: 10,
    padding: 12,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
  },
  errorBoxText: {
    fontSize: 14,
    color: '#FCA5A5',
  },
  groupList: {
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 14,
    fontStyle: 'italic',
    marginVertical: 8,
  },
  officeSectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  roomGroup: {
    marginBottom: 12,
  },
  roomGroupTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 6,
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1C1C1E',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 6,
  },
  linkDeviceName: {
    fontSize: 15,
    flex: 1,
  },
  unlinkBtn: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: '#DC2626',
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: '#3A3A3C',
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 8,
  },
  selectTriggerText: {
    fontSize: 16,
  },
  dropdown: {
    backgroundColor: '#1C1C1E',
    borderRadius: 10,
    marginBottom: 12,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  dropdownItemActive: {
    backgroundColor: 'rgba(226,91,33,0.3)',
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#fff',
  },
  footerNote: {
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 8,
    marginBottom: 16,
  },
});
