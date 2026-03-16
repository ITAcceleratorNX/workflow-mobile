import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { persistStorage } from '@/lib/storage';
import { NEWS_ITEMS, type NewsItem } from '@/constants/news';

export type { NewsItem };

interface NewsState {
  items: NewsItem[];
  addItem: (item: Omit<NewsItem, 'id'>) => void;
  updateItem: (id: string, item: Partial<Omit<NewsItem, 'id'>>) => void;
  removeItem: (id: string) => void;
  getItem: (id: string) => NewsItem | undefined;
}

function generateId(): string {
  return `news-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export const useNewsStore = create<NewsState>()(
  persist(
    (set, get) => ({
      items: [...NEWS_ITEMS],

      addItem: (item) => {
        const trimmed = {
          tag: (item.tag || '').trim(),
          title: (item.title || '').trim(),
          desc: (item.desc || '').trim(),
          image: (item.image || '').trim(),
          date: item.date || new Date().toISOString().slice(0, 10),
        };
        if (!trimmed.title) return;
        const newItem: NewsItem = {
          id: generateId(),
          ...trimmed,
        };
        set((state) => ({ items: [newItem, ...state.items] }));
      },

      updateItem: (id, updates) => {
        set((state) => ({
          items: state.items.map((i) =>
            i.id === id ? { ...i, ...updates } : i
          ),
        }));
      },

      removeItem: (id) =>
        set((state) => ({ items: state.items.filter((i) => i.id !== id) })),

      getItem: (id) => get().items.find((i) => i.id === id),
    }),
    {
      name: 'news-storage',
      storage: createJSONStorage(() => persistStorage),
    }
  )
);

/** Для клиента: возвращает список новостей (из store или fallback на NEWS_ITEMS) */
export function getNewsItems(): NewsItem[] {
  const items = useNewsStore.getState().items;
  return items.length > 0 ? items : NEWS_ITEMS;
}
