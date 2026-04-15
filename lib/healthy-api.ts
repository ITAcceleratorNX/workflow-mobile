import { request } from '@/lib/api';

const HEALTHY_API_VERSION = 'healthy.v1';

export type HealthyInsightPeriod = 'day' | 'week' | 'month';

export interface HealthyWeakPoint {
  id: 'sleep' | 'water' | 'steps' | 'mood' | 'energy' | 'stress';
  label: string;
}

export interface HealthyInsightResponse {
  period: HealthyInsightPeriod;
  lowData: boolean;
  missingHints: string[];
  statusLabel: string;
  statusTone: 'positive' | 'neutral' | 'attention';
  summary: string;
  weakPoints: HealthyWeakPoint[];
  improved: string[];
  worsened: string[];
  recommendations: string[];
  supportMessage: string;
  weeklyFocus?: string;
  monthlyDynamics?: string;
  strengths: string[];
  weaknessesNarrative: string[];
  patternsLine?: string;
  monthlyFocus?: string;
  generated_at?: string;
  engine_version?: string;
}

export interface HealthyProfilePayload {
  sleep_goal_minutes: number;
  steps_goal: number | null;
  weight_kg: number | null;
  height_cm: number | null;
  timezone: string;
  health_data_consent: boolean;
  apple_health_enabled: boolean;
  sleep_notifications_enabled: boolean;
  steps_notifications_enabled: boolean;
  no_activity_interval_hours: number;
}

export interface HealthyMetricPayload {
  date: string;
  sleep_minutes: number | null;
  sleep_rating: 'poor' | 'ok' | 'good' | null;
  water_ml: number | null;
  water_goal_ml: number | null;
  steps_count: number | null;
  mood_value: number | null;
  energy_level: 'low' | 'medium' | 'high' | null;
  stress_level: 'low' | 'medium' | 'high' | null;
  data_sources: Record<string, boolean>;
}

interface HealthySyncResponseDto {
  version: typeof HEALTHY_API_VERSION;
  sync_result: {
    ok: boolean;
    synced_dates: string[];
    profile_updated: boolean;
  };
}

interface HealthyInsightResponseDto extends HealthyInsightResponse {
  version: typeof HEALTHY_API_VERSION;
}

export async function syncHealthyData(payload: {
  profile: HealthyProfilePayload;
  metrics: HealthyMetricPayload[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const result = await request<{ ok: boolean; data: HealthySyncResponseDto }>('/healthy/sync', {
    method: 'POST',
    body: JSON.stringify({
      version: HEALTHY_API_VERSION,
      ...payload,
    }),
  });
  if (!result.ok) return { ok: false, error: result.error };
  if (result.data?.data?.version !== HEALTHY_API_VERSION) {
    return { ok: false, error: 'Неподдерживаемая версия healthy sync response' };
  }
  return { ok: true };
}

export async function getHealthyInsight(period: HealthyInsightPeriod): Promise<
  { ok: true; data: HealthyInsightResponse } | { ok: false; error: string }
> {
  const result = await request<{ ok: boolean; data: HealthyInsightResponseDto }>('/healthy/insights', {
    params: { period },
  });
  if (!result.ok) return { ok: false, error: result.error };
  const payload = result.data?.data;
  if (!payload) {
    return { ok: false, error: 'Пустой ответ healthy insight' };
  }
  if (payload.version !== HEALTHY_API_VERSION) {
    return { ok: false, error: 'Неподдерживаемая версия healthy insight response' };
  }
  return { ok: true, data: payload };
}

