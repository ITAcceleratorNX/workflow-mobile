import { config } from '@/lib/config';

/** ID приложения в App Store и package в Google Play — для кнопки «Обновить». */
const IOS_APP_STORE_ID = '6759451937';
const ANDROID_PACKAGE = 'com.workflow.kz';
const PLAY_STORE_PACKAGE = 'com.android.vending';

const MIN_VERSION_TIMEOUT_MS = 5000;

function parseVersion(value: string): number[] | null {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(value.trim());
  return match ? match.slice(1).map(Number) : null;
}

/**
 * Нужно ли обновление: версия приложения старше минимальной.
 * Если какую-то из версий не удалось разобрать — не блокируем.
 */
export function isUpdateRequired(current: string | null | undefined, min: string | null | undefined): boolean {
  if (!current || !min) return false;
  const a = parseVersion(current);
  const b = parseVersion(min);
  if (!a || !b) return false;
  for (let i = 0; i < 3; i += 1) {
    if (a[i] !== b[i]) return a[i] < b[i];
  }
  return false;
}

type VersionConfig = { version?: string; ios?: { version?: string }; android?: { version?: string } } | null | undefined;

/**
 * Версия приложения, которую видит стор платформы: `ios.version` / `android.version`
 * из app.json, если задана, иначе общая `version`. Общая может отставать от
 * платформенной (у iOS 1.0.7 общая была 1.0.0) — тогда сравнение блокировало бы всех.
 */
export function appVersionFor(platform: string, expoConfig: VersionConfig): string | null {
  const own = platform === 'ios' ? expoConfig?.ios?.version : platform === 'android' ? expoConfig?.android?.version : undefined;
  return own ?? expoConfig?.version ?? null;
}

/**
 * Версия установленного билда. В Expo Go нативная версия — это версия Expo Go,
 * её нельзя сравнивать с минимумом Workflow. В обычной сборке берём versionName /
 * CFBundleShortVersionString: версия из JS-конфига отстаёт, если OTA принёс старый app.json,
 * и тогда уже обновлённый Android снова показывает «Доступна новая версия».
 */
export function installedAppVersion(
  platform: string,
  expoConfig: VersionConfig,
  nativeVersion: string | null | undefined,
  inExpoGo: boolean,
): string | null {
  if (!inExpoGo) {
    const native = nativeVersion?.trim();
    if (native) return native;
  }
  return appVersionFor(platform, expoConfig);
}

/** Ссылка на страницу приложения в сторе платформы. */
export function storeUrl(platform: string): string {
  return platform === 'ios'
    ? `itms-apps://apps.apple.com/app/id${IOS_APP_STORE_ID}`
    : storeWebUrl('android');
}

/** Та же страница в браузере, если приложение стора не открылось. */
export function storeWebUrl(platform: string): string {
  return platform === 'ios'
    ? `https://apps.apple.com/app/id${IOS_APP_STORE_ID}`
    : `https://play.google.com/store/apps/details?id=${ANDROID_PACKAGE}`;
}

/**
 * Явный intent в приложение Google Play. Голый `market://` на Android 11+ часто
 * не виден (package visibility) либо открывает магазин производителя, где этой
 * сборки нет: человек удаляет Workflow и ставит тот же файл снова.
 */
export function playStoreIntentUrl(): string {
  const fallback = encodeURIComponent(storeWebUrl('android'));
  return `intent://details?id=${ANDROID_PACKAGE}#Intent;scheme=market;package=${PLAY_STORE_PACKAGE};S.browser_fallback_url=${fallback};end`;
}

/** Открывает стор этой платформы. На Android сначала само приложение Google Play. */
export async function openAppStore(platform: string, open: (url: string) => Promise<unknown>): Promise<void> {
  const urls = platform === 'android' ? [playStoreIntentUrl(), storeWebUrl('android')] : [storeUrl(platform), storeWebUrl(platform)];
  let lastError: unknown;
  for (const url of urls) {
    try {
      await open(url);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not open the store');
}

type PlatformVersionBody = { min_version?: unknown; store_version?: unknown };
type AppVersionBody = { min_version?: unknown; ios?: PlatformVersionBody; android?: PlatformVersionBody };

export type StorePolicy = { minVersion: string | null; storeVersion: string | null };

function versionField(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

/** Минимум и последняя версия в сторе этой платформы. Старый ответ без полей платформы — общий min_version. */
export function policyForPlatform(platform: string, body: AppVersionBody): StorePolicy {
  const shared = versionField(body.min_version);
  const own = platform === 'ios' ? body.ios : platform === 'android' ? body.android : undefined;
  return {
    minVersion: versionField(own?.min_version) ?? shared,
    storeVersion: versionField(own?.store_version),
  };
}

/**
 * Версия, старше которой приложение блокируется. Если в сторе платформы ещё нет
 * требуемой сборки, требовать её нельзя: удаление и повторная установка скачивают
 * тот же релиз, и экран «Доступна новая версия» не исчезает.
 */
export function blockingMinVersion(policy: StorePolicy): string | null {
  const { minVersion, storeVersion } = policy;
  if (!minVersion) return null;
  if (storeVersion && isUpdateRequired(storeVersion, minVersion)) return storeVersion;
  return minVersion;
}

/**
 * Минимальная поддерживаемая версия с бэкенда (GET /app-version, без авторизации).
 * Нет сети, ошибка сервера или старый бэкенд без эндпоинта — null: пользователя не блокируем.
 */
export async function fetchMinAppVersion(fetchImpl: typeof fetch = fetch, platform = 'android'): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), MIN_VERSION_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${config.apiBaseUrl}/app-version`, { signal: controller.signal });
    if (!res.ok) return null;
    const body = (await res.json()) as AppVersionBody;
    return blockingMinVersion(policyForPlatform(platform, body));
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
