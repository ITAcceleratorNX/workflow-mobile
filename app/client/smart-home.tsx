import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageLoader, ScreenHeader } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/context/toast-context';
import {
  getClientRoomSubscriptions,
  getRoomDevicesForClient,
  controlDevice,
  type YandexDevice,
  type ClientRoomSubscription,
} from '@/lib/api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';

const MOCK_SUBSCRIPTIONS: ClientRoomSubscription[] = [
  {
    id: 1,
    client_id: 0,
    meeting_room_id: 1,
    meetingRoom: {
      id: 1,
      name: 'Кабинет 101 (демо)',
      office_id: 1,
      office: { id: 1, name: 'Демо офис' },
    },
  },
];

const MOCK_DEVICES: YandexDevice[] = [
  {
    id: 'demo-lamp-1',
    name: 'Свет (демо)',
    type: 'devices.types.light',
    capabilities: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: false } }],
  },
  {
    id: 'demo-ac-1',
    name: 'Кондиционер (демо)',
    type: 'devices.types.thermostat.ac',
    capabilities: [{ type: 'devices.capabilities.on_off', state: { instance: 'on', value: true } }],
  },
];

export default function ClientSmartHomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { show: showToast } = useToast();
  const background = useThemeColor({}, 'background');

  const [subscriptions, setSubscriptions] = useState<ClientRoomSubscription[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [devices, setDevices] = useState<YandexDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isControlling, setIsControlling] = useState<string | null>(null);
  const [showRoomSelector, setShowRoomSelector] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadSubscriptions = async () => {
      if (isGuest) {
        setSubscriptions(MOCK_SUBSCRIPTIONS);
        setSelectedRoomId(1);
        return;
      }
      if (!user?.id) return;
      try {
        setLoading(true);
        const result = await getClientRoomSubscriptions(user.id);
        if (result.ok) {
          const subs = result.data.subscriptions || [];
          setSubscriptions(subs);
          if (subs.length > 0 && !selectedRoomId) setSelectedRoomId(subs[0].meeting_room_id);
        } else {
          showToast({ title: 'Ошибка загрузки', description: result.error, variant: 'destructive', duration: 4000 });
        }
      } catch {
        showToast({ title: 'Ошибка', description: 'Не удалось загрузить комнаты', variant: 'destructive', duration: 4000 });
      } finally {
        setLoading(false);
      }
    };
    loadSubscriptions();
  }, [user?.id, showToast, isGuest]);

  useEffect(() => {
    const loadDevices = async () => {
      if (!selectedRoomId) return;
      if (isGuest) {
        setDevices(MOCK_DEVICES);
        return;
      }
      try {
        setIsLoadingDevices(true);
        const result = await getRoomDevicesForClient(selectedRoomId);
        if (result.ok) setDevices(result.data.devices || []);
        else showToast({ title: 'Ошибка загрузки', description: result.error, variant: 'destructive', duration: 4000 });
      } catch {
        showToast({ title: 'Ошибка', description: 'Не удалось загрузить устройства', variant: 'destructive', duration: 4000 });
      } finally {
        setIsLoadingDevices(false);
      }
    };
    loadDevices();
  }, [selectedRoomId, showToast, isGuest]);

  const handleControlDevice = useCallback(
    async (device: YandexDevice, value: boolean) => {
      try {
        setIsControlling(device.id);
        if (!isGuest) {
          const result = await controlDevice({
            device_id: device.id,
            action_type: 'devices.capabilities.on_off',
            action_state: { instance: 'on', value },
          });
          if (!result.ok) {
            showToast({ title: 'Ошибка', description: 'Не удалось управлять устройством', variant: 'destructive', duration: 4000 });
            return;
          }
        }
        showToast({
          title: 'Успешно',
          description: isGuest ? `(Демо) ${device.name} ${value ? 'включено' : 'выключено'}` : `${device.name} ${value ? 'включено' : 'выключено'}`,
          variant: 'success',
          duration: 2000,
        });
        setDevices((prev) =>
          prev.map((d) => {
            if (d.id !== device.id) return d;
            const cap = d.capabilities?.find((c) => c.type === 'devices.capabilities.on_off');
            if (cap?.state) cap.state = { instance: cap.state.instance, value };
            return { ...d };
          })
        );
      } catch {
        showToast({ title: 'Ошибка', description: 'Не удалось управлять устройством', variant: 'destructive', duration: 4000 });
      } finally {
        setIsControlling(null);
      }
    },
    [showToast, isGuest]
  );

  const getDeviceState = useCallback((device: YandexDevice): boolean | null => {
    const cap = device.capabilities?.find((c) => c.type === 'devices.capabilities.on_off');
    return cap?.state?.value ?? null;
  }, []);

  const controllableDevices = devices.filter((d) =>
    d.capabilities?.some((c) => c.type === 'devices.capabilities.on_off')
  );
  const selectedRoom = subscriptions.find((s) => s.meeting_room_id === selectedRoomId);

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScreenHeader title="Управление умным домом" />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        {subscriptions.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="home" size={64} color="rgba(255,255,255,0.4)" />
            <ThemedText style={styles.emptyTitle}>Нет подписок на комнаты</ThemedText>
            <ThemedText style={styles.emptySubtitle}>Обратитесь к администратору</ThemedText>
          </View>
        ) : (
          <>
            <View style={styles.roomSelectorContainer}>
              <ThemedText style={styles.roomLabel}>Выберите комнату:</ThemedText>
              <Pressable onPress={() => setShowRoomSelector(!showRoomSelector)} style={styles.roomSelectorButton}>
                <ThemedText style={styles.roomSelectorText}>
                  {selectedRoom?.meetingRoom?.name || 'Выберите комнату'}
                  {selectedRoom?.meetingRoom?.office ? ` (${selectedRoom.meetingRoom.office.name})` : ''}
                </ThemedText>
                <MaterialIcons name={showRoomSelector ? 'expand-less' : 'expand-more'} size={24} color="#FFFFFF" />
              </Pressable>
              {showRoomSelector && (
                <View style={styles.roomDropdown}>
                  {subscriptions.map((sub) => (
                    <Pressable
                      key={sub.id}
                      onPress={() => {
                        setSelectedRoomId(sub.meeting_room_id);
                        setShowRoomSelector(false);
                      }}
                      style={[styles.roomDropdownItem, selectedRoomId === sub.meeting_room_id && styles.roomDropdownItemActive]}
                    >
                      <ThemedText style={styles.roomDropdownText}>
                        {sub.meetingRoom?.name || `Комната ID: ${sub.meeting_room_id}`}
                        {sub.meetingRoom?.office ? ` (${sub.meetingRoom.office.name})` : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <ThemedText style={styles.devicesTitle}>Устройства в комнате</ThemedText>
            <View style={styles.devicesAreaWrapper}>
              {isLoadingDevices ? (
                <View style={styles.devicesGridPlaceholder} />
              ) : controllableDevices.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="lightbulb" size={64} color="rgba(255,255,255,0.4)" />
                  <ThemedText style={styles.emptyTitle}>Нет доступных устройств</ThemedText>
                  <ThemedText style={styles.emptySubtitle}>В этой комнате нет устройств</ThemedText>
                </View>
              ) : (
                <View style={styles.devicesGrid}>
                  {controllableDevices.map((device) => {
                    const isOn = getDeviceState(device);
                    const isControllingThis = isControlling === device.id;
                    return (
                      <Pressable
                        key={device.id}
                        onPress={() => handleControlDevice(device, !isOn)}
                        disabled={isControllingThis || isOn === null}
                        style={[
                          styles.deviceCard,
                          { backgroundColor: isOn ? CARD_GREEN : CARD_ORANGE },
                          isControllingThis && styles.deviceCardDisabled,
                        ]}
                      >
                        <View style={styles.deviceCardContent}>
                          <View>
                            <ThemedText style={styles.deviceName}>{device.name}</ThemedText>
                            <ThemedText style={styles.deviceStatus}>
                              {isControllingThis ? 'Загрузка...' : isOn ? 'Вкл.' : 'Выкл.'}
                            </ThemedText>
                          </View>
                          <View style={[styles.deviceIconContainer, { backgroundColor: isOn ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)' }]}>
                            {isControllingThis ? (
                              <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                              <MaterialIcons name="power-settings-new" size={22} color={isOn ? '#FFFFFF' : 'rgba(255,255,255,0.6)'} />
                            )}
                          </View>
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              )}
              {isLoadingDevices && (
                <View style={styles.loadingOverlay}>
                  <PageLoader size={80} />
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8 },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: 48 },
  emptyTitle: { fontSize: 16, fontWeight: '600', color: '#FFFFFF', marginTop: 16 },
  emptySubtitle: { fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  roomSelectorContainer: { marginBottom: 8 },
  roomLabel: { fontSize: 14, color: 'rgba(255,255,255,0.8)', marginBottom: 8 },
  roomSelectorButton: {
    backgroundColor: CARD_ORANGE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomSelectorText: { fontSize: 16, color: '#FFFFFF', fontWeight: '500' },
  roomDropdown: { backgroundColor: CARD_ORANGE, borderRadius: 12, marginTop: 8, overflow: 'hidden' },
  roomDropdownItem: { paddingHorizontal: 16, paddingVertical: 12 },
  roomDropdownItemActive: { backgroundColor: 'rgba(255,255,255,0.2)' },
  roomDropdownText: { fontSize: 16, color: '#FFFFFF' },
  devicesTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginTop: 8 },
  devicesAreaWrapper: { position: 'relative', minHeight: 140 },
  devicesGridPlaceholder: { width: CARD_WIDTH, height: 100, borderRadius: 16, backgroundColor: CARD_ORANGE, opacity: 0.6 },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  devicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  deviceCard: { width: CARD_WIDTH, borderRadius: 16, padding: 16, minHeight: 100 },
  deviceCardDisabled: { opacity: 0.5 },
  deviceCardContent: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', flex: 1, paddingRight: 16 },
  deviceName: { fontSize: 15, fontWeight: '500', color: '#FFFFFF', flex: 1, marginRight: 8 },
  deviceStatus: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 4 },
  deviceIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
