/**
 * App config from environment.
 * EXPO_PUBLIC_* vars are available at runtime in Expo.
 */
const API_BASE_URL =
  typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_API_BASE_URL
    ? process.env.EXPO_PUBLIC_API_BASE_URL
    : 'http://192.168.100.205:3001/api';

/** Базовый URL веб-приложения: по ссылке открывается в браузере или в приложении (Universal/App Links). */
const WEB_APP_BASE_URL = 'https://app.tmk-workflow.kz';

export const config = {
  apiBaseUrl: API_BASE_URL,
  webAppBaseUrl: WEB_APP_BASE_URL,
} as const;
