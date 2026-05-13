import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { PageLoader, ScreenHeader } from '@/components/ui';
import { SmartDeskCalculator } from '@/components/smart-office/smart-desk-calculator';
import { Radius, Spacing } from '@/constants/theme';
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

function smartHomeCardWidth(screenWidth: number) {
  const pad = Spacing.lg * 3;
  return Math.max(0, (screenWidth - pad) / 2);
}

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
  const { width: windowWidth } = useWindowDimensions();
  const cardWidth = useMemo(() => smartHomeCardWidth(windowWidth), [windowWidth]);
  const user = useAuthStore((state) => state.user);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { show: showToast } = useToast();
  const background = useThemeColor({}, 'background');
  const primary = useThemeColor({}, 'primary');
  const success = useThemeColor({}, 'success');
  const text = useThemeColor({}, 'text');
  const textSecondary = useThemeColor({}, 'textSecondary');
  const textMuted = useThemeColor({}, 'textMuted');
  const onPrimary = useThemeColor({}, 'onPrimary');

  const onAccentSurface = useMemo(
    () => ({
      iconBubble: 'rgba(255,255,255,0.22)' as const,
      iconBubbleStrong: 'rgba(255,255,255,0.32)' as const,
      inactivePower: 'rgba(255,255,255,0.65)' as const,
    }),
    []
  );

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
      <ScreenHeader
        title="Управление умным офисом"
        titleStyle={styles.screenTitleLarge}
      />
      {loading && subscriptions.length === 0 ? (
        <View style={styles.fullScreenLoading}>
          <PageLoader size={96} />
        </View>
      ) : (
        <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + Spacing.huge - 4 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {subscriptions.length === 0 ? (
          <>
            <View style={styles.emptyState}>
              <MaterialIcons name="home" size={64} color={textMuted} />
              <ThemedText style={[styles.emptyTitle, { color: text }]}>Нет подписок на комнаты</ThemedText>
              <ThemedText style={[styles.emptySubtitle, { color: textSecondary }]}>
                Обратитесь к администратору
              </ThemedText>
            </View>
            <SmartDeskCalculator variant="compact" compactTheme="app" containerStyle={styles.deskCalculatorSection} />
          </>
        ) : (
          <>
            <View style={styles.roomSelectorContainer}>
              <ThemedText style={[styles.devicesTitle, styles.sectionHeadingFirst, { color: text }]}>
                Выберите комнату
              </ThemedText>
              <Pressable
                onPress={() => setShowRoomSelector(!showRoomSelector)}
                accessibilityRole="button"
                accessibilityLabel="Выбор комнаты"
                accessibilityState={{ expanded: showRoomSelector }}
                style={({ pressed }) => [
                  styles.deviceCard,
                  styles.roomCardFullWidth,
                  { backgroundColor: primary, opacity: pressed ? 0.9 : 1 },
                ]}
              >
                <View style={styles.deviceCardContent}>
                  <View style={styles.roomCardTextCol}>
                    <ThemedText
                      style={[styles.deviceName, styles.roomCardTitleNoFlex, { color: onPrimary }]}
                      numberOfLines={2}
                    >
                      {selectedRoom?.meetingRoom?.name || 'Выберите комнату'}
                    </ThemedText>
                    <ThemedText style={[styles.deviceStatus, { color: onPrimary, opacity: 0.88 }]} numberOfLines={2}>
                      {selectedRoom?.meetingRoom?.office?.name || 'Нажмите, чтобы открыть список'}
                    </ThemedText>
                  </View>
                  <View
                    style={[styles.deviceIconContainer, { backgroundColor: onAccentSurface.iconBubble }]}
                  >
                    <MaterialIcons
                      name={showRoomSelector ? 'expand-less' : 'expand-more'}
                      size={22}
                      color={onPrimary}
                    />
                  </View>
                </View>
              </Pressable>
              {showRoomSelector && (
                <View style={[styles.roomDropdown, { backgroundColor: primary }]}>
                  {subscriptions.map((sub) => (
                    <Pressable
                      key={sub.id}
                      onPress={() => {
                        setSelectedRoomId(sub.meeting_room_id);
                        setShowRoomSelector(false);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={sub.meetingRoom?.name ?? `Комната ${sub.meeting_room_id}`}
                      style={[
                        styles.roomDropdownItem,
                        selectedRoomId === sub.meeting_room_id && {
                          backgroundColor: onAccentSurface.iconBubble,
                        },
                      ]}
                    >
                      <ThemedText style={[styles.roomDropdownText, { color: onPrimary }]}>
                        {sub.meetingRoom?.name || `Комната ID: ${sub.meeting_room_id}`}
                        {sub.meetingRoom?.office ? ` (${sub.meetingRoom.office.name})` : ''}
                      </ThemedText>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
            <ThemedText style={[styles.devicesTitle, { color: text }]}>Устройства в кабинете</ThemedText>
            <View style={styles.devicesAreaWrapper}>
              {isLoadingDevices ? (
                <View style={[styles.devicesGridPlaceholder, { width: cardWidth, backgroundColor: primary }]} />
              ) : controllableDevices.length === 0 ? (
                <View style={styles.emptyState}>
                  <MaterialIcons name="lightbulb" size={64} color={textMuted} />
                  <ThemedText style={[styles.emptyTitle, { color: text }]}>Нет доступных устройств</ThemedText>
                  <ThemedText style={[styles.emptySubtitle, { color: textSecondary }]}>
                    В этой комнате нет устройств
                  </ThemedText>
                </View>
              ) : (
                <View style={styles.devicesGrid}>
                  {controllableDevices.map((device) => {
                    const isOn = getDeviceState(device);
                    const isControllingThis = isControlling === device.id;
                    const cardBg = isOn ? success : primary;
                    return (
                      <Pressable
                        key={device.id}
                        onPress={() => handleControlDevice(device, !isOn)}
                        disabled={isControllingThis || isOn === null}
                        accessibilityRole="button"
                        accessibilityLabel={`${device.name}, ${isOn ? 'включено' : 'выключено'}`}
                        style={[
                          styles.deviceCard,
                          { width: cardWidth, backgroundColor: cardBg },
                          isControllingThis && styles.deviceCardDisabled,
                        ]}
                      >
                        <View style={styles.deviceCardContent}>
                          <View>
                            <ThemedText style={[styles.deviceName, { color: onPrimary }]}>
                              {device.name}
                            </ThemedText>
                            <ThemedText style={[styles.deviceStatus, { color: onPrimary, opacity: 0.88 }]}>
                              {isControllingThis ? 'Загрузка...' : isOn ? 'Вкл.' : 'Выкл.'}
                            </ThemedText>
                          </View>
                          <View
                            style={[
                              styles.deviceIconContainer,
                              {
                                backgroundColor: isOn
                                  ? onAccentSurface.iconBubbleStrong
                                  : onAccentSurface.iconBubble,
                              },
                            ]}
                          >
                            {isControllingThis ? (
                              <ActivityIndicator size="small" color={onPrimary} />
                            ) : (
                              <MaterialIcons
                                name="power-settings-new"
                                size={22}
                                color={isOn ? onPrimary : onAccentSurface.inactivePower}
                              />
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
            <SmartDeskCalculator variant="compact" compactTheme="app" containerStyle={styles.deskCalculatorSection} />
          </>
        )}
      </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  fullScreenLoading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.giant,
  },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.md },
  screenTitleLarge: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    letterSpacing: -0.35,
  },
  deskCalculatorSection: { marginTop: Spacing.md },
  emptyState: { alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.giant },
  emptyTitle: { fontSize: 16, fontWeight: '600', marginTop: Spacing.lg },
  emptySubtitle: { fontSize: 14, marginTop: Spacing.xs },
  roomSelectorContainer: { marginBottom: Spacing.md },
  sectionHeadingFirst: { marginTop: 0 },
  roomCardFullWidth: {
    width: '100%',
    alignSelf: 'stretch',
  },
  roomCardTextCol: {
    flex: 1,
    minWidth: 0,
    marginRight: Spacing.sm,
  },
  roomCardTitleNoFlex: {
    flex: 0,
  },
  roomDropdown: { borderRadius: Radius.lg - 2, marginTop: Spacing.sm, overflow: 'hidden' },
  roomDropdownItem: { paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
  roomDropdownText: { fontSize: 16 },
  devicesTitle: {
    fontSize: 17,
    fontWeight: '700',
    marginTop: Spacing.xs,
    marginBottom: Spacing.sm + 2,
    letterSpacing: -0.2,
  },
  devicesAreaWrapper: { position: 'relative' },
  devicesGridPlaceholder: {
    height: 100,
    borderRadius: Radius.lg,
    opacity: 0.55,
  },
  loadingOverlay: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  devicesGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  deviceCard: { borderRadius: Radius.lg - 2, padding: Spacing.lg, minHeight: 100 },
  deviceCardDisabled: { opacity: 0.5 },
  deviceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flex: 1,
    paddingRight: Spacing.lg,
  },
  deviceName: { fontSize: 15, fontWeight: '500', flex: 1, marginRight: Spacing.sm },
  deviceStatus: { fontSize: 13, marginTop: Spacing.xs },
  deviceIconContainer: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
});
