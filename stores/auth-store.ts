import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { User } from '@/lib/auth';
import { persistStorage } from '@/lib/storage';

export interface AuthState {
  token: string | null;
  role: string | null;
  user: User | null;
  setAuth: (token: string, role: string, user: User) => void;
  clearAuth: () => void;
  updateUser: (
    updater: Partial<User> | ((prev: User | null) => User | null)
  ) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      user: null,
      setAuth: (token, role, user) => set({ token, role, user }),
      clearAuth: () => set({ token: null, role: null, user: null }),
      updateUser: (updater) =>
        set((state) => {
          if (typeof updater === 'function') {
            return { user: updater(state.user) };
          }
          return {
            user: state.user ? { ...state.user, ...updater } : null,
          };
        }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => persistStorage),
    }
  )
);
