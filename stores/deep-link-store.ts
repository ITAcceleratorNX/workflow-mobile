import { create } from 'zustand';

/** Хранит requestId из входящей deep link до момента редиректа после авторизации. */
interface DeepLinkState {
  pendingRequestId: number | null;
  setPendingRequestId: (id: number | null) => void;
}

export const useDeepLinkStore = create<DeepLinkState>((set) => ({
  pendingRequestId: null,
  setPendingRequestId: (id) => set({ pendingRequestId: id }),
}));
