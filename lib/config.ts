/**
 * App config from environment.
 * EXPO_PUBLIC_* vars are available at runtime in Expo.
 */
const API_BASE_URL =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL
    : 'https://workflow-back-zpk4.onrender.com/api';

export const config = {
  apiBaseUrl: API_BASE_URL,
} as const;
