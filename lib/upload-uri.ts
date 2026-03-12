import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * На Android expo-image-picker возвращает content:// URI,
 * которые FormData в React Native не умеет отправлять.
 * Копируем файл в кэш и возвращаем file:// URI для загрузки.
 * На iOS оставляем URI как есть.
 */
export async function resolveUriForUpload(uri: string, index: number = 0): Promise<string> {
  if (Platform.OS !== 'android') return uri;
  if (!uri.startsWith('content://')) return uri;

  const dir = FileSystem.cacheDirectory;
  if (!dir) return uri;

  const ext = uri.includes('.png') ? '.png' : '.jpg';
  const toUri = `${dir}upload_${Date.now()}_${index}${ext}`;

  try {
    await FileSystem.copyAsync({ from: uri, to: toUri });
    return toUri;
  } catch {
    return uri;
  }
}

/** Разрешает массив URI для загрузки (Android: content:// → file в кэше). */
export async function resolveUrisForUpload(uris: string[]): Promise<string[]> {
  return Promise.all(uris.map((uri, i) => resolveUriForUpload(uri, i)));
}
