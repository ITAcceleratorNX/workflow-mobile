import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  ActivityIndicator,
  Dimensions,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle } from 'react-native-svg';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import { useActivityTrackerStore } from '@/stores/activity-tracker-store';
import { useStepsStore } from '@/stores/steps-store';
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
import { stepLengthMetersFromHeight, stepsToKm } from '@/lib/steps-utils';

type TabType = 'home' | 'health' | 'settings' | 'steps';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const PRIMARY_ORANGE = '#E25B21';
const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';
const TRACKER_ACTIVE_TEAL = '#1CC7A5';
const DARK_BG = '#1C1C1E';

type AdminCardKey = 'categories' | 'users' | 'office' | 'smart-home' | 'statistics';

const ADMIN_MANAGEMENT_CARDS: {
  key: AdminCardKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  {
    key: 'categories',
    title: 'Управление категориями',
    subtitle: 'Категории и подкатегории услуг',
    icon: 'category',
  },
  {
    key: 'users',
    title: 'Управление пользователями',
    subtitle: 'Роли и запросы на регистрацию',
    icon: 'groups',
  },
  {
    key: 'office',
    title: 'Управление офисом',
    subtitle: 'Кабинеты, переговорные, локации',
    icon: 'business',
  },
  {
    key: 'smart-home',
    title: 'Умный дом',
    subtitle: 'Яндекс.Умный дом: токены и устройства',
    icon: 'home-filled',
  },
  {
    key: 'statistics',
    title: 'Статистика',
    subtitle: 'Отчёты и аналитика по заявкам',
    icon: 'insert-chart-outlined',
  },
];

// Главная «Управление» для исполнителя: department-head и manager (как management в workflow-web)
type ExecutorCardKey =
  | 'users'
  | 'statistics'
  | 'office'
  | 'categories'
  | 'subcategories'
  | 'registration-requests';

const DEPARTMENT_HEAD_MANAGEMENT_CARDS: {
  key: ExecutorCardKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  {
    key: 'statistics',
    title: 'Аналитика',
    subtitle: 'SLA, оценки, статистика по заявкам',
    icon: 'insert-chart-outlined',
  },
];

// Manager: как в браузере (мобильная версия) — 3 раздела управления + Аналитика (внутри неё вкладки Статистика и Аналитика)
const MANAGER_MANAGEMENT_CARDS: {
  key: ExecutorCardKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  {
    key: 'office',
    title: 'Управление офисами',
    subtitle: 'Добавление и управление офисами компании',
    icon: 'business',
  },
  {
    key: 'categories',
    title: 'Категории услуг',
    subtitle: 'Категории и подкатегории услуг',
    icon: 'category',
  },
  {
    key: 'users',
    title: 'Управление пользователями',
    subtitle: 'Пользователи и запросы на регистрацию',
    icon: 'groups',
  },
  {
    key: 'statistics',
    title: 'Аналитика',
    subtitle: 'Статистика и аналитика по заявкам',
    icon: 'insert-chart-outlined',
  },
];

// Главная «Мой кабинет» для роли executor (как executor/management в workflow-web)
type ExecutorCabinetCardKey = 'scan-qr' | 'statistics';

const EXECUTOR_CABINET_CARDS: {
  key: ExecutorCabinetCardKey;
  title: string;
  subtitle: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
}[] = [
  {
    key: 'scan-qr',
    title: 'QR сканер',
    subtitle: 'Сканирование QR-кодов бронирования',
    icon: 'qr-code-2',
  },
  {
    key: 'statistics',
    title: 'Статистика',
    subtitle: 'Мои показатели и рейтинг',
    icon: 'insert-chart-outlined',
  },
];

function AdminWorkerManagementScreen() {
  const insets = useSafeAreaInsets();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const router = useRouter();

  const handleOpen = useCallback(
    (key: AdminCardKey) => {
      switch (key) {
        case 'categories':
          router.push('/admin-worker/categories');
          break;
        case 'users':
          router.push('/admin-worker/users');
          break;
        case 'office':
          router.push('/admin-worker/office');
          break;
        case 'smart-home':
          router.push('/admin-worker/smart-home');
          break;
        case 'statistics':
        default:
          router.push('/admin-worker/statistics');
          break;
      }
    },
    [router],
  );

  return (
    <ThemedView
      style={[styles.adminContainer, { paddingTop: insets.top + 16, backgroundColor: background }]}
    >
      <ScrollView contentContainerStyle={styles.adminContent}>
        <ThemedText type="title" style={[styles.adminTitle, { color: text }]}>
          Управление системой
        </ThemedText>
        <ThemedText style={[styles.adminDescription, { color: textMuted }]}>
          Выберите раздел для управления
        </ThemedText>
        <View style={styles.adminGrid}>
          {ADMIN_MANAGEMENT_CARDS.map((card) => (
            <Pressable
              key={card.key}
              style={[styles.adminCard, { backgroundColor: cardBackground }]}
              onPress={() => handleOpen(card.key)}
            >
              <View style={styles.adminCardHeader}>
                <MaterialIcons
                  name={card.icon}
                  size={28}
                  color={PRIMARY_ORANGE}
                  style={styles.adminIcon}
                />
              </View>
              <ThemedText style={[styles.adminCardTitle, { color: text }]}>
                {card.title}
              </ThemedText>
              <ThemedText style={[styles.adminCardSubtitle, { color: textMuted }]}>
                {card.subtitle}
              </ThemedText>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={PRIMARY_ORANGE}
                style={styles.adminChevron}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** Главная страница «Управление» для исполнителя (department-head, manager) — аналог management в workflow-web */
function ExecutorManagementScreen({
  role: executorRole,
}: {
  role: 'department-head' | 'manager';
}) {
  const insets = useSafeAreaInsets();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const router = useRouter();

  const cards =
    executorRole === 'department-head'
      ? DEPARTMENT_HEAD_MANAGEMENT_CARDS
      : MANAGER_MANAGEMENT_CARDS;

  const handleOpen = useCallback(
    (key: ExecutorCardKey) => {
      // department-head: только Аналитика, свой эндпоинт /analytics/stats/department-head
      if (executorRole === 'department-head') {
        if (key === 'statistics') router.push('/department-head/statistics');
        return;
      }
      // manager: офисы, категории (внутри — вкладки категории/подкатегории), пользователи (внутри — управление/регистрации), аналитика
      switch (key) {
        case 'office':
          router.push('/admin-worker/office');
          break;
        case 'categories':
          router.push('/admin-worker/categories');
          break;
        case 'users':
          router.push('/admin-worker/users');
          break;
        case 'statistics':
          router.push('/manager/statistics');
          break;
      }
    },
    [router, executorRole],
  );

  return (
    <ThemedView
      style={[styles.adminContainer, { paddingTop: insets.top + 16, backgroundColor: background }]}
    >
      <ScrollView contentContainerStyle={styles.adminContent}>
        <ThemedText type="title" style={[styles.adminTitle, { color: text }]}>
          Управление
        </ThemedText>
        <ThemedText style={[styles.adminDescription, { color: textMuted }]}>
          Выберите раздел
        </ThemedText>
        <View style={styles.adminGrid}>
          {cards.map((card) => (
            <Pressable
              key={card.key}
              style={[styles.adminCard, { backgroundColor: cardBackground }]}
              onPress={() => handleOpen(card.key)}
            >
              <View style={styles.adminCardHeader}>
                <MaterialIcons
                  name={card.icon}
                  size={28}
                  color={PRIMARY_ORANGE}
                  style={styles.adminIcon}
                />
              </View>
              <ThemedText style={[styles.adminCardTitle, { color: text }]}>
                {card.title}
              </ThemedText>
              <ThemedText style={[styles.adminCardSubtitle, { color: textMuted }]}>
                {card.subtitle}
              </ThemedText>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={PRIMARY_ORANGE}
                style={styles.adminChevron}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

/** Главная «Мой кабинет» для роли executor — аналог executor/management в workflow-web */
function ExecutorCabinetScreen() {
  const insets = useSafeAreaInsets();
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const router = useRouter();

  const handleOpen = useCallback(
    (key: ExecutorCabinetCardKey) => {
      if (key === 'scan-qr') router.push('/executor/scan-qr');
      else router.push('/executor/statistics');
    },
    [router],
  );

  return (
    <ThemedView
      style={[styles.adminContainer, { paddingTop: insets.top + 16, backgroundColor: background }]}
    >
      <ScrollView contentContainerStyle={styles.adminContent}>
        <ThemedText type="title" style={[styles.adminTitle, { color: text }]}>
          Мой кабинет
        </ThemedText>
        <ThemedText style={[styles.adminDescription, { color: textMuted }]}>
          Выберите раздел
        </ThemedText>
        <View style={styles.adminGrid}>
          {EXECUTOR_CABINET_CARDS.map((card) => (
            <Pressable
              key={card.key}
              style={[styles.adminCard, { backgroundColor: cardBackground }]}
              onPress={() => handleOpen(card.key)}
            >
              <View style={styles.adminCardHeader}>
                <MaterialIcons
                  name={card.icon}
                  size={28}
                  color={PRIMARY_ORANGE}
                  style={styles.adminIcon}
                />
              </View>
              <ThemedText style={[styles.adminCardTitle, { color: text }]}>
                {card.title}
              </ThemedText>
              <ThemedText style={[styles.adminCardSubtitle, { color: textMuted }]}>
                {card.subtitle}
              </ThemedText>
              <MaterialIcons
                name="chevron-right"
                size={20}
                color={PRIMARY_ORANGE}
                style={styles.adminChevron}
              />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </ThemedView>
  );
}

export default function ClientDashboardScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const { show } = useToast();

  // Определяем эффективную роль
  const effectiveRole = role || user?.role;
  const isClient = effectiveRole?.toLowerCase() === 'client';
  const isAdminWorker = effectiveRole?.toLowerCase() === 'admin-worker';
  const isDepartmentHead = effectiveRole?.toLowerCase() === 'department-head';
  const isManager = effectiveRole?.toLowerCase() === 'manager';
  const isExecutor = effectiveRole?.toLowerCase() === 'executor';

  // Редирект если роль не поддерживается на главной (клиент, админ, исполнители)
  useEffect(() => {
    if (
      effectiveRole &&
      !isClient &&
      !isAdminWorker &&
      !isDepartmentHead &&
      !isManager &&
      !isExecutor
    ) {
      console.log('[ClientDashboard] Unsupported role, redirecting:', effectiveRole);
      router.replace('/login');
    }
  }, [effectiveRole, isClient, isAdminWorker, isDepartmentHead, isManager, isExecutor, router]);

  if (isAdminWorker) {
    return <AdminWorkerManagementScreen />;
  }

  if (isExecutor) {
    return <ExecutorCabinetScreen />;
  }

  if (isDepartmentHead || isManager) {
    return (
      <ExecutorManagementScreen
        role={isDepartmentHead ? 'department-head' : 'manager'}
      />
    );
  }

  return <ClientDashboardContent />;
}

/** Контент главной только для роли client. Вынесен в отдельный компонент, чтобы не нарушать правила хуков (одинаковое количество хуков при любом рендере). */
function ClientDashboardContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const isGuest = useAuthStore((state) => state.isGuest);
  const { show } = useToast();
  const effectiveRole = role || user?.role;
  const isClient = effectiveRole?.toLowerCase() === 'client';
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const tabInactiveBackground = useThemeColor({}, 'cardBackground');

  // Activity Tracker Store
  const {
    statistics,
    healthReminders,
    autoStartInWorkingHours,
    setHealthReminders,
    setAutoStartInWorkingHours,
  } = useActivityTrackerStore();

  // Шагомер: данные с устройства (iOS: Motion & Fitness, Android: счётчик шагов)
  const stepsToday = useStepsStore((s) => s.stepsToday);
  const stepsGoal = useStepsStore((s) => s.settings.goalSteps);
  const stepsHeightCm = useStepsStore((s) => s.settings.heightCm);
  const stepLengthM = stepsHeightCm && stepsHeightCm > 0 ? stepLengthMetersFromHeight(stepsHeightCm) : 0.7;
  const stepsKmToday = stepsToKm(stepsToday, stepLengthM);
  const stepsProgress = stepsGoal && stepsGoal > 0 ? Math.min(stepsToday / stepsGoal, 1) : 0;

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

  // Smart Home State
  const [subscriptions, setSubscriptions] = useState<ClientRoomSubscription[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState<number | null>(null);
  const [devices, setDevices] = useState<YandexDevice[]>([]);
  const [isLoadingDevices, setIsLoadingDevices] = useState(false);
  const [isControlling, setIsControlling] = useState<string | null>(null);
  const [showRoomSelector, setShowRoomSelector] = useState(false);

  const MOCK_SUBSCRIPTIONS: ClientRoomSubscription[] = [
    {
      id: 1,
      client_id: 0,
      meeting_room_id: 1,
      meetingRoom: {
        id: 1,
        name: 'Кабинет 101 (демо)',
        office_id: 1,
        office: {
          id: 1,
          name: 'Демо офис',
        },
      },
    },
  ];

  const MOCK_DEVICES: YandexDevice[] = [
    {
      id: 'demo-lamp-1',
      name: 'Свет (демо)',
      type: 'devices.types.light',
      capabilities: [
        {
          type: 'devices.capabilities.on_off',
          state: { instance: 'on', value: false },
        },
      ],
    },
    {
      id: 'demo-ac-1',
      name: 'Кондиционер (демо)',
      type: 'devices.types.thermostat.ac',
      capabilities: [
        {
          type: 'devices.capabilities.on_off',
          state: { instance: 'on', value: true },
        },
      ],
    },
  ];

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
      if (isGuest) {
        setSubscriptions(MOCK_SUBSCRIPTIONS);
        setSelectedRoomId(1);
        return;
      }

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
  }, [user?.id, show, isGuest]);

  // Load Devices when room changes
  useEffect(() => {
    const loadDevices = async () => {
      if (!selectedRoomId) {
        console.log('[SmartHome] No room selected, skipping device load');
        return;
      }

      if (isGuest) {
        setDevices(MOCK_DEVICES);
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
  }, [selectedRoomId, show, isGuest]);

  // Control device
  const handleControlDevice = useCallback(
    async (device: YandexDevice, value: boolean) => {
      try {
        setIsControlling(device.id);
        if (!isGuest) {
          const result = await controlDevice({
            device_id: device.id,
            action_type: 'devices.capabilities.on_off',
            action_state: {
              instance: 'on',
              value: value,
            },
          });

          if (!result.ok) {
            show({
              title: 'Ошибка',
              description: 'Не удалось управлять устройством',
              variant: 'destructive',
              duration: 2000,
            });
            return;
          }
        }

        show({
          title: 'Успешно',
          description: isGuest
            ? `(Демо) ${device.name} ${value ? 'включено' : 'выключено'}`
            : `${device.name} ${value ? 'включено' : 'выключено'}`,
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
              if (capability && capability.state) {
                capability.state = {
                  instance: capability.state.instance,
                  value,
                };
              }
              return updatedDevice;
            }
            return d;
          })
        );
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

  // Section titles
  const getSectionTitle = () => {
    switch (activeSection) {
      case 'home':
        return 'Управление "умным домом"';
      case 'health':
        return 'Health-напоминание';
      case 'settings':
        return 'Настройки трекера';
      case 'steps':
        return 'Шаги';
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
      case 'steps':
        return 'Шаги за день, цель и история';
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

          {/* Devices area: content visible, loader overlay when loading */}
          <View style={styles.devicesAreaWrapper}>
            {isLoadingDevices ? (
              <View style={styles.devicesGridPlaceholder} />
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
                            {
                              backgroundColor: isOn
                                ? 'rgba(255,255,255,0.3)'
                                : 'rgba(255,255,255,0.2)',
                            },
                          ]}
                        >
                          {isControllingThis ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                          ) : (
                            <MaterialIcons
                              name="power-settings-new"
                              size={22}
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
            {isLoadingDevices && (
              <View style={styles.loadingOverlay}>
                <PageLoader size={80} />
              </View>
            )}
          </View>
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
          style={[
            styles.statCard,
            { backgroundColor: isTracking ? TRACKER_ACTIVE_TEAL : CARD_ORANGE },
          ]}
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

        {/* Шагомер: данные с датчика шагов (iOS: Motion & Fitness, Android: счётчик шагов) */}
        <Pressable
          onPress={() => router.push('/steps')}
          style={[styles.statCard, { backgroundColor: CARD_GREEN }]}
        >
          <View style={styles.statCardContent}>
            <View>
              <ThemedText style={styles.statCardTitle}>Шаги</ThemedText>
              <ThemedText style={[styles.statCardSubtitle, { opacity: 0.9 }]}>
                {stepsGoal ? `Цель ${stepsGoal.toLocaleString('ru-RU')}` : 'Датчик шагов'}
              </ThemedText>
            </View>
            <MaterialIcons name="directions-walk" size={24} color="#FFFFFF" />
          </View>
          <ThemedText style={styles.statCardValue}>
            {stepsToday.toLocaleString('ru-RU')}
          </ThemedText>
          <ThemedText style={[styles.statCardSubtitle, { marginTop: 2, opacity: 0.85, fontSize: 11 }]}>
            ~{stepsKmToday.toFixed(2)} км
          </ThemedText>
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
      {/* Reminders + Interval in one card */}
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

        <View style={{ marginTop: 16 }}>
          <ThemedText style={styles.settingsCardTitle}>
            Интервал напоминаний
          </ThemedText>
          <View style={styles.intervalButtons}>
            {[2, 30, 45, 60, 90, 120].map((mins) => {
              const isActive = healthReminders.sittingIntervalMinutes === mins;
              return (
                <Pressable
                  key={mins}
                  onPress={() =>
                    setHealthReminders({ sittingIntervalMinutes: mins })
                  }
                  style={[
                    styles.intervalButton,
                    {
                      backgroundColor: isActive
                        ? TRACKER_ACTIVE_TEAL
                        : 'rgba(255,255,255,0.2)',
                    },
                  ]}
                >
                  <ThemedText
                    style={[
                      styles.intervalButtonText,
                      { color: '#FFFFFF' },
                    ]}
                  >
                    {mins} мин
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Pressable>

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

      {/* Шагомер — рядом с настройками трекера; данные: датчик шагов устройства */}
      <Pressable
        onPress={() => router.push('/steps')}
        style={[styles.settingsCard, { backgroundColor: CARD_GREEN }]}
      >
        <View style={styles.settingsRow}>
          <View style={styles.settingsTextContainer}>
            <ThemedText style={styles.settingsCardTitle}>
              Шагомер
            </ThemedText>
            <ThemedText style={styles.settingsCardSubtitle}>
              Цель, история, уведомления. Данные: датчик шагов (iOS: Motion & Fitness, Android: счётчик шагов)
            </ThemedText>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
        </View>
      </Pressable>

      <ThemedText style={[styles.settingsCardSubtitle, { marginTop: 12, opacity: 0.8 }]}>
        Трекер учитывает время, когда приложение на экране. В фоне учёт приостанавливается.
      </ThemedText>
    </View>
  );

  // Секция Шаги (4-я вкладка, контент под кнопкой-шагомером)
  const renderStepsSection = () => (
    <View style={styles.sectionContent}>
      <View style={styles.stepsCircleWrap}>
        <View style={styles.stepsCircleContainer}>
          <Svg width={180} height={180}>
            <Circle
              cx={90}
              cy={90}
              r={75}
              stroke="rgba(255,255,255,0.25)"
              strokeWidth={10}
              strokeLinecap="round"
              fill="none"
            />
            <Circle
              cx={90}
              cy={90}
              r={75}
              stroke="#FFFFFF"
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 75}
              strokeDashoffset={2 * Math.PI * 75 * (1 - stepsProgress)}
              fill="none"
              rotation={-90}
              originX={90}
              originY={90}
            />
          </Svg>
          <View style={styles.stepsCircleCenter}>
            <ThemedText
              style={[styles.stepsBigValue, { color: '#FFFFFF' }]}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.35}
            >
              {stepsToday.toLocaleString('ru-RU')}
            </ThemedText>
            {stepsGoal != null && stepsGoal > 0 && (
              <ThemedText style={styles.stepsCircleSubtitle}>
                из {stepsGoal.toLocaleString('ru-RU')}
              </ThemedText>
            )}
          </View>
        </View>
      </View>
      <ThemedText style={styles.stepsBigLabel}>шагов сегодня</ThemedText>
      {stepsGoal != null && stepsGoal > 0 && (
        <ThemedText style={styles.stepsGoalLine}>
          Осталось: {Math.max(stepsGoal - stepsToday, 0).toLocaleString('ru-RU')} шагов
        </ThemedText>
      )}
      <ThemedText style={styles.stepsKmLine}>
        ≈ {stepsKmToday.toFixed(2)} км
      </ThemedText>
      <Pressable
        onPress={() => router.push('/steps')}
        style={[styles.stepsDetailButton, { backgroundColor: CARD_GREEN }]}
      >
        <ThemedText style={styles.stepsDetailButtonText}>
          Подробнее: история и настройки
        </ThemedText>
        <MaterialIcons name="chevron-right" size={24} color="#FFFFFF" />
      </Pressable>
    </View>
  );

  // Если роль еще загружается - показываем загрузку
  if (!effectiveRole) {
    return (
      <ThemedView
        style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}
      >
        <View style={styles.loadingContainer}>
          <PageLoader size={80} />
        </View>
      </ThemedView>
    );
  }

  // Если пользователь не клиент - показываем заглушку
  if (!isClient) {
    return (
      <ThemedView
        style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}
      >
        <View style={styles.notClientContainer}>
          <MaterialIcons name="lock" size={64} color="#E25B21" />
          <ThemedText style={[styles.notClientTitle, { color: headerText }]}>
            Доступ ограничен
          </ThemedText>
          <ThemedText style={[styles.notClientSubtitle, { color: headerSubtitle }]}>
            Эта страница доступна только для клиентов{'\n'}
            Ваша роль: {effectiveRole || 'не определена'}
          </ThemedText>
        </View>
      </ThemedView>
    );
  }

  return (
    <ThemedView
      style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}
    >
      <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: insets.bottom + 100 },
          ]}
          showsVerticalScrollIndicator={false}
        >
        {/* Header Section - Dark */}
        <View style={styles.header}>
          {/* Title */}
          <ThemedText style={[styles.headerTitle, { color: headerText }]}>
            {getSectionTitle()}
          </ThemedText>
          <ThemedText style={[styles.headerSubtitle, { color: headerSubtitle }]}>
            {getSectionSubtitle() || ' '}
          </ThemedText>

          {/* Tab Icons */}
          <View style={styles.tabContainer}>
            {/* Home Tab */}
            <Pressable
              onPress={() => handleTabPress('home')}
              style={[
                styles.tabButton,
                {
                  backgroundColor:
                    activeSection === 'home' ? PRIMARY_ORANGE : tabInactiveBackground,
                },
              ]}
            >
              <MaterialIcons name="home" size={28} color="#FFFFFF" />
            </Pressable>

            {/* Health Tab */}
            <Pressable
              onPress={() => handleTabPress('health')}
              style={[
                styles.tabButton,
                {
                  backgroundColor:
                    activeSection === 'health' ? PRIMARY_ORANGE : tabInactiveBackground,
                },
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
                {
                  backgroundColor:
                    activeSection === 'settings' ? PRIMARY_ORANGE : tabInactiveBackground,
                },
              ]}
            >
              <MaterialIcons name="settings" size={28} color="#FFFFFF" />
            </Pressable>

            {/* Steps Tab (4-я кнопка, как на скрине) */}
            <Pressable
              onPress={() => handleTabPress('steps')}
              style={[
                styles.tabButton,
                {
                  backgroundColor:
                    activeSection === 'steps' ? PRIMARY_ORANGE : tabInactiveBackground,
                },
              ]}
            >
              <MaterialIcons name="directions-walk" size={28} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Orange Content Section with fixed dark gradient for readability */}
        <LinearGradient
          colors={[PRIMARY_ORANGE, DARK_BG]}
          start={{ x: 0.5, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.contentSection}
        >
          {activeSection === 'home' && renderHomeSection()}
          {activeSection === 'health' && renderHealthSection()}
          {activeSection === 'settings' && renderSettingsSection()}
          {activeSection === 'steps' && renderStepsSection()}
        </LinearGradient>
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  adminContainer: {
    flex: 1,
  },
  adminContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  adminTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  adminDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  adminGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  adminCard: {
    width: CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
  },
  adminCardHeader: {
    marginBottom: 12,
  },
  adminIcon: {
    opacity: 0.9,
  },
  adminCardTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 4,
  },
  adminCardSubtitle: {
    fontSize: 13,
    opacity: 0.7,
  },
  adminChevron: {
    position: 'absolute',
    right: 12,
    bottom: 12,
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
  devicesAreaWrapper: {
    position: 'relative',
    minHeight: 140,
  },
  devicesGridPlaceholder: {
    width: CARD_WIDTH,
    height: 100,
    borderRadius: 16,
    backgroundColor: CARD_ORANGE,
    opacity: 0.6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
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
    paddingRight: 16,
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
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
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
  // Steps Section (4-я вкладка)
  stepsNumberWrap: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 12,
    minHeight: 80,
    overflow: 'visible',
  },
  stepsBigValue: {
    fontSize: 40,
    fontWeight: '700',
    textAlign: 'center',
    lineHeight: 52,
  },
  stepsBigLabel: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginTop: 4,
  },
  stepsGoalLine: {
    fontSize: 18,
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 16,
  },
  stepsKmLine: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    textAlign: 'center',
    marginTop: 8,
  },
  stepsDetailButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  stepsDetailButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  stepsCircleWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    marginBottom: 8,
  },
  stepsCircleContainer: {
    width: 180,
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepsCircleCenter: {
    position: 'absolute',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  stepsCircleSubtitle: {
    marginTop: 4,
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
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
