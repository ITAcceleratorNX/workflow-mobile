import type { Href } from 'expo-router';
import { create } from 'zustand';

/** Хранит requestId из входящей deep link до момента редиректа после авторизации. */
interface DeepLinkState {
  pendingRequestId: number | null;
  setPendingRequestId: (id: number | null) => void;
  /**
   * Экран из нажатого push, который откроется на вкладках: после входа, если пользователь не вошёл,
   * и после splash холодного старта — ранний router.push затёр бы Redirect из `app/index.tsx`.
   * Открывает `app/(tabs)/_layout.tsx`.
   */
  pendingPostAuthHref: Href | null;
  setPendingPostAuthHref: (href: Href | null) => void;
}

export const useDeepLinkStore = create<DeepLinkState>((set) => ({
  pendingRequestId: null,
  setPendingRequestId: (id) => set({ pendingRequestId: id }),
  pendingPostAuthHref: null,
  setPendingPostAuthHref: (href) => set({ pendingPostAuthHref: href }),
}));
