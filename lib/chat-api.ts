import { config } from '@/lib/config';
import { useAuthStore } from '@/stores/auth-store';

const { apiBaseUrl } = config;

type ChatApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string; unauthorized?: boolean };

async function authRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<ChatApiResult<T>> {
  const token = useAuthStore.getState().token;
  if (!token) {
    return { ok: false, error: 'Не авторизован', unauthorized: true };
  }

  const url = `${apiBaseUrl}${path}`;
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    ...(options.headers as HeadersInit),
  };

  try {
    const res = await fetch(url, { ...options, headers });
    const data = await res.json().catch(() => ({}));

    if (res.status === 401) {
      useAuthStore.getState().clearAuth();
      return {
        ok: false,
        error: 'Сессия истекла. Войдите снова.',
        unauthorized: true,
      };
    }

    if (!res.ok) {
      const error =
        (data as { error?: string })?.error ||
        (data as { message?: string })?.message ||
        'Произошла ошибка';
      return { ok: false, error };
    }

    return { ok: true, data: data as T };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Сетевая ошибка';
    return { ok: false, error: message };
  }
}

// ==================== Chat Bot ====================

export interface ChatResponse {
  answer: string;
}

export async function sendChatMessage(
  message: string
): Promise<ChatApiResult<ChatResponse>> {
  return authRequest<ChatResponse>('/chat', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

// ==================== Support ====================

export interface SupportTicket {
  id: number;
  user_id: number;
  message: string;
  status: 'open' | 'in_progress' | 'closed';
  created_at: string;
  updated_at?: string;
  /** Имя клиента (для админа при списке чатов) */
  client_name?: string;
  client?: { full_name?: string };
}

export interface SupportMessage {
  id: number;
  ticket_id: number;
  sender: 'user' | 'admin';
  message: string;
  created_at: string;
}

export async function createSupportTicket(
  message: string
): Promise<ChatApiResult<{ ticket: SupportTicket }>> {
  return authRequest<{ ticket: SupportTicket }>('/support-tickets', {
    method: 'POST',
    body: JSON.stringify({ message }),
  });
}

export async function getMySupportTickets(): Promise<
  ChatApiResult<{ tickets: SupportTicket[] }>
> {
  return authRequest<{ tickets: SupportTicket[] }>('/support-tickets');
}

export async function getSupportTicketMessages(
  ticketId: number
): Promise<ChatApiResult<{ messages: SupportMessage[] }>> {
  return authRequest<{ messages: SupportMessage[] }>(
    `/support-tickets/${ticketId}/messages`
  );
}

export async function sendSupportMessage(
  ticketId: number,
  message: string
): Promise<ChatApiResult<{ message: SupportMessage }>> {
  return authRequest<{ message: SupportMessage }>(
    `/support-tickets/${ticketId}/messages`,
    {
      method: 'POST',
      body: JSON.stringify({ message }),
    }
  );
}
