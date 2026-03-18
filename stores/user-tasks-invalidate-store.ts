import { create } from 'zustand';

/**
 * Глобальный "сигнал" для обновления экранов задач после любых мутаций (create/update/delete/complete/remind).
 * DRY: вместо ручного refresh() во всех местах.
 */
export const useUserTasksInvalidateStore = create<{
  version: number;
  bump: () => void;
}>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));

