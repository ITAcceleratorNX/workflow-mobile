import { type Href, router } from 'expo-router';

import { useAuthStore } from '@/stores/auth-store';
import { useDeepLinkStore } from '@/stores/deep-link-store';

import { canOpenWidgetDestination, parseWidgetLink } from './model';

type AppRouter = {
  push: (href: Href) => void;
  replace: (href: Href) => void;
};

let claimedUrl = '';
let claimedAt = 0;

function claimWidgetUrl(url: string): boolean {
  const now = Date.now();
  if (claimedUrl === url && now - claimedAt < 2500) return false;
  claimedUrl = url;
  claimedAt = now;
  return true;
}

/**
 * Куда вести по отложенному переходу виджета или push. Query у задач передаётся параметрами: строка
 * целиком их теряет. У карточки задачи — все параметры (`taskId`, `commentId` из push комментария).
 */
export function openAppHref(navigation: AppRouter, href: string, mode: 'push' | 'replace' = 'replace'): void {
  const go = mode === 'push' ? navigation.push.bind(navigation) : navigation.replace.bind(navigation);
  const splitIdx = href.indexOf('?');
  const path = splitIdx >= 0 ? href.slice(0, splitIdx) : href;
  const query = splitIdx >= 0 ? href.slice(splitIdx + 1) : '';
  const params = Object.fromEntries(new URLSearchParams(query));

  if (path === '/client/tasks/details' && params.taskId) {
    go({ pathname: '/client/tasks/details', params });
    return;
  }
  if (path === '/client/tasks') {
    go({ pathname: '/client/tasks', params });
    return;
  }
  go(href as Href);
}

export function consumePostAuthHref(fallback: Href): Href {
  const pending = useDeepLinkStore.getState().pendingPostAuthHref;
  if (!pending) return fallback;
  useDeepLinkStore.getState().setPendingPostAuthHref(null);
  return pending as Href;
}

/** Холодный старт: запомнить действие, переход сделает экран входа или индекс после сплэша. */
export function rememberWidgetUrl(url: string): boolean {
  const link = parseWidgetLink(url);
  if (!link) return false;
  if (!claimWidgetUrl(url)) return true;
  useDeepLinkStore.getState().setPendingPostAuthHref(link.href);
  return true;
}

/** Приложение уже открыто. Без сессии задачника сначала вход, затем то же действие. */
export function openWidgetUrl(url: string): boolean {
  const link = parseWidgetLink(url);
  if (!link) return false;
  if (!claimWidgetUrl(url)) return true;
  if (!useAuthStore.persist.hasHydrated() || !canOpenWidgetDestination(useAuthStore.getState())) {
    useDeepLinkStore.getState().setPendingPostAuthHref(link.href);
    if (useAuthStore.persist.hasHydrated()) router.replace('/login');
    return true;
  }
  openAppHref(router, link.href, 'push');
  return true;
}
