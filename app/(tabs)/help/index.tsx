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
  Modal,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PageLoader } from '@/components/ui';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { chatStorage } from '@/lib/storage';
import { useAuthStore } from '@/stores/auth-store';
import {
  createSupportTicket,
  getMySupportTickets,
  type SupportTicket,
} from '@/lib/chat-api';
import { helpStyles as styles } from '../../../src/styles/help';

type ChatMessage = { from: 'user' | 'bot'; text: string };

type Topic = {
  id: string;
  title: string;
  description: string;
  icon: React.ComponentProps<typeof MaterialIcons>['name'];
  questions: string[];
};

const TOPICS: Topic[] = [
  {
    id: 'booking',
    title: 'Бронирование комнат',
    description: 'Найти и забронировать переговорную или кабинет',
    icon: 'room',
    questions: [
      'Как забронировать комнату?',
      'Как изменить или отменить бронь?',
      'Почему комната недоступна?',
      'Где посмотреть мои бронирования?',
      'Что происходит, если я опоздал?',
    ],
  },
  {
    id: 'requests',
    title: 'Сервисные заявки',
    description: 'Клининг, КТО, административные заявки',
    icon: 'build',
    questions: [
      'Как создать заявку?',
      'Какие типы заявок доступны?',
      'Как прикрепить фото?',
      'Как посмотреть статус?',
      'Кто обрабатывает заявку?',
    ],
  },
  {
    id: 'calculator',
    title: 'Калькулятор высоты стола',
    description: 'Подобрать комфортную высоту стола под себя',
    icon: 'tune',
    questions: [
      'Как работает калькулятор?',
      'Нужно ли вводить вес?',
      'В чём разница «сидя» / «стоя»?',
      'Насколько точны рекомендации?',
    ],
  },
  {
    id: 'health',
    title: 'Хелси-уведомления',
    description: 'Напоминания встать, пройтись и сделать перерыв',
    icon: 'notifications',
    questions: [
      'Почему пришло уведомление «пора встать»?',
      'Как выбрать тайминг?',
      'Как включить / выключить уведомления?',
      'Работают ли уведомления во время встреч?',
      'Где посмотреть историю уведомлений?',
    ],
  },
  {
    id: 'smart-home',
    title: 'Умный дом',
    description: 'Управление светом, климатом и устройствами офиса',
    icon: 'home',
    questions: [
      'Что такое «умный дом» в WorkFlow?',
      'Какие устройства я могу управлять?',
      'Почему у меня есть / нет доступа?',
      'В каких кабинетах мне доступно управление?',
      'Что делать, если устройство не отвечает?',
    ],
  },
  {
    id: 'statistics',
    title: 'Статистика',
    description: 'Загрузка комнат, активность, отчёты',
    icon: 'insert-chart',
    questions: [
      'Какие данные доступны?',
      'За какой период?',
      'Что означают показатели?',
      'Можно ли выгрузить отчёт?',
    ],
  },
  {
    id: 'errors',
    title: 'Ошибки и поддержка',
    description: 'Ошибки, инструкции, вопросы по работе системы',
    icon: 'warning',
    questions: [
      'Ошибка сервера — что делать?',
      'Не работает бронирование',
      'Нет доступа к умному дому',
      'Не приходят уведомления',
      'Куда обратиться за помощью?',
    ],
  },
  {
    id: 'profile',
    title: 'Профиль и доступы',
    description: 'Настройки, роли, доступы к офисам',
    icon: 'person',
    questions: [
      'Где изменить данные профиля?',
      'Как работают мои доступы?',
      'Почему у меня ограниченные права?',
      'Кто может изменить мои доступы?',
    ],
  },
];

const INITIAL_MESSAGE: ChatMessage = {
  from: 'bot',
  text: 'Выберите, с чем хотите работать 👉',
};

function getChatStorageKey(token: string | null) {
  return token ? `chat-messages-${token}` : 'chat-messages';
}

function getAdaptivePadding(height: number, min: number, max: number): number {
  const ratio = height / 812;
  return Math.round(Math.min(max, Math.max(min, min * ratio + (max - min) * 0.3)));
}

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const token = useAuthStore((s) => s.token);
  const role = useAuthStore((s) => s.role);
  const isAdminMessages = role === 'admin-worker';
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const background = useThemeColor({}, 'background');
  const cardBackground = useThemeColor({}, 'cardBackground');

  const [innerChatTab, setInnerChatTab] = useState<'bot' | 'support'>('bot');

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportFormValue, setSupportFormValue] = useState('');
  const [supportFormSubmitting, setSupportFormSubmitting] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);
  const [myTickets, setMyTickets] = useState<SupportTicket[]>([]);
  const [loadingTickets, setLoadingTickets] = useState(false);

  const scrollRef = useRef<ScrollView>(null);
  const supportFormScrollRef = useRef<ScrollView>(null);

  const storageKey = getChatStorageKey(token);

  useEffect(() => {
    chatStorage.getItem(storageKey).then((saved) => {
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 1) {
            setMessages(parsed);
            setShowTopics(false);
          }
        } catch {
          chatStorage.removeItem(storageKey);
        }
      }
    });
  }, [storageKey]);

  useEffect(() => {
    if (messages.length > 1) {
      chatStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSubmit = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isSending) return;

    setMessages((prev) => [...prev, { from: 'user', text: trimmed }]);
    setInputValue('');
    setShowTopics(false);
    setSelectedTopic(null);
    setIsSending(true);
    setIsBotTyping(true);
    setError(null);

    const { sendChatMessage } = await import('@/lib/chat-api');
    const result = await sendChatMessage(trimmed);

    if (result.ok) {
      const botText = result.data.answer ?? 'Не получилось обработать ответ.';
      setMessages((prev) => [...prev, { from: 'bot', text: botText }]);
    } else {
      setError(result.error);
      setMessages((prev) => [...prev, { from: 'bot', text: result.error }]);
    }
    setIsSending(false);
    setIsBotTyping(false);
  }, [inputValue, isSending]);

  const handleTopicSelect = useCallback((topicId: string) => {
    setSelectedTopic(topicId);
    setShowTopics(false);
  }, []);

  const handleQuestionSelect = useCallback(async (question: string) => {
    setSelectedTopic(null);
    setShowTopics(false);
    setMessages((prev) => [...prev, { from: 'user', text: question }]);
    setIsSending(true);
    setIsBotTyping(true);
    setError(null);

    const { sendChatMessage } = await import('@/lib/chat-api');
    const result = await sendChatMessage(question);

    if (result.ok) {
      const botText = result.data.answer ?? 'Не получилось обработать ответ.';
      setMessages((prev) => [...prev, { from: 'bot', text: botText }]);
    } else {
      setError(result.error);
      setMessages((prev) => [...prev, { from: 'bot', text: result.error }]);
    }
    setIsSending(false);
    setIsBotTyping(false);
  }, []);

  const handleBackToTopics = useCallback(() => {
    setSelectedTopic(null);
    setShowTopics(true);
  }, []);

  const handleShowTopicsMenu = useCallback(() => {
    setSelectedTopic(null);
    setShowTopics(true);
  }, []);

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as const);
    }
  }, [router]);

  const loadOrCreateSupportTicket = useCallback(
    async (initialMessage: string) => {
      setSupportFormSubmitting(true);
      setSupportError(null);
      const result = await createSupportTicket(initialMessage);

      if (result.ok && result.data.ticket?.id) {
        const ticket = result.data.ticket;
        setMyTickets((prev) => [ticket, ...prev.filter((t) => t.id !== ticket.id)]);
        setShowSupportForm(false);
        setSupportFormValue('');
        router.push(`/(tabs)/help/chat/${ticket.id}` as const);
      } else {
        setSupportError(result.error ?? 'Не удалось создать обращение. Попробуйте ещё раз.');
      }
      setSupportFormSubmitting(false);
    },
    [router]
  );

  const handleSupportFormSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      const trimmed = supportFormValue.trim();
      if (!trimmed || supportFormSubmitting) return;
      loadOrCreateSupportTicket(trimmed);
    },
    [supportFormValue, supportFormSubmitting, loadOrCreateSupportTicket]
  );

  const openSupportTicket = useCallback(
    (ticket: SupportTicket) => {
      router.push(`/(tabs)/help/chat/${ticket.id}` as const);
    },
    [router]
  );

  useEffect(() => {
    if (!token) return;
    if (isAdminMessages) {
      setLoadingTickets(true);
      getMySupportTickets()
        .then((res) => (res.ok ? setMyTickets(res.data.tickets ?? []) : setMyTickets([])))
        .catch(() => setMyTickets([]))
        .finally(() => setLoadingTickets(false));
      return;
    }
    if (innerChatTab !== 'support') return;
    setLoadingTickets(true);
    getMySupportTickets()
      .then((res) => (res.ok ? setMyTickets(res.data.tickets ?? []) : setMyTickets([])))
      .catch(() => setMyTickets([]))
      .finally(() => setLoadingTickets(false));
  }, [innerChatTab, token, isAdminMessages]);

  const scrollPaddingBottom = getAdaptivePadding(windowHeight, 16, 32);
  const inputBarPaddingBase = getAdaptivePadding(windowHeight, 8, 16);
  const inputBarBottomPadding = insets.bottom + inputBarPaddingBase;
  const keyboardVerticalOffset = 0;
  const modalBottomPadding = insets.bottom + getAdaptivePadding(windowHeight, 24, 40);

  if (isAdminMessages) {
    return (
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}
      >
        <View style={[styles.flex1, { paddingTop: insets.top }]}>
          <ThemedView style={styles.container}>
            <View style={[styles.header, { paddingTop: 12 }]}>
              <Pressable
                onPress={handleBack}
                style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
                hitSlop={12}
              >
                <MaterialIcons name="arrow-back" size={24} color={text} />
              </Pressable>
              <ThemedText type="title" style={styles.title}>
                Сообщения
              </ThemedText>
            </View>
            <View style={[styles.adminSubtitleWrap, { borderBottomColor: border }]}>
              <View style={[styles.supportAvatar, { backgroundColor: `${primary}33` }]}>
                <MaterialIcons name="chat" size={22} color={primary} />
              </View>
              <View>
                <ThemedText style={styles.supportTitle}>Чаты с клиентами</ThemedText>
                <ThemedText style={[styles.supportSubtitle, { color: textMuted }]}>
                  Ответьте на обращения пользователей
                </ThemedText>
              </View>
            </View>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                styles.supportTabContent,
                { paddingBottom: insets.bottom + 32 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              {loadingTickets ? (
                <View style={styles.ticketsLoading}>
                  <PageLoader size={80} />
                  <ThemedText style={[styles.ticketsLoadingText, { color: textMuted }]}>
                    Загрузка чатов...
                  </ThemedText>
                </View>
              ) : myTickets.length === 0 ? (
                <ThemedText style={[styles.ticketsLoadingText, { color: textMuted }]}>
                  Нет чатов с клиентами
                </ThemedText>
              ) : (
                <View style={styles.ticketsSection}>
                  {myTickets.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => openSupportTicket(t)}
                      style={({ pressed }) => [
                        styles.ticketRow,
                        { borderColor: border },
                        pressed && styles.pressed,
                      ]}
                    >
                      <View style={[styles.supportAvatar, { backgroundColor: `${primary}20` }]}>
                        <MaterialIcons name="person" size={22} color={primary} />
                      </View>
                      <View style={styles.adminTicketInfo}>
                        <ThemedText style={styles.adminTicketName} numberOfLines={1}>
                          {t.client_name ?? t.client?.full_name ?? `Клиент #${t.id}`}
                        </ThemedText>
                        <ThemedText
                          style={[styles.ticketRowText, { color: textMuted }]}
                          numberOfLines={1}
                        >
                          {t.status === 'closed'
                            ? 'Закрыт'
                            : t.status === 'in_progress'
                            ? 'В работе'
                            : 'Открыт'}{' '}
                          · #{t.id}
                        </ThemedText>
                      </View>
                      <MaterialIcons name="chevron-right" size={24} color={textMuted} />
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
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
          <View style={[styles.header, { paddingTop: 12 }]}>
            <ThemedText type="title" style={styles.title}>
              Сообщение
            </ThemedText>
          </View>

          <View style={[styles.tabsRow, { backgroundColor: `${border}40` }]}>
            <Pressable
              onPress={() => setInnerChatTab('bot')}
              style={[
                styles.tab,
                innerChatTab === 'bot' && [styles.tabActive, { backgroundColor: primary }],
              ]}
            >
              <MaterialIcons
                name="smart-toy"
                size={20}
                color={innerChatTab === 'bot' ? '#FFF' : textMuted}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: innerChatTab === 'bot' ? '#FFF' : textMuted },
                ]}
              >
                Чат-бот
              </ThemedText>
            </Pressable>
            <Pressable
              onPress={() => setInnerChatTab('support')}
              style={[
                styles.tab,
                innerChatTab === 'support' && [styles.tabActive, { backgroundColor: primary }],
              ]}
            >
              <MaterialIcons
                name="headset-mic"
                size={20}
                color={innerChatTab === 'support' ? '#FFF' : textMuted}
              />
              <ThemedText
                style={[
                  styles.tabLabel,
                  { color: innerChatTab === 'support' ? '#FFF' : textMuted },
                ]}
              >
                Техподдержка
              </ThemedText>
            </Pressable>
          </View>

          {innerChatTab === 'support' ? (
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                styles.supportTabContent,
                { paddingBottom: insets.bottom + 32 },
              ]}
              showsVerticalScrollIndicator={false}
            >
              <Pressable
                onPress={() => setShowSupportForm(true)}
                style={({ pressed }) => [
                  styles.supportCard,
                  { borderColor: border },
                  pressed && styles.pressed,
                ]}
              >
                <View style={[styles.supportCardIcon, { backgroundColor: `${primary}20` }]}>
                  <MaterialIcons name="headset-mic" size={24} color={primary} />
                </View>
                <View style={styles.supportCardText}>
                  <ThemedText style={styles.supportCardTitle}>Написать в поддержку</ThemedText>
                  <ThemedText style={[styles.supportCardSubtitle, { color: textMuted }]}>
                    Опишите проблему — ответим в чате
                  </ThemedText>
                </View>
              </Pressable>
              {loadingTickets ? (
                <View style={styles.ticketsLoading}>
                  <PageLoader size={80} />
                  <ThemedText style={[styles.ticketsLoadingText, { color: textMuted }]}>
                    Загрузка обращений...
                  </ThemedText>
                </View>
              ) : myTickets.length > 0 ? (
                <View style={styles.ticketsSection}>
                  <ThemedText style={[styles.ticketsSectionTitle, { color: textMuted }]}>
                    Мои обращения
                  </ThemedText>
                  {myTickets.map((t) => (
                    <Pressable
                      key={t.id}
                      onPress={() => openSupportTicket(t)}
                      style={({ pressed }) => [
                        styles.ticketRow,
                        { borderColor: border },
                        pressed && styles.pressed,
                      ]}
                    >
                      <ThemedText style={styles.ticketRowText} numberOfLines={1}>
                        #{t.id} ·{' '}
                        {t.status === 'closed'
                          ? 'Закрыт'
                          : t.status === 'in_progress'
                          ? 'В работе'
                          : 'Открыт'}
                      </ThemedText>
                      <MaterialIcons name="chevron-right" size={24} color={textMuted} />
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </ScrollView>
          ) : (
            <>
              <ScrollView
                ref={scrollRef}
                style={styles.scroll}
                contentContainerStyle={[
                  styles.scrollContent,
                  { paddingBottom: scrollPaddingBottom },
                ]}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
              >
                {showTopics && (
                  <View style={styles.topicsSection}>
                    {TOPICS.map((topic) => (
                      <Pressable
                        key={topic.id}
                        onPress={() => handleTopicSelect(topic.id)}
                        style={({ pressed }) => [
                          styles.topicCard,
                          { borderColor: border },
                          pressed && styles.pressed,
                        ]}
                      >
                        <View
                          style={[
                            styles.topicIcon,
                            { backgroundColor: `${primary}33` },
                          ]}
                        >
                          <MaterialIcons name={topic.icon} size={24} color={primary} />
                        </View>
                        <View style={styles.topicContent}>
                          <ThemedText style={styles.topicTitle}>{topic.title}</ThemedText>
                          <ThemedText style={[styles.topicDesc, { color: textMuted }]}>
                            {topic.description}
                          </ThemedText>
                        </View>
                      </Pressable>
                    ))}
                  </View>
                )}

                {selectedTopic && !showTopics && (
                  <View style={styles.questionsSection}>
                    <Pressable onPress={handleBackToTopics} style={styles.backLink}>
                      <MaterialIcons name="chevron-left" size={20} color={primary} />
                      <ThemedText style={[styles.backLinkText, { color: primary }]}>
                        Назад к темам
                      </ThemedText>
                    </Pressable>
                    <View style={[styles.questionsCard, { borderColor: border }]}>
                      <ThemedText style={styles.questionsTitle}>
                        {TOPICS.find((t) => t.id === selectedTopic)?.title}
                      </ThemedText>
                      <ThemedText style={[styles.questionsSubtitle, { color: textMuted }]}>
                        Выберите вопрос или напишите свой:
                      </ThemedText>
                      {TOPICS.find((t) => t.id === selectedTopic)?.questions.map(
                        (question, idx) => (
                          <Pressable
                            key={idx}
                            onPress={() => handleQuestionSelect(question)}
                            style={({ pressed }) => [
                              styles.questionButton,
                              { backgroundColor: `${border}40` },
                              pressed && styles.pressed,
                            ]}
                          >
                            <ThemedText style={styles.questionText}>{question}</ThemedText>
                          </Pressable>
                        )
                      )}
                      {selectedTopic === 'errors' && (
                        <Pressable
                          onPress={() => setShowSupportForm(true)}
                          style={({ pressed }) => [
                            styles.supportButton,
                            { borderColor: primary },
                            pressed && styles.pressed,
                          ]}
                        >
                          <MaterialIcons name="headset-mic" size={18} color={primary} />
                          <ThemedText
                            style={[styles.supportButtonText, { color: primary }]}
                          >
                            ИИ не помог — написать в поддержку
                          </ThemedText>
                        </Pressable>
                      )}
                    </View>
                  </View>
                )}

                {messages.map((msg, idx) => (
                  <View
                    key={idx}
                    style={[
                      styles.messageRow,
                      msg.from === 'bot'
                        ? styles.messageRowLeft
                        : styles.messageRowRight,
                    ]}
                  >
                    {msg.from === 'bot' && (
                      <View style={[styles.avatar, { backgroundColor: primary }]}>
                        <MaterialIcons name="smart-toy" size={20} color="#FFF" />
                      </View>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        msg.from === 'bot'
                          ? [styles.bubbleLeft, { backgroundColor: border }]
                          : [styles.bubbleRight, { backgroundColor: primary }],
                      ]}
                    >
                      <ThemedText
                        style={[
                          styles.bubbleText,
                          msg.from === 'user' && styles.bubbleTextWhite,
                        ]}
                      >
                        {msg.text}
                      </ThemedText>
                    </View>
                    {msg.from === 'user' && (
                      <View style={[styles.avatar, styles.avatarUser]}>
                        <MaterialIcons name="person" size={20} color="#FFF" />
                      </View>
                    )}
                  </View>
                ))}

                {isBotTyping && (
                  <View style={[styles.messageRow, styles.messageRowLeft]}>
                    <View style={[styles.avatar, { backgroundColor: primary }]}>
                      <MaterialIcons name="smart-toy" size={20} color="#FFF" />
                    </View>
                    <View
                      style={[
                        styles.bubble,
                        styles.bubbleLeft,
                        { backgroundColor: border },
                      ]}
                    >
                      <View style={styles.typingDots}>
                        <View style={[styles.dot, { backgroundColor: primary }]} />
                        <View
                          style={[
                            styles.dot,
                            styles.dot2,
                            { backgroundColor: primary },
                          ]}
                        />
                        <View
                          style={[
                            styles.dot,
                            styles.dot3,
                            { backgroundColor: primary },
                          ]}
                        />
                      </View>
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
                {error && (
                  <ThemedText style={[styles.errorText, { color: primary }]}>
                    {error}
                  </ThemedText>
                )}
                <View style={styles.inputRow}>
                  <Pressable
                    onPress={handleShowTopicsMenu}
                    style={({ pressed }) => [
                      styles.menuButton,
                      { backgroundColor: `${border}40` },
                      pressed && styles.pressed,
                    ]}
                  >
                    <MaterialIcons name="menu" size={24} color={text} />
                  </Pressable>
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
                    value={inputValue}
                    onChangeText={setInputValue}
                    onSubmitEditing={handleSubmit}
                    returnKeyType="send"
                    multiline
                    maxLength={2000}
                    editable={!isSending}
                  />
                  <Pressable
                    onPress={handleSubmit}
                    disabled={!inputValue.trim() || isSending}
                    style={({ pressed }) => [
                      styles.sendButton,
                      { backgroundColor: primary },
                      (pressed || !inputValue.trim() || isSending) &&
                        styles.sendButtonDisabled,
                    ]}
                  >
                    {isSending ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <MaterialIcons name="send" size={22} color="#FFF" />
                    )}
                  </Pressable>
                </View>
              </View>
            </>
          )}
        </ThemedView>
      </View>

      <Modal
        visible={showSupportForm}
        transparent
        animationType="slide"
        onRequestClose={() => !supportFormSubmitting && setShowSupportForm(false)}
      >
        <Pressable
          style={styles.modalBackdrop}
          onPress={() => !supportFormSubmitting && setShowSupportForm(false)}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardWrap}
            keyboardVerticalOffset={keyboardVerticalOffset}
          >
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: background,
                  paddingTop: insets.top + 24,
                  paddingBottom: modalBottomPadding,
                },
              ]}
              onStartShouldSetResponder={() => true}
            >
              <View style={styles.modalHeader}>
                <View style={styles.modalTitleRow}>
                  <MaterialIcons name="headset-mic" size={24} color={primary} />
                  <ThemedText style={styles.modalTitle}>
                    Обращение в поддержку
                  </ThemedText>
                </View>
                <Pressable
                  onPress={() => !supportFormSubmitting && setShowSupportForm(false)}
                  style={({ pressed }) => [styles.closeButton, pressed && styles.pressed]}
                >
                  <MaterialIcons name="close" size={24} color={textMuted} />
                </Pressable>
              </View>
              <ScrollView
                ref={supportFormScrollRef}
                style={styles.modalScroll}
                contentContainerStyle={styles.modalScrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <ThemedText style={[styles.modalDesc, { color: textMuted }]}>
                  Опишите вашу проблему. Администратор свяжется с вами в чате.
                </ThemedText>
                <TextInput
                  style={[
                    styles.modalTextArea,
                    {
                      color: text,
                      borderColor: border,
                      backgroundColor: cardBackground,
                    },
                  ]}
                  placeholder="Опишите проблему..."
                  placeholderTextColor={textMuted}
                  cursorColor={text}
                  selectionColor={`${primary}40`}
                  value={supportFormValue}
                  onChangeText={setSupportFormValue}
                  onFocus={() => {
                    setTimeout(
                      () =>
                        supportFormScrollRef.current?.scrollToEnd({ animated: true }),
                      300
                    );
                  }}
                  multiline
                  numberOfLines={4}
                  editable={!supportFormSubmitting}
                />
                {supportError && (
                  <ThemedText style={[styles.supportError, { color: primary }]}>
                    {supportError}
                  </ThemedText>
                )}
              </ScrollView>
              <View style={styles.modalActions}>
                <Button
                  title="Отмена"
                  variant="secondary"
                  onPress={() =>
                    !supportFormSubmitting && setShowSupportForm(false)
                  }
                  disabled={supportFormSubmitting}
                  style={styles.modalButton}
                />
                <Pressable
                  onPress={() => handleSupportFormSubmit()}
                  disabled={!supportFormValue.trim() || supportFormSubmitting}
                  style={({ pressed }) => [
                    styles.submitButton,
                    { backgroundColor: primary },
                    (pressed || !supportFormValue.trim() || supportFormSubmitting) &&
                      styles.sendButtonDisabled,
                  ]}
                >
                  {supportFormSubmitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MaterialIcons name="send" size={20} color="#FFF" />
                      <ThemedText style={styles.submitButtonText}>
                        Отправить
                      </ThemedText>
                    </>
                  )}
                </Pressable>
              </View>
            </View>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

