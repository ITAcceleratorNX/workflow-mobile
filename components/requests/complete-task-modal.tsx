import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { SubRequest } from '@/lib/api';

interface CompleteTaskModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (comment: string, photoUris: string[]) => Promise<void>;
  subRequest: SubRequest | null;
  requestGroupId: number;
  loading?: boolean;
}

export function CompleteTaskModal({
  visible,
  onClose,
  onSubmit,
  subRequest,
  requestGroupId,
  loading = false,
}: CompleteTaskModalProps) {
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const newUris = result.assets.map((a) => a.uri);
      const combined = [...photos, ...newUris].slice(0, 3);
      setPhotos(combined);
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((p) => p.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (photos.length === 0) return;
    await onSubmit(comment.trim(), photos);
    setComment('');
    setPhotos([]);
    onClose();
  };

  const handleClose = () => {
    setComment('');
    setPhotos([]);
    onClose();
  };

  if (!subRequest) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable
          style={[styles.content, { backgroundColor: cardBackground, borderColor: border }]}
          onPress={(e) => e.stopPropagation()}
        >
          <ScrollView showsVerticalScrollIndicator={false}>
            <ThemedText style={[styles.title, { color: text }]}>
              Завершить задачу
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              Подзаявка #{subRequest.id}
            </ThemedText>
            <ThemedText style={[styles.label, { color: textMuted }]}>
              Комментарий (необязательно)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: text, borderColor: border, backgroundColor: background },
              ]}
              placeholder="Опишите выполненную работу"
              placeholderTextColor={textMuted}
              value={comment}
              onChangeText={setComment}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <ThemedText style={[styles.label, { color: textMuted }]}>
              Фото результата (обязательно, макс. 3)
            </ThemedText>
            <View style={styles.photosRow}>
              {photos.map((uri, i) => (
                <View key={i} style={styles.photoWrap}>
                  <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                  <Pressable
                    style={styles.removePhoto}
                    onPress={() => removePhoto(i)}
                  >
                    <MaterialIcons name="close" size={18} color="#FFF" />
                  </Pressable>
                </View>
              ))}
              {photos.length < 3 && (
                <Pressable
                  style={[styles.addPhotoBtn, { borderColor: border }]}
                  onPress={pickImage}
                >
                  <MaterialIcons name="add-a-photo" size={32} color={textMuted} />
                  <ThemedText style={[styles.addPhotoLabel, { color: textMuted }]}>
                    Добавить
                  </ThemedText>
                </Pressable>
              )}
            </View>
            <Button
              title={loading ? 'Отправка...' : 'Завершить'}
              onPress={handleSubmit}
              variant="primary"
              disabled={photos.length === 0 || loading}
            />
            <Button
              title="Отмена"
              onPress={handleClose}
              variant="ghost"
              style={styles.cancelBtn}
            />
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    borderRadius: 16,
    padding: 24,
    borderWidth: 1,
    maxHeight: '85%',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 80,
    marginBottom: 16,
  },
  photosRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  photoWrap: {
    width: 80,
    height: 80,
    borderRadius: 8,
    overflow: 'hidden',
    position: 'relative',
  },
  photo: {
    width: '100%',
    height: '100%',
  },
  removePhoto: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  cancelBtn: {
    marginTop: 8,
  },
});
