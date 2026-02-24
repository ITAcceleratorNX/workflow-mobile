import { config } from '@/lib/config';

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
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(init.headers as HeadersInit),
  };
  try {
    const res = await fetch(url, { ...init, headers });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
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
