/**
 * Файл для `FormData.append` (фото, вложения), который отправляют обе реализации `fetch`:
 * - `expo/fetch` (глобальный `fetch` начиная с Expo SDK 57) читает содержимое через `bytes()`
 *   и не принимает старую часть `{ uri, name, type }` — «Unsupported FormDataPart implementation»;
 * - `fetch` React Native (флаг EXPO_PUBLIC_USE_RN_FETCH) читает файл по `uri`.
 * Имя и тип задаются явно: `File` из expo-file-system взял бы имя из пути (у DocumentPicker — UUID).
 */
export type FormDataFileSource = { uri: string; name: string; type: string };

export function formDataFile({ uri, name, type }: FormDataFileSource): Blob {
  return {
    uri,
    name,
    type,
    // Нативный модуль подгружается только при отправке: модули lib/ проверяются тестами в Node.
    bytes: async () => {
      const { File } = await import('expo-file-system');
      return new File(uri).bytes();
    },
  } as unknown as Blob;
}
