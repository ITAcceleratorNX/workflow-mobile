import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import type { User } from '@/lib/auth';
import { persistStorage } from '@/lib/storage';

export interface AuthState {
  token: string | null;
  role: string | null;
  user: User | null;
  setAuth: (token: string, role: string, user: User) => void;
  setGuestAuth: () => void;
  clearAuth: () => void;
  updateUser: (
    updater: Partial<User> | ((prev: User | null) => User | null)
  ) => void;
  isGuest: boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      role: null,
      user: null,
      isGuest: false,
      setAuth: (token, role, user) =>
        set({
          token,
          role,
          user,
          isGuest: false,
        }),
      setGuestAuth: () =>
        set({
          token: 'guest-demo',
          role: 'client',
          user: {
            id: 0,
            full_name: 'Гость (демо)',
            phone: '+7 000 000 00 00',
            email: 'guest@demo.kz',
            email_verified: false,
            office_id: 0,
            office: { name: 'Демо', photo: null },
            role: 'client',
            email_notifications: false,
            security_notifications: false,
            marketing_notifications: false,
            push_notifications: false,
          },
          isGuest: true,
        }),
      clearAuth: () =>
        set({
          token: null,
          role: null,
          user: null,
          isGuest: false,
        }),
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
