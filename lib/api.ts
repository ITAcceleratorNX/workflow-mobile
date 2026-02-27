import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/auth-store';

const { apiBaseUrl } = config;

type RequestOptions = RequestInit & { params?: Record<string, string> };

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<{ data: T; ok: true } | { error: string; ok: false }> {
  const { params, ...init } = options;
  const url = params
    ? `${apiBaseUrl}${path}?${new URLSearchParams(params).toString()}`
    : `${apiBaseUrl}${path}`;

  // Получаем токен из auth store
  const token = useAuthStore.getState().token;

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers as HeadersInit),
  };

  try {
    console.log(`[API] ${init.method || 'GET'} ${path}`, { hasToken: !!token });
    const res = await fetch(url, { ...init, headers });
    if (res.status === 204) return { ok: true, data: undefined as T };
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error(`[API Error] ${path}:`, res.status, data);
      const error =
        (data as { error?: string })?.error ||
        (data as { message?: string })?.message ||
        (Array.isArray((data as { details?: { message?: string }[] })?.details) &&
          (data as { details: { message?: string }[] }).details[0]?.message) ||
        'Произошла ошибка';
      return { ok: false, error };
    }
    return { ok: true, data: data as T };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Сетевая ошибка';
    console.error(`[API Error] ${path}:`, message);
    return { ok: false, error: message };
  }
}

// ==================== Types ====================

export interface Office {
  id: number;
  name: string;
  city?: string;
  address?: string;
  photo?: string | null;
  working_hours_start?: string | null; // "HH:mm:ss"
  working_hours_end?: string | null;   // "HH:mm:ss"
}

export interface ServiceSubcategory {
  id: number;
  name: string;
  category_id: number;
}

export interface ServiceCategory {
  id: number;
  name: string;
  subcategories?: ServiceSubcategory[];
}

export interface CreateRegistrationRequestBody {
  phone: string;
  full_name: string;
  office_id: number;
  role: 'client' | 'executor';
  password: string;
  service_category_id?: number;
}

// ==================== Offices ====================

export async function getOffices(): Promise<Office[]> {
  const result = await request<Office[] | Office>('/offices');
  if (!result.ok) return [];
  const data = result.data;
  return Array.isArray(data) ? data : [data];
}

export async function getOfficeById(
  id: number
): Promise<{ ok: true; data: Office } | { ok: false; error: string }> {
  const result = await request<Office>(`/offices/${id}`);
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}

// ==================== Service categories ====================

export async function getServiceCategoriesPublic(): Promise<ServiceCategory[]> {
  const result = await request<ServiceCategory[] | ServiceCategory>(
    '/service-categories/public'
  );
  if (!result.ok) return [];
  const data = result.data;
  return Array.isArray(data) ? data : [data];
}

/** Authenticated: categories with subcategories */
export async function getServiceCategories(): Promise<
  { ok: true; data: ServiceCategory[] } | { ok: false; error: string }
> {
  const result = await request<ServiceCategory[] | ServiceCategory>(
    '/service-categories'
  );
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return { ok: true, data: list };
}

export async function createServiceCategory(body: { name: string }): Promise<
  { ok: true; data: ServiceCategory } | { ok: false; error: string }
> {
  const result = await request<ServiceCategory>('/service-categories', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data! };
}

export async function deleteServiceCategory(id: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await request<undefined>(`/service-categories/${id}`, {
    method: 'DELETE',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export interface ExecutorInCategory {
  id: number;
  specialty: string;
  department_id?: number;
  user?: { id: number; full_name: string; phone?: string; role?: string };
}

export async function getExecutorsByCategory(categoryId: number): Promise<
  { ok: true; data: ExecutorInCategory[] } | { ok: false; error: string }
> {
  const result = await request<ExecutorInCategory[]>(
    `/service-categories/${categoryId}/executors`
  );
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : [];
  return { ok: true, data: list };
}

export async function changeCategoryHead(
  categoryId: number,
  executorId: number
): Promise<{ ok: true; data?: { newHead?: { name: string }; processedTasks?: { message?: string } } } | { ok: false; error: string }> {
  const result = await request<{ newHead?: { name: string }; processedTasks?: { message?: string } }>(
    `/service-categories/${categoryId}/change-head`,
    { method: 'POST', body: JSON.stringify({ newHeadUserId: executorId }) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

export async function createSubcategory(body: {
  name: string;
  category_id: number;
}): Promise<
  { ok: true; data: ServiceSubcategory } | { ok: false; error: string }
> {
  const result = await request<ServiceSubcategory>(
    '/service-categories/subcategories',
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data! };
}

export async function deleteSubcategory(id: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await request<undefined>(
    `/service-categories/subcategories/${id}`,
    { method: 'DELETE' }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// ==================== Registration ====================

export async function createRegistrationRequest(
  body: CreateRegistrationRequestBody
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>('/registration-requests', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

// ==================== Registration requests (admin) ====================

export interface RegistrationRequestItem {
  id: number;
  phone: string;
  full_name: string;
  office: { name: string };
  role: string;
  service_category_id?: number;
  service_category?: { name: string };
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export async function getRegistrationRequests(filters?: {
  status?: string;
  office_id?: string;
  date_from?: string;
  date_to?: string;
}): Promise<
  { ok: true; data: RegistrationRequestItem[] } | { ok: false; error: string }
> {
  const params: Record<string, string> = {};
  if (filters?.status) params.status = filters.status;
  if (filters?.office_id) params.office_id = filters.office_id;
  if (filters?.date_from) params.date_from = filters.date_from;
  if (filters?.date_to) params.date_to = filters.date_to;
  const qs = Object.keys(params).length ? `?${new URLSearchParams(params).toString()}` : '';
  const result = await request<{ success?: boolean; data: RegistrationRequestItem[] }>(
    `/registration-requests${qs}`
  );
  if (!result.ok) return { ok: false, error: result.error };
  const raw = result.data;
  const list = Array.isArray((raw as { data?: RegistrationRequestItem[] })?.data)
    ? (raw as { data: RegistrationRequestItem[] }).data
    : Array.isArray(raw)
      ? (raw as RegistrationRequestItem[])
      : [];
  return { ok: true, data: list };
}

export async function approveRegistrationRequest(requestId: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await request<unknown>(
    `/registration-requests/${requestId}/approve`,
    { method: 'PUT' }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function rejectRegistrationRequest(requestId: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await request<unknown>(
    `/registration-requests/${requestId}/reject`,
    { method: 'PUT' }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// ==================== Users (admin-worker) ====================

export interface OfficeUser {
  id: number;
  full_name: string;
  phone: string;
  role: string;
  office_id?: number;
}

export async function getOfficeUsers(officeId: number): Promise<
  { ok: true; data: OfficeUser[] } | { ok: false; error: string }
> {
  const result = await request<OfficeUser[]>(`/users/office/${officeId}`);
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : [];
  return { ok: true, data: list };
}

export async function changeUserPassword(
  userId: number,
  newPassword: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/users/${userId}/change-password`, {
    method: 'PATCH',
    body: JSON.stringify({ new_password: newPassword }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function updateUserRole(
  userId: number,
  role: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/users/${userId}`, {
    method: 'PUT',
    body: JSON.stringify({ role }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

// ==================== Smart Home ====================

export interface YandexDevice {
  id: string;
  name: string;
  type: string;
  capabilities?: Array<{
    type: string;
    state?: {
      instance: string;
      value: boolean;
    };
  }>;
}

export interface ControlDeviceRequest {
  device_id: string;
  action_type: string;
  action_state: {
    instance: string;
    value: boolean;
  };
}

export interface ClientRoomSubscription {
  id: number;
  client_id: number;
  meeting_room_id: number;
  meetingRoom?: {
    id: number;
    name: string;
    office?: {
      id: number;
      name: string;
    };
  };
}

export async function getClientRoomSubscriptions(client_id: number): Promise<
  | { ok: true; data: { subscriptions: ClientRoomSubscription[] } }
  | { ok: false; error: string }
> {
  const result = await request<{ subscriptions: ClientRoomSubscription[] }>(
    `/client-room-subscriptions/client/${client_id}`
  );
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}

export async function getRoomDevicesForClient(meeting_room_id: number): Promise<
  | { ok: true; data: { devices: YandexDevice[] } }
  | { ok: false; error: string }
> {
  const result = await request<{ devices: YandexDevice[] }>(
    `/yandex-smart-home/room-devices/room/${meeting_room_id}/client`
  );
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}

export async function controlDevice(
  data: ControlDeviceRequest
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>('/yandex-smart-home/devices/control', {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}

// ==================== Meeting Rooms & Bookings ====================

export interface MeetingRoom {
  id: number;
  name: string;
  floor?: number;
  capacity?: number;
  office_id?: number | null;
  office?: Office;
  status?: 'available' | 'booked';
  isActive?: boolean;
  room_type?: string;
  /** Массив URL фото (приоритет) */
  photos?: string[];
  /** Одно фото — если бэкенд отдаёт только photo */
  photo?: string | null;
}

export interface MeetingRoomBooking {
  id: number;
  meeting_room_id: number;
  user_id?: number;
  client_id?: number;
  start_time: string;
  end_time: string;
  status?: string;
  company_name?: string | null;
  created_at?: string;
  updated_at?: string;
  meeting_room?: MeetingRoom;
  meetingRoom?: MeetingRoom;
  office?: Office;
}

export interface RoomAvailabilitySlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  booking_id: number | null;
  booking_status: string | null;
}

export interface RoomAvailabilityResponse {
  room: MeetingRoom;
  bookings: MeetingRoomBooking[];
  slots: RoomAvailabilitySlot[];
}

export async function getMeetingRooms(officeId?: number): Promise<
  | { ok: true; data: MeetingRoom[] }
  | { ok: false; error: string }
> {
  const path = officeId
    ? `/meeting-rooms?office_id=${officeId}`
    : '/meeting-rooms';
  const result = await request<MeetingRoom[]>(path);
  if (result.ok) return { ok: true, data: Array.isArray(result.data) ? result.data : [] };
  return { ok: false, error: result.error };
}

export async function getRoomDailyAvailability(
  roomId: number,
  date: string,
  slotMinutes?: number
): Promise<
  | { ok: true; data: RoomAvailabilityResponse }
  | { ok: false; error: string }
> {
  const params: Record<string, string> = { date };
  if (slotMinutes != null) params.slot_minutes = String(slotMinutes);
  const qs = new URLSearchParams(params).toString();
  const result = await request<RoomAvailabilityResponse>(
    `/meeting-room-bookings/rooms/${roomId}/availability?${qs}`
  );
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}

export async function createMeetingRoomBooking(data: {
  meeting_room_id: number;
  booking_date: string;
  start_time: string;
  end_time: string;
  company_name?: string | null;
}): Promise<
  | { ok: true; data: MeetingRoomBooking }
  | { ok: false; error: string }
> {
  const { booking_date, ...rest } = data;
  const result = await request<MeetingRoomBooking>('/meeting-room-bookings', {
    method: 'POST',
    body: JSON.stringify({ ...rest, date: booking_date }),
  });
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}

export async function getMyBookings(): Promise<
  | { ok: true; data: MeetingRoomBooking[] }
  | { ok: false; error: string }
> {
  const result = await request<MeetingRoomBooking[] | MeetingRoomBooking>(
    '/meeting-room-bookings/my'
  );
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return { ok: true, data: list };
}

export async function cancelMeetingRoomBooking(
  id: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/meeting-room-bookings/${id}`, {
    method: 'DELETE',
  });
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}
