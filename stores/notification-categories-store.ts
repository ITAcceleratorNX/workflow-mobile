import { create } from 'zustand';

import {
  applyNotificationRead,
  type CategoryNotification,
  type CategorySummary,
  type NotificationCategory,
} from '@/lib/notification-categories';
import { fetchCategoryHistory, fetchNotificationSummary, markNotificationRead } from '@/lib/profile-api';
import { setBadgeCount } from '@/lib/pushNotifications';

export interface CategoryHistoryState {
  /** Как пришло с сервера: новые первыми. */
  items: CategoryNotification[];
  page: number;
  hasMore: boolean;
  loading: boolean;
  error: string | null;
}

interface NotificationCategoriesState {
  /** Чьи данные лежат в store: при смене пользователя всё сбрасывается. */
  ownerToken: string | null;
  summary: CategorySummary | null;
  summaryLoading: boolean;
  summaryError: string | null;
  histories: Partial<Record<NotificationCategory, CategoryHistoryState>>;
  refreshSummary: (token: string) => Promise<void>;
  /** Первая страница категории заново (вход в категорию, возврат на экран). */
  loadHistory: (token: string, category: NotificationCategory) => Promise<void>;
  /** Следующая, более ранняя страница. */
  loadOlder: (token: string, category: NotificationCategory) => Promise<void>;
  /**
   * Открытие одного уведомления. Прочтение сохраняет сервер; счётчики и запись меняются только
   * после его ответа, чтобы приложение не показывало несохранённое прочтение. false — не сохранено.
   */
  markRead: (notification: CategoryNotification) => Promise<boolean>;
  reset: () => void;
}

const EMPTY_HISTORY: CategoryHistoryState = { items: [], page: 0, hasMore: true, loading: false, error: null };

let summaryInFlight: { token: string; promise: Promise<void> } | null = null;

function syncAppBadge(summary: CategorySummary) {
  void setBadgeCount(summary.unread_count).catch(() => {});
}

export const useNotificationCategoriesStore = create<NotificationCategoriesState>((set, get) => {
  const bind = (token: string) => {
    if (get().ownerToken !== token) {
      set({ ownerToken: token, summary: null, summaryLoading: false, summaryError: null, histories: {} });
    }
  };

  const patchHistory = (category: NotificationCategory, patch: Partial<CategoryHistoryState>) =>
    set((state) => ({
      histories: { ...state.histories, [category]: { ...(state.histories[category] ?? EMPTY_HISTORY), ...patch } },
    }));

  const loadPage = async (token: string, category: NotificationCategory, page: number) => {
    // История может открыться по ссылке раньше сводки: привязка к пользователю — здесь же.
    bind(token);
    patchHistory(category, { loading: true, error: null });
    const result = await fetchCategoryHistory(category, page);
    if (get().ownerToken !== token) return;
    if (!result.ok) {
      patchHistory(category, { loading: false, error: result.unauthorized ? null : result.error });
      return;
    }
    const list = result.data.notifications ?? [];
    const previous = page === 1 ? [] : get().histories[category]?.items ?? [];
    const known = new Set(previous.map((n) => n.id));
    patchHistory(category, {
      items: [...previous, ...list.filter((n) => !known.has(n.id))],
      page,
      hasMore: page < (result.data.totalPages ?? 0),
      loading: false,
    });
  };

  return {
    ownerToken: null,
    summary: null,
    summaryLoading: false,
    summaryError: null,
    histories: {},

    refreshSummary: (token) => {
      // Колокольчик и экран уведомлений обновляются вместе: один запрос на всех.
      if (summaryInFlight?.token === token) return summaryInFlight.promise;
      bind(token);
      set({ summaryLoading: true, summaryError: null });
      const promise = fetchNotificationSummary()
        .then((result) => {
          if (get().ownerToken !== token) return;
          if (result.ok) {
            set({ summary: result.data, summaryLoading: false });
            syncAppBadge(result.data);
          } else {
            // Сбой сети не сбрасывает прежние счётчики.
            set({ summaryLoading: false, summaryError: result.unauthorized ? null : result.error });
          }
        })
        .finally(() => {
          if (summaryInFlight?.promise === promise) summaryInFlight = null;
        });
      summaryInFlight = { token, promise };
      return promise;
    },

    loadHistory: (token, category) => loadPage(token, category, 1),

    loadOlder: async (token, category) => {
      const history = get().ownerToken === token ? get().histories[category] : undefined;
      if (!history || history.loading || !history.hasMore) return;
      await loadPage(token, category, history.page + 1);
    },

    markRead: async (notification) => {
      if (notification.is_read) return true;
      const token = get().ownerToken;
      const result = await markNotificationRead(notification.id);
      if (!result.ok || get().ownerToken !== token) return false;
      set((state) => {
        const category = notification.category;
        const history = category ? state.histories[category] : undefined;
        const summary = state.summary ? applyNotificationRead(state.summary, notification) : state.summary;
        if (summary) syncAppBadge(summary);
        return {
          summary,
          histories:
            category && history
              ? {
                  ...state.histories,
                  [category]: {
                    ...history,
                    items: history.items.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n)),
                  },
                }
              : state.histories,
        };
      });
      return true;
    },

    reset: () => set({ ownerToken: null, summary: null, summaryLoading: false, summaryError: null, histories: {} }),
  };
});
