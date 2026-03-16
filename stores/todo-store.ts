import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
  /** Дата задачи YYYY-MM-DD (для отображения в календаре). Опционально для старых записей. */
  date?: string;
}

interface TodoState {
  items: TodoItem[];
  addItem: (text: string, date: string) => void;
  removeItem: (id: string) => void;
  toggleItem: (id: string) => void;
  clearCompleted: () => void;
}

/** Дата из YYYY-MM-DD или createdAt (для миграции старых записей) */
function getTaskDate(item: { date?: string; createdAt: string }): string {
  if (item.date && item.date.length >= 10) return item.date.slice(0, 10);
  return item.createdAt.slice(0, 10);
}

export { getTaskDate };

export const useTodoStore = create<TodoState>()(
  persist(
    (set) => ({
      items: [],

      addItem: (text, date) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const dateStr = date && date.length >= 10 ? date.slice(0, 10) : new Date().toISOString().slice(0, 10);
        const item: TodoItem = {
          id: `todo-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          text: trimmed,
          completed: false,
          createdAt: new Date().toISOString(),
          date: dateStr,
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
