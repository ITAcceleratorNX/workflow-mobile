import React, { useCallback, useEffect, useState } from 'react';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Switch,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useToast } from '@/context/toast-context';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore, type AuthState } from '@/stores/auth-store';
import {
  disableCalendarSubscription,
  disconnectGoogleCalendar,
  enableCalendarSubscription,
  getGoogleCalendarAuthUrl,
  getTaskCalendarStatus,
  syncGoogleCalendar,
  type TaskCalendarStatus,
} from '@/lib/task-calendar-api';
import {
  CALENDAR_RETURN_URL,
  calendarResultFromUrl,
  calendarResultNotice,
  lastSyncedLabel,
} from '@/lib/task-calendar';

type Busy = null | 'connect' | 'sync' | 'disconnect' | 'ics' | 'rotate';

function confirm(title: string, message: string, confirmLabel: string, destructive = false): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Отмена', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}

/**
 * Синхронизация задач с внешними календарями: Google Календарь и ссылка-подписка
 * (Apple Календарь, Outlook). Одностороннее направление: Workflow → календарь.
 */
export default function CalendarSettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ calendar?: string }>();
  const { show: showToast } = useToast();
  const isGuest = useAuthStore((s: AuthState) => s.isGuest);

  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');
  const errorColor = useThemeColor({}, 'error');

  const [status, setStatus] = useState<TaskCalendarStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Busy>(null);

  const load = useCallback(async () => {
    const result = await getTaskCalendarStatus();
    if (result.ok) {
      setStatus(result.data);
      setLoadError(null);
    } else {
      setLoadError(result.error);
    }
  }, []);

  // Перечитывается при каждом возврате на экран, в том числе по ссылке возврата от Google.
  useFocusEffect(
    useCallback(() => {
      if (!isGuest) void load();
    }, [isGuest, load]),
  );

  const showResult = useCallback((result: string | null) => {
    const notice = calendarResultNotice(result);
    if (!notice) return;
    showToast({
      title: notice.title,
      description: notice.description,
      variant: notice.tone === 'success' ? 'success' : 'error',
    });
  }, [showToast]);

  // Android может открыть экран заново по ссылке возврата вместо ответа сессии входа.
  useEffect(() => {
    if (!params.calendar) return;
    showResult(params.calendar);
    router.setParams({ calendar: undefined });
  }, [params.calendar, showResult, router]);

  const fail = (title: string, description?: string) =>
    showToast({ title, description, variant: 'error' });

  const connectGoogle = async () => {
    setBusy('connect');
    try {
      const answer = await getGoogleCalendarAuthUrl();
      if (!answer.ok) {
        fail('Не удалось начать подключение', answer.error);
        return;
      }
      // Системный браузер: Google не пускает вход во встроенный WebView.
      const session = await WebBrowser.openAuthSessionAsync(answer.data.url, CALENDAR_RETURN_URL);
      if (session.type === 'success') showResult(calendarResultFromUrl(session.url));
      await load();
    } finally {
      setBusy(null);
    }
  };

  const syncNow = async () => {
    setBusy('sync');
    const answer = await syncGoogleCalendar();
    await load();
    setBusy(null);
    if (answer.ok && answer.data.ok) showToast({ title: 'Календарь обновлён', variant: 'success' });
    else fail('Не удалось обновить календарь', answer.ok ? answer.data.last_error ?? undefined : answer.error);
  };

  const disconnectGoogle = async () => {
    const ok = await confirm(
      'Отключить Google Календарь?',
      'Календарь «Workflow — задачи» будет удалён из вашего Google-аккаунта вместе с событиями. Задачи в Workflow не изменятся.',
      'Отключить',
      true,
    );
    if (!ok) return;
    setBusy('disconnect');
    const answer = await disconnectGoogleCalendar();
    await load();
    setBusy(null);
    if (!answer.ok) fail('Не удалось отключить', answer.error);
  };

  const toggleSubscription = async (enabled: boolean) => {
    setBusy('ics');
    const answer = enabled ? await enableCalendarSubscription() : await disableCalendarSubscription();
    await load();
    setBusy(null);
    if (!answer.ok) fail(enabled ? 'Не удалось создать ссылку' : 'Не удалось выключить ссылку', answer.error);
  };

  const rotateLink = async () => {
    const ok = await confirm(
      'Выпустить новую ссылку?',
      'Старая ссылка перестанет работать: календари, подписанные на неё, нужно будет подписать заново.',
      'Выпустить',
    );
    if (!ok) return;
    setBusy('rotate');
    const answer = await enableCalendarSubscription(true);
    await load();
    setBusy(null);
    if (answer.ok) showToast({ title: 'Новая ссылка готова', variant: 'success' });
    else fail('Не удалось выпустить ссылку', answer.error);
  };

  const subscribe = async (webcalUrl: string) => {
    try {
      await Linking.openURL(webcalUrl);
    } catch {
      fail('Не удалось открыть Календарь', 'Скопируйте ссылку и добавьте подписку вручную.');
    }
  };

  const shareLink = (feedUrl: string) => {
    void Share.share({ message: feedUrl });
  };

  const google = status?.google;
  const ics = status?.ics;
  const googleRevoked = google?.status === 'revoked';
  const synced = lastSyncedLabel(google?.last_synced_at);
  const disabled = busy !== null;

  const outlineButton = (label: string, onPress: () => void, kind: Busy, icon?: keyof typeof MaterialIcons.glyphMap) => (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.outlineButton, { borderColor: border }, (pressed || disabled) && styles.dimmed]}
    >
      {kind !== null && busy === kind ? (
        <ActivityIndicator size="small" color={text} />
      ) : (
        <>
          {icon ? <MaterialIcons name={icon} size={18} color={text} /> : null}
          <ThemedText style={styles.outlineButtonText}>{label}</ThemedText>
        </>
      )}
    </Pressable>
  );

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/settings'))}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.backButton}
        >
          <MaterialIcons name="arrow-back" size={22} color={text} />
        </Pressable>
        <ThemedText style={styles.headerTitle}>Календарь</ThemedText>
        <View style={styles.headerRightSpacer} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: 32 + insets.bottom }]}
        showsVerticalScrollIndicator={false}
      >
        <ThemedText style={[styles.intro, { color: muted }]}>
          Задачи со сроком появятся в вашем календаре: задача только с датой — на весь день, со временем — в это
          время. Выполненные остаются с отметкой ✅. Изменения в календаре задачи в Workflow не меняют.
        </ThemedText>

        {isGuest ? (
          <View style={[styles.card, { borderColor: border }]}>
            <ThemedText style={{ color: muted }}>Подключение календаря недоступно в демо-версии.</ThemedText>
          </View>
        ) : loadError && !status ? (
          <View style={[styles.card, { borderColor: border }]}>
            <ThemedText style={{ color: muted }}>Не удалось загрузить настройки календаря.</ThemedText>
            {outlineButton('Повторить', () => void load(), null)}
          </View>
        ) : !status ? (
          <ActivityIndicator style={styles.loader} color={muted} />
        ) : (
          <>
            <View style={[styles.card, { borderColor: border }]}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="event" size={22} color={primary} />
                <View style={styles.cardHeaderText}>
                  <ThemedText style={styles.cardTitle}>Google Календарь</ThemedText>
                  <ThemedText style={[styles.cardSubtitle, { color: muted }]}>
                    Для Android, iPhone и компьютера. Обновляется сразу после изменения задачи.
                  </ThemedText>
                </View>
              </View>

              {!google?.available ? (
                <ThemedText style={[styles.cardSubtitle, { color: muted }]}>
                  Подключение Google Календаря пока не настроено.
                </ThemedText>
              ) : google.connected ? (
                <>
                  <View style={[styles.infoBox, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.infoTitle} numberOfLines={1}>
                      {google.account_email ?? 'Аккаунт Google'}
                    </ThemedText>
                    {google.status === 'error' ? (
                      <ThemedText style={[styles.cardSubtitle, { color: errorColor }]}>
                        {google.last_error ?? 'Последняя синхронизация не удалась'}
                      </ThemedText>
                    ) : (
                      <ThemedText style={[styles.cardSubtitle, { color: muted }]}>
                        {synced ?? 'Первая синхронизация идёт…'}
                      </ThemedText>
                    )}
                  </View>
                  <View style={styles.buttonRow}>
                    {outlineButton('Обновить', () => void syncNow(), 'sync', 'refresh')}
                    {outlineButton('Отключить', () => void disconnectGoogle(), 'disconnect')}
                  </View>
                </>
              ) : (
                <>
                  {googleRevoked ? (
                    <ThemedText style={[styles.cardSubtitle, { color: errorColor }]}>
                      {google.last_error ?? 'Доступ к Google Календарю отозван. Подключите календарь заново.'}
                    </ThemedText>
                  ) : null}
                  <Pressable
                    onPress={() => void connectGoogle()}
                    disabled={disabled}
                    style={({ pressed }) => [styles.primaryButton, { backgroundColor: primary }, (pressed || disabled) && styles.dimmed]}
                  >
                    {busy === 'connect' ? (
                      <ActivityIndicator size="small" color={onPrimary} />
                    ) : (
                      <ThemedText style={[styles.primaryButtonText, { color: onPrimary }]}>
                        {googleRevoked ? 'Подключить заново' : 'Подключить Google Календарь'}
                      </ThemedText>
                    )}
                  </Pressable>
                  <ThemedText style={[styles.hint, { color: muted }]}>
                    Workflow создаст отдельный календарь «Workflow — задачи» и не получит доступа к другим вашим
                    календарям.
                  </ThemedText>
                </>
              )}
            </View>

            <View style={[styles.card, { borderColor: border }]}>
              <View style={styles.cardHeader}>
                <MaterialIcons name="link" size={22} color={primary} />
                <View style={styles.cardHeaderText}>
                  <ThemedText style={styles.cardTitle}>
                    {Platform.OS === 'ios' ? 'Календарь iPhone, Outlook и другие' : 'Outlook и другие календари'}
                  </ThemedText>
                  <ThemedText style={[styles.cardSubtitle, { color: muted }]}>
                    Ссылка-подписка. Календарь обновляет её сам — от 15 минут до нескольких часов.
                  </ThemedText>
                </View>
                <Switch
                  value={ics?.enabled ?? false}
                  onValueChange={(value) => void toggleSubscription(value)}
                  disabled={disabled}
                  trackColor={{ false: border, true: primary }}
                  accessibilityLabel="Ссылка-подписка на календарь"
                />
              </View>

              {ics?.enabled && ics.feed_url && ics.webcal_url ? (
                <>
                  <View style={[styles.infoBox, { backgroundColor: surfaceMuted }]}>
                    <ThemedText style={styles.linkText} selectable>{ics.feed_url}</ThemedText>
                  </View>
                  <View style={styles.buttonRow}>
                    {Platform.OS === 'ios'
                      ? outlineButton('Подписаться', () => void subscribe(ics.webcal_url!), null, 'event-available')
                      : null}
                    {outlineButton('Поделиться', () => shareLink(ics.feed_url!), null, 'share')}
                  </View>
                  <ThemedText style={[styles.hint, { color: muted }]}>
                    {Platform.OS === 'ios'
                      ? '«Подписаться» добавит календарь в приложение «Календарь». '
                      : 'Для Android удобнее Google Календарь выше: подписки по ссылке Google обновляет редко. '}
                    Никому не передавайте ссылку — по ней видны ваши задачи.
                  </ThemedText>
                  <Pressable onPress={() => void rotateLink()} disabled={disabled} style={disabled && styles.dimmed}>
                    <ThemedText style={[styles.linkAction, { color: primary }]}>
                      {busy === 'rotate' ? 'Выпускаем…' : 'Выпустить новую ссылку'}
                    </ThemedText>
                  </Pressable>
                </>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  backButton: {
    minWidth: 44,
    minHeight: 44,
    padding: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: { flex: 1, textAlign: 'center', fontSize: 20, fontWeight: '600' },
  headerRightSpacer: { width: 26 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, gap: 12 },
  intro: { fontSize: 14, lineHeight: 20 },
  loader: { marginTop: 40 },
  card: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  cardHeaderText: { flex: 1, gap: 2 },
  cardTitle: { fontSize: 16, fontWeight: '500' },
  cardSubtitle: { fontSize: 13, lineHeight: 18 },
  infoBox: { borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, gap: 2 },
  infoTitle: { fontSize: 14, fontWeight: '500' },
  linkText: { fontSize: 13 },
  buttonRow: { flexDirection: 'row', gap: 8 },
  outlineButton: {
    flex: 1,
    minHeight: 44,
    borderWidth: 1,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  outlineButtonText: { fontSize: 15, fontWeight: '500' },
  primaryButton: { minHeight: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { fontSize: 16, fontWeight: '600' },
  hint: { fontSize: 12, lineHeight: 17 },
  linkAction: { fontSize: 14 },
  dimmed: { opacity: 0.6 },
});
