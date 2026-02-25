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
