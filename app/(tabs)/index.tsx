import { useEffect, useState, useCallback, useMemo } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
  Modal,
  TextInput as RNTextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { PageLoader, Select } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { useTodoStore, type TodoItem, getTaskDate, getTaskTime } from '@/stores/todo-store';
import { TIME_SLOTS, getDateOptions } from '@/constants/task-form';
import { useToast } from '@/context/toast-context';
import { getRequestGroups, getMyBookings, type RequestGroup, type MeetingRoomBooking } from '@/lib/api';
import {   formatDateForApi, formatTimeOnly } from '@/lib/dateTimeUtils';
import { NEWS_ITEMS } from '@/constants/news';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';
const TRACKER_ACTIVE_TEAL = '#1CC7A5';

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
  const primary = useThemeColor({}, 'primary');
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
                  color={primary}
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
                color={primary}
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
  const primary = useThemeColor({}, 'primary');
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
                  color={primary}
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
                color={primary}
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
  const primary = useThemeColor({}, 'primary');
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
                  color={primary}
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
                color={primary}
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

const INSIGHT_CARD_WIDTH = width * 0.88;
const INSIGHT_CARD_HEIGHT = 260;

const WEEK_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const TASK_COLOR_REQUEST = '#3B82F6';
const TASK_COLOR_BOOKING = CARD_ORANGE;

function TodoRowInline({
  item,
  onToggle,
  onRemove,
  textColor,
  textMuted,
  primary,
  borderColor,
}: {
  item: TodoItem;
  onToggle: () => void;
  onRemove: () => void;
  textColor: string;
  textMuted: string;
  primary: string;
  borderColor: string;
}) {
  return (
    <Pressable
      onPress={() => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onToggle();
      }}
      style={styles.todoRow}
    >
      <View style={[styles.todoCheckbox, { borderColor: item.completed ? primary : borderColor }, item.completed && { backgroundColor: primary }]}>
        {item.completed && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
      </View>
      <View style={styles.todoRowContent}>
        <ThemedText
          style={[styles.todoRowText, { color: item.completed ? textMuted : textColor }, item.completed && styles.todoTextCompleted]}
          numberOfLines={2}
        >
          {item.text}
        </ThemedText>
        <ThemedText style={[styles.todoRowTime, { color: textMuted }]}>{getTaskTime(item)}</ThemedText>
      </View>
      <Pressable
        onPress={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onRemove();
        }}
        hitSlop={12}
        style={styles.todoRemoveBtn}
      >
        <MaterialIcons name="close" size={20} color={textMuted} />
      </Pressable>
    </Pressable>
  );
}

/** Контент главной только для роли client. Вынесен в отдельный компонент, чтобы не нарушать правила хуков (одинаковое количество хуков при любом рендере). */
function ClientDashboardContent() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const role = useAuthStore((state) => state.role);
  const effectiveRole = role || user?.role;
  const isClient = effectiveRole?.toLowerCase() === 'client';
  const background = useThemeColor({}, 'background');
  const headerText = useThemeColor({}, 'text');
  const headerSubtitle = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const screenBg = useThemeColor({}, 'screenBackgroundDark');
  const cardBg = useThemeColor({}, 'cardBackground');
  const border = useThemeColor({}, 'border');

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [showTodoList, setShowTodoList] = useState(false);
  const [todoInputText, setTodoInputText] = useState('');
  const [todoAddDate, setTodoAddDate] = useState(() => formatDateForApi(new Date()));
  const [todoAddTime, setTodoAddTime] = useState('09:00');
  const [hasNotifications] = useState(true);
  const [selectedInsight, setSelectedInsight] = useState<(typeof NEWS_ITEMS)[number] | null>(null);
  const [requests, setRequests] = useState<RequestGroup[]>([]);
  const [bookings, setBookings] = useState<MeetingRoomBooking[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const isGuest = useAuthStore((state) => state.isGuest);
  const guestBookings = useGuestDemoStore((state) => state.bookings);
  const guestRequests = useGuestDemoStore((state) => state.requests);
  const { items: todoItems, addItem: addTodoItem, removeItem: removeTodoItem, toggleItem: toggleTodoItem, clearCompleted: clearTodoCompleted } = useTodoStore();

  // Неделя, содержащая selectedDate (Пн–Вс)
  const weekDates = (() => {
    const d = new Date(selectedDate);
    const dayOfWeek = d.getDay(); // 0=Вс, 1=Пн, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(d);
    monday.setDate(d.getDate() + mondayOffset);
    const today = new Date();
    const days: { date: Date; label: string; isToday: boolean; isSelected: boolean }[] = [];
    for (let i = 0; i < 7; i++) {
      const day = new Date(monday);
      day.setDate(monday.getDate() + i);
      days.push({
        date: day,
        label: `${WEEK_DAYS[day.getDay()]} ${day.getDate()}`,
        isToday: day.toDateString() === today.toDateString(),
        isSelected: day.toDateString() === selectedDate.toDateString(),
      });
    }
    return days;
  })();

  // Задачи на выбранную дату: заявки + брони
  const tasksForSelectedDate = (() => {
    const dateKey = formatDateForApi(selectedDate);
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const items: { id: string; time: string; title: string; color: string; requestId?: number; bookingId?: number; taskId?: string }[] = [];

    // Личные задачи (из Todo list) — только активные, выполненные скрыты
    const TASK_COLOR_TODO = '#10B981';
    for (const item of todoItems) {
      if (item.completed) continue;
      const itemDate = getTaskDate(item);
      if (itemDate !== dateKey) continue;
      items.push({
        id: `task-${item.id}`,
        time: getTaskTime(item),
        title: item.text,
        color: TASK_COLOR_TODO,
        taskId: item.id,
      });
    }

    // Заявки: created_date или planned_date
    const reqList = isGuest ? guestRequests : requests;
    for (const rg of reqList) {
      const dateStr = ('planned_date' in rg ? rg.planned_date : null) || rg.created_date;
      if (!dateStr) continue;
      const itemDate = new Date(dateStr);
      if (itemDate < dayStart || itemDate > dayEnd) continue;
      const dateOnly = dateStr.slice(0, 10);
      if (dateOnly !== dateKey) continue;
      const title = rg.requests?.[0]?.title || rg.location_detail || 'Заявка';
      items.push({
        id: `req-${rg.id}`,
        time: formatTimeOnly(dateStr),
        title,
        color: TASK_COLOR_REQUEST,
        requestId: rg.id,
      });
    }

    // Брони: start_time
    const bookList = isGuest ? guestBookings : bookings;
    for (const b of bookList) {
      const startStr = b.start_time;
      if (!startStr) continue;
      const itemDate = new Date(startStr);
      if (itemDate < dayStart || itemDate > dayEnd) continue;
      const bDateKey = formatDateForApi(itemDate);
      if (bDateKey !== dateKey) continue;
      const roomName = (b as MeetingRoomBooking).meetingRoom?.name || (b as MeetingRoomBooking).meeting_room?.name || 'Переговорная';
      items.push({
        id: `book-${b.id}`,
        time: formatTimeOnly(startStr),
        title: roomName,
        color: TASK_COLOR_BOOKING,
        bookingId: b.id,
      });
    }

    items.sort((a, b) => a.time.localeCompare(b.time));
    return items;
  })();

  // Дневная продуктивность: completed / total for selected date (задачи + заявки + брони)
  const dailyPerformance = (() => {
    const dateKey = formatDateForApi(selectedDate);
    let total = 0;
    let completed = 0;
    for (const item of todoItems) {
      if (getTaskDate(item) !== dateKey) continue;
      total++;
      if (item.completed) completed++;
    }
    const reqList = isGuest ? guestRequests : requests;
    for (const rg of reqList) {
      const dateStr = ('planned_date' in rg ? rg.planned_date : null) || rg.created_date;
      if (!dateStr || dateStr.slice(0, 10) !== dateKey) continue;
      total++;
      if (rg.status === 'completed') completed++;
    }
    const bookList = isGuest ? guestBookings : bookings;
    for (const b of bookList) {
      if (!b.start_time) continue;
      if (formatDateForApi(new Date(b.start_time)) !== dateKey) continue;
      total++;
      if (b.status === 'completed') completed++;
    }
    if (total === 0) return { percent: 0, total: 0, completed: 0 };
    return { percent: Math.round((completed / total) * 100), total, completed };
  })();

  const loadTasks = useCallback(async () => {
    if (isGuest) return;
    setTasksLoading(true);
    const [reqRes, bookRes] = await Promise.all([
      getRequestGroups(1, 100, 'client'),
      getMyBookings({ page: 1, pageSize: 100 }),
    ]);
    setTasksLoading(false);
    if (reqRes.ok) setRequests(reqRes.data);
    if (bookRes.ok) setBookings(bookRes.data);
  }, [isGuest]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const formatDateNav = () => {
    const d = selectedDate;
    const today = new Date();
    const dateStr = `${d.getDate()} ${['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()]}`;
    if (d.toDateString() === today.toDateString()) return `Сегодня – ${dateStr}`;
    return dateStr;
  };

  const formatDateShort = () => {
    const d = selectedDate;
    const today = new Date();
    if (d.toDateString() === today.toDateString()) return 'сегодня';
    return `${d.getDate()} ${['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()]}`;
  };

  const handlePrevDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(selectedDate);
    d.setDate(d.getDate() - 1);
    setSelectedDate(d);
  };

  const handleNextDay = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const d = new Date(selectedDate);
    d.setDate(d.getDate() + 1);
    setSelectedDate(d);
  };

  const handleSmartHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/client/smart-home');
  };

  const handleHealthStats = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/client/health-screen');
  };

  const handleAllTasks = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/client/tasks');
  };

  const handleToggleView = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setShowTodoList((prev) => {
      if (!prev) {
        setTodoAddDate(formatDateForApi(selectedDate));
      }
      return !prev;
    });
  };

  const handleAddTodo = useCallback(() => {
    addTodoItem(todoInputText, todoAddDate, todoAddTime);
    setTodoInputText('');
  }, [todoInputText, todoAddDate, todoAddTime, addTodoItem]);

  const todoDateOptions = useMemo(() => getDateOptions(), []);

  const todoActiveItems = useMemo(() => todoItems.filter((i) => !i.completed), [todoItems]);
  const todoCompletedCount = todoItems.filter((i) => i.completed).length;

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
    <ThemedView style={[styles.container, { paddingTop: insets.top, backgroundColor: background }]}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
      >
        {/* Daily Insights — заголовок + уведомления, кнопка Все новости под заголовком */}
        <View style={styles.insightsHeader}>
          <View style={styles.insightsHeaderRow}>
            <ThemedText style={[styles.insightsTitle, { color: headerText }]}>Обзор дня</ThemedText>
            <Pressable onPress={() => router.push('/(tabs)/profile?tab=notifications')} style={styles.notificationButton}>
              <MaterialIcons name="notifications" size={26} color={headerText} />
              {hasNotifications && <View style={[styles.notificationDot, { backgroundColor: primary }]} />}
            </Pressable>
          </View>
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              router.push('/client/news');
            }}
            style={styles.insightsViewAllLink}
          >
            <ThemedText style={[styles.viewAllText, { color: primary }]}>Все новости</ThemedText>
            <MaterialIcons name="arrow-forward" size={18} color={primary} />
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.insightsScroll}
        >
          {NEWS_ITEMS.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                setSelectedInsight(item);
              }}
              style={styles.insightCard}
            >
              <Image
                source={{ uri: item.image }}
                style={styles.insightCardImage}
                contentFit="cover"
              />
              <View style={styles.insightTagTop}>
                <View style={styles.insightTag}>
                  <ThemedText style={styles.insightTagText}>{item.tag}</ThemedText>
                </View>
              </View>
              <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.7)']}
                style={styles.insightCardOverlay}
              >
                <ThemedText style={styles.insightTitle}>{item.title}</ThemedText>
                <ThemedText style={styles.insightDesc} numberOfLines={3}>{item.desc}</ThemedText>
              </LinearGradient>
            </Pressable>
          ))}
        </ScrollView>

        {/* Smart Control — две кнопки */}
        <View style={[styles.section, { backgroundColor: background }]}>
          <ThemedText style={[styles.sectionTitle, { color: headerText }]}>Smart Control</ThemedText>
          <View style={styles.smartControlGrid}>
            <Pressable onPress={handleSmartHome} style={[styles.smartControlButton, { backgroundColor: cardBg }]}>
              <View style={[styles.smartControlIconWrap, { backgroundColor: `${primary}80` }]}>
                <MaterialIcons name="home" size={28} color={primary} />
              </View>
              <ThemedText style={[styles.smartControlLabel, { color: headerText }]}>Управление умным домом</ThemedText>
            </Pressable>
            <Pressable onPress={handleHealthStats} style={[styles.smartControlButton, { backgroundColor: cardBg }]}>
              <View style={[styles.smartControlIconWrap, { backgroundColor: '#60A5FA80' }]}>
                <MaterialIcons name="favorite" size={28} color="#60A5FA" />
              </View>
              <ThemedText style={[styles.smartControlLabel, { color: headerText }]}>Health трекер</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Tasks — заголовок + Все задачи + календарь + список */}
        <View style={[styles.section, { backgroundColor: background }]}>
          <View style={styles.tasksHeader}>
            <ThemedText style={[styles.sectionTitle, { color: headerText }]}>Задачи</ThemedText>
            <Pressable onPress={handleAllTasks} style={styles.viewAllLink}>
              <ThemedText style={[styles.viewAllText, { color: primary }]}>Все задачи</ThemedText>
              <MaterialIcons name="arrow-forward" size={18} color={primary} />
            </Pressable>
          </View>
          <View style={[styles.tasksBlock, { backgroundColor: cardBg }]}>
            {showTodoList ? (
              <>
                <View style={[styles.todoInputRow, { backgroundColor: cardBg, borderColor: border }]}>
                  <RNTextInput
                    value={todoInputText}
                    onChangeText={setTodoInputText}
                    placeholder="Введите задачу..."
                    placeholderTextColor={headerSubtitle}
                    onSubmitEditing={handleAddTodo}
                    returnKeyType="done"
                    style={[styles.todoInput, { color: headerText }]}
                  />
                  <Pressable
                    onPress={() => {
                      if (todoInputText.trim()) handleAddTodo();
                      else Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
                    }}
                    style={[
                      styles.todoAddButton,
                      { backgroundColor: primary, opacity: todoInputText.trim() ? 1 : 0.5 },
                    ]}
                  >
                    <MaterialIcons name="add" size={24} color="#FFFFFF" />
                  </Pressable>
                </View>
                <View style={[styles.todoAddRow, { borderColor: border }]}>
                  <View style={styles.todoAddField}>
                    <ThemedText style={[styles.todoAddLabel, { color: headerSubtitle }]}>Дата</ThemedText>
                    <Select
                      value={todoAddDate}
                      onValueChange={setTodoAddDate}
                      options={todoDateOptions}
                      placeholder="Дата"
                    />
                  </View>
                  <View style={styles.todoAddField}>
                    <ThemedText style={[styles.todoAddLabel, { color: headerSubtitle }]}>Время</ThemedText>
                    <Select
                      value={todoAddTime}
                      onValueChange={setTodoAddTime}
                      options={TIME_SLOTS}
                      placeholder="Время"
                    />
                  </View>
                </View>
                <View style={styles.todoListContent}>
                  {todoActiveItems.length === 0 ? (
                    <View style={styles.todoEmptyState}>
                      <MaterialIcons name="format-list-bulleted" size={40} color={headerSubtitle} />
                      <ThemedText style={[styles.todoEmptyTitle, { color: headerText }]}>Нет задач</ThemedText>
                      <ThemedText style={[styles.todoEmptySubtitle, { color: headerSubtitle }]}>
                        {todoCompletedCount > 0 ? 'Все задачи выполнены' : 'Добавьте задачу выше'}
                      </ThemedText>
                    </View>
                  ) : (
                    <View style={styles.todoListBlock}>
                      {todoActiveItems.map((item) => (
                        <TodoRowInline
                          key={item.id}
                          item={item}
                          onToggle={() => toggleTodoItem(item.id)}
                          onRemove={() => removeTodoItem(item.id)}
                          textColor={headerText}
                          textMuted={headerSubtitle}
                          primary={primary}
                          borderColor={border}
                        />
                      ))}
                    </View>
                  )}
                  {todoCompletedCount > 0 && (
                    <Pressable
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        clearTodoCompleted();
                      }}
                      style={styles.todoClearButton}
                    >
                      <MaterialIcons name="delete-outline" size={18} color={primary} />
                      <ThemedText style={[styles.todoClearButtonText, { color: primary }]}>
                        Очистить выполненные ({todoCompletedCount})
                      </ThemedText>
                    </Pressable>
                  )}
                </View>
              </>
            ) : (
              <>
                <View style={styles.dateNav}>
                  <Pressable onPress={handlePrevDay} style={styles.dateNavButton}>
                    <MaterialIcons name="chevron-left" size={24} color={headerText} />
                  </Pressable>
                  <ThemedText style={[styles.dateNavLabel, { color: headerText }]}>
                    {formatDateNav()}
                  </ThemedText>
                  <Pressable onPress={handleNextDay} style={styles.dateNavButton}>
                    <MaterialIcons name="chevron-right" size={24} color={headerText} />
                  </Pressable>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.weekScroll}>
                  {weekDates.map((day) => (
                    <Pressable
                      key={day.date.toISOString()}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        setSelectedDate(day.date);
                      }}
                      style={[styles.weekDay, (day.isSelected || day.isToday) && { backgroundColor: primary }]}
                    >
                      <ThemedText style={[styles.weekDayText, { color: day.isSelected || day.isToday ? '#FFF' : headerText }]}>{day.label}</ThemedText>
                    </Pressable>
                  ))}
                </ScrollView>
                <View style={styles.taskList}>
                  {tasksLoading ? (
                    <ThemedText style={[styles.taskEmpty, { color: headerSubtitle }]}>Загрузка...</ThemedText>
                  ) : tasksForSelectedDate.length === 0 ? (
                    <ThemedText style={[styles.taskEmpty, { color: headerSubtitle }]}>Нет задач на эту дату</ThemedText>
                  ) : (
                    tasksForSelectedDate.map((task) => (
                      <Pressable
                        key={task.id}
                        onPress={() => {
                          if (task.taskId) setShowTodoList(true);
                          else if (task.requestId) router.push(`/(tabs)/requests/${task.requestId}`);
                          else if (task.bookingId) router.push(`/booking/${task.bookingId}`);
                        }}
                        style={styles.taskRow}
                      >
                        <View style={[styles.taskTimeIndicator, { backgroundColor: task.color }]} />
                        <ThemedText style={[styles.taskTime, { color: headerSubtitle }]}>
                          {task.time}
                        </ThemedText>
                        <ThemedText style={[styles.taskTitle, { color: headerText }]} numberOfLines={1}>{task.title}</ThemedText>
                        <View style={[styles.taskDot, { backgroundColor: task.color }]} />
                      </Pressable>
                    ))
                  )}
                </View>
              </>
            )}
          </View>
          <Pressable onPress={handleToggleView} style={styles.todoListButton}>
            <ThemedText style={[styles.todoListButtonText, { color: primary }]}>
              {showTodoList ? 'Календарь' : 'Todo list'}
            </ThemedText>
            <MaterialIcons name={showTodoList ? 'calendar-today' : 'format-list-bulleted'} size={20} color={primary} />
          </Pressable>
        </View>

        {/* Daily Performance — процент выполненных задач за день */}
        <View style={[styles.section, { backgroundColor: background }]}>
          <View style={[styles.dailyPerformanceCard, { backgroundColor: `${primary}80` }]}>
            <View style={[styles.dailyPerformanceIconWrap, { backgroundColor: primary }]}>
              <MaterialIcons name="show-chart" size={28} color="#FFFFFF" />
            </View>
            <View style={styles.dailyPerformanceText}>
              <ThemedText style={styles.dailyPerformanceLabel}>Дневная продуктивность</ThemedText>
              <ThemedText style={styles.dailyPerformanceStatus}>
              {dailyPerformance.total === 0 ? 'Нет задач' : dailyPerformance.percent >= 100 ? 'Цель достигнута!' : `${dailyPerformance.completed} из ${dailyPerformance.total}`}
            </ThemedText>
            </View>
            <ThemedText style={styles.dailyPerformancePercent}>{dailyPerformance.percent}%</ThemedText>
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={!!selectedInsight}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedInsight(null)}
      >
        <Pressable
          style={styles.insightModalOverlay}
          onPress={() => setSelectedInsight(null)}
        >
          <Pressable style={[styles.insightModalContent, { backgroundColor: cardBg }]} onPress={(e) => e.stopPropagation()}>
            {selectedInsight && (
              <>
                <Image
                  source={{ uri: selectedInsight.image }}
                  style={styles.insightModalImage}
                  contentFit="cover"
                />
                <View style={styles.insightModalBody}>
                  <View style={[styles.insightTag, { marginBottom: 12 }]}>
                    <ThemedText style={styles.insightTagText}>{selectedInsight.tag}</ThemedText>
                  </View>
                  <ThemedText style={[styles.insightModalTitle, { color: headerText }]}>{selectedInsight.title}</ThemedText>
                  <ThemedText style={[styles.insightModalDesc, { color: headerSubtitle }]}>{selectedInsight.desc}</ThemedText>
                </View>
                <Pressable
                  onPress={() => setSelectedInsight(null)}
                  style={[styles.insightModalClose, { backgroundColor: primary }]}
                >
                  <ThemedText style={styles.insightModalCloseText}>Закрыть</ThemedText>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
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
  // Client Dashboard — Daily Insights
  insightsHeader: {
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  insightsHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  insightsTitle: { fontSize: 24, fontWeight: 'bold' },
  insightsViewAllLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
    alignSelf: 'flex-start',
  },
  notificationButton: { padding: 8, position: 'relative' },
  notificationDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  insightsScroll: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  insightCard: {
    width: INSIGHT_CARD_WIDTH,
    height: INSIGHT_CARD_HEIGHT,
    borderRadius: 20,
    marginRight: 14,
    overflow: 'hidden',
  },
  insightCardImage: {
    width: '100%',
    height: '100%',
  },
  insightTagTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
  },
  insightCardOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 18,
    paddingTop: 60,
    justifyContent: 'flex-end',
  },
  insightTag: { alignSelf: 'flex-start', backgroundColor: CARD_ORANGE, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  insightTagText: { fontSize: 11, fontWeight: '600', color: '#FFFFFF' },
  insightTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 6 },
  insightDesc: { fontSize: 15, color: 'rgba(255,255,255,0.9)', lineHeight: 22 },
  // Insight modal
  insightModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  insightModalContent: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  insightModalImage: {
    width: '100%',
    height: 200,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  insightModalBody: { padding: 20 },
  insightModalTitle: { fontSize: 22, fontWeight: 'bold', marginBottom: 12 },
  insightModalDesc: { fontSize: 16, lineHeight: 24 },
  insightModalClose: {
    margin: 20,
    marginTop: 0,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  insightModalCloseText: { fontSize: 16, fontWeight: '600', color: '#FFFFFF' },
  // Smart Control
  section: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', marginBottom: 16 },
  smartControlGrid: { flexDirection: 'row', gap: 12 },
  smartControlButton: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  smartControlIconWrap: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  smartControlLabel: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  // Tasks
  tasksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 14, fontWeight: '500' },
  tasksBlock: { borderRadius: 16, padding: 16 },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dateNavButton: { padding: 8 },
  dateNavLabel: { fontSize: 16, fontWeight: '500' },
  weekScroll: { flexDirection: 'row', gap: 8 },
  weekDay: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  weekDayText: { fontSize: 14, fontWeight: '500' },
  todoListButton: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 16, alignSelf: 'flex-end' },
  todoListButtonText: { fontSize: 14, fontWeight: '500' },
  // Todo list (inline)
  todoInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
  },
  todoInput: { flex: 1, fontSize: 16, paddingVertical: 10 },
  todoAddRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  todoAddField: { flex: 1 },
  todoAddLabel: { fontSize: 14, marginBottom: 6 },
  todoAddButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 8,
  },
  todoListContent: { marginTop: 4 },
  todoEmptyState: { alignItems: 'center', paddingVertical: 32 },
  todoEmptyTitle: { fontSize: 16, fontWeight: '600', marginTop: 12 },
  todoEmptySubtitle: { fontSize: 14, marginTop: 4 },
  todoListBlock: { borderRadius: 12, overflow: 'hidden' },
  todoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  todoCheckbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    marginRight: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  todoRowContent: { flex: 1, minWidth: 0 },
  todoRowText: { fontSize: 16 },
  todoRowTime: { fontSize: 12, marginTop: 2 },
  todoTextCompleted: { textDecorationLine: 'line-through' },
  todoRemoveBtn: { padding: 4 },
  todoClearButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  todoClearButtonText: { fontSize: 13, fontWeight: '500' },
  taskList: { gap: 4, marginTop: 16 },
  taskEmpty: { fontSize: 14, paddingVertical: 16, textAlign: 'center' },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  taskTimeIndicator: { width: 4, height: 24, borderRadius: 2, marginRight: 12 },
  taskTime: { fontSize: 14, width: 44 },
  taskTitle: { flex: 1, fontSize: 16 },
  taskDot: { width: 8, height: 8, borderRadius: 4 },
  // Daily Performance
  dailyPerformanceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 16,
    padding: 16,
  },
  dailyPerformanceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  dailyPerformanceText: { flex: 1, flexShrink: 1, minWidth: 0 },
  dailyPerformanceLabel: { fontSize: 13, marginBottom: 2, color: 'rgba(255,255,255,0.9)' },
  dailyPerformanceStatus: { fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' },
  dailyPerformancePercent: { fontSize: 22, fontWeight: 'bold', flexShrink: 0, marginLeft: 8, color: '#FFFFFF' },
  // Legacy (admin/executor)
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
