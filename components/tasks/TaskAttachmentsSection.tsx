import { MaterialIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import { ListGroup, ListGroupLabel, ListRow } from '@/components/ui/list-group';
import { toastTaskError } from '@/components/tasks/task-toasts';
import { useToast } from '@/context/toast-context';
import { useProductUi } from '@/hooks/use-product-ui';
import {
  deleteUserTaskAttachment,
  getUserTaskAttachments,
  uploadUserTaskAttachments,
  type UserTaskAttachment,
} from '@/lib/user-tasks-api';

const MAX_FILES = 10;
const KIND_LABEL: Record<UserTaskAttachment['file_kind'], string> = { image: 'Фото', video: 'Видео', document: 'Документ' };

const extensionOf = (nameOrUri: string) => nameOrUri.match(/\.([a-zA-Z0-9]+)(\?|#|$)/)?.[1]?.toLowerCase() ?? '';

/**
 * «Вложения» of a task: photos, videos and documents; the author adds and removes them. Hidden for
 * a reader when there is nothing attached.
 */
export function TaskAttachmentsSection({ taskId, canEdit }: { taskId: number; canEdit: boolean }) {
  const ui = useProductUi();
  const { show: showToast } = useToast();
  const [items, setItems] = useState<UserTaskAttachment[] | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getUserTaskAttachments(taskId).then((res) => {
      if (cancelled) return;
      setItems(res.ok ? res.data : []);
      if (!res.ok) toastTaskError(showToast, 'Не удалось загрузить вложения', res.error);
    });
    return () => {
      cancelled = true;
    };
  }, [taskId, showToast]);

  const upload = async (files: { uri: string; name: string; type?: string }[]) => {
    if (files.length === 0) return;
    setUploading(true);
    const res = await uploadUserTaskAttachments(taskId, files.slice(0, MAX_FILES));
    setUploading(false);
    if (res.ok) setItems((current) => [...res.data, ...(current ?? [])]);
    else toastTaskError(showToast, 'Не удалось прикрепить файл', res.error);
  };

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      toastTaskError(showToast, 'Нет доступа к фото и видео', 'Разрешите доступ к медиатеке в настройках устройства.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], allowsMultipleSelection: true, quality: 0.8 });
    if (result.canceled) return;
    await upload(
      result.assets.map((asset, index) => {
        const ext = extensionOf(asset.fileName ?? asset.uri);
        return {
          uri: asset.uri,
          name: asset.fileName ?? `attachment_${index}_${Date.now()}${ext ? `.${ext}` : ''}`,
          type: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
        };
      })
    );
  };

  const pickDocuments = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: '*/*', multiple: true });
    if (result.canceled) return;
    await upload(result.assets.map((asset) => ({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? 'application/octet-stream' })));
  };

  const remove = async (attachment: UserTaskAttachment) => {
    const before = items;
    setItems((current) => current?.filter((item) => item.id !== attachment.id) ?? null);
    const res = await deleteUserTaskAttachment(taskId, attachment.id);
    if (!res.ok) {
      setItems(before);
      toastTaskError(showToast, 'Не удалось удалить вложение', res.error);
    }
  };

  if (items == null) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="small" color={ui.fg(0.5)} />
        <Text style={[styles.loadingText, { color: ui.fg(0.5) }]}>Вложения…</Text>
      </View>
    );
  }
  if (items.length === 0 && !canEdit) return null;

  return (
    <View style={styles.section}>
      <ListGroupLabel>{items.length ? `Вложения · ${items.length}` : 'Вложения'}</ListGroupLabel>
      <ListGroup>
        {items.map((item) => (
          <View key={item.id} style={styles.item}>
            <Pressable
              onPress={() => void Linking.openURL(item.file_url)}
              accessibilityRole="link"
              accessibilityLabel={`${item.file_name || KIND_LABEL[item.file_kind]}, открыть`}
              style={styles.itemLink}
            >
              {item.file_kind === 'image' ? (
                <Image source={{ uri: item.file_url }} style={styles.thumb} contentFit="cover" />
              ) : (
                <View style={[styles.thumb, styles.fileThumb, { backgroundColor: ui.fg(0.06) }]}>
                  <MaterialIcons name={item.file_kind === 'video' ? 'videocam' : 'description'} size={20} color={ui.fg(0.6)} />
                </View>
              )}
              <View style={styles.itemText}>
                <Text style={[styles.itemName, { color: ui.fg() }]} numberOfLines={1}>
                  {item.file_name || KIND_LABEL[item.file_kind]}
                </Text>
                <Text style={[styles.itemKind, { color: ui.fg(0.5) }]}>{KIND_LABEL[item.file_kind]}</Text>
              </View>
            </Pressable>
            {canEdit ? (
              <Pressable
                onPress={() => void remove(item)}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={`Удалить вложение ${item.file_name ?? ''}`.trim()}
                style={styles.delete}
              >
                <MaterialIcons name="delete-outline" size={20} color={ui.danger} />
              </Pressable>
            ) : null}
          </View>
        ))}
        {canEdit ? (
          <ListRow
            icon={uploading ? 'hourglass-empty' : 'photo-library'}
            label={uploading ? 'Загружаем…' : 'Фото или видео'}
            tone="accent"
            chevron={false}
            disabled={uploading}
            onPress={() => void pickMedia()}
          />
        ) : null}
        {canEdit && !uploading ? <ListRow icon="attach-file" label="Файл" tone="accent" chevron={false} onPress={() => void pickDocuments()} /> : null}
      </ListGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: 8 },
  loading: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  loadingText: { fontSize: 13 },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 10, paddingLeft: 14, paddingRight: 8 },
  itemLink: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 },
  thumb: { width: 40, height: 40, borderRadius: 8 },
  fileThumb: { alignItems: 'center', justifyContent: 'center' },
  itemText: { flex: 1, gap: 2 },
  itemName: { fontSize: 14 },
  itemKind: { fontSize: 12 },
  delete: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
});
