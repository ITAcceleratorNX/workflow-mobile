import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuthStore } from '@/stores/auth-store';
import {
  getMySupportTickets,
  getSupportTicketMessages,
  sendSupportMessage,
  type SupportMessage,
  type SupportTicket,
} from '@/lib/chat-api';
import { styles } from '../styles';

type Params = {
  id?: string;
};

function getAdaptivePadding(height: number, min: number, max: number): number {
  const ratio = height / 812;
  return Math.round(Math.min(max, Math.max(min, min * ratio + (max - min) * 0.3)));
}

export default function SupportChatScreen() {
  const { id } = useLocalSearchParams<Params>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const role = useAuthStore((s) => s.role);
  const isAdminMessages = role === 'admin-worker';

  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const [activeSupportTicket, setActiveSupportTicket] = useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportInputValue, setSupportInputValue] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [supportError, setSupportError] = useState<string | null>(null);

  const supportScrollRef = useRef<ScrollView>(null);

  const scrollPaddingBottom = getAdaptivePadding(windowHeight, 16, 32);
  const inputBarPaddingBase = getAdaptivePadding(windowHeight, 8, 16);
  const inputBarBottomPadding = insets.bottom + inputBarPaddingBase;
  const keyboardVerticalOffset = 0;

  const ticketId = id ? parseInt(id, 10) : NaN;

  useEffect(() => {
    if (!id || Number.isNaN(ticketId)) {
      setSupportError('Неверный идентификатор обращения');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setSupportError(null);

    const load = async () => {
      const [ticketsRes, messagesRes] = await Promise.all([
        getMySupportTickets(),
        getSupportTicketMessages(ticketId),
      ]);

      if (cancelled) return;

      if (ticketsRes.ok && ticketsRes.data.tickets) {
        const found = ticketsRes.data.tickets.find((t) => t.id === ticketId) ?? null;
        setActiveSupportTicket(found);
      } else {
        setActiveSupportTicket(null);
      }

      if (messagesRes.ok && messagesRes.data.messages) {
        setSupportMessages(messagesRes.data.messages);
      } else {
        setSupportError(messagesRes.error ?? 'Не удалось загрузить сообщения');
        setSupportMessages([]);
      }
      setLoading(false);
    };

    load();

    return () => {
      cancelled = true;
    };
  }, [id, ticketId]);

  useEffect(() => {
    setTimeout(() => {
      supportScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [supportMessages]);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)/help' as const);
    }
  }, [router]);

  const handleSendSupportMessage = useCallback(async () => {
    const trimmed = supportInputValue.trim();
    if (!trimmed || Number.isNaN(ticketId) || supportSending) return;

    const optimisticMsg: SupportMessage = {
      id: Date.now(),
      ticket_id: ticketId,
      sender: isAdminMessages ? 'admin' : 'user',
      message: trimmed,
      created_at: new Date().toISOString(),
    };

    setSupportMessages((prev) => [...prev, optimisticMsg]);
    setSupportInputValue('');
    setSupportSending(true);
    setSupportError(null);

    const result = await sendSupportMessage(ticketId, trimmed);

    if (result.ok) {
      const res = await getSupportTicketMessages(ticketId);
      if (res.ok && res.data.messages) {
        setSupportMessages(res.data.messages);
      }
    } else {
      setSupportError(result.error ?? 'Не удалось отправить сообщение');
    }

    setSupportSending(false);
  }, [supportInputValue, supportSending, ticketId, isAdminMessages]);

  if (loading) {
    return (
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={[styles.flex1, { paddingTop: insets.top }]}>
          <ThemedView style={styles.container}>
            <View style={[styles.supportHeader, { borderBottomColor: border, paddingTop: 12 }]}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
              >
                <MaterialIcons name="arrow-back" size={24} color={text} />
              </Pressable>
              <View style={[styles.supportAvatar, { backgroundColor: `${primary}33` }]}>
                <MaterialIcons name="headset-mic" size={24} color={primary} />
              </View>
              <View style={styles.supportHeaderText}>
                <ThemedText style={styles.supportTitle} numberOfLines={1}>
                  Чат с поддержкой
                </ThemedText>
              </View>
            </View>
            <View style={[styles.ticketsLoading, { flex: 1 }]}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          </ThemedView>
        </View>
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <View style={[styles.flex1, { paddingTop: insets.top }]}>
        <ThemedView style={styles.container}>
          <View style={[styles.supportHeader, { borderBottomColor: border, paddingTop: 12 }]}>
            <Pressable
              onPress={handleBack}
              style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
            >
              <MaterialIcons name="arrow-back" size={24} color={text} />
            </Pressable>
            <View style={[styles.supportAvatar, { backgroundColor: `${primary}33` }]}>
              <MaterialIcons name="headset-mic" size={24} color={primary} />
            </View>
            <View style={styles.supportHeaderText}>
              <ThemedText style={styles.supportTitle} numberOfLines={1}>
                {isAdminMessages && activeSupportTicket
                  ? activeSupportTicket.client_name ??
                    activeSupportTicket.client?.full_name ??
                    `Клиент #${activeSupportTicket.id}`
                  : `Обращение #${id}`}
              </ThemedText>
              <ThemedText style={[styles.supportSubtitle, { color: textMuted }]}>
                {isAdminMessages && activeSupportTicket
                  ? activeSupportTicket.status === 'closed'
                    ? 'Закрыт'
                    : activeSupportTicket.status === 'in_progress'
                    ? 'В работе'
                    : 'Открыт'
                  : 'Администратор'}
              </ThemedText>
            </View>
          </View>

          <ScrollView
            ref={supportScrollRef}
            style={styles.scroll}
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: scrollPaddingBottom },
            ]}
            showsVerticalScrollIndicator={false}
          >
            {supportError && (
              <ThemedText style={[styles.errorText, { color: primary }]}>
                {supportError}
              </ThemedText>
            )}
            {supportMessages.map((msg) => {
              const isFromAdmin = msg.sender === 'admin';
              const isOwnMessage = isAdminMessages ? isFromAdmin : !isFromAdmin;
              const showOnLeft = !isOwnMessage;
              return (
                <View
                  key={msg.id}
                  style={[
                    styles.messageRow,
                    showOnLeft ? styles.messageRowLeft : styles.messageRowRight,
                  ]}
                >
                  {showOnLeft && (
                    <View
                      style={[
                        styles.avatar,
                        { backgroundColor: isFromAdmin ? primary : border },
                      ]}
                    >
                      <MaterialIcons
                        name={isFromAdmin ? 'headset-mic' : 'person'}
                        size={20}
                        color="#FFF"
                      />
                    </View>
                  )}
                  <View
                    style={[
                      styles.bubble,
                      showOnLeft
                        ? [styles.bubbleLeft, { backgroundColor: border }]
                        : [styles.bubbleRight, { backgroundColor: primary }],
                    ]}
                  >
                    <ThemedText
                      style={[
                        styles.bubbleText,
                        isOwnMessage && styles.bubbleTextWhite,
                      ]}
                    >
                      {msg.message}
                    </ThemedText>
                    <ThemedText
                      style={[
                        styles.bubbleTime,
                        isOwnMessage
                          ? styles.bubbleTimeWhite
                          : { color: textMuted },
                      ]}
                    >
                      {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </ThemedText>
                  </View>
                  {!showOnLeft && (
                    <View style={[styles.avatar, { backgroundColor: primary }]}>
                      <MaterialIcons
                        name={isFromAdmin ? 'headset-mic' : 'person'}
                        size={20}
                        color="#FFF"
                      />
                    </View>
                  )}
                </View>
              );
            })}
            {supportSending && (
              <View style={[styles.messageRow, styles.messageRowRight]}>
                <View
                  style={[
                    styles.bubble,
                    styles.bubbleRight,
                    { backgroundColor: `${primary}80` },
                  ]}
                >
                  <ThemedText
                    style={[styles.bubbleText, styles.bubbleTextWhite]}
                  >
                    Отправка...
                  </ThemedText>
                </View>
              </View>
            )}
          </ScrollView>

          <View
            style={[
              styles.inputBar,
              {
                borderTopColor: border,
                backgroundColor: background,
                paddingHorizontal: getAdaptivePadding(windowHeight, 10, 16),
                paddingTop: inputBarPaddingBase,
                paddingBottom: inputBarBottomPadding,
              },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputFlex,
                  {
                    color: text,
                    borderColor: border,
                    backgroundColor: cardBackground,
                  },
                ]}
                placeholder="Напишите сообщение..."
                placeholderTextColor={textMuted}
                cursorColor={text}
                selectionColor={`${primary}40`}
                value={supportInputValue}
                onChangeText={setSupportInputValue}
                multiline
                maxLength={1000}
                editable={!supportSending}
              />
              <Pressable
                onPress={handleSendSupportMessage}
                disabled={!supportInputValue.trim() || supportSending}
                style={({ pressed }) => [
                  styles.sendButton,
                  { backgroundColor: primary },
                  (pressed || !supportInputValue.trim() || supportSending) &&
                    styles.sendButtonDisabled,
                ]}
              >
                <MaterialIcons name="send" size={22} color="#FFF" />
              </Pressable>
            </View>
          </View>
        </ThemedView>
      </View>
    </KeyboardAvoidingView>
  );
}

