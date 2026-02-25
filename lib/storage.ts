/**
 * Cross-platform storage for Zustand persist.
 * Uses localStorage on web (avoids "Native module is null"), AsyncStorage on native.
 * Wraps in try/catch to fall back to in-memory when storage fails (e.g. native module not ready).
 */
import { Platform } from 'react-native';

import AsyncStorage from '@react-native-async-storage/async-storage';

const isWeb = Platform.OS === 'web';

const memoryStore: Record<string, string> = {};

const webStorage = {
  getItem: async (name: string): Promise<string | null> => {
    try {
      if (typeof localStorage !== 'undefined') {
        return localStorage.getItem(name);
      }
    } catch {
      // ignore
    }
    return memoryStore[name] ?? null;
  },
  setItem: async (name: string, value: string): Promise<void> => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(name, value);
      }
    } catch {
      // ignore
    }
    memoryStore[name] = value;
  },
  removeItem: async (name: string): Promise<void> => {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(name);
      }
    } catch {
      // ignore
    }
    delete memoryStore[name];
  },
};

const memoryStorage = {
  getItem: async (name: string): Promise<string | null> =>
    memoryStore[name] ?? null,
  setItem: async (name: string, value: string): Promise<void> => {
    memoryStore[name] = value;
  },
  removeItem: async (name: string): Promise<void> => {
    delete memoryStore[name];
  },
};

async function safeAsyncStorageGet(name: string): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(name);
  } catch {
    return memoryStore[name] ?? null;
  }
}

async function safeAsyncStorageSet(name: string, value: string): Promise<void> {
  try {
    await AsyncStorage.setItem(name, value);
  } catch {
    memoryStore[name] = value;
  }
}

async function safeAsyncStorageRemove(name: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(name);
  } catch {
    delete memoryStore[name];
  }
}

const nativeStorage = {
  getItem: safeAsyncStorageGet,
  setItem: safeAsyncStorageSet,
  removeItem: safeAsyncStorageRemove,
};

export const persistStorage = isWeb ? webStorage : nativeStorage;
