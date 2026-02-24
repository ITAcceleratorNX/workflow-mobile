import { config } from '@/lib/config';

const { apiBaseUrl } = config;

export type VerificationPurpose = 'registration' | 'password_reset';

export interface VerificationResult {
  success: boolean;
  message?: string;
}

export interface LoginResponse {
  token: string;
  role?: string;
}

export interface User {
  id: number;
  full_name: string;
  phone?: string;
  email?: string;
  email_verified?: boolean;
  office_id: number;
  office: { name: string; photo?: string | null };
  role: string;
  email_notifications: boolean;
  security_notifications: boolean;
  marketing_notifications: boolean;
  push_notifications: boolean;
  service_category_id?: number;
}

export async function loginWithPhone(
  phone: string,
  password: string
): Promise<LoginResponse> {
  const res = await fetch(`${apiBaseUrl}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { details?: { message?: string }[] })?.details?.[0]?.message ??
      (data as { message?: string })?.message ??
      'Ошибка входа';
    throw new Error(msg);
  }
  return data as LoginResponse;
}

export async function getCurrentUser(token: string): Promise<User> {
  const res = await fetch(`${apiBaseUrl}/users/me`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { details?: { message?: string }[] })?.details?.[0]?.message ??
      (data as { message?: string })?.message ??
      'Не удалось получить данные пользователя';
    throw new Error(msg);
  }
  return data as User;
}

export async function sendVerificationCode(
  phone: string,
  purpose: VerificationPurpose = 'registration'
): Promise<VerificationResult> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/send-verification-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, purpose }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { success: true };
    const message =
      (data as { details?: { message?: string }[] })?.details?.[0]?.message ||
      (data as { message?: string })?.message ||
      'Ошибка при отправке SMS';
    return { success: false, message };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Ошибка при отправке SMS';
    return { success: false, message };
  }
}

export async function verifyCode(
  phone: string,
  code: string,
  purpose: VerificationPurpose = 'registration'
): Promise<VerificationResult> {
  try {
    const res = await fetch(`${apiBaseUrl}/auth/verify-code`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, code, purpose }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { success: true };
    const message =
      (data as { details?: { message?: string }[] })?.details?.[0]?.message ||
      (data as { message?: string })?.message ||
      'Неверный код верификации';
    return { success: false, message };
  } catch (e) {
    const message =
      e instanceof Error ? e.message : 'Ошибка при проверке кода';
    return { success: false, message };
  }
}

export async function resetPassword(
  phone: string,
  verificationCode: string,
  newPassword: string
): Promise<void> {
  const res = await fetch(`${apiBaseUrl}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      phone,
      verification_code: verificationCode,
      new_password: newPassword,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const msg =
      (data as { details?: { message?: string }[] })?.details?.[0]?.message ??
      (data as { message?: string })?.message ??
      'Ошибка при сбросе пароля';
    throw new Error(msg);
  }
}
