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

export interface ServiceCategory {
  id: number;
  name: string;
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

// ==================== Service categories (public) ====================

export async function getServiceCategoriesPublic(): Promise<ServiceCategory[]> {
  const result = await request<ServiceCategory[] | ServiceCategory>(
    '/service-categories/public'
  );
  if (!result.ok) return [];
  const data = result.data;
  return Array.isArray(data) ? data : [data];
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
