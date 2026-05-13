import * as FileSystem from 'expo-file-system';
import type { Action } from 'expo-image-manipulator';
import { Image } from 'react-native';

const REQUEST_PHOTO_MAX_DIMENSION = 1600;
const REQUEST_PHOTO_TARGET_BYTES = 900 * 1024;
const REQUEST_PHOTO_QUALITIES = [0.82, 0.68, 0.55] as const;

export interface CompressedRequestPhoto {
  uri: string;
  type: 'image/jpeg';
  name: string;
}

function makePhotoName(prefix: string, index: number): string {
  return `${prefix}_${Date.now()}_${index}.jpg`;
}

async function getImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve(null)
    );
  });
}

async function getFileSize(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (!info.exists || info.isDirectory) return null;
    const fileInfo = info as FileSystem.FileInfo & { size?: number };
    return typeof fileInfo.size === 'number' ? fileInfo.size : null;
  } catch {
    return null;
  }
}

export async function compressRequestPhoto(
  uri: string,
  index: number,
  prefix: string
): Promise<CompressedRequestPhoto> {
  try {
    // Lazy-load so missing native module (e.g. stale iOS binary) does not break module exports.
    const ImageManipulator = await import('expo-image-manipulator');
    if (typeof ImageManipulator.manipulateAsync !== 'function') {
      throw new Error('expo-image-manipulator native module unavailable');
    }

    const size = await getImageSize(uri);
    const maxSide = size ? Math.max(size.width, size.height) : 0;
    const shouldResize = maxSide > REQUEST_PHOTO_MAX_DIMENSION;
    const actions: Action[] = shouldResize
      ? size!.width >= size!.height
        ? [{ resize: { width: REQUEST_PHOTO_MAX_DIMENSION } }]
        : [{ resize: { height: REQUEST_PHOTO_MAX_DIMENSION } }]
      : [];

    let currentUri = uri;
    for (let i = 0; i < REQUEST_PHOTO_QUALITIES.length; i += 1) {
      const quality = REQUEST_PHOTO_QUALITIES[i];
      const result = await ImageManipulator.manipulateAsync(
        currentUri,
        i === 0 ? actions : [],
        {
          compress: quality,
          format: ImageManipulator.SaveFormat.JPEG,
        }
      );
      currentUri = result.uri;
      const fileSize = await getFileSize(currentUri);
      if (fileSize == null || fileSize <= REQUEST_PHOTO_TARGET_BYTES) break;
    }

    return {
      uri: currentUri,
      type: 'image/jpeg',
      name: makePhotoName(prefix, index),
    };
  } catch {
    return {
      uri,
      type: 'image/jpeg',
      name: makePhotoName(prefix, index),
    };
  }
}

export async function compressRequestPhotos(
  uris: string[],
  prefix: string
): Promise<CompressedRequestPhoto[]> {
  const compressed = await Promise.all(
    uris.map((uri, index) => compressRequestPhoto(uri, index, prefix))
  );
  return compressed;
}
