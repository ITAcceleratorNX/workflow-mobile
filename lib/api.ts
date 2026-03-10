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
  const isGuestToken = token === 'guest-demo';

  // В демо-режиме (guest-demo) не ходим на /request-groups,
  // возвращаем пустой ответ, чтобы работать только с мок-данными.
  if (isGuestToken && path.startsWith('/request-groups')) {
    const empty: any = path === '/request-groups' || path.startsWith('/request-groups?')
      ? {
          requests: [],
          total: 0,
          totalPages: 0,
          page: 1,
          pageSize: 20,
        }
      : {};
    return { ok: true, data: empty as T };
  }

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
  lat?: number | null;
  lon?: number | null;
  photo?: string | null;
  working_hours_start?: string | null; // "HH:mm:ss"
  working_hours_end?: string | null;   // "HH:mm:ss"
  auto_track_enabled?: boolean;
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

export async function getOfficeRooms(officeId: number): Promise<
  { ok: true; data: MeetingRoom[] } | { ok: false; error: string }
> {
  const result = await request<MeetingRoom[]>(`/offices/${officeId}/rooms`);
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : [];
  return { ok: true, data: list };
}

export async function updateOfficeWorkingHours(
  officeId: number,
  body: {
    working_hours_start: string; // "HH:mm:ss"
    working_hours_end: string;
    auto_track_enabled: boolean;
  }
): Promise<{ ok: true; data: Office } | { ok: false; error: string }> {
  const result = await request<Office>(`/offices/${officeId}/working-hours`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data! };
}

export async function updateOffice(
  id: number,
  body: Partial<Pick<Office, 'name' | 'city' | 'address' | 'working_hours_start' | 'working_hours_end' | 'auto_track_enabled'>>
): Promise<{ ok: true; data: Office } | { ok: false; error: string }> {
  const result = await request<Office>(`/offices/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data! };
}

export async function createOffice(body: {
  name: string;
  address: string;
  city: string;
  working_hours_start?: string;
  working_hours_end?: string;
  auto_track_enabled?: boolean;
}): Promise<{ ok: true; data: Office } | { ok: false; error: string }> {
  const result = await request<Office>('/offices', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data! };
}

export async function deleteOffice(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<undefined>(`/offices/${id}`, { method: 'DELETE' });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
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

/** Список всех исполнителей для админа (назначение к категории) */
export async function getAllExecutorsForAdmin(): Promise<
  { ok: true; data: ExecutorInCategory[] } | { ok: false; error: string }
> {
  const result = await request<ExecutorInCategory[] | ExecutorInCategory>('/executors/all');
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return { ok: true, data: list };
}

export async function assignExecutorToCategory(
  categoryId: number,
  executorId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(
    `/service-categories/${categoryId}/assign-executor`,
    { method: 'POST', body: JSON.stringify({ executorId }) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
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

// ==================== Request groups (заявки) ====================

export interface RequestPhoto {
  id: number;
  request_id: number;
  photo_url: string;
  type: string;
  created_at: string;
}

export interface RequestCategory {
  id: number;
  name: string;
}

export interface SubRequest {
  id: number;
  title: string;
  description: string;
  status: string;
  category_id?: number;
  category?: RequestCategory;
  complexity?: string;
  sla?: string;
  created_date: string;
  executor?: { user: { id: number; full_name: string; phone?: string }; RequestExecutor?: { role: string } };
  executors?: Array<{ user: { id: number; full_name: string; phone?: string }; RequestExecutor?: { role: string } }>;
  is_long_term?: boolean;
  ratings?: Array<{ rating: number; comment?: string; comments?: string[] }>;
  comment?: string;
  rating?: number;
  photos?: RequestPhoto[];
  location?: string;
}

export interface RequestGroup {
  id: number;
  client_id: number;
  office_id: number;
  location: string;
  location_detail: string;
  date_submitted?: string;
  status: string;
  request_type: string;
  rejection_reason?: string;
  planned_date?: string;
  created_date: string;
  client?: { full_name: string; phone?: string; role?: string };
  office?: { id: number; name: string; city: string; address?: string };
  photos?: RequestPhoto[];
  requests: SubRequest[];
  is_long_term?: boolean;
  clientRatings?: Array<{ id: number; rating: number; comment?: string; created_at: string }>;
}

/** Формы ответа бэкенда по ролям (getAllRequestGroups вызывает разные методы). */
export type RequestGroupsBackendResponse =
  | { requests: RequestGroup[]; total: number; totalPages: number; page: number; pageSize: number }
  | { data: RequestGroup[]; total: number; totalPages: number; page: number; pageSize: number }
  | { myRequests: RequestGroup[]; otherRequests: RequestGroup[]; total?: number; page?: number; pageSize?: number }
  | { assignedRequests: RequestGroup[]; completedRequests: RequestGroup[]; myRequests: RequestGroup[] };

export type RequestGroupsRole = 'client' | 'admin-worker' | 'department-head' | 'executor' | 'manager';

export type RequestGroupsSegments = Record<string, RequestGroup[]>;

function normalizeRequestGroupsResponse(
  raw: unknown,
  role: RequestGroupsRole | null
): { list: RequestGroup[]; hasMore: boolean; segments?: RequestGroupsSegments } {
  const r = raw as RequestGroupsBackendResponse;
  if (!r || typeof r !== 'object') {
    return { list: [], hasMore: false };
  }

  switch (role) {
    case 'client': {
      const x = r as { requests?: RequestGroup[]; page?: number; totalPages?: number };
      const list = Array.isArray(x.requests) ? x.requests : [];
      const page = typeof x.page === 'number' ? x.page : 1;
      const totalPages = typeof x.totalPages === 'number' ? x.totalPages : 0;
      return { list, hasMore: page < totalPages };
    }
    case 'manager': {
      const x = r as { data?: RequestGroup[]; page?: number; totalPages?: number };
      const list = Array.isArray(x.data) ? x.data : [];
      const page = typeof x.page === 'number' ? x.page : 1;
      const totalPages = typeof x.totalPages === 'number' ? x.totalPages : 0;
      return { list, hasMore: page < totalPages };
    }
    case 'admin-worker': {
      const x = r as { myRequests?: RequestGroup[]; otherRequests?: RequestGroup[]; total?: number; page?: number; pageSize?: number };
      const my = Array.isArray(x.myRequests) ? x.myRequests : [];
      const other = Array.isArray(x.otherRequests) ? x.otherRequests : [];
      const list = [...my, ...other];
      const total = typeof x.total === 'number' ? x.total : list.length;
      const page = typeof x.page === 'number' ? x.page : 1;
      const pageSize = typeof x.pageSize === 'number' && x.pageSize > 0 ? x.pageSize : 10;
      const totalPages = Math.ceil(total / pageSize);
      return {
        list,
        hasMore: page < totalPages,
        segments: { incoming: other, my },
      };
    }
    case 'department-head': {
      const x = r as { myRequests?: RequestGroup[]; otherRequests?: RequestGroup[] };
      const my = Array.isArray(x.myRequests) ? x.myRequests : [];
      const other = Array.isArray(x.otherRequests) ? x.otherRequests : [];
      return {
        list: [...my, ...other],
        hasMore: false,
        segments: { incoming: other, my },
      };
    }
    case 'executor': {
      const x = r as { assignedRequests?: RequestGroup[]; myRequests?: RequestGroup[]; completedRequests?: RequestGroup[] };
      const assigned = Array.isArray(x.assignedRequests) ? x.assignedRequests : [];
      const my = Array.isArray(x.myRequests) ? x.myRequests : [];
      const completed = Array.isArray(x.completedRequests) ? x.completedRequests : [];
      return {
        list: [...assigned, ...my, ...completed],
        hasMore: false,
        segments: { tasks: assigned, myTasks: my, completed },
      };
    }
    default:
      if (Array.isArray((r as { requests?: unknown }).requests)) {
        const x = r as { requests: RequestGroup[] };
        return { list: x.requests, hasMore: false };
      }
      if (Array.isArray((r as { data?: unknown }).data)) {
        const x = r as { data: RequestGroup[] };
        return { list: x.data, hasMore: false };
      }
      return { list: [], hasMore: false };
  }
}

/** Параметры запроса заявок (в т.ч. для manager: офис и период). */
export interface RequestGroupsParams {
  status?: string | null;
  priority?: string | null;
  office_id?: string | null;
  from?: string | null;
}

/** Список заявок. Один запрос для всех ролей — бэкенд по токену возвращает разную структуру. segments — для вкладок. Для manager можно передать office_id и from (период). */
export async function getRequestGroups(
  page = 1,
  pageSize = 20,
  role: RequestGroupsRole | null,
  params?: RequestGroupsParams
): Promise<
  | { ok: true; data: RequestGroup[]; hasMore: boolean; segments?: RequestGroupsSegments }
  | { ok: false; error: string }
> {
  const search = new URLSearchParams();
  search.set('page', String(page));
  search.set('pageSize', String(pageSize));
  if (params?.status && params.status !== 'all') search.set('status', params.status);
  if (params?.priority && params.priority !== 'all') search.set('priority', params.priority);
  if (params?.office_id && params.office_id !== 'all') search.set('office_id', params.office_id);
  if (params?.from) search.set('from', params.from);
  const result = await request<RequestGroupsBackendResponse>(
    `/request-groups?${search.toString()}`
  );
  if (!result.ok) return { ok: false, error: result.error };
  const { list, hasMore, segments } = normalizeRequestGroupsResponse(result.data, role);
  return { ok: true, data: list, hasMore, segments };
}

/** Одна группа заявок по id (для страницы детали). */
export async function getRequestGroupById(
  id: number
): Promise<{ ok: true; data: RequestGroup } | { ok: false; error: string }> {
  const result = await request<RequestGroup>(`/request-groups/${id}`);
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

/** Параметры подзаявки при принятии заявки (admin-worker) */
export interface AcceptSubRequestPayload {
  id: number;
  sla?: string | null;
  complexity?: string | null;
  category_id?: number;
}

/** Принять/отклонить группу заявок (admin-worker). patch_code: 1 = accept (с sub_requests, request_type, location_detail), 2 = reject (rejection_reason) */
export async function patchRequestGroup(
  id: number,
  patchCode: 1 | 2,
  body?: {
    request_type?: string;
    location_detail?: string;
    rejection_reason?: string;
    sub_requests?: AcceptSubRequestPayload[];
  }
): Promise<{ ok: true; data: RequestGroup } | { ok: false; error: string }> {
  const result = await request<RequestGroup>(`/request-groups/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ patch_code: patchCode, ...body }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data! };
}

/** Начать выполнение задачи (executor) */
export async function executeRequest(
  requestId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/requests/${requestId}/execute`, {
    method: 'PATCH',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Завершить задачу (executor) */
export async function completeRequest(
  requestId: number,
  body: { comment: string }
): Promise<{ ok: true; data?: { requestGroup?: { id: number } } } | { ok: false; error: string }> {
  const result = await request<{ requestGroup?: { id: number } }>(
    `/requests/${requestId}/complete`,
    { method: 'PATCH', body: JSON.stringify(body) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data };
}

/** Админ-завершение подзаявки (admin-worker) */
export async function adminCompleteRequest(
  requestId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/requests/${requestId}/admin-complete`, {
    method: 'PATCH',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Переключить долгосрочная (admin-worker) */
export async function toggleLongTermRequest(
  requestId: number,
  isLongTerm: boolean
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/requests/${requestId}/long-term`, {
    method: 'PATCH',
    body: JSON.stringify({ is_long_term: isLongTerm }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Перенаправить подзаявку (department-head, executor) */
export async function redirectRequest(
  requestId: number,
  categoryId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/requests/${requestId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      status: 'awaiting_assignment',
      executor_id: null,
      actual_completion_date: null,
      category_id: categoryId,
      patch_code: 1,
    }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Отклонить подзаявку (executor) */
export async function rejectRequest(
  requestId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/requests/${requestId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'awaiting_assignment', patch_code: 1 }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Отправить уведомление об отклонении (executor) */
export async function postRejectNotification(
  requestId: number,
  reason: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>('/notifications/reject-assigned', {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, reason }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Удалить подзаявку */
export async function deleteRequest(
  requestId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/requests/${requestId}`, {
    method: 'DELETE',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Удалить группу заявок */
export async function deleteRequestGroup(
  groupId: number
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/request-groups/${groupId}`, {
    method: 'DELETE',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Оценить работу исполнителя */
export async function postRating(
  requestId: number,
  rating: number,
  comment?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>('/ratings', {
    method: 'POST',
    body: JSON.stringify({ request_id: requestId, rating, comment }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Оценить клиента */
export async function postClientRating(
  requestGroupId: number,
  rating: number,
  comment?: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>('/client-ratings', {
    method: 'POST',
    body: JSON.stringify({ request_group_id: requestGroupId, rating, comment }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Загрузить фото к заявке (React Native: uri от image picker) */
export async function uploadRequestPhotos(
  groupId: number,
  photos: { uri: string; type?: string }[],
  photoType: 'before' | 'after' = 'after'
): Promise<{ ok: true } | { ok: false; error: string }> {
  const formData = new FormData();
  photos.forEach((p, i) => {
    formData.append('photos', {
      uri: p.uri,
      type: p.type ?? 'image/jpeg',
      name: `photo_${i}_${Date.now()}.jpg`,
    } as unknown as Blob);
  });
  formData.append('type', photoType);

  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${config.apiBaseUrl}/request-photos/${groupId}/photos`, {
      method: 'POST',
      headers,
      body: formData,
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      const err =
        (data as { error?: string })?.error ||
        (data as { message?: string })?.message ||
        'Ошибка загрузки фото';
      return { ok: false, error: err };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка загрузки фото';
    return { ok: false, error: msg };
  }
}

/** Список исполнителей (для department-head) */
export async function getExecutors(): Promise<
  { ok: true; data: ExecutorInCategory[] } | { ok: false; error: string }
> {
  const result = await request<ExecutorInCategory[] | ExecutorInCategory>('/executors');
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const list = Array.isArray(data) ? data : data ? [data] : [];
  return { ok: true, data: list };
}

/** Назначить исполнителей на подзаявку (department-head) */
export async function assignExecutorsToRequest(
  subRequestId: number,
  executors: Array<{ id: number; role: 'executor' | 'leader' }>
): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(
    `/request-executors/${subRequestId}/assign`,
    { method: 'POST', body: JSON.stringify({ executors }) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

/** Создать группу заявок (FormData с photos) */
export async function createRequestGroup(
  formData: FormData
): Promise<{ ok: true; data: RequestGroup } | { ok: false; error: string }> {
  const token = useAuthStore.getState().token;
  const headers: HeadersInit = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    const res = await fetch(`${config.apiBaseUrl}/request-groups`, {
      method: 'POST',
      headers,
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err =
        (data as { error?: string })?.error ||
        (data as { message?: string })?.message ||
        'Ошибка создания заявки';
      return { ok: false, error: err };
    }
    return { ok: true, data: data as RequestGroup };
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Ошибка создания заявки';
    return { ok: false, error: msg };
  }
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

// ==================== Analytics (admin-worker) ====================

export interface AdminWorkerStats {
  totalRequests: number;
  statusCounts: {
    new: number;
    inWork: number;
    completed: number;
    overdue: number;
  };
  requestTypeSummary: Record<string, number>;
}

export async function getAdminWorkerStats(): Promise<
  { ok: true; data: AdminWorkerStats } | { ok: false; error: string }
> {
  const result = await request<AdminWorkerStats>('/analytics/stats/admin-worker');
  if (!result.ok) return { ok: false, error: result.error };
  const data = result.data;
  const normalized: AdminWorkerStats = {
    totalRequests: typeof data?.totalRequests === 'number' ? data.totalRequests : 0,
    statusCounts: {
      new: typeof data?.statusCounts?.new === 'number' ? data.statusCounts.new : 0,
      inWork: typeof data?.statusCounts?.inWork === 'number' ? data.statusCounts.inWork : 0,
      completed: typeof data?.statusCounts?.completed === 'number' ? data.statusCounts.completed : 0,
      overdue: typeof data?.statusCounts?.overdue === 'number' ? data.statusCounts.overdue : 0,
    },
    requestTypeSummary: data?.requestTypeSummary && typeof data.requestTypeSummary === 'object'
      ? data.requestTypeSummary
      : {},
  };
  return { ok: true, data: normalized };
}

// ==================== Analytics (department-head) ====================

export interface DepartmentHeadStats {
  totalRequests: number;
  statusCounts: {
    awaitingAssignment: number;
    new: number;
    inWork: number;
    completed: number;
    overdue: number;
  };
  requestTypeSummary: Record<string, number>;
}

export async function getDepartmentHeadStats(): Promise<
  { ok: true; data: DepartmentHeadStats } | { ok: false; error: string }
> {
  const result = await request<DepartmentHeadStats>('/analytics/stats/department-head');
  if (!result.ok) return { ok: false, error: result.error };
  const d = result.data;
  const sc = d?.statusCounts;
  const normalized: DepartmentHeadStats = {
    totalRequests: typeof d?.totalRequests === 'number' ? d.totalRequests : 0,
    statusCounts: {
      awaitingAssignment: typeof sc?.awaitingAssignment === 'number' ? sc.awaitingAssignment : 0,
      new: typeof sc?.new === 'number' ? sc.new : 0,
      inWork: typeof sc?.inWork === 'number' ? sc.inWork : 0,
      completed: typeof sc?.completed === 'number' ? sc.completed : 0,
      overdue: typeof sc?.overdue === 'number' ? sc.overdue : 0,
    },
    requestTypeSummary:
      d?.requestTypeSummary && typeof d.requestTypeSummary === 'object'
        ? d.requestTypeSummary
        : {},
  };
  return { ok: true, data: normalized };
}

// ==================== Analytics (manager) ====================

/** Ответ /analytics/stats/manager: по офисам и датам */
export interface ManagerStatsRawItem {
  officeId: number;
  data: Record<
    string,
    {
      totalRequests: number;
      newRequests: number;
      inWorkRequests: number;
      completedRequests: number;
      overdueRequests: number;
      normalRequests: number;
      urgentRequests: number;
      plannedRequests: number;
    }
  >;
}

/** Агрегированная статистика для отображения (как admin-worker) */
export interface ManagerStatsAggregated {
  totalRequests: number;
  statusCounts: { new: number; inWork: number; completed: number; overdue: number };
  requestTypeSummary: Record<string, number>;
}

export async function getManagerStats(): Promise<
  { ok: true; data: ManagerStatsRawItem[] } | { ok: false; error: string }
> {
  const result = await request<ManagerStatsRawItem[]>('/analytics/stats/manager');
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data ?? [] };
}

/** Аналитика: SLA по времени/категориям/офисам */
export async function getManagerSLAStats(): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; error: string }
> {
  const result = await request<Record<string, unknown>>('/analytics/stats/manager/sla');
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data ?? {} };
}

/** Аналитика: рейтинги по офисам/категориям/исполнителям */
export async function getManagerRatingStats(): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; error: string }
> {
  const result = await request<Record<string, unknown>>('/analytics/stats/manager/ratings');
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data ?? {} };
}

/** Аналитика: детальная статистика по категориям/направлениям/исполнителям */
export async function getManagerDetailedStats(): Promise<
  { ok: true; data: Record<string, unknown> } | { ok: false; error: string }
> {
  const result = await request<Record<string, unknown>>('/analytics/stats/manager/detailed');
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: result.data ?? {} };
}

/** Агрегирует сырые данные manager в плоскую структуру для UI */
export function aggregateManagerStats(raw: ManagerStatsRawItem[]): ManagerStatsAggregated {
  let total = 0,
    newCount = 0,
    inWork = 0,
    completed = 0,
    overdue = 0,
    normal = 0,
    urgent = 0,
    planned = 0;
  for (const item of raw ?? []) {
    const data = item.data ?? {};
    for (const day of Object.values(data)) {
      if (!day || typeof day !== 'object') continue;
      total += Number(day.totalRequests) || 0;
      newCount += Number(day.newRequests) || 0;
      inWork += Number(day.inWorkRequests) || 0;
      completed += Number(day.completedRequests) || 0;
      overdue += Number(day.overdueRequests) || 0;
      normal += Number(day.normalRequests) || 0;
      urgent += Number(day.urgentRequests) || 0;
      planned += Number(day.plannedRequests) || 0;
    }
  }
  return {
    totalRequests: total,
    statusCounts: { new: newCount, inWork, completed, overdue },
    requestTypeSummary: { normal, urgent, planned },
  };
}

// ==================== Analytics (executor) ====================

export interface ExecutorStats {
  totalRequests: number;
  overdue: number;
  inWork: number;
  completed: number;
  onTime: number;
  averageExecutionHours: string;
  averageRating: string;
}

export async function getExecutorStats(): Promise<
  { ok: true; data: ExecutorStats } | { ok: false; error: string }
> {
  const result = await request<ExecutorStats>('/analytics/stats/executor');
  if (!result.ok) return { ok: false, error: result.error };
  const d = result.data;
  const normalized: ExecutorStats = {
    totalRequests: typeof d?.totalRequests === 'number' ? d.totalRequests : 0,
    overdue: typeof d?.overdue === 'number' ? d.overdue : 0,
    inWork: typeof d?.inWork === 'number' ? d.inWork : 0,
    completed: typeof d?.completed === 'number' ? d.completed : 0,
    onTime: typeof d?.onTime === 'number' ? d.onTime : 0,
    averageExecutionHours:
      typeof d?.averageExecutionHours === 'string' ? d.averageExecutionHours : '0.00',
    averageRating: typeof d?.averageRating === 'string' ? d.averageRating : '0.00',
  };
  return { ok: true, data: normalized };
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
    office_id?: number;
    room_type?: string;
    office?: {
      id: number;
      name: string;
    };
  };
  subscribedClient?: {
    id: number;
    full_name: string;
    phone?: string;
  };
}

/** Все подписки (для админа): кто привязан к каким комнатам для управления умным домом */
export async function getAllClientRoomSubscriptions(): Promise<
  { ok: true; data: ClientRoomSubscription[] } | { ok: false; error: string }
> {
  const result = await request<{ success?: boolean; subscriptions?: ClientRoomSubscription[] }>(
    '/client-room-subscriptions'
  );
  if (!result.ok) return { ok: false, error: result.error };
  const raw = result.data;
  const list = Array.isArray((raw as { subscriptions?: ClientRoomSubscription[] })?.subscriptions)
    ? (raw as { subscriptions: ClientRoomSubscription[] }).subscriptions
    : [];
  return { ok: true, data: list };
}

export async function createClientRoomSubscription(body: {
  client_id: number;
  meeting_room_id: number;
}): Promise<{ ok: true; data: ClientRoomSubscription } | { ok: false; error: string }> {
  const result = await request<{ success?: boolean; data?: ClientRoomSubscription }>(
    '/client-room-subscriptions',
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  const data = (result.data as { data?: ClientRoomSubscription })?.data;
  if (!data) return { ok: false, error: 'Нет данных в ответе' };
  return { ok: true, data };
}

export async function deleteClientRoomSubscription(id: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await request<unknown>(`/client-room-subscriptions/${id}`, {
    method: 'DELETE',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
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

// ==================== Smart Home (admin-worker / manager) ====================

export interface YandexTokensMeta {
  id: number;
  expires_at: string | null;
  created_at?: string;
  updated_at?: string;
  has_tokens: boolean;
}

export async function getYandexTokens(): Promise<
  { ok: true; data: YandexTokensMeta } | { ok: false; error: string } | { ok: true; data: null }
> {
  const result = await request<YandexTokensMeta>('/yandex-smart-home/tokens');
  if (!result.ok) {
    if (result.error?.toLowerCase().includes('not found') || result.error?.toLowerCase().includes('токены не')) {
      return { ok: true, data: null };
    }
    return { ok: false, error: result.error };
  }
  return { ok: true, data: result.data ?? null };
}

export async function refreshYandexTokens(): Promise<
  { ok: true; data?: { id: number; expires_at: string; updated_at: string } } | { ok: false; error: string }
> {
  const result = await request<{ success?: boolean; data?: { id: number; expires_at: string; updated_at: string } }>(
    '/yandex-smart-home/tokens/refresh',
    { method: 'POST' }
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, data: (result.data as { data?: { id: number; expires_at: string; updated_at: string } })?.data };
}

export async function deleteYandexTokens(): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>('/yandex-smart-home/tokens', { method: 'DELETE' });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
}

export async function getYandexDevicesList(): Promise<
  { ok: true; data: YandexDevice[] } | { ok: false; error: string }
> {
  const result = await request<{ success?: boolean; devices?: YandexDevice[] }>(
    '/yandex-smart-home/devices/list'
  );
  if (!result.ok) return { ok: false, error: result.error };
  const raw = result.data;
  const list = Array.isArray((raw as { devices?: YandexDevice[] })?.devices)
    ? (raw as { devices: YandexDevice[] }).devices
    : [];
  return { ok: true, data: list };
}

export interface RoomDeviceLink {
  id: number;
  meeting_room_id: number;
  device_id: string;
  device_name: string;
  device_type?: string | null;
  meetingRoom?: {
    id: number;
    name: string;
    office_id?: number;
    office?: { id: number; name: string };
  };
}

export async function getAllRoomDevices(): Promise<
  { ok: true; data: RoomDeviceLink[] } | { ok: false; error: string }
> {
  const result = await request<{ success?: boolean; devices?: RoomDeviceLink[] }>(
    '/yandex-smart-home/room-devices'
  );
  if (!result.ok) return { ok: false, error: result.error };
  const raw = result.data;
  const list = Array.isArray((raw as { devices?: RoomDeviceLink[] })?.devices)
    ? (raw as { devices: RoomDeviceLink[] }).devices
    : [];
  return { ok: true, data: list };
}

export async function createRoomDevice(body: {
  meeting_room_id: number;
  device_id: string;
  device_name: string;
  device_type?: string;
}): Promise<{ ok: true; data: RoomDeviceLink } | { ok: false; error: string }> {
  const result = await request<{ success?: boolean; data?: RoomDeviceLink }>(
    '/yandex-smart-home/room-devices',
    { method: 'POST', body: JSON.stringify(body) }
  );
  if (!result.ok) return { ok: false, error: result.error };
  const data = (result.data as { data?: RoomDeviceLink })?.data;
  if (!data) return { ok: false, error: 'Нет данных в ответе' };
  return { ok: true, data };
}

export async function deleteRoomDevice(id: number): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<unknown>(`/yandex-smart-home/room-devices/${id}`, {
    method: 'DELETE',
  });
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true };
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
  description?: string | null;
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

export interface ScanBookingQrResponse {
  booking: MeetingRoomBooking;
  tables_remaining: number;
}

export async function scanBookingQRCode(
  bookingId: number
): Promise<{ ok: true; data: ScanBookingQrResponse } | { ok: false; error: string }> {
  const result = await request<ScanBookingQrResponse>('/meeting-room-bookings/scan-qr', {
    method: 'POST',
    body: JSON.stringify({ bookingId }),
  });
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
}

export async function getPublicBooking(
  bookingId: number
): Promise<{ ok: true; data: MeetingRoomBooking } | { ok: false; error: string }> {
  const result = await request<MeetingRoomBooking>(`/meeting-room-bookings/${bookingId}/public`);
  if (result.ok) return { ok: true, data: result.data };
  return { ok: false, error: result.error };
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

export async function createMeetingRoom(body: {
  name: string;
  office_id: number;
  floor?: number;
  capacity?: number;
  room_type?: string;
  description?: string | null;
}): Promise<
  { ok: true; data: MeetingRoom } | { ok: false; error: string }
> {
  const payload = {
    name: body.name.trim(),
    office_id: body.office_id,
    floor: body.floor ?? 0,
    capacity: body.capacity ?? 1,
    ...(body.room_type != null && { room_type: body.room_type }),
    ...(body.description != null && { description: body.description }),
  };
  const result = await request<MeetingRoom>('/meeting-rooms', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok) return { ok: true, data: result.data! };
  return { ok: false, error: result.error };
}

export async function updateMeetingRoom(
  id: number,
  body: Partial<Pick<MeetingRoom, 'name' | 'floor' | 'capacity' | 'room_type' | 'description'>>
): Promise<
  { ok: true; data: MeetingRoom } | { ok: false; error: string }
> {
  const result = await request<MeetingRoom>(`/meeting-rooms/${id}`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });
  if (result.ok) return { ok: true, data: result.data! };
  return { ok: false, error: result.error };
}

export async function deleteMeetingRoom(id: number): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const result = await request<undefined>(`/meeting-rooms/${id}`, { method: 'DELETE' });
  if (result.ok) return { ok: true };
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

/** Синк шагов на сервер для пуш-уведомлений шагомера (50%, почти цель, нет активности) */
export async function syncStepsToServer(payload: {
  stepsToday: number;
  goalSteps: number | null;
  noActivityIntervalHours: number;
  stepsNotificationsEnabled: boolean;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<{ data: { success: boolean; date: string } }>('/steps/sync', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  if (result.ok) return { ok: true };
  return { ok: false, error: result.error };
}
