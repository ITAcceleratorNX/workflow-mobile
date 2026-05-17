import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  deleteExecutor,
  getExecutors,
  getServiceCategories,
  updateExecutor,
  type ExecutorInCategory,
  type ServiceCategory,
} from '@/lib/api';
import { useAuthStore } from '@/stores/auth-store';

export default function DepartmentHeadExecutorsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { show: showToast } = useToast();
  const role = useAuthStore((s) => s.role);

  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const bg = useThemeColor({}, 'background');
  const card = useThemeColor({}, 'cardBackground');

  const [executors, setExecutors] = useState<ExecutorInCategory[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ExecutorInCategory | null>(null);
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('+7 ');
  const [specialty, setSpecialty] = useState('');
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [execRes, catRes] = await Promise.all([getExecutors(), getServiceCategories()]);
    if (execRes.ok) setExecutors(execRes.data);
    if (catRes.ok && catRes.data) setCategories(catRes.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (role !== 'department-head') {
      router.back();
      return;
    }
    load();
  }, [role, load, router]);

  const resetForm = () => {
    setEditing(null);
    setFullName('');
    setPhone('+7 ');
    setSpecialty('');
    setSelectedCategoryIds([]);
    setFormOpen(false);
  };

  const openEdit = (exec: ExecutorInCategory) => {
    setEditing(exec);
    setFullName(exec.user?.full_name ?? '');
    setPhone(exec.user?.phone ?? '+7 ');
    setSpecialty(exec.specialty ?? '');
    setSelectedCategoryIds(
      exec.serviceCategories?.map((c) => c.id) ?? []
    );
    setFormOpen(true);
  };

  const toggleCategory = (id: number) => {
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSave = async () => {
    if (!fullName.trim() || !specialty.trim() || selectedCategoryIds.length === 0) {
      showToast({
        title: 'Укажите ФИО, специальность и хотя бы одну категорию',
        variant: 'destructive',
      });
      return;
    }
    if (!editing) return;

    setSaving(true);
    const res = await updateExecutor(editing.id, {
      full_name: fullName.trim(),
      phone,
      specialty: specialty.trim(),
      category_ids: selectedCategoryIds,
    });
    setSaving(false);
    if (res.ok) {
      showToast({ title: 'Исполнитель обновлён', variant: 'success' });
      resetForm();
      load();
    } else {
      showToast({ title: res.error, variant: 'destructive' });
    }
  };

  const handleDelete = (exec: ExecutorInCategory) => {
    Alert.alert(
      'Удалить исполнителя?',
      exec.user?.full_name ?? '',
      [
        { text: 'Отмена', style: 'cancel' },
        {
          text: 'Удалить',
          style: 'destructive',
          onPress: async () => {
            const res = await deleteExecutor(exec.id);
            if (res.ok) {
              showToast({ title: 'Исполнитель удалён', variant: 'success' });
              load();
            } else {
              showToast({ title: res.error, variant: 'destructive' });
            }
          },
        },
      ]
    );
  };

  if (role !== 'department-head') {
    return null;
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor: bg, paddingTop: insets.top }]}>
      <ScreenHeader title="Исполнители" onBack={() => router.back()} />

      {loading ? (
        <ActivityIndicator style={styles.loader} color={primary} />
      ) : (
        <ScrollView
          contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        >
          {executors.map((exec) => (
            <View key={exec.id} style={[styles.card, { backgroundColor: card, borderColor: border }]}>
              <View style={styles.cardHeader}>
                <ThemedText style={[styles.name, { color: text }]}>
                  {exec.user?.full_name ?? `Исполнитель #${exec.id}`}
                </ThemedText>
                <View style={styles.cardActions}>
                  <Pressable onPress={() => openEdit(exec)} hitSlop={8}>
                    <MaterialIcons name="edit" size={22} color={primary} />
                  </Pressable>
                  <Pressable onPress={() => handleDelete(exec)} hitSlop={8}>
                    <MaterialIcons name="delete" size={22} color="#c62828" />
                  </Pressable>
                </View>
              </View>
              {exec.user?.phone ? (
                <ThemedText style={{ color: muted }}>{exec.user.phone}</ThemedText>
              ) : null}
              {exec.specialty ? (
                <ThemedText style={[styles.specialty, { color: text }]}>
                  {exec.specialty}
                </ThemedText>
              ) : null}
              {(exec.serviceCategories ?? []).length > 0 ? (
                <ThemedText style={[styles.categories, { color: muted }]}>
                  {(exec.serviceCategories ?? []).map((c) => c.name).join(' · ')}
                </ThemedText>
              ) : null}
            </View>
          ))}
        </ScrollView>
      )}

      {formOpen && (
        <View style={[styles.formOverlay, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
          <View style={[styles.formCard, { backgroundColor: card }]}>
            <ThemedText type="subtitle" style={{ color: text, marginBottom: 12 }}>
              Редактировать
            </ThemedText>
            <ThemedText style={[styles.label, { color: muted }]}>ФИО</ThemedText>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              style={[styles.input, { color: text, borderColor: border }]}
              placeholder="Иванов Иван"
              placeholderTextColor={muted}
            />
            <ThemedText style={[styles.label, { color: muted }]}>Телефон</ThemedText>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              style={[styles.input, { color: text, borderColor: border }]}
              keyboardType="phone-pad"
            />
            <ThemedText style={[styles.label, { color: muted }]}>Специальность</ThemedText>
            <TextInput
              value={specialty}
              onChangeText={setSpecialty}
              style={[styles.input, { color: text, borderColor: border }]}
              placeholder="Например: электрик"
              placeholderTextColor={muted}
            />
            <ThemedText style={[styles.label, { color: muted }]}>Категории услуг</ThemedText>
            <View style={styles.chips}>
              {categories.map((c) => {
                const active = selectedCategoryIds.includes(c.id);
                return (
                  <Pressable
                    key={c.id}
                    onPress={() => toggleCategory(c.id)}
                    style={[
                      styles.chip,
                      { borderColor: border },
                      active && { backgroundColor: primary, borderColor: primary },
                    ]}
                  >
                    <ThemedText style={{ color: active ? '#fff' : text, fontSize: 13 }}>
                      {c.name}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
            <View style={styles.formActions}>
              <Pressable onPress={resetForm} style={[styles.formBtn, { borderColor: border }]}>
                <ThemedText style={{ color: text }}>Отмена</ThemedText>
              </Pressable>
              <Pressable
                onPress={handleSave}
                disabled={saving}
                style={[styles.formBtn, { backgroundColor: primary }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <ThemedText style={{ color: '#fff', fontWeight: '600' }}>Сохранить</ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { marginTop: 40 },
  content: { padding: 16, gap: 12 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 6 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  cardActions: { flexDirection: 'row', gap: 12 },
  name: { fontSize: 16, fontWeight: '600', flex: 1 },
  specialty: { fontSize: 14 },
  categories: { fontSize: 13 },
  formOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    padding: 20,
  },
  formCard: { borderRadius: 16, padding: 20, maxHeight: '90%' },
  label: { fontSize: 13, marginBottom: 4, marginTop: 8 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  formActions: { flexDirection: 'row', gap: 12, marginTop: 20 },
  formBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
    minHeight: 44,
  },
});
