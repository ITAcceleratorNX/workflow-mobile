import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { ExecutorInCategory } from '@/lib/api';
import type { SubRequest } from '@/lib/api';

interface ExecutorOption {
  id: number;
  name: string;
  role: 'executor' | 'leader';
}

interface AssignExecutorsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (executors: Array<{ id: number; role: 'executor' | 'leader' }>) => Promise<void>;
  subRequest: SubRequest | null;
  executors: ExecutorInCategory[];
  userServiceCategoryId?: number;
  loading?: boolean;
  error?: string | null;
}

export function AssignExecutorsModal({
  visible,
  onClose,
  onSubmit,
  subRequest,
  executors,
  loading = false,
  error,
}: AssignExecutorsModalProps) {
  const [selected, setSelected] = useState<ExecutorOption[]>([]);
  const [newExecutorId, setNewExecutorId] = useState('');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const availableExecutors = executors.filter(
    (e) => !selected.some((s) => s.id === e.id)
  );
  const addOptions = [
    { value: '', label: 'Добавить исполнителя' },
    ...availableExecutors.map((e) => ({
      value: String(e.id),
      label: e.user?.full_name ?? `Исполнитель #${e.id}`,
    })),
  ];

  const addExecutor = (executorId: string) => {
    if (!executorId) return;
    const id = parseInt(executorId, 10);
    const exec = executors.find((e) => e.id === id);
    if (exec && !selected.some((s) => s.id === id)) {
      const hasLeader = selected.some((s) => s.role === 'leader');
      setSelected((prev) => [
        ...prev,
        {
          id,
          name: exec.user?.full_name ?? `#${id}`,
          role: hasLeader ? ('executor' as const) : ('leader' as const),
        },
      ]);
      setNewExecutorId('');
    }
  };

  const removeExecutor = (id: number) => {
    setSelected((prev) => prev.filter((e) => e.id !== id));
  };

  const setRole = (id: number, role: 'executor' | 'leader') => {
    setSelected((prev) =>
      prev.map((e) => (e.id === id ? { ...e, role } : e))
    );
  };

  const handleSubmit = async () => {
    const hasLeader = selected.some((s) => s.role === 'leader');
    if (selected.length === 0 || !hasLeader) return;
    await onSubmit(
      selected.map((e) => ({ id: e.id, role: e.role }))
    );
    setSelected([]);
    onClose();
  };

  const handleClose = () => {
    setSelected([]);
    setNewExecutorId('');
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
              Назначить исполнителей
            </ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>
              Подзаявка #{subRequest.id}
            </ThemedText>
            <View style={styles.selectWrap}>
              <Select
                value={newExecutorId}
                onValueChange={(v) => {
                  if (v) addExecutor(v);
                  setNewExecutorId('');
                }}
                options={addOptions}
                placeholder="Добавить исполнителя"
              />
            </View>
            {selected.map((e) => (
              <View
                key={e.id}
                style={[styles.executorRow, { borderColor: border }]}
              >
                <ThemedText style={[styles.executorName, { color: text }]}>
                  {e.name}
                </ThemedText>
                <View style={styles.roleRow}>
                  <Pressable
                    onPress={() => setRole(e.id, 'leader')}
                    style={[
                      styles.roleBtn,
                      e.role === 'leader' && styles.roleBtnActive,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.roleLabel,
                        { color: e.role === 'leader' ? '#FFF' : textMuted },
                      ]}
                    >
                      Лидер
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setRole(e.id, 'executor')}
                    style={[
                      styles.roleBtn,
                      e.role === 'executor' && styles.roleBtnActive,
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.roleLabel,
                        { color: e.role === 'executor' ? '#FFF' : textMuted },
                      ]}
                    >
                      Исполнитель
                    </ThemedText>
                  </Pressable>
                </View>
                <Pressable onPress={() => removeExecutor(e.id)} style={styles.removeBtn}>
                  <MaterialIcons name="close" size={20} color="#EF4444" />
                </Pressable>
              </View>
            ))}
            {error && (
              <ThemedText style={styles.error}>{error}</ThemedText>
            )}
            <ThemedText style={[styles.hint, { color: textMuted }]}>
              Необходим хотя бы один лидер
            </ThemedText>
            <Button
              title={loading ? 'Назначение...' : 'Назначить'}
              onPress={handleSubmit}
              variant="primary"
              disabled={
                selected.length === 0 ||
                !selected.some((s) => s.role === 'leader') ||
                loading
              }
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
  selectWrap: {
    marginBottom: 16,
  },
  executorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  executorName: {
    flex: 1,
    fontSize: 16,
  },
  roleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  roleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  roleBtnActive: {
    backgroundColor: '#114A65',
  },
  roleLabel: {
    fontSize: 14,
  },
  removeBtn: {
    padding: 4,
    marginLeft: 8,
  },
  error: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 12,
  },
  hint: {
    fontSize: 12,
    marginBottom: 16,
  },
  cancelBtn: {
    marginTop: 8,
  },
});
