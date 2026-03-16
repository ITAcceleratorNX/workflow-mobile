import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

interface TodoState {
  items: TodoItem[];
  addItem: (text: string) => void;
  removeItem: (id: string) => void;
  toggleItem: (id: string) => void;
  clearCompleted: () => void;
}

export const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const item: TodoItem = {
          id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: trimmed,
          completed: false,
          createdAt: new Date().toISOString(),
        };
        set((state) => ({ items: [item, ...state.items] }));
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      toggleItem: (id) =>
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, completed: !i.completed } : i
          ),
        })),

      clearCompleted: () =>
        set((state) => ({ items: state.items.filter((i) => !i.completed) })),
    }),
    {
      name: 'todo-list-storage',
      storage: createJSONStorage(() => persistStorage),
    }
  )
);
