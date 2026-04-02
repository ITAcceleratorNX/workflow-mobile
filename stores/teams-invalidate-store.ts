import { create } from 'zustand';

/**
 * Сигнал обновления списка команд после create/update/delete.
 */
export const useTeamsInvalidateStore = create<{
  version: number;
  bump: () => void;
}>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
