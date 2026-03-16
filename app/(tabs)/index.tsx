import { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';

import { PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import { useToast } from '@/context/toast-context';

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

const INSIGHT_CARD_WIDTH = width * 0.75;

const MOCK_INSIGHTS = [
  { id: '1', tag: 'Wellness', title: 'Оптимизируйте сон', desc: 'Новые метрики показывают: сон на 15 мин раньше может повысить концентрацию на 20%.', bg: '#1E3A5F' },
  { id: '2', tag: 'Умный дом', title: 'Экономия энергии', desc: 'Ваши умные устройства экономят энергию, синхронизируясь с расписанием.', bg: '#2D5A3D' },
  { id: '3', tag: 'Продуктивность', title: 'Советы на день', desc: 'Рекомендуем сделать перерыв через 45 минут работы.', bg: '#4A3D6B' },
];

const MOCK_TASKS = [
  { id: '1', time: '09:30', title: 'Code review', color: '#3B82F6' },
  { id: '2', time: '11:00', title: 'Security audit', color: CARD_ORANGE },
  { id: '3', time: '13:00', title: 'Lunch meeting', color: CARD_ORANGE },
  { id: '4', time: '15:30', title: 'Documentation update', color: '#3B82F6' },
];

const WEEK_DAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

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

  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [hasNotifications] = useState(true);

  const weekDates = (() => {
    const today = new Date();
    const days: { date: Date; label: string; isToday: boolean }[] = [];
    for (let i = -2; i <= 2; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      days.push({
        date: d,
        label: `${WEEK_DAYS[d.getDay()]} ${d.getDate()}`,
        isToday: d.toDateString() === today.toDateString(),
      });
    }
    return days;
  })();

  const formatDateNav = () => {
    const d = selectedDate;
    const today = new Date();
    const dateStr = `${d.getDate()} ${['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'][d.getMonth()]}`;
    if (d.toDateString() === today.toDateString()) return `Сегодня – ${dateStr}`;
    return dateStr;
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
    router.push('/(tabs)/requests');
  };

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
        {/* Daily Insights — заголовок + уведомления + скролл новостей */}
        <View style={styles.insightsHeader}>
          <View style={styles.insightsHeaderLeft}>
            <ThemedText style={[styles.insightsTitle, { color: headerText }]}>Обзор дня</ThemedText>
            <Pressable onPress={() => {}} style={styles.exploreLink}>
              <ThemedText style={[styles.exploreText, { color: primary }]}>Подробнее</ThemedText>
              <MaterialIcons name="arrow-forward" size={18} color={primary} />
            </Pressable>
          </View>
          <Pressable onPress={() => {}} style={styles.notificationButton}>
            <MaterialIcons name="notifications" size={26} color={headerText} />
            {hasNotifications && <View style={[styles.notificationDot, { backgroundColor: primary }]} />}
          </Pressable>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.insightsScroll}
        >
          {MOCK_INSIGHTS.map((item) => (
            <View key={item.id} style={[styles.insightCard, { backgroundColor: item.bg }]}>
              <View style={styles.insightTag}>
                <ThemedText style={styles.insightTagText}>{item.tag}</ThemedText>
              </View>
              <ThemedText style={styles.insightTitle}>{item.title}</ThemedText>
              <ThemedText style={styles.insightDesc} numberOfLines={3}>{item.desc}</ThemedText>
            </View>
          ))}
        </ScrollView>

        {/* Smart Control — две кнопки */}
        <View style={[styles.section, { backgroundColor: screenBg }]}>
          <ThemedText style={styles.sectionTitle}>Smart Control</ThemedText>
          <View style={styles.smartControlGrid}>
            <Pressable onPress={handleSmartHome} style={[styles.smartControlButton, { backgroundColor: cardBg }]}>
              <View style={[styles.smartControlIconWrap, { backgroundColor: screenBg }]}>
                <MaterialIcons name="home" size={28} color={primary} />
              </View>
              <ThemedText style={[styles.smartControlLabel, { color: headerText }]}>Управление умным домом</ThemedText>
            </Pressable>
            <Pressable onPress={handleHealthStats} style={[styles.smartControlButton, { backgroundColor: cardBg }]}>
              <View style={[styles.smartControlIconWrap, { backgroundColor: screenBg }]}>
                <MaterialIcons name="favorite" size={28} color="#60A5FA" />
              </View>
              <ThemedText style={[styles.smartControlLabel, { color: headerText }]}>Health трекер</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Tasks — заголовок + Все задачи + календарь + список */}
        <View style={[styles.section, { backgroundColor: screenBg }]}>
          <View style={styles.tasksHeader}>
            <ThemedText style={styles.sectionTitle}>Задачи</ThemedText>
            <Pressable onPress={handleAllTasks} style={styles.viewAllLink}>
              <ThemedText style={[styles.viewAllText, { color: primary }]}>Все задачи</ThemedText>
              <MaterialIcons name="arrow-forward" size={18} color={primary} />
            </Pressable>
          </View>
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
                onPress={() => setSelectedDate(day.date)}
                style={[styles.weekDay, day.isToday && { backgroundColor: primary }]}
              >
                <ThemedText style={[styles.weekDayText, { color: day.isToday ? '#FFF' : headerText }]}>{day.label}</ThemedText>
              </Pressable>
            ))}
          </ScrollView>
          <View style={styles.taskList}>
            {MOCK_TASKS.map((task) => (
              <View key={task.id} style={styles.taskRow}>
                <View style={[styles.taskTimeIndicator, { backgroundColor: task.color }]} />
                <ThemedText style={[styles.taskTime, { color: headerSubtitle }]}>{task.time}</ThemedText>
                <ThemedText style={[styles.taskTitle, { color: headerText }]}>{task.title}</ThemedText>
                <View style={[styles.taskDot, { backgroundColor: task.color }]} />
              </View>
            ))}
          </View>
        </View>
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
  // Client Dashboard — Daily Insights
  insightsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
  },
  insightsHeaderLeft: { flex: 1 },
  insightsTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 4 },
  exploreLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  exploreText: { fontSize: 14, fontWeight: '500' },
  notificationButton: { padding: 8, position: 'relative' },
  notificationDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4 },
  insightsScroll: { paddingHorizontal: 16, paddingBottom: 20, gap: 12 },
  insightCard: {
    width: INSIGHT_CARD_WIDTH,
    borderRadius: 16,
    padding: 16,
    marginRight: 12,
  },
  insightTag: { alignSelf: 'flex-start', backgroundColor: CARD_ORANGE, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, marginBottom: 12 },
  insightTagText: { fontSize: 12, fontWeight: '600', color: '#FFFFFF' },
  insightTitle: { fontSize: 18, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 8 },
  insightDesc: { fontSize: 14, color: 'rgba(255,255,255,0.85)', lineHeight: 20 },
  // Smart Control
  section: { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 24, marginTop: 8 },
  sectionTitle: { fontSize: 20, fontWeight: 'bold', color: '#FFFFFF', marginBottom: 16 },
  smartControlGrid: { flexDirection: 'row', gap: 12 },
  smartControlButton: { flex: 1, borderRadius: 16, padding: 16, alignItems: 'center' },
  smartControlIconWrap: { width: 56, height: 56, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginBottom: 12 },
  smartControlLabel: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
  // Tasks
  tasksHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  viewAllLink: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  viewAllText: { fontSize: 14, fontWeight: '500' },
  dateNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  dateNavButton: { padding: 8 },
  dateNavLabel: { fontSize: 16, fontWeight: '500' },
  weekScroll: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  weekDay: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  weekDayText: { fontSize: 14, fontWeight: '500' },
  taskList: { gap: 4 },
  taskRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12 },
  taskTimeIndicator: { width: 4, height: 24, borderRadius: 2, marginRight: 12 },
  taskTime: { fontSize: 14, width: 44 },
  taskTitle: { flex: 1, fontSize: 16 },
  taskDot: { width: 8, height: 8, borderRadius: 4 },
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
