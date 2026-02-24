import { config } from '@/lib/config';

const { apiBaseUrl } = config;

export type VerificationPurpose = 'registration' | 'password_reset';

export interface VerificationResult {
  success: boolean;
  message?: string;
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
