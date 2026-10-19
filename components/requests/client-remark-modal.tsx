import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { useThemeColor } from '@/hooks/use-theme-color';

/** Сервер принимает замечание не длиннее 2000 символов. */
const REMARK_MAX_LENGTH = 2000;

interface ClientRemarkModalProps {
  visible: boolean;
  loading?: boolean;
  error?: string | null;
  onClose: () => void;
  onSubmit: (remark: string) => Promise<void>;
}

/**
 * «Есть замечания»: автор описывает, что не так, и заявка возвращается на доработку.
 * Монтируется только на время показа — текст замечания при каждом открытии пустой.
 */
export function ClientRemarkModal({
  visible,
  loading = false,
  error,
  onClose,
  onSubmit,
}: ClientRemarkModalProps) {
  const [remark, setRemark] = useState('');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const danger = useThemeColor({}, 'danger');

  const handleClose = () => {
    if (!loading) onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable style={styles.backdrop} onPress={handleClose}>
          <Pressable
            style={[styles.content, { backgroundColor: cardBackground, borderColor: border }]}
            onPress={(e) => e.stopPropagation()}
          >
            <ThemedText style={[styles.title, { color: text }]}>Есть замечания</ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              Заявка не закроется и вернётся на доработку. Когда работы выполнят повторно, вы снова
              получите её на подтверждение.
            </ThemedText>
            <ThemedText style={[styles.label, { color: textMuted }]}>
              Замечание (обязательно)
            </ThemedText>
            <TextInput
              style={[
                styles.input,
                { color: text, borderColor: border, backgroundColor: background },
              ]}
              placeholder="Что осталось не сделано?"
              placeholderTextColor={textMuted}
              value={remark}
              onChangeText={setRemark}
              maxLength={REMARK_MAX_LENGTH}
              editable={!loading}
              multiline
              numberOfLines={4}
              textAlignVertical="top"
            />
            {error ? (
              <ThemedText style={[styles.error, { color: danger }]}>{error}</ThemedText>
            ) : null}
            <Button
              title={loading ? 'Отправка...' : 'Отправить'}
              onPress={() => void onSubmit(remark.trim())}
              variant="primary"
              disabled={loading || !remark.trim()}
            />
            <Button
              title="Отмена"
              onPress={handleClose}
              variant="ghost"
              disabled={loading}
              style={styles.cancelBtn}
            />
          </Pressable>
        </Pressable>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
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
    minHeight: 100,
    marginBottom: 16,
  },
  error: {
    fontSize: 14,
    marginBottom: 12,
  },
  cancelBtn: {
    marginTop: 8,
  },
});
