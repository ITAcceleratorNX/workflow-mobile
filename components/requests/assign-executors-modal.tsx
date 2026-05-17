import { MaterialIcons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ExecutorAssignCard } from '@/components/requests/executor-assign-card';
import { ThemedText } from '@/components/themed-text';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  FontSizes,
  FontWeights,
  getShadow,
  Radius,
  Spacing,
} from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import {
  formatExecutorLabel,
  getExecutorDisplayParts,
  type ExecutorInCategory,
  type SubRequest,
} from '@/lib/api';

interface SelectedExecutor {
  id: number;
  fullName: string;
  specialty: string;
  role: 'executor' | 'leader';
}

interface AssignExecutorsModalProps {
  visible: boolean;
  onClose: () => void;
  onSubmit: (executors: Array<{ id: number; role: 'executor' | 'leader' }>) => Promise<void>;
  subRequest: SubRequest | null;
  executors: ExecutorInCategory[];
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
  const insets = useSafeAreaInsets();
  const scheme = useColorScheme() ?? 'light';
  const [selected, setSelected] = useState<SelectedExecutor[]>([]);
  const [newExecutorId, setNewExecutorId] = useState('');

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const primary = useThemeColor({}, 'primary');

  useEffect(() => {
    if (!visible) {
      setSelected([]);
      setNewExecutorId('');
    }
  }, [visible]);

  const availableExecutors = executors.filter(
    (e) => !selected.some((s) => s.id === e.id)
  );
  const addOptions = [
    { value: '', label: 'Выберите исполнителя' },
    ...availableExecutors.map((e) => ({
      value: String(e.id),
      label: formatExecutorLabel(e),
    })),
  ];

  const hasLeader = selected.some((s) => s.role === 'leader');
  const canSubmit = selected.length > 0 && hasLeader && !loading;

  const addExecutor = (executorId: string) => {
    if (!executorId) return;
    const id = parseInt(executorId, 10);
    const exec = executors.find((e) => e.id === id);
    if (!exec || selected.some((s) => s.id === id)) return;

    const { name, specialty } = getExecutorDisplayParts(exec);
    const assignLeader = !selected.some((s) => s.role === 'leader');

    setSelected((prev) => [
      ...prev,
      {
        id,
        fullName: name,
        specialty,
        role: assignLeader ? 'leader' : 'executor',
      },
    ]);
    setNewExecutorId('');
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    await onSubmit(selected.map((e) => ({ id: e.id, role: e.role })));
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
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={handleClose} accessibilityLabel="Закрыть" />

        <View
          style={[
            styles.sheet,
            {
              backgroundColor: cardBackground,
              borderColor: border,
              marginBottom: insets.bottom + Spacing.md,
              ...getShadow('modal', scheme),
            },
          ]}
        >
          <View style={styles.header}>
            <View style={styles.headerText}>
              <ThemedText style={[styles.title, { color: text }]}>
                Назначить исполнителей
              </ThemedText>
              <ThemedText style={[styles.subtitle, { color: textMuted }]}>
                Подзаявка #{subRequest.id}
              </ThemedText>
            </View>
            <Pressable
              onPress={handleClose}
              hitSlop={10}
              style={({ pressed }) => [
                styles.closeBtn,
                { borderColor: border, opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <MaterialIcons name="close" size={22} color={textMuted} />
            </Pressable>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>
              Добавить
            </ThemedText>
            <Select
              value={newExecutorId}
              onValueChange={(v) => {
                if (v) addExecutor(v);
                setNewExecutorId('');
              }}
              options={addOptions}
              placeholder="Выберите исполнителя"
            />

            {selected.length > 0 ? (
              <View style={styles.selectedSection}>
                <ThemedText style={[styles.sectionLabel, { color: textMuted }]}>
                  Выбранные · {selected.length}
                </ThemedText>
                {selected.map((item) => (
                  <ExecutorAssignCard
                    key={item.id}
                    fullName={item.fullName}
                    specialty={item.specialty}
                    role={item.role}
                    onRoleChange={(role) =>
                      setSelected((prev) =>
                        prev.map((e) => (e.id === item.id ? { ...e, role } : e))
                      )
                    }
                    onRemove={() =>
                      setSelected((prev) => prev.filter((e) => e.id !== item.id))
                    }
                  />
                ))}
              </View>
            ) : (
              <View style={[styles.emptyState, { borderColor: border, backgroundColor: surfaceMuted }]}>
                <MaterialIcons name="group-add" size={28} color={textMuted} />
                <ThemedText style={[styles.emptyText, { color: textMuted }]}>
                  Выберите одного или нескольких исполнителей из списка
                </ThemedText>
              </View>
            )}

            {error ? <ThemedText style={styles.error}>{error}</ThemedText> : null}

            {!hasLeader && selected.length > 0 ? (
              <View style={[styles.hintBanner, { backgroundColor: `${primary}18` }]}>
                <MaterialIcons name="info-outline" size={18} color={primary} />
                <ThemedText style={[styles.hintText, { color: primary }]}>
                  Назначьте хотя бы одного лидера
                </ThemedText>
              </View>
            ) : null}
          </ScrollView>

          <View style={[styles.footer, { borderTopColor: border }]}>
            <Button
              title={loading ? 'Назначение...' : 'Назначить'}
              onPress={handleSubmit}
              variant="primary"
              loading={loading}
              disabled={!canSubmit}
            />
            <Button title="Отмена" onPress={handleClose} variant="ghost" />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'flex-end',
    paddingHorizontal: Spacing.md,
  },
  sheet: {
    width: '100%',
    maxHeight: '88%',
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.md,
  },
  headerText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  title: {
    fontSize: FontSizes.titleLarge,
    fontWeight: FontWeights.semibold,
  },
  subtitle: {
    fontSize: FontSizes.bodySmall,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flexGrow: 0,
  },
  scrollContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    gap: Spacing.md,
  },
  sectionLabel: {
    fontSize: FontSizes.caption,
    fontWeight: FontWeights.semibold,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  selectedSection: {
    gap: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
  },
  emptyText: {
    fontSize: FontSizes.bodySmall,
    textAlign: 'center',
    lineHeight: 20,
  },
  error: {
    color: '#EF4444',
    fontSize: FontSizes.bodySmall,
  },
  hintBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.md,
  },
  hintText: {
    flex: 1,
    fontSize: FontSizes.bodySmall,
    fontWeight: FontWeights.medium,
  },
  footer: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.lg,
    gap: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
