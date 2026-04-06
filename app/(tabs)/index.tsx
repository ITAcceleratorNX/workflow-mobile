import { useEffect, useState, useCallback } from 'react';
import {
  StyleSheet,
  View,
  ScrollView,
  Pressable,
  Dimensions,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useRouter, useFocusEffect } from 'expo-router';
import * as Notifications from 'expo-notifications';

import { PageLoader, PullToRefresh } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { TasksSection } from '@/components/tasks/TasksSection';
import { useAuthStore } from '@/stores/auth-store';
import { useUserTasksInvalidateStore } from '@/stores/user-tasks-invalidate-store';
import { useToast } from '@/context/toast-context';
import { NEWS_ITEMS } from '@/constants/news';
import { getNewsMain } from '@/lib/news-api';
import type { NewsDisplayItem } from '@/lib/news-api';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;

const CARD_ORANGE = '#D94F15';
const CARD_GREEN = '#1A9A8A';
const TRACKER_ACTIVE_TEAL = '#1CC7A5';

type AdminCardKey = 'categories' | 'users' | 'office' | 'smart-home' | 'statistics' | 'news';

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
  {
    key: 'news',
    title: 'Управление новостями',
    subtitle: 'Создание и редактирование новостей для клиентов',
    icon: 'article',
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

function AdminWorkerManagementScreen({ hasNotifications }: { hasNotifications: boolean }) {
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
          router.push('/admin-worker/statistics');
          break;
        case 'news':
          router.push('/admin-worker/news');
          break;
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
        <View style={styles.adminHeaderRow}>
          <ThemedText type="title" style={[styles.adminTitle, { color: text }]}>
            Управление системой
          </ThemedText>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.adminNotificationButton}
            hitSlop={8}
          >
            <MaterialIcons name="notifications" size={24} color={text} />
            {hasNotifications && (
              <View style={[styles.notificationDot, { backgroundColor: primary }]} />
            )}
          </Pressable>
        </View>
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
  hasNotifications,
}: {
  role: 'department-head' | 'manager';
  hasNotifications: boolean;
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
        <View style={styles.adminHeaderRow}>
          <ThemedText type="title" style={[styles.adminTitle, { color: text }]}>
            Управление
          </ThemedText>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.adminNotificationButton}
            hitSlop={8}
          >
            <MaterialIcons name="notifications" size={24} color={text} />
            {hasNotifications && (
              <View style={[styles.notificationDot, { backgroundColor: primary }]} />
            )}
          </Pressable>
        </View>
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
function ExecutorCabinetScreen({ hasNotifications }: { hasNotifications: boolean }) {
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
        <View style={styles.adminHeaderRow}>
          <ThemedText type="title" style={[styles.adminTitle, { color: text }]}>
            Мой кабинет
          </ThemedText>
          <Pressable
            onPress={() => router.push('/notifications')}
            style={styles.adminNotificationButton}
            hitSlop={8}
          >
            <MaterialIcons name="notifications" size={24} color={text} />
            {hasNotifications && (
              <View style={[styles.notificationDot, { backgroundColor: primary }]} />
            )}
          </Pressable>
        </View>
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
  const { show: showToast } = useToast();

  const [hasNotifications, setHasNotifications] = useState(false);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      Notifications.getBadgeCountAsync()
        .then((count) => {
          if (active) setHasNotifications(count > 0);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, []),
  );

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
    return <AdminWorkerManagementScreen hasNotifications={hasNotifications} />;
  }

  if (isExecutor) {
    return <ExecutorCabinetScreen hasNotifications={hasNotifications} />;
  }

  if (isDepartmentHead || isManager) {
    return (
      <ExecutorManagementScreen
        role={isDepartmentHead ? 'department-head' : 'manager'}
        hasNotifications={hasNotifications}
      />
    );
  }

  return <ClientDashboardContent hasNotifications={hasNotifications} />;
}

const INSIGHT_CARD_WIDTH = width * 0.88;
const INSIGHT_CARD_HEIGHT = 260;

/** Контент главной только для роли client. Вынесен в отдельный компонент, чтобы не нарушать правила хуков (одинаковое количество хуков при любом рендере). */
function ClientDashboardContent({ hasNotifications }: { hasNotifications: boolean }) {
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
  const cardBg = useThemeColor({}, 'cardBackground');
  const [insightItems, setInsightItems] = useState<NewsDisplayItem[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const bumpTasks = useUserTasksInvalidateStore((s) => s.bump);

  useEffect(() => {
    let cancelled = false;
    getNewsMain().then((res) => {
      if (cancelled) return;
      if (res.ok) setInsightItems(res.data);
      else setInsightItems(NEWS_ITEMS.map((i) => ({ id: i.id, tag: i.tag || 'Новость', title: i.title, desc: i.desc, image: i.image, date: i.date })));
    });
    return () => { cancelled = true; };
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    const newsPromise = getNewsMain().then((res) => {
      if (res.ok) setInsightItems(res.data);
      else setInsightItems(NEWS_ITEMS.map((i) => ({ id: i.id, tag: i.tag || 'Новость', title: i.title, desc: i.desc, image: i.image, date: i.date })));
    });
    bumpTasks();
    await newsPromise;
    setRefreshing(false);
  }, [bumpTasks]);

  const handleSmartHome = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/client/smart-home');
  };

  const handleHealthStats = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/client/health-screen');
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
      <PullToRefresh
        refreshing={refreshing}
        onRefresh={onRefresh}
        loaderSize={96}
        topOffset={insets.top + 16}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 100 }]}
          showsVerticalScrollIndicator={false}
        >
        {/* Daily Insights — заголовок + уведомления, кнопка Все новости под заголовком */}
        <View style={styles.insightsHeader}>
          <View style={styles.insightsHeaderRow}>
            <ThemedText style={[styles.insightsTitle, { color: headerText }]}>Обзор дня</ThemedText>
            <Pressable onPress={() => router.push('/notifications')} style={styles.notificationButton}>
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
          {insightItems.slice(0, 5).map((item) => (
            <Pressable
              key={item.id}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                router.push(`/client/news/${item.id}`);
              }}
              style={styles.insightCard}
            >
              <Image
                source={{ uri: item.image || 'https://via.placeholder.com/400' }}
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
              <ThemedText style={[styles.smartControlLabel, { color: headerText }]}>Управление умным офисом</ThemedText>
            </Pressable>
            <Pressable onPress={handleHealthStats} style={[styles.smartControlButton, { backgroundColor: cardBg }]}>
              <View style={[styles.smartControlIconWrap, { backgroundColor: '#60A5FA80' }]}>
                <MaterialIcons name="favorite" size={28} color="#60A5FA" />
              </View>
              <ThemedText style={[styles.smartControlLabel, { color: headerText }]}>Health трекер</ThemedText>
            </Pressable>
          </View>
        </View>

        {/* Tasks: только прогресс, переход в экран задач */}
        <TasksSection />
      </ScrollView>
      </PullToRefresh>
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
  adminSectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 12,
  },
  adminBlock: {
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
  },
  adminBlockCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  adminBlockCardContent: { flex: 1, minWidth: 0 },
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
  adminHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  adminNotificationButton: {
    padding: 4,
    position: 'relative',
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
