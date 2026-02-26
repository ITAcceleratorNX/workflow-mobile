import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import { useActivityTrackerStore } from '@/stores/activity-tracker-store';
import { useToast } from '@/context/toast-context';
import { useActivityTracker } from '@/hooks/use-activity-tracker';
import { useHealthReminders } from '@/hooks/use-health-reminders';
import {
  getClientRoomSubscriptions,
  getRoomDevicesForClient,
  controlDevice,
  type YandexDevice,
  type ClientRoomSubscription,
} from '@/lib/api';

type TabType = 'home' | 'health' | 'settings';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const PRIMARY_ORANGE = '#E25B21';
const DARK_BG = '#1C1C1E';
const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';
const GRAY_600 = '#3A3A3C';

export default function ClientDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const { show } = useToast();

  // Определяем эффективную роль
  const effectiveRole = role || user?.role;
  const isClient = effectiveRole?.toLowerCase() === 'client';

  // Редирект если не клиент
  useEffect(() => {
    if (effectiveRole && !isClient) {
      console.log('[ClientDashboard] Not a client, redirecting:', effectiveRole);
      router.replace('/login');
    }
  }, [effectiveRole, isClient, router]);

  // Activity Tracker Store
  const {
    statistics,
    healthReminders,
    autoStartInWorkingHours,
    setHealthReminders,
    setAutoStartInWorkingHours,
  } = useActivityTrackerStore();

  // Логирование изменений статистики
  useEffect(() => {
    console.log('[UI] Statistics updated:', {
      sitting: statistics.totalSittingTime.toFixed(1),
      standing: statistics.totalStandingTime.toFixed(1),
      standUps: statistics.standUpCount,
      posture: statistics.currentPosture,
    });
  }, [statistics]);

  // Activity Tracker Hook (работает с сенсорами)
  const { isTracking, startTracking, stopTracking, requestPermission, isAvailable } = useActivityTracker();

  // Health-напоминания: уведомление "пора встать" при долгом сидении
  useHealthReminders();

  const [activeSection, setActiveSection] = useState<TabType>('home');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Smart Home State
  const [subscriptions, setSubscriptions] = useState<ClientRoomSubscription[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [devices, setDevices] = useState<YandexDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isControlling, setIsControlling] = useState<string | null>(null);
  const [showRoomSelector, setShowRoomSelector] = useState(false);

  // Format time helper
  const formatTime = useCallback((seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
      return `${hours}ч ${minutes}м ${secs.toString().padStart(2, '0')}с`;
    } else if (minutes > 0) {
      return `${minutes}м ${secs.toString().padStart(2, '0')}с`;
    } else {
      return `${secs}с`;
    }
  }, []);

  // Toggle tracker
  const handleToggleTracker = useCallback(async () => {
    if (isTracking) {
      stopTracking(true);
      show({
        title: 'Трекер остановлен',
        variant: 'default',
        duration: 2000,
      });
    } else {
      // Проверяем доступность датчиков
      if (isAvailable === false) {
        show({
          title: 'Датчики недоступны',
          description: 'Акселерометр не доступен на этом устройстве',
          variant: 'destructive',
          duration: 4000,
        });
        return;
      }

      // Запрашиваем разрешение на датчики (iOS требует explicit permission request)
      console.log('[Tracker] Requesting motion permission...');
      const granted = await requestPermission();
      console.log('[Tracker] Permission granted:', granted);

      if (!granted) {
        show({
          title: 'Доступ к датчикам',
          description: 'Разрешите доступ к датчикам движения для работы трекера активности. Откройте Настройки > Приватность и безопасность > Движение и фитнес.',
          variant: 'destructive',
          duration: 5000,
        });
        return;
      }

      startTracking(true);
      show({
        title: 'Трекер запущен',
        description: 'Отслеживание активности начато',
        variant: 'success',
        duration: 2000,
      });
    }
  }, [isTracking, isAvailable, startTracking, stopTracking, requestPermission, show]);

  // Load Smart Home Subscriptions
  useEffect(() => {
    const loadSubscriptions = async () => {
      if (!user?.id) {
        console.log('[SmartHome] No user ID, skipping load');
        return;
      }
      try {
        setLoading(true);
        console.log('[SmartHome] Loading subscriptions for user:', user.id);
        const result = await getClientRoomSubscriptions(user.id);
        console.log('[SmartHome] Subscriptions result:', result);

        if (result.ok) {
          const subs = result.data.subscriptions || [];
          console.log('[SmartHome] Loaded subscriptions:', subs.length);
          setSubscriptions(subs);
          if (subs.length > 0 && !selectedRoomId) {
            setSelectedRoomId(subs[0].meeting_room_id);
          }
        } else {
          console.error('[SmartHome] Failed to load subscriptions:', result.error);
          show({
            title: 'Ошибка загрузки',
            description: result.error,
            variant: 'destructive',
            duration: 3000,
          });
        }
      } catch (err) {
        console.error('[SmartHome] Error loading subscriptions:', err);
        show({
          title: 'Ошибка',
          description: 'Не удалось загрузить комнаты',
          variant: 'destructive',
          duration: 3000,
        });
      } finally {
        setLoading(false);
      }
    };
    loadSubscriptions();
  }, [user?.id, show]);

  // Load Devices when room changes
  useEffect(() => {
    const loadDevices = async () => {
      if (!selectedRoomId) {
        console.log('[SmartHome] No room selected, skipping device load');
        return;
      }
      try {
        setIsLoadingDevices(true);
        console.log('[SmartHome] Loading devices for room:', selectedRoomId);
        const result = await getRoomDevicesForClient(selectedRoomId);
        console.log('[SmartHome] Devices result:', result);

        if (result.ok) {
          setDevices(result.data.devices || []);
        } else {
          console.error('[SmartHome] Failed to load devices:', result.error);
          show({
            title: 'Ошибка загрузки',
            description: result.error,
            variant: 'destructive',
            duration: 3000,
          });
        }
      } catch (err) {
        console.error('[SmartHome] Error loading devices:', err);
        show({
          title: 'Ошибка',
          description: 'Не удалось загрузить устройства',
          variant: 'destructive',
          duration: 3000,
        });
      } finally {
        setIsLoadingDevices(false);
      }
    };
    loadDevices();
  }, [selectedRoomId, show]);

  // Control device
  const handleControlDevice = useCallback(
    async (device: YandexDevice, value: boolean) => {
      try {
        setIsControlling(device.id);
        const result = await controlDevice({
          device_id: device.id,
          action_type: 'devices.capabilities.on_off',
          action_state: {
            instance: 'on',
            value: value,
          },
        });

        if (result.ok) {
          show({
            title: 'Успешно',
            description: `${device.name} ${value ? 'включено' : 'выключено'}`,
            variant: 'success',
            duration: 2000,
          });

          // Update local state
          setDevices((prevDevices) =>
            prevDevices.map((d) => {
              if (d.id === device.id) {
                const updatedDevice = { ...d };
                const capability = updatedDevice.capabilities?.find(
                  (cap) => cap.type === 'devices.capabilities.on_off'
                );
                if (capability) {
                  capability.state = { ...capability.state, value };
                }
                return updatedDevice;
              }
              return d;
            })
          );
        } else {
          show({
            title: 'Ошибка',
            description: 'Не удалось управлять устройством',
            variant: 'destructive',
            duration: 2000,
          });
        }
      } catch (err) {
        show({
          title: 'Ошибка',
          description: 'Не удалось управлять устройством',
          variant: 'destructive',
          duration: 2000,
        });
      } finally {
        setIsControlling(null);
      }
    },
    [show]
  );

  // Get device state
  const getDeviceState = useCallback((device: YandexDevice): boolean | null => {
    const capability = device.capabilities?.find(
      (cap) => cap.type === 'devices.capabilities.on_off'
    );
    if (capability?.state?.value !== undefined) {
      return capability.state.value;
    }
    return null;
  }, []);

  // Get controllable devices
  const controllableDevices = devices.filter((device) => {
    return device.capabilities?.some(
      (cap) => cap.type === 'devices.capabilities.on_off'
    );
  });

  // Get selected room name
  const selectedRoom = subscriptions.find(
    (sub) => sub.meeting_room_id === selectedRoomId
  );

  // Handle refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    if (user?.id) {
      const result = await getClientRoomSubscriptions(user.id);
      if (result.ok) {
        setSubscriptions(result.data.subscriptions || []);
      }
      if (selectedRoomId) {
        const devicesResult = await getRoomDevicesForClient(selectedRoomId);
        if (devicesResult.ok) {
          setDevices(devicesResult.data.devices || []);
        }
      }
    }
    setRefreshing(false);
  }, [user?.id, selectedRoomId]);

  // Section titles
  const getSectionTitle = () => {
    switch (activeSection) {
      case 'home':
        return 'Управление "умным домом"';
      case 'health':
        return 'Health-напоминание';
      case 'settings':
        return 'Настройки трекера';
      default:
        return '';
    }
  };

  const getSectionSubtitle = () => {
    switch (activeSection) {
      case 'home':
        return 'Выберите комнату и управляйте устройствами';
      case 'health':
        return '';
      case 'settings':
        return 'Настройте параметры отслеживания';
      default:
        return '';
    }
  };

  const handleTabPress = useCallback((tab: TabType) => {
    setActiveSection(tab);
    if (tab === 'home') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
  }, []);

  // Render Home Section (Smart Home)
  const renderHomeSection = () => (
    <View style={styles.sectionContent}>
      {subscriptions.length === 0 ? (
        <View style={styles.emptyState}>
          <MaterialIcons name="home" size={64} color="rgba(255,255,255,0.4)" />
          <ThemedText style={styles.emptyTitle}>Нет подписок на комнаты</ThemedText>
          <ThemedText style={styles.emptySubtitle}>
            Обратитесь к администратору
          </ThemedText>
        </View>
      ) : (
        <>
          {/* Room Selector */}
          <View style={styles.roomSelectorContainer}>
            <ThemedText style={styles.roomLabel}>Выберите комнату:</ThemedText>
            <Pressable
              onPress={() => setShowRoomSelector(!showRoomSelector)}
              style={styles.roomSelectorButton}
            >
              <ThemedText style={styles.roomSelectorText}>
                {selectedRoom?.meetingRoom?.name || 'Выберите комнату'}
                {selectedRoom?.meetingRoom?.office
                  ? ` (${selectedRoom.meetingRoom.office.name})`
                  : ''}
              </ThemedText>
              <MaterialIcons
                name={showRoomSelector ? 'expand-less' : 'expand-more'}
                size={24}
                color="#FFFFFF"
              />
            </Pressable>

            {/* Room Dropdown */}
            {showRoomSelector && (
              <View style={styles.roomDropdown}>
                {subscriptions.map((sub) => (
                  <Pressable
                    key={sub.id}
                    onPress={() => {
                      setSelectedRoomId(sub.meeting_room_id);
                      setShowRoomSelector(false);
                    }}
                    style={[
                      styles.roomDropdownItem,
                      selectedRoomId === sub.meeting_room_id &&
                        styles.roomDropdownItemActive,
                    ]}
                  >
                    <ThemedText style={styles.roomDropdownText}>
                      {sub.meetingRoom?.name || `Комната ID: ${sub.meeting_room_id}`}
                      {sub.meetingRoom?.office
                        ? ` (${sub.meetingRoom.office.name})`
                        : ''}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>

          {/* Devices Title */}
          <ThemedText style={styles.devicesTitle}>Устройство в комнате</ThemedText>

          {/* Loading State */}
          {isLoadingDevices ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#FFFFFF" />
            </View>
          ) : controllableDevices.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons
                name="lightbulb"
                size={64}
                color="rgba(255,255,255,0.4)"
              />
              <ThemedText style={styles.emptyTitle}>
                Нет доступных устройств
              </ThemedText>
              <ThemedText style={styles.emptySubtitle}>
                В этой комнате нет устройств
              </ThemedText>
            </View>
          ) : (
            /* Device Cards Grid */
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
                        <ThemedText style={styles.deviceName}>
                          {device.name}
                        </ThemedText>
                        <ThemedText style={styles.deviceStatus}>
                          {isControllingThis
                            ? 'Загрузка...'
                            : isOn
                              ? 'Вкл.'
                              : 'Выкл.'}
                        </ThemedText>
                      </View>
                      <View
                        style={[
                          styles.deviceIconContainer,
                          { backgroundColor: isOn ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.2)' },
                        ]}
                      >
                        {isControllingThis ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <MaterialIcons
                            name="power-settings-new"
                            size={28}
                            color={isOn ? '#FFFFFF' : 'rgba(255,255,255,0.6)'}
                          />
                        )}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </>
      )}
    </View>
  );

  // Render Health Section
  const renderHealthSection = () => (
    <View style={styles.sectionContent}>
      <ThemedText style={styles.statsLabel}>Общая статистика</ThemedText>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        {/* Tracker Card */}
        <Pressable
          onPress={handleToggleTracker}
          style={[styles.statCard, { backgroundColor: CARD_ORANGE }]}
        >
          <View style={styles.statCardContent}>
            <View>
              <ThemedText style={styles.statCardTitle}>Трекер</ThemedText>
              <ThemedText style={styles.statCardSubtitle}>
                {isTracking ? 'Вкл.' : 'Выкл.'}
              </ThemedText>
            </View>
            <View style={styles.statIconContainer}>
              <MaterialIcons
                name={isTracking ? 'pause' : 'play-arrow'}
                size={24}
                color="#FFFFFF"
              />
            </View>
          </View>
        </Pressable>

        {/* Sitting Time Card */}
        <View style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
          <View style={styles.statCardContent}>
            <View>
              <ThemedText style={styles.statCardTitle}>Время сидя</ThemedText>
            </View>
            <MaterialIcons name="access-time" size={24} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.statCardValue}>
            {formatTime(statistics.totalSittingTime)}
          </ThemedText>
        </View>

        {/* Total Tracking Time Card - spans 2 rows */}
        <View
          style={[
            styles.statCard,
            styles.statCardLarge,
            { backgroundColor: CARD_ORANGE },
          ]}
        >
          <ThemedText style={styles.statCardTitle}>
            Общее время отслеживания
          </ThemedText>
          <ThemedText style={styles.statCardValueLarge}>
            {formatTime(statistics.totalSittingTime + statistics.totalStandingTime)}
          </ThemedText>
        </View>

        {/* Standing Time Card */}
        <View style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
          <View style={styles.statCardContent}>
            <View>
              <ThemedText style={styles.statCardTitle}>Время стоя</ThemedText>
            </View>
            <MaterialIcons name="trending-up" size={24} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.statCardValue}>
            {formatTime(statistics.totalStandingTime)}
          </ThemedText>
        </View>

        {/* Stand Up Count Card */}
        <View style={[styles.statCard, { backgroundColor: CARD_GREEN }]}>
          <View style={styles.statCardContent}>
            <View style={{ flex: 1 }}>
              <ThemedText style={[styles.statCardTitle, { fontSize: 13 }]}>
                Количество вставаний
              </ThemedText>
            </View>
            <MaterialIcons name="bar-chart" size={24} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.statCardValue}>
            {statistics.standUpCount}
          </ThemedText>
        </View>
      </View>
    </View>
  );

  // Toggle component
  const Toggle = ({
    value,
    onToggle,
  }: {
    value: boolean;
    onToggle: () => void;
  }) => (
    <Pressable onPress={onToggle} style={styles.toggleContainer}>
      <View
        style={[
          styles.toggleTrack,
          { backgroundColor: value ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.1)' },
        ]}
      >
        <View
          style={[
            styles.toggleThumb,
            {
              backgroundColor: value ? '#FFFFFF' : 'rgba(255,255,255,0.4)',
              transform: [{ translateX: value ? 20 : 0 }],
            },
          ]}
        />
      </View>
    </Pressable>
  );

  // Render Settings Section
  const renderSettingsSection = () => (
    <View style={styles.sectionContent}>
      {/* Reminders Toggle */}
      <Pressable
        onPress={() =>
          setHealthReminders({ enabled: !healthReminders.enabled })
        }
        style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}
      >
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextContainer}>
            <ThemedText style={styles.settingsCardTitle}>Напоминания</ThemedText>
            <ThemedText style={styles.settingsCardSubtitle}>
              Напоминать вставать каждые {healthReminders.sittingIntervalMinutes} мин
            </ThemedText>
          </View>
          <Toggle
            value={healthReminders.enabled}
            onToggle={() =>
              setHealthReminders({ enabled: !healthReminders.enabled })
            }
          />
        </View>
      </Pressable>

      {/* Interval Settings */}
      <View style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}>
        <ThemedText style={styles.settingsCardTitle}>
          Интервал напоминаний
        </ThemedText>
        <View style={styles.intervalButtons}>
          {[2, 30, 45, 60, 90, 120].map((mins) => (
            <Pressable
              key={mins}
              onPress={() =>
                setHealthReminders({ sittingIntervalMinutes: mins })
              }
              style={[
                styles.intervalButton,
                healthReminders.sittingIntervalMinutes === mins
                  ? { backgroundColor: '#FFFFFF' }
                  : { backgroundColor: 'rgba(255,255,255,0.2)' },
              ]}
            >
              <ThemedText
                style={[
                  styles.intervalButtonText,
                  {
                    color:
                      healthReminders.sittingIntervalMinutes === mins
                        ? CARD_ORANGE
                        : '#FFFFFF',
                  },
                ]}
              >
                {mins} мин
              </ThemedText>
            </Pressable>
          ))}
        </View>
      </View>

      {/* Auto-start Toggle */}
      <Pressable
        onPress={() => setAutoStartInWorkingHours(!autoStartInWorkingHours)}
        style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}
      >
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextContainer}>
            <ThemedText style={styles.settingsCardTitle}>
              Автозапуск трекера
            </ThemedText>
            <ThemedText style={styles.settingsCardSubtitle}>
              Запускать в рабочее время
            </ThemedText>
          </View>
          <Toggle
            value={autoStartInWorkingHours}
            onToggle={() => setAutoStartInWorkingHours(!autoStartInWorkingHours)}
          />
        </View>
      </Pressable>

      {/* Quiet Mode Toggle */}
      <Pressable
        onPress={() =>
          setHealthReminders({
            disableDuringMeetings: !healthReminders.disableDuringMeetings,
          })
        }
        style={[styles.settingsCard, { backgroundColor: CARD_ORANGE }]}
      >
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextContainer}>
            <ThemedText style={styles.settingsCardTitle}>
              Тихий режим на встречах
            </ThemedText>
            <ThemedText style={styles.settingsCardSubtitle}>
              Отключать напоминания во время встреч
            </ThemedText>
          </View>
          <Toggle
            value={healthReminders.disableDuringMeetings}
            onToggle={() =>
              setHealthReminders({
                disableDuringMeetings: !healthReminders.disableDuringMeetings,
              })
            }
          />
        </View>
      </Pressable>

      <ThemedText style={[styles.settingsCardSubtitle, { marginTop: 12, opacity: 0.8 }]}>
        Трекер учитывает время, когда приложение на экране. В фоне учёт приостанавливается.
      </ThemedText>
    </View>
  );

  // Если роль еще загружается - показываем загрузку
  if (!effectiveRole) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={PRIMARY_ORANGE} />
        </View>
      </ThemedView>
    );
  }

  // Если пользователь не клиент - показываем заглушку
  if (!isClient) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <View style={styles.notClientContainer}>
          <MaterialIcons name="lock" size={64} color="#E25B21" />
          <ThemedText style={styles.notClientTitle}>
            Доступ ограничен
          </ThemedText>
          <ThemedText style={styles.notClientSubtitle}>
            Эта страница доступна только для клиентов{'\n'}
            Ваша роль: {effectiveRole || 'не определена'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: insets.bottom + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#FFFFFF"
            colors={['#E25B21']}
          />
        }
      >
        {/* Header Section - Dark */}
        <View style={styles.header}>
          {/* Title */}
          <ThemedText style={styles.headerTitle}>{getSectionTitle()}</ThemedText>
          {getSectionSubtitle() && (
            <ThemedText style={styles.headerSubtitle}>
              {getSectionSubtitle()}
            </ThemedText>
          )}

          {/* Tab Icons */}
          <View style={styles.tabContainer}>
            {/* Home Tab */}
            <Pressable
              onPress={() => handleTabPress('home')}
              style={[
                styles.tabButton,
                { backgroundColor: activeSection === 'home' ? PRIMARY_ORANGE : GRAY_600 },
              ]}
            >
              <MaterialIcons name="home" size={28} color="#FFFFFF" />
            </Pressable>

            {/* Health Tab */}
            <Pressable
              onPress={() => handleTabPress('health')}
              style={[
                styles.tabButton,
                { backgroundColor: activeSection === 'health' ? PRIMARY_ORANGE : GRAY_600 },
              ]}
            >
              <MaterialIcons
                name="favorite"
                size={28}
                color="#FFFFFF"
              />
            </Pressable>

            {/* Settings Tab */}
            <Pressable
              onPress={() => handleTabPress('settings')}
              style={[
                styles.tabButton,
                { backgroundColor: activeSection === 'settings' ? PRIMARY_ORANGE : GRAY_600 },
              ]}
            >
              <MaterialIcons name="settings" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Orange Content Section */}
        <View style={styles.contentSection}>
          {activeSection === 'home' && renderHomeSection()}
          {activeSection === 'health' && renderHealthSection()}
          {activeSection === 'settings' && renderSettingsSection()}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DARK_BG,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginBottom: 16,
  },
  tabContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  tabButton: {
    width: 64,
    height: 64,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  contentSection: {
    flex: 1,
    backgroundColor: PRIMARY_ORANGE,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    paddingTop: 24,
    paddingHorizontal: 16,
    paddingBottom: 32,
    minHeight: 500,
  },
  sectionContent: {
    gap: 16,
  },
  // Home Section Styles
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  roomSelectorContainer: {
    marginBottom: 8,
  },
  roomLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  roomSelectorButton: {
    backgroundColor: CARD_ORANGE,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  roomSelectorText: {
    fontSize: 16,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  roomDropdown: {
    backgroundColor: CARD_ORANGE,
    borderRadius: 12,
    marginTop: 8,
    overflow: 'hidden',
  },
  roomDropdownItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  roomDropdownItemActive: {
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  roomDropdownText: {
    fontSize: 16,
    color: '#FFFFFF',
  },
  devicesTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 48,
  },
  devicesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  deviceCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
  },
  deviceCardDisabled: {
    opacity: 0.5,
  },
  deviceCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    flex: 1,
  },
  deviceName: {
    fontSize: 15,
    fontWeight: '500',
    color: '#FFFFFF',
    flex: 1,
    marginRight: 8,
  },
  deviceStatus: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  deviceIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Health Section Styles
  statsLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    minHeight: 100,
  },
  statCardLarge: {
    height: 140,
  },
  statCardContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  statCardTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  statCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  statCardValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 8,
  },
  statCardValueLarge: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Settings Section Styles
  settingsCard: {
    borderRadius: 16,
    padding: 16,
  },
  settingsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  settingsTextContainer: {
    flex: 1,
    marginRight: 16,
  },
  settingsCardTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  settingsCardSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    marginTop: 4,
  },
  toggleContainer: {
    padding: 4,
  },
  toggleTrack: {
    width: 52,
    height: 28,
    borderRadius: 14,
    padding: 2,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  intervalButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 12,
  },
  intervalButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  intervalButtonText: {
    fontSize: 13,
    fontWeight: '500',
  },
  notClientContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  notClientTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginTop: 16,
    marginBottom: 8,
  },
  notClientSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.6)',
    textAlign: 'center',
    lineHeight: 20,
  },
});
