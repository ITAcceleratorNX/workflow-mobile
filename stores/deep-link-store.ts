import { create } from 'zustand';

/** Хранит requestId из входящей deep link до момента редиректа после авторизации. */
interface DeepLinkState {
  pendingRequestId: number | null;
  setPendingRequestId: (id: number | null) => void;
  /**
   * Холодный старт по пушу: index ~1.2s держит splash и делает Redirect на табы,
   * из‑за чего ранний router.push из обработчика затирается. Промежуточный href обрабатывается в index.
   */
  pendingPostAuthHref: string | null;
  setPendingPostAuthHref: (href: string | null) => void;
}

export const useDeepLinkStore = create<DeepLinkState>((set) => ({
  pendingRequestId: null,
  setPendingRequestId: (id) => set({ pendingRequestId: id }),
  pendingPostAuthHref: null,
  setPendingPostAuthHref: (href) => set({ pendingPostAuthHref: href }),
}));
