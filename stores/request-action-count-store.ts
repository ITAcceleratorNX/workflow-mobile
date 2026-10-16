import { create } from 'zustand';

import { request } from '@/lib/api';
import { REQUEST_ACTION_COUNT_PATH } from '@/lib/request-action-count';

interface RequestActionCountState {
  /** Число для бейджа «Заявки»; 0 — бейджа нет. */
  count: number;
  /** Чей это счёт: при смене пользователя старое число не показывается. */
  ownerToken: string | null;
  refresh: (token: string) => Promise<void>;
  reset: () => void;
}

let inFlight: { token: string; promise: Promise<void> } | null = null;

export const useRequestActionCountStore = create<RequestActionCountState>((set, get) => ({
  count: 0,
  ownerToken: null,
  refresh: (token) => {
    if (inFlight?.token === token) return inFlight.promise;
    if (get().ownerToken !== token) set({ count: 0, ownerToken: token });
    const promise = request<{ count: number }>(REQUEST_ACTION_COUNT_PATH)
      .then((result) => {
        // Сбой сети не сбрасывает бейдж: при следующем обновлении число придёт снова.
        if (result.ok && get().ownerToken === token) set({ count: Number(result.data?.count) || 0 });
      })
      .finally(() => {
        if (inFlight?.promise === promise) inFlight = null;
      });
    inFlight = { token, promise };
    return promise;
  },
  reset: () => set({ count: 0, ownerToken: null }),
}));
