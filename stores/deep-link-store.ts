import { create } from 'zustand';

/** Хранит requestId из входящей deep link до момента редиректа после авторизации. */
interface DeepLinkState {
  pendingRequestId: number | null;
  setPendingRequestId: (id: number | null) => void;
  /**
   * Экран из нажатого push или системного виджета, строкой с query (`openAppHref` разбирает её на
   * параметры). Ранний router.push затёр бы Redirect из `app/index.tsx`, поэтому переход ждёт:
   * его открывает `app/index.tsx` после splash, экран входа после входа или вкладки, если приложение
   * уже на них.
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
