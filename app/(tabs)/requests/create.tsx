import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { getPrimaryPhotoUri } from '@/lib/image-uri';
import { Button, PageLoader, Select } from '@/components/ui';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useToast } from '@/context/toast-context';
import {
  createRequestGroup,
  getClientRoomSubscriptions,
  getExecutors,
  getOffices,
  getServiceCategories,
  type ExecutorInCategory,
  type Office,
  type ServiceCategory,
  type RequestGroup,
} from '@/lib/api';
import {
  getBlocksForOffice,
  getLocationsForBlock,
  getRoomsForLocation,
  hasLocationsForBlock,
  hasRoomsForLocation,
} from '@/lib/office-locations';
import { findNearestOffice } from '@/lib/nearest-office';
import { useAuthStore } from '@/stores/auth-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COMPLEXITY_OPTIONS, SLA_OPTIONS } from '@/constants/requests';

type CreateUserRole = 'client' | 'admin-worker' | 'department-head' | 'executor' | 'manager';

const REQUEST_TYPES: { value: string; label: string }[] = [
  { value: 'normal', label: 'Обычная' },
  { value: 'urgent', label: 'Экстренная' },
  { value: 'planned', label: 'Плановая' },
  { value: 'recurring', label: 'Повторяющаяся задача' },
];

/** Как в kcell: для справочника офисов используем office.name (совпадает с address в officeLocationsData) */
function getOfficeAddressForLocations(office: Office): string {
  return office.name;
}

const KCELL = {
  primary: '#F35713',
  primaryDark: '#E25B21',
  cardBg: '#212121',
  cardBgSelected: '#212121',
  cardBorder: '#2A2A2A',
  muted: '#8E8E93',
  gradientFrom: '#114A65',
  gradientTo: '#B8400E',
} as const;

const BOTTOM_BAR_MARGIN = 12;
const BOTTOM_BAR_RADIUS = 25;
const BOTTOM_BAR_HEIGHT = 64;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_GAP = 8;
const CARD_COLS = 2;
const OFFICE_CARD_WIDTH = (SCREEN_WIDTH - 48 - CARD_GAP) / CARD_COLS;
const OFFICE_CARD_ASPECT = 108 / 134;
const OFFICE_CARD_HEIGHT = OFFICE_CARD_WIDTH / OFFICE_CARD_ASPECT;

export default function CreateRequestScreen() {
  const router = useRouter();
  const { show: showToast } = useToast();
  const role = useAuthStore((s) => s.role) as CreateUserRole | null;
  const user = useAuthStore((s) => s.user);
  const isGuest = useAuthStore((s) => s.isGuest);
  const { addRequest: addGuestRequest } = useGuestDemoStore();

  const textColor = useThemeColor({}, 'text');
  const mutedColor = useThemeColor({}, 'textMuted');
  const primaryColor = useThemeColor({}, 'primary');
  const borderColor = useThemeColor({}, 'border');
  const backgroundColor = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');
  const insets = useSafeAreaInsets();

  const themeStyles = useMemo(
    () => ({
      stepDotInactive: { backgroundColor: borderColor },
      stepDotActive: { backgroundColor: primaryColor },
      chipActive: { backgroundColor: primaryColor, borderColor: primaryColor },
      officeChip: { backgroundColor: cardBackground },
      officeChipActive: {
        backgroundColor: primaryColor,
        borderColor: primaryColor,
      },
      officeCard: { backgroundColor: cardBackground },
      officeCardSelected: {
        borderColor: primaryColor,
        shadowColor: primaryColor,
        shadowOpacity: 0.5,
        shadowRadius: 6,
      },
      officeCardImage: { backgroundColor: borderColor },
      toggleRow: { backgroundColor: cardBackground },
      summaryCard: { backgroundColor: cardBackground },
      actionsFooterBar: { backgroundColor: cardBackground },
      actionsFooterWrap: { borderTopWidth: 1, borderTopColor: borderColor },
    }),
    [
      borderColor,
      primaryColor,
      cardBackground,
    ]
  );

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [offices, setOffices] = useState<Office[]>([]);
  const [categories, setCategories] = useState<ServiceCategory[]>([]);
  const [executors, setExecutors] = useState<ExecutorInCategory[]>([]);

  const [locationSource, setLocationSource] = useState<'office' | 'cabinet'>('office');
  const [selectedOfficeId, setSelectedOfficeId] = useState<number | null>(null);
  const [selectedCabinetRoom, setSelectedCabinetRoom] = useState<{
    id: number;
    name: string;
    office_id: number;
  } | null>(null);
  const [userCabinetRooms, setUserCabinetRooms] = useState<
    { id: number; name: string; office_id: number }[]
  >([]);
  const [selectedBlock, setSelectedBlock] = useState('');
  const [selectedLocation, setSelectedLocation] = useState('');
  const [selectedRoom, setSelectedRoom] = useState('');
  const [customLocation, setCustomLocation] = useState('');
  const [customRoom, setCustomRoom] = useState('');
  const [customLocationDetail, setCustomLocationDetail] = useState('');

  const [requestType, setRequestType] = useState('normal');
  const [plannedDate, setPlannedDate] = useState('');
  const [isRecurringTask, setIsRecurringTask] = useState(false);
  const [recurrenceType, setRecurrenceType] = useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('weekly');
  const [recurrenceInterval, setRecurrenceInterval] = useState(1);
  const [recurrenceStartDate, setRecurrenceStartDate] = useState(new Date());
  const [categoryId, setCategoryId] = useState(0);
  const [subcategoryId, setSubcategoryId] = useState(0);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [complexity, setComplexity] = useState('');
  const [sla, setSla] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [selectedExecutors, setSelectedExecutors] = useState<Array<{ id: number; role: 'executor' | 'leader' }>>([]);

  const [createMode, setCreateMode] = useState<'create' | 'createAndComplete'>('create');
  const [completionComment, setCompletionComment] = useState('');
  const [completionDate, setCompletionDate] = useState(new Date());
  const [afterPhotos, setAfterPhotos] = useState<string[]>([]);
  const [isDetectingNearestOffice, setIsDetectingNearestOffice] = useState(false);

  const selectedOffice =
    locationSource === 'cabinet' && selectedCabinetRoom
      ? offices.find((o) => o.id === selectedCabinetRoom.office_id)
      : offices.find((o) => o.id === selectedOfficeId);
  const officeAddress = selectedOffice ? getOfficeAddressForLocations(selectedOffice) : '';
  const blocks = officeAddress && locationSource === 'office' ? getBlocksForOffice(officeAddress) : [];
  const locationForRooms = selectedLocation === 'Другое' ? '' : selectedLocation;
  const hasLocations = selectedBlock ? hasLocationsForBlock(officeAddress, selectedBlock) : false;
  const locations = hasLocations && selectedBlock ? getLocationsForBlock(officeAddress, selectedBlock) : [];
  const hasRooms =
    selectedBlock && (hasLocations ? selectedLocation : true)
      ? hasRoomsForLocation(officeAddress, selectedBlock, locationForRooms)
      : false;
  const rooms =
    hasRooms && selectedBlock
      ? getRoomsForLocation(officeAddress, selectedBlock, locationForRooms)
      : [];
  const selectedCategory = categories.find((c) => c.id === categoryId);

  useEffect(() => {
    const load = async () => {
      setLoading(true);

      // В демо-режиме не ходим в API, используем мок-данные
      if (isGuest) {
        const demoOffice: Office = {
          id: 1,
          name: 'Офис (демо)',
          city: 'Алматы',
          address: 'ул. Демо, 1',
        };
        const demoCategories: ServiceCategory[] = [
          {
            id: 1,
            name: 'IT‑инфраструктура (демо)',
            subcategories: [
              { id: 11, name: 'Не работает интернет', category_id: 1 },
              { id: 12, name: 'Проблемы с ноутбуком', category_id: 1 },
            ],
          },
          {
            id: 2,
            name: 'Офисная инфраструктура (демо)',
            subcategories: [
              { id: 21, name: 'Климат / кондиционер', category_id: 2 },
              { id: 22, name: 'Мебель / рабочее место', category_id: 2 },
            ],
          },
        ];

        setOffices([demoOffice]);
        setCategories(demoCategories);
        setUserCabinetRooms([]);
        setLoading(false);
        return;
      }

      const [offRes, catRes] = await Promise.all([
        getOffices(),
        getServiceCategories(),
      ]);
      const offList = Array.isArray(offRes) ? offRes : [];
      setOffices(offList);
      if (catRes.ok && catRes.data) {
        setCategories(catRes.data);
      }
      if (role === 'department-head') {
        const execRes = await getExecutors();
        if (execRes.ok && execRes.data) {
          setExecutors(execRes.data);
        }
      }
      if (['admin-worker', 'department-head', 'executor', 'manager'].includes(role ?? '') && user?.id) {
        try {
          const subsRes = await getClientRoomSubscriptions(user.id);
          if (subsRes.ok && subsRes.data?.subscriptions) {
            const cabinets = subsRes.data.subscriptions
              .filter((s) => (s.meetingRoom as { room_type?: string })?.room_type === 'cabinet')
              .map((s) => ({
                id: s.meetingRoom!.id,
                name: s.meetingRoom!.name,
                office_id: s.meetingRoom!.office_id ?? 0,
              }))
              .filter((c) => c.office_id > 0);
            setUserCabinetRooms(cabinets);
          }
        } catch {
          setUserCabinetRooms([]);
        }
      }
      setLoading(false);
    };
    load();
  }, [role, user?.id]);

  useEffect(() => {
    setSelectedBlock('');
    setSelectedLocation('');
    setSelectedRoom('');
    setCustomLocation('');
    setCustomRoom('');
  }, [selectedOfficeId, locationSource]);

  useEffect(() => {
    setSelectedLocation('');
    setSelectedRoom('');
    setCustomLocation('');
    setCustomRoom('');
  }, [selectedBlock]);

  useEffect(() => {
    setSelectedRoom('');
    setCustomRoom('');
  }, [selectedLocation]);

  useEffect(() => {
    if (requestType !== 'planned' && requestType !== 'recurring') {
      setPlannedDate('');
    }
    setIsRecurringTask(requestType === 'recurring');
  }, [requestType]);

  const buildLocationDetail = useCallback((): string => {
    if (locationSource === 'cabinet' && selectedCabinetRoom) {
      return `Кабинет: ${selectedCabinetRoom.name}`;
    }
    const parts: string[] = [];
    if (selectedBlock) parts.push(`Блок: ${selectedBlock}`);
    if (hasLocations) {
      const locVal = selectedLocation === 'Другое' ? customLocation : selectedLocation;
      if (locVal) parts.push(`Местонахождение: ${locVal}`);
    } else if (customLocation.trim()) {
      parts.push(`Местонахождение: ${customLocation.trim()}`);
    }
    if (hasRooms) {
      const roomVal = selectedRoom === 'Другое' ? customRoom : selectedRoom;
      if (roomVal) parts.push(`Помещение: ${roomVal}`);
    } else if (customRoom.trim() || (selectedLocation && selectedLocation !== 'Другое')) {
      if (customRoom.trim()) parts.push(`Помещение: ${customRoom.trim()}`);
    }
    if (customLocationDetail.trim()) parts.push(customLocationDetail.trim());
    return parts.length > 0 ? parts.join(', ') : 'Не указано';
  }, [
    locationSource,
    selectedCabinetRoom,
    selectedBlock,
    selectedLocation,
    selectedRoom,
    customLocation,
    customRoom,
    customLocationDetail,
    hasLocations,
    hasRooms,
  ]);

  const canProceedStep1 =
    locationSource === 'cabinet' ? selectedCabinetRoom != null : selectedOfficeId != null;
  const canProceedStep2 = (() => {
    if (locationSource === 'cabinet') return !!selectedCabinetRoom;
    if (blocks.length === 0) return customLocationDetail.trim().length > 0;
    if (!selectedBlock) return false;
    if (hasLocations) {
      if (!selectedLocation) return false;
      if (selectedLocation === 'Другое' && !customLocation.trim()) return false;
    }
    if (hasRooms) {
      if (!selectedRoom) return false;
      if (selectedRoom === 'Другое' && !customRoom.trim()) return false;
    } else if (selectedLocation && selectedLocation !== 'Другое') {
      if (!customRoom.trim()) return false;
    }
    return true;
  })();
  const canProceedStep3 = requestType && categoryId > 0 && title.trim().length > 0;
  const canProceedStep4 = description.trim().length > 0;
  const canSubmit =
    canProceedStep1 &&
    canProceedStep2 &&
    canProceedStep3 &&
    canProceedStep4 &&
    (role !== 'admin-worker' && role !== 'department-head' ? true : complexity && sla) &&
    (role !== 'department-head' || selectedExecutors.length === 0 || selectedExecutors.some((e) => e.role === 'leader')) &&
    (role !== 'executor' || createMode !== 'createAndComplete' || (completionComment.trim() && afterPhotos.length > 0));

  const handleDetectNearestOffice = useCallback(async () => {
    if (!offices.length) return;
    setIsDetectingNearestOffice(true);
    try {
      let { status, canAskAgain } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') {
        const req = await Location.requestForegroundPermissionsAsync();
        status = req.status;
        canAskAgain = req.canAskAgain;
      }

      if (status !== 'granted') {
        if (!canAskAgain) {
          Alert.alert(
            'Геолокация выключена',
            'Разрешите доступ к геолокации в настройках устройства, чтобы рекомендовать ближайший офис.',
            [
              { text: 'Отмена', style: 'cancel' },
              {
                text: 'Открыть настройки',
                onPress: () => {
                  try {
                    Linking.openSettings();
                  } catch {
                    // ignore
                  }
                },
              },
            ]
          );
        } else {
          showToast({
            title: 'Геолокация недоступна',
            description: 'Разрешите доступ к геолокации, чтобы рекомендовать офис.',
            variant: 'destructive',
            duration: 3000,
          });
        }
        return;
      }

      const current = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const nearest = findNearestOffice(offices, {
        lat: current.coords.latitude,
        lon: current.coords.longitude,
      });
      if (!nearest) {
        showToast({
          title: 'Офисы не найдены',
          description: 'Нет офисов с координатами для определения ближайшего.',
          variant: 'destructive',
          duration: 3000,
        });
        return;
      }

      setSelectedOfficeId(nearest.id);
      showToast({
        title: 'Ближайший офис',
        description: `Рекомендуемый офис: ${nearest.name}`,
        variant: 'success',
        duration: 2500,
      });
    } catch (e) {
      console.error('[RequestsCreate] detect nearest office error', e);
      showToast({
        title: 'Ошибка геолокации',
        description: 'Не удалось определить ближайший офис.',
        variant: 'destructive',
        duration: 3000,
      });
    } finally {
      setIsDetectingNearestOffice(false);
    }
  }, [offices, showToast]);

  const pickImage = useCallback(async (forAfter = false) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Доступ к фото отключён',
        'Разрешите доступ к фото/видео в настройках устройства, чтобы прикреплять файлы.',
        [
          { text: 'Отмена', style: 'cancel' },
          {
            text: 'Открыть настройки',
            onPress: () => {
              try {
                Linking.openSettings();
              } catch {
                // ignore
              }
            },
          },
        ]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets) {
      const uris = result.assets.map((a) => a.uri);
      if (forAfter) {
        setAfterPhotos((p) => [...p, ...uris].slice(0, 3));
      } else {
        setPhotos((p) => [...p, ...uris].slice(0, 3));
      }
    }
  }, []);

  const removePhoto = useCallback((index: number, forAfter: boolean) => {
    if (forAfter) {
      setAfterPhotos((p) => p.filter((_, i) => i !== index));
    } else {
      setPhotos((p) => p.filter((_, i) => i !== index));
    }
  }, []);

  const handleSubmit = useCallback(async () => {
    const officeIdToSend =
      locationSource === 'cabinet' && selectedCabinetRoom
        ? selectedCabinetRoom.office_id
        : selectedOfficeId;
    if (!officeIdToSend || !canSubmit) return;

    const formData = new FormData();
    let groupStatus = 'awaiting_assignment';
    if (role === 'client') groupStatus = 'in_progress';
    else if (role === 'executor') groupStatus = createMode === 'createAndComplete' ? 'completed' : 'in_progress';
    else if (role === 'department-head' && selectedExecutors.length > 0) groupStatus = 'execution';

    const subStatus =
      role === 'client'
        ? 'in_progress'
        : role === 'executor'
          ? createMode === 'createAndComplete'
            ? 'completed'
            : 'in_progress'
          : role === 'department-head' && selectedExecutors.length > 0
            ? 'assigned'
            : 'awaiting_assignment';

    const finalRequestType = isRecurringTask ? 'recurring' : requestType;
    formData.append('request_type', finalRequestType);
    formData.append('office_id', String(officeIdToSend));
    const officeForLocation = selectedOffice ?? offices.find((o) => o.id === officeIdToSend);
    formData.append(
      'location',
      `Широта: ${officeForLocation?.lat ?? ''}, Долгота: ${officeForLocation?.lon ?? ''} (±1 м)`
    );
    formData.append('location_detail', buildLocationDetail());
    formData.append('status', groupStatus);
    if (plannedDate) formData.append('planned_date', plannedDate);
    if (isRecurringTask) {
      formData.append('recurrence_type', recurrenceType);
      formData.append('recurrence_interval', String(recurrenceInterval));
      formData.append('start_date', recurrenceStartDate.toISOString().split('T')[0]);
    }

    const subRequestsData = [
      {
        title: title.trim(),
        description: description.trim(),
        category_id: categoryId,
        subcategory_id: subcategoryId || null,
        complexity: role === 'admin-worker' || role === 'department-head' ? complexity || undefined : undefined,
        sla: role === 'admin-worker' || role === 'department-head' ? sla || undefined : undefined,
        status: subStatus,
        executors: role === 'department-head' ? selectedExecutors : [],
      },
    ];
    formData.append('sub_requests', JSON.stringify(subRequestsData));

    photos.forEach((uri) => {
      formData.append('photos', {
        uri,
        type: 'image/jpeg',
        name: `photo_${Date.now()}.jpg`,
      } as unknown as Blob);
    });

    if (role === 'executor' && createMode === 'createAndComplete') {
      formData.append('completion_comment', completionComment.trim());
      formData.append('completion_date', completionDate.toISOString().split('T')[0]);
    }

    setSubmitting(true);
    setError(null);

    if (isGuest) {
      const office = offices.find((o) => o.id === officeIdToSend);
      const created: RequestGroup = {
        id: -1,
        client_id: user?.id ?? 0,
        office_id: officeIdToSend,
        location: `Широта: ${office?.lat ?? ''}, Долгота: ${office?.lon ?? ''} (демо)`,
        location_detail: buildLocationDetail(),
        date_submitted: new Date().toISOString(),
        status: groupStatus,
        request_type: finalRequestType,
        rejection_reason: undefined,
        planned_date: plannedDate || undefined,
        created_date: new Date().toISOString(),
        office: office ? { id: office.id, name: office.name, city: office.city ?? '', address: office.address } : undefined,
        photos: [],
        client: user ? { full_name: user.full_name, phone: user.phone, role: user.role } : undefined,
        is_long_term: false,
        requests: [
          {
            id: -1,
            title: title.trim(),
            description: description.trim(),
            status: subStatus,
            category_id: categoryId,
            category: selectedCategory ? { id: selectedCategory.id, name: selectedCategory.name } : undefined,
            complexity: complexity || undefined,
            sla: sla || undefined,
            created_date: new Date().toISOString(),
            executors: [],
            is_long_term: false,
            ratings: [],
            photos: [],
          } as any,
        ],
      };

      addGuestRequest(created as any);
      setSubmitting(false);
      showToast({
        title: 'Демо',
        description: 'Заявка создана локально',
        variant: 'success',
      });
      router.replace('/requests');
      return;
    }

    const res = await createRequestGroup(formData);
    setSubmitting(false);

    if (res.ok) {
      if (role === 'executor' && createMode === 'createAndComplete' && afterPhotos.length > 0 && res.data) {
        const { uploadRequestPhotos } = await import('@/lib/api');
        const uploadRes = await uploadRequestPhotos(res.data.id, afterPhotos.map((uri) => ({ uri })), 'after');
        if (!uploadRes.ok) showToast({ title: uploadRes.error, variant: 'destructive' });
      }
      showToast({
        title: role === 'executor' && createMode === 'createAndComplete' ? 'Заявка создана и завершена' : 'Заявка создана',
        variant: 'success',
      });
      router.replace('/requests');
    } else {
      setError(res.error);
    }
  }, [
    locationSource,
    selectedCabinetRoom,
    selectedOfficeId,
    selectedOffice,
    offices,
    canSubmit,
    role,
    createMode,
    selectedExecutors,
    requestType,
    plannedDate,
    title,
    description,
    categoryId,
    subcategoryId,
    complexity,
    sla,
    photos,
    afterPhotos,
    completionComment,
    completionDate,
    buildLocationDetail,
    isRecurringTask,
    recurrenceType,
    recurrenceInterval,
    recurrenceStartDate,
    router,
    showToast,
  ]);

  const goBack = useCallback(() => {
    if (step > 1) setStep((s) => s - 1);
    else router.back();
  }, [step, router]);

  if (loading) {
    return (
      <ThemedView style={styles.centered}>
        <PageLoader size={80} />
        <ThemedText style={[styles.loadingText, { color: mutedColor }]}>Загрузка...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { backgroundColor }]}>
      <View style={[styles.header, { paddingTop: 12 + insets.top, borderBottomColor: borderColor }]}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={textColor} />
          <ThemedText style={[styles.backLabel, { color: textColor }]}>Назад</ThemedText>
        </Pressable>
        <ThemedText style={[styles.headerTitle, { color: textColor }]}>
          Создать заявку
        </ThemedText>
      </View>

      <KeyboardAvoidingView
        style={styles.keyboard}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={80}
      >
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom:
                BOTTOM_BAR_HEIGHT + BOTTOM_BAR_MARGIN * 2 + 24 + insets.bottom,
            },
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.stepIndicator}>
            {[1, 2, 3, 4].map((s) => (
              <View
                key={s}
                style={[
                  styles.stepDot,
                  step >= s ? themeStyles.stepDotActive : themeStyles.stepDotInactive,
                  step === s && styles.stepDotCurrent,
                ]}
              />
            ))}
          </View>

          {step === 1 && (
            <View style={styles.step}>
              <ThemedText style={[styles.stepTitle, { color: textColor }]}>
                Где находится заявка?
              </ThemedText>
              {['admin-worker', 'department-head', 'executor', 'manager'].includes(role ?? '') &&
                userCabinetRooms.length > 0 && (
                  <View style={[styles.toggleRow, { borderColor }, themeStyles.toggleRow]}>
                    <Pressable
                      onPress={() => {
                        setLocationSource('office');
                        setSelectedCabinetRoom(null);
                        setSelectedOfficeId(null);
                      }}
                      style={[
                        styles.toggleBtn,
                        locationSource === 'office' && { backgroundColor: primaryColor },
                      ]}
                    >
                      <MaterialIcons name="business" size={18} color={locationSource === 'office' ? '#FFF' : mutedColor} />
                      <ThemedText style={[styles.toggleLabel, { color: locationSource === 'office' ? '#FFF' : mutedColor }]}>
                        Офис
                      </ThemedText>
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setLocationSource('cabinet');
                        setSelectedOfficeId(null);
                        setSelectedBlock('');
                        setSelectedLocation('');
                        setSelectedRoom('');
                        setCustomLocation('');
                        setCustomRoom('');
                      }}
                      style={[
                        styles.toggleBtn,
                        locationSource === 'cabinet' && { backgroundColor: primaryColor },
                      ]}
                    >
                      <MaterialIcons name="home" size={18} color={locationSource === 'cabinet' ? '#FFF' : mutedColor} />
                      <ThemedText style={[styles.toggleLabel, { color: locationSource === 'cabinet' ? '#FFF' : mutedColor }]}>
                        Кабинет (умный дом)
                      </ThemedText>
                    </Pressable>
                  </View>
                )}
              {locationSource === 'cabinet' ? (
                <>
                  <ThemedText style={[styles.stepHint, { color: mutedColor }]}>
                    Кабинет, закреплённый за вами с умным домом
                  </ThemedText>
                  <View style={styles.chipRow}>
                    {userCabinetRooms.map((room) => (
                      <Pressable
                        key={room.id}
                        onPress={() => {
                          setSelectedCabinetRoom(room);
                          setSelectedOfficeId(room.office_id);
                        }}
                        style={[
                          styles.chip,
                          { borderColor },
                          selectedCabinetRoom?.id === room.id && themeStyles.chipActive,
                        ]}
                      >
                        <ThemedText style={[styles.chipText, { color: selectedCabinetRoom?.id === room.id ? '#FFF' : textColor }]}>
                          {room.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </>
              ) : (
                <>
                  <ThemedText style={[styles.stepHint, { color: mutedColor }]}>
                    Выберите офис, в котором находится заявка
                  </ThemedText>
                  <Pressable
                    onPress={handleDetectNearestOffice}
                    style={styles.geoButton}
                  >
                    <MaterialIcons name="my-location" size={18} color="#FFFFFF" />
                    <ThemedText style={styles.geoButtonText}>
                      {isDetectingNearestOffice ? 'Определяем ближайший офис...' : 'Определить ближайший офис'}
                    </ThemedText>
                  </Pressable>
                  <View style={styles.officeChipRow}>
                    {offices.map((office) => (
                      <Pressable
                        key={office.id}
                        onPress={() => setSelectedOfficeId(office.id)}
                        style={[
                          styles.officeChip,
                          themeStyles.officeChip,
                          selectedOfficeId === office.id && themeStyles.officeChipActive,
                        ]}
                      >
                        <ThemedText
                          style={[
                            styles.officeChipText,
                            { color: selectedOfficeId === office.id ? '#FFF' : textColor },
                          ]}
                          numberOfLines={1}
                        >
                          {office.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  <View style={styles.officeGrid}>
                    {offices.map((office) => {
                      const photoUri = getPrimaryPhotoUri(office);
                      const isSelected = selectedOfficeId === office.id;
                      return (
                        <Pressable
                          key={office.id}
                          onPress={() => setSelectedOfficeId(office.id)}
                          style={[
                            styles.officeCard,
                            themeStyles.officeCard,
                            isSelected && themeStyles.officeCardSelected,
                          ]}
                        >
                          <View style={[styles.officeCardImage, themeStyles.officeCardImage]}>
                            {photoUri ? (
                              <Image
                                source={{ uri: photoUri }}
                                style={styles.officeCardImageImg}
                                resizeMode="cover"
                              />
                            ) : (
                              <LinearGradient
                                colors={[KCELL.gradientFrom, KCELL.gradientTo]}
                                style={styles.officeCardImagePlaceholder}
                              >
                                <MaterialIcons name="location-on" size={32} color="rgba(255,255,255,0.5)" />
                              </LinearGradient>
                            )}
                          </View>
                          <View style={styles.officeCardInfo}>
                            <ThemedText
                              style={[styles.officeCardName, { color: isSelected ? primaryColor : textColor }]}
                              numberOfLines={2}
                            >
                              {office.name}
                            </ThemedText>
                            {office.city && (
                              <ThemedText style={[styles.officeCardMeta, { color: mutedColor }]} numberOfLines={1}>
                                {office.city}
                              </ThemedText>
                            )}
                            {office.address && (
                              <ThemedText style={[styles.officeCardMeta, { color: mutedColor }]} numberOfLines={2}>
                                {office.address}
                              </ThemedText>
                            )}
                          </View>
                        </Pressable>
                      );
                    })}
                  </View>
                </>
              )}
            </View>
          )}

          {step === 2 && (
            <View style={styles.step}>
              <ThemedText style={[styles.stepTitle, { color: textColor }]}>Расположение</ThemedText>
              {locationSource === 'cabinet' && selectedCabinetRoom ? (
                <View style={[styles.summaryCard, { borderColor }, themeStyles.summaryCard]}>
                  <MaterialIcons name="home" size={24} color={primaryColor} />
                  <View>
                    <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Выбран кабинет</ThemedText>
                    <ThemedText style={[styles.officeName, { color: textColor }]}>{selectedCabinetRoom.name}</ThemedText>
                  </View>
                </View>
              ) : (
                <>
                  <ThemedText style={[styles.stepHint, { color: mutedColor }]}>
                    {selectedOffice?.name}
                  </ThemedText>

                  {blocks.length > 0 ? (
                    <>
                      <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Блок</ThemedText>
                      <View style={styles.chipRow}>
                        {blocks.map((b) => (
                          <Pressable
                            key={b}
                            onPress={() => {
                              setSelectedBlock(b);
                              setSelectedLocation('');
                              setSelectedRoom('');
                            }}
                            style={[
                              styles.chip,
                              { borderColor },
                              selectedBlock === b && themeStyles.chipActive,
                            ]}
                          >
                            <ThemedText style={[styles.chipText, { color: selectedBlock === b ? '#FFF' : textColor }]}>
                              {b}
                            </ThemedText>
                          </Pressable>
                        ))}
                      </View>

                      {hasLocations && selectedBlock && (
                        <>
                          <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Местонахождение</ThemedText>
                          <View style={styles.chipRow}>
                            {locations.map((loc) => (
                              <Pressable
                                key={loc}
                                onPress={() => {
                                  setSelectedLocation(loc);
                                  setSelectedRoom('');
                                }}
                                style={[
                                  styles.chip,
                                  { borderColor },
                                  selectedLocation === loc && themeStyles.chipActive,
                                ]}
                              >
                                <ThemedText style={[styles.chipText, { color: selectedLocation === loc ? '#FFF' : textColor }]}>
                                  {loc}
                                </ThemedText>
                              </Pressable>
                            ))}
                            <Pressable
                              onPress={() => {
                                setSelectedLocation('Другое');
                                setSelectedRoom('');
                              }}
                              style={[
                                styles.chip,
                                { borderColor },
                                selectedLocation === 'Другое' && themeStyles.chipActive,
                              ]}
                            >
                              <ThemedText style={[styles.chipText, { color: selectedLocation === 'Другое' ? '#FFF' : textColor }]}>
                                Другое
                              </ThemedText>
                            </Pressable>
                          </View>
                          {selectedLocation === 'Другое' && (
                            <View style={styles.inputWrap}>
                              <TextInput
                                style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                                placeholder="Введите местонахождение"
                                placeholderTextColor={mutedColor}
                                value={customLocation}
                                onChangeText={setCustomLocation}
                              />
                            </View>
                          )}
                        </>
                      )}

                      {selectedBlock && (hasLocations ? selectedLocation : true) && (
                        <>
                          <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Помещение</ThemedText>
                          {hasRooms && rooms.length > 0 ? (
                            <>
                              <View style={styles.chipRow}>
                                {rooms.map((room) => (
                                  <Pressable
                                    key={room}
                                    onPress={() => setSelectedRoom(room)}
                                    style={[
                                      styles.chip,
                                      { borderColor },
                                      selectedRoom === room && themeStyles.chipActive,
                                    ]}
                                  >
                                    <ThemedText style={[styles.chipText, { color: selectedRoom === room ? '#FFF' : textColor }]}>
                                      {room}
                                    </ThemedText>
                                  </Pressable>
                                ))}
                                <Pressable
                                  onPress={() => setSelectedRoom('Другое')}
                                  style={[
                                    styles.chip,
                                    { borderColor },
                                    selectedRoom === 'Другое' && themeStyles.chipActive,
                                  ]}
                                >
                                  <ThemedText style={[styles.chipText, { color: selectedRoom === 'Другое' ? '#FFF' : textColor }]}>
                                    Другое
                                  </ThemedText>
                                </Pressable>
                              </View>
                              {selectedRoom === 'Другое' && (
                                <View style={styles.inputWrap}>
                                  <TextInput
                                    style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                                    placeholder="Введите помещение"
                                    placeholderTextColor={mutedColor}
                                    value={customRoom}
                                    onChangeText={setCustomRoom}
                                  />
                                </View>
                              )}
                            </>
                          ) : (
                            <View style={styles.inputWrap}>
                              <TextInput
                                style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                                placeholder="Введите помещение"
                                placeholderTextColor={mutedColor}
                                value={customRoom}
                                onChangeText={setCustomRoom}
                              />
                            </View>
                          )}
                        </>
                      )}
                    </>
                  ) : (
                    <View style={styles.inputWrap}>
                      <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Уточнение локации</ThemedText>
                      <TextInput
                        style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                        placeholder="Например: Блок А, 2 этаж, кабинет 101"
                        placeholderTextColor={mutedColor}
                        value={customLocationDetail}
                        onChangeText={setCustomLocationDetail}
                      />
                    </View>
                  )}
                </>
              )}
            </View>
          )}

          {step === 3 && (
            <View style={styles.step}>
              <ThemedText style={[styles.stepTitle, { color: textColor }]}>Тип и категория</ThemedText>

              <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Тип заявки</ThemedText>
              <View style={styles.chipRow}>
                {REQUEST_TYPES.filter((t) => {
                  if (role === 'client' || role === 'executor') return t.value !== 'planned' && t.value !== 'recurring';
                  if (role === 'department-head') return t.value !== 'recurring';
                  return true;
                }).map((t) => (
                  <Pressable
                    key={t.value}
                    onPress={() => {
                      setRequestType(t.value);
                      setIsRecurringTask(t.value === 'recurring');
                    }}
                    style={[styles.chip, { borderColor }, requestType === t.value && themeStyles.chipActive]}
                  >
                    <ThemedText style={[styles.chipText, { color: requestType === t.value ? '#FFF' : textColor }]}>
                      {t.label}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {(role === 'admin-worker' || role === 'department-head') && requestType === 'planned' && (
                <View style={styles.inputWrap}>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Планируемая дата</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                    placeholder="ГГГГ-ММ-ДД"
                    placeholderTextColor={mutedColor}
                    value={plannedDate}
                    onChangeText={setPlannedDate}
                  />
                </View>
              )}

              {role === 'admin-worker' && isRecurringTask && (
                <View style={styles.recurringSection}>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Тип повторения</ThemedText>
                  <View style={styles.chipRow}>
                    {[
                      { value: 'daily', label: 'Ежедневно' },
                      { value: 'weekly', label: 'Еженедельно' },
                      { value: 'monthly', label: 'Ежемесячно' },
                      { value: 'yearly', label: 'Ежегодно' },
                    ].map((opt) => (
                      <Pressable
                        key={opt.value}
                        onPress={() => setRecurrenceType(opt.value as 'daily' | 'weekly' | 'monthly' | 'yearly')}
                        style={[
                          styles.chip,
                          { borderColor },
                          recurrenceType === opt.value && themeStyles.chipActive,
                        ]}
                      >
                        <ThemedText style={[styles.chipText, { color: recurrenceType === opt.value ? '#FFF' : textColor }]}>
                          {opt.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Интервал</ThemedText>
                  <View style={styles.chipRow}>
                    {[1, 2, 3, 4, 6, 12].map((n) => (
                      <Pressable
                        key={n}
                        onPress={() => setRecurrenceInterval(n)}
                        style={[
                          styles.chip,
                          { borderColor },
                          recurrenceInterval === n && themeStyles.chipActive,
                        ]}
                      >
                        <ThemedText style={[styles.chipText, { color: recurrenceInterval === n ? '#FFF' : textColor }]}>
                          Каждые {n}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Дата начала повторения</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                    placeholder="ГГГГ-ММ-ДД"
                    placeholderTextColor={mutedColor}
                    value={recurrenceStartDate.toISOString().split('T')[0]}
                    onChangeText={(v) => {
                      const d = new Date(v);
                      if (!isNaN(d.getTime())) setRecurrenceStartDate(d);
                    }}
                  />
                </View>
              )}

              <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Категория заявки</ThemedText>
              <View style={styles.chipRow}>
                {categories.map((c) => (
                  <Pressable
                    key={c.id}
                    onPress={() => {
                      setCategoryId(c.id);
                      setSubcategoryId(0);
                      setTitle('');
                    }}
                    style={[
                      styles.chip,
                      { borderColor },
                      categoryId === c.id && themeStyles.chipActive,
                    ]}
                  >
                    <ThemedText style={[styles.chipText, { color: categoryId === c.id ? '#FFF' : textColor }]}>
                      {c.name}
                    </ThemedText>
                  </Pressable>
                ))}
              </View>

              {selectedCategory?.subcategories && selectedCategory.subcategories.length > 0 && (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Название (подкатегория)</ThemedText>
                  <View style={styles.chipRow}>
                    {selectedCategory.subcategories.map((sub) => (
                      <Pressable
                        key={sub.id}
                        onPress={() => {
                          setSubcategoryId(sub.id);
                          setTitle(sub.name);
                        }}
                        style={[
                          styles.chip,
                          { borderColor },
                          title === sub.name && themeStyles.chipActive,
                        ]}
                      >
                        <ThemedText style={[styles.chipText, { color: title === sub.name ? '#FFF' : textColor }]}>
                          {sub.name}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {(!selectedCategory?.subcategories || selectedCategory.subcategories.length === 0) && (
                <View style={styles.inputWrap}>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Название заявки</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                    placeholder="Краткое название"
                    placeholderTextColor={mutedColor}
                    value={title}
                    onChangeText={setTitle}
                  />
                </View>
              )}
            </View>
          )}

          {step === 4 && (
            <View style={styles.step}>
              <ThemedText style={[styles.stepTitle, { color: textColor }]}>Описание и фото</ThemedText>

              {role === 'executor' && (
                <View style={styles.modeRow}>
                  <Pressable
                    onPress={() => setCreateMode('create')}
                    style={[styles.modeBtn, { borderColor }, createMode === 'create' && themeStyles.chipActive]}
                  >
                    <ThemedText style={[styles.chipText, { color: createMode === 'create' ? '#FFF' : textColor }]}>
                      Создать
                    </ThemedText>
                  </Pressable>
                  <Pressable
                    onPress={() => setCreateMode('createAndComplete')}
                    style={[styles.modeBtn, { borderColor }, createMode === 'createAndComplete' && themeStyles.chipActive]}
                  >
                    <ThemedText style={[styles.chipText, { color: createMode === 'createAndComplete' ? '#FFF' : textColor }]}>
                      С завершением
                    </ThemedText>
                  </Pressable>
                </View>
              )}

              <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Описание *</ThemedText>
              <TextInput
                style={[
                  styles.textArea,
                  { color: textColor, borderColor, backgroundColor },
                ]}
                placeholder="Опишите заявку подробно..."
                placeholderTextColor={mutedColor}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={4}
              />

              <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Фото (до 3 шт.)</ThemedText>
              <View style={styles.photoRow}>
                {photos.map((uri, i) => (
                  <View key={i} style={styles.photoWrap}>
                    <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                    <Pressable style={styles.removePhoto} onPress={() => removePhoto(i, false)}>
                      <MaterialIcons name="close" size={16} color="#FFF" />
                    </Pressable>
                  </View>
                ))}
                {photos.length < 3 && (
                  <Pressable style={[styles.addPhoto, { borderColor }]} onPress={() => pickImage(false)}>
                    <MaterialIcons name="add-a-photo" size={28} color={mutedColor} />
                  </Pressable>
                )}
              </View>

              {(role === 'admin-worker' || role === 'department-head') && (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Сложность</ThemedText>
                  <View style={styles.chipRow}>
                    {COMPLEXITY_OPTIONS.map((c) => (
                      <Pressable
                        key={c.value}
                        onPress={() => setComplexity(c.value)}
                        style={[styles.chip, { borderColor }, complexity === c.value && themeStyles.chipActive]}
                      >
                        <ThemedText style={[styles.chipText, { color: complexity === c.value ? '#FFF' : textColor }]}>
                          {c.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>

                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Время выполнения</ThemedText>
                  <View style={styles.chipRow}>
                    {SLA_OPTIONS.map((s) => (
                      <Pressable
                        key={s.value}
                        onPress={() => setSla(s.value)}
                        style={[styles.chip, { borderColor }, sla === s.value && themeStyles.chipActive]}
                      >
                        <ThemedText style={[styles.chipText, { color: sla === s.value ? '#FFF' : textColor }]}>
                          {s.label}
                        </ThemedText>
                      </Pressable>
                    ))}
                  </View>
                </>
              )}

              {role === 'department-head' &&
                user?.service_category_id === categoryId &&
                executors.length > 0 && (
                  <View style={styles.inputWrap}>
                    <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>
                      Исполнители (необязательно)
                    </ThemedText>
                    <View style={styles.selectWrap}>
                      <Select
                        value=""
                        onValueChange={(v) => {
                          if (v) {
                            const id = parseInt(v, 10);
                            if (!selectedExecutors.some((e) => e.id === id)) {
                              setSelectedExecutors((prev) => [
                                ...prev,
                                { id, role: prev.some((e) => e.role === 'leader') ? 'executor' : 'leader' },
                              ]);
                            }
                          }
                        }}
                        options={[
                          { value: '', label: 'Добавить исполнителя' },
                          ...executors
                            .filter((e) => !selectedExecutors.some((s) => s.id === e.id))
                            .map((e) => ({
                              value: String(e.id),
                              label: e.user?.full_name ?? `#${e.id}`,
                            })),
                        ]}
                        placeholder="Добавить"
                      />
                    </View>
                    {selectedExecutors.length > 0 && (
                      <View style={styles.executorsListWrap}>
                        <ThemedText style={[styles.fieldLabel, { color: mutedColor, marginBottom: 8 }]}>
                          Выбранные исполнители
                        </ThemedText>
                        {selectedExecutors.map((executorData) => {
                          const executor = executors.find((e) => e.id === executorData.id);
                          if (!executor) return null;
                          return (
                            <View
                              key={executorData.id}
                              style={[styles.executorChip, { backgroundColor: cardBackground, borderColor }]}
                            >
                              <View style={styles.executorChipLeft}>
                                <ThemedText style={[styles.executorChipName, { color: textColor }]} numberOfLines={1}>
                                  {executor.user?.full_name ?? `#${executor.id}`}
                                </ThemedText>
                                {executorData.role === 'leader' && (
                                  <View style={[styles.executorLeaderBadge, { backgroundColor: primaryColor }]}>
                                    <ThemedText style={styles.executorLeaderBadgeText}>Лидер</ThemedText>
                                  </View>
                                )}
                              </View>
                              <View style={styles.executorChipActions}>
                                <View style={styles.executorRoleSelectWrap}>
                                  <Select
                                    value={executorData.role}
                                    onValueChange={(v) => {
                                      if (v === 'executor' || v === 'leader') {
                                        setSelectedExecutors((prev) =>
                                          prev.map((e) => (e.id === executorData.id ? { ...e, role: v } : e))
                                        );
                                      }
                                    }}
                                    options={[
                                      { value: 'executor', label: 'Исполнитель' },
                                      { value: 'leader', label: 'Лидер' },
                                    ]}
                                    placeholder="Роль"
                                  />
                                </View>
                                <Pressable
                                  onPress={() => {
                                    setSelectedExecutors((prev) => prev.filter((e) => e.id !== executorData.id));
                                  }}
                                  style={({ pressed }) => [
                                    styles.executorRemoveBtn,
                                    { opacity: pressed ? 0.7 : 1 },
                                  ]}
                                  hitSlop={8}
                                >
                                  <MaterialIcons name="close" size={20} color="#EF4444" />
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                        {selectedExecutors.length > 0 && !selectedExecutors.some((e) => e.role === 'leader') && (
                          <ThemedText style={[styles.executorLeaderHint, { color: primaryColor }]}>
                            Нужен хотя бы один лидер
                          </ThemedText>
                        )}
                      </View>
                    )}
                  </View>
                )}

              {role === 'executor' && createMode === 'createAndComplete' && (
                <>
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Дата выполнения</ThemedText>
                  <TextInput
                    style={[styles.input, { color: textColor, borderColor, backgroundColor }]}
                    placeholder="ГГГГ-ММ-ДД"
                    placeholderTextColor={mutedColor}
                    value={completionDate.toISOString().split('T')[0]}
                    onChangeText={(v) => {
                      const d = new Date(v);
                      if (!isNaN(d.getTime())) setCompletionDate(d);
                    }}
                  />
                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Комментарий о выполненной работе *</ThemedText>
                  <TextInput
                    style={[
                      styles.textArea,
                      { color: textColor, borderColor, backgroundColor },
                    ]}
                    placeholder="Опишите выполненную работу..."
                    placeholderTextColor={mutedColor}
                    value={completionComment}
                    onChangeText={setCompletionComment}
                    multiline
                  />

                  <ThemedText style={[styles.fieldLabel, { color: mutedColor }]}>Фото результата *</ThemedText>
                  <View style={styles.photoRow}>
                    {afterPhotos.map((uri, i) => (
                      <View key={i} style={styles.photoWrap}>
                        <Image source={{ uri }} style={styles.photo} resizeMode="cover" />
                        <Pressable style={styles.removePhoto} onPress={() => removePhoto(i, true)}>
                          <MaterialIcons name="close" size={16} color="#FFF" />
                        </Pressable>
                      </View>
                    ))}
                    {afterPhotos.length < 3 && (
                      <Pressable style={[styles.addPhoto, { borderColor }]} onPress={() => pickImage(true)}>
                        <MaterialIcons name="add-a-photo" size={28} color={mutedColor} />
                      </Pressable>
                    )}
                  </View>
                </>
              )}
            </View>
          )}

        {error && (
          <ThemedText style={styles.errorText}>{error}</ThemedText>
        )}
      </ScrollView>

      <View
        style={[
          styles.actionsFooterWrap,
          themeStyles.actionsFooterWrap,
          { paddingBottom: BOTTOM_BAR_MARGIN + insets.bottom },
        ]}
      >
        <View style={[styles.actionsFooterBar, themeStyles.actionsFooterBar]}>
          {step < 4 ? (
            <>
              <Button
                title={step === 1 ? 'Отмена' : 'Назад'}
                onPress={step === 1 ? () => router.back() : goBack}
                variant="ghost"
                style={styles.backBtn}
              />
              <Button
                title="Дальше"
                onPress={() => setStep((s) => s + 1)}
                variant="primary"
                labelColor="#FFFFFF"
                disabled={
                  (step === 1 && !canProceedStep1) ||
                  (step === 2 && !canProceedStep2) ||
                  (step === 3 && !canProceedStep3)
                }
                style={styles.primaryBtn}
              />
            </>
          ) : (
            <>
              <Button
                title="Назад"
                onPress={goBack}
                variant="ghost"
                style={styles.backBtn}
              />
              <Button
                title={submitting ? 'Отправка...' : 'Создать заявку'}
                onPress={handleSubmit}
                variant="primary"
                labelColor="#FFFFFF"
                disabled={!canSubmit || submitting}
                style={styles.primaryBtn}
              />
            </>
          )}
        </View>
      </View>
      </KeyboardAvoidingView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 8,
    marginRight: 8,
  },
  backLabel: {
    fontSize: 16,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    flex: 1,
  },
  keyboard: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
  },
  step: {
    marginBottom: 24,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  stepHint: {
    fontSize: 14,
    marginBottom: 16,
  },
  fieldLabel: {
    fontSize: 14,
    marginBottom: 8,
  },
  stepIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginBottom: 20,
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotCurrent: {
    width: 24,
  },
  officeChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  officeChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
  },
  officeChipText: {
    fontSize: 13,
    fontWeight: '500',
  },
  geoButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    marginTop: 8,
    marginBottom: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F35713',
    backgroundColor: '#2A2A2A',
    gap: 6,
  },
  geoButtonText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  officeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: CARD_GAP,
  },
  officeCard: {
    width: OFFICE_CARD_WIDTH,
    borderRadius: 10,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 3,
  },
  officeCardSelected: {
    shadowOpacity: 0.35,
    borderWidth: 2,
  },
  officeCardImage: {
    width: '100%',
    height: OFFICE_CARD_HEIGHT * 0.7,
  },
  officeCardImageImg: {
    width: '100%',
    height: '100%',
  },
  officeCardImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  officeCardInfo: {
    padding: 8,
    gap: 2,
  },
  officeCardName: {
    fontSize: 10,
    fontWeight: '600',
    textAlign: 'center',
  },
  officeCardMeta: {
    fontSize: 9,
    textAlign: 'center',
  },
  officeName: {
    fontSize: 16,
    fontWeight: '500',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 16,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
  toggleRow: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 16,
  },
  toggleBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
  },
  toggleLabel: {
    fontSize: 14,
  },
  summaryCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  recurringSection: {
    marginBottom: 16,
  },
  chipText: {
    fontSize: 14,
  },
  modeRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 20,
  },
  modeBtn: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  inputWrap: {
    marginBottom: 16,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    minHeight: 100,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  selectWrap: {
    marginBottom: 16,
  },
  executorsListWrap: {
    marginTop: 8,
    marginBottom: 8,
  },
  executorChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  executorChipLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minWidth: 0,
  },
  executorChipName: {
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
  },
  executorLeaderBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  executorLeaderBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
  },
  executorChipActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  executorRoleSelectWrap: {
    minWidth: 110,
  },
  executorRemoveBtn: {
    padding: 4,
  },
  executorLeaderHint: {
    fontSize: 12,
    marginTop: 4,
  },
  photoRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 20,
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
  addPhoto: {
    width: 80,
    height: 80,
    borderRadius: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 14,
    marginBottom: 16,
  },
  actionsFooterWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 50,
  },
  actionsFooterBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 10,
    height: BOTTOM_BAR_HEIGHT,
    borderTopLeftRadius: BOTTOM_BAR_RADIUS,
    borderTopRightRadius: BOTTOM_BAR_RADIUS,
    borderWidth: 0,
  },
  backBtn: {
    paddingHorizontal: 4,
  },
  primaryBtn: {
    flex: 1,
    borderRadius: 18,
    minHeight: 44,
    paddingVertical: 10,
    alignSelf: 'stretch',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
