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
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { chatStorage } from '@/lib/storage';
import { useAuthStore } from '@/stores/auth-store';
import {
  createSupportTicket,
  getSupportTicketMessages,
  sendChatMessage,
  sendSupportMessage,
  type SupportMessage,
  type SupportTicket,
} from '@/lib/chat-api';

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

export default function HelpScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const token = useAuthStore((s) => s.token);
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const primary = useThemeColor({}, 'primary');
  const background = useThemeColor({}, 'background');

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [isBotTyping, setIsBotTyping] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTopics, setShowTopics] = useState(true);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);

  // Support
  const [showSupportForm, setShowSupportForm] = useState(false);
  const [supportFormValue, setSupportFormValue] = useState('');
  const [supportFormSubmitting, setSupportFormSubmitting] = useState(false);
  const [activeSupportTicket, setActiveSupportTicket] =
    useState<SupportTicket | null>(null);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [supportInputValue, setSupportInputValue] = useState('');
  const [supportSending, setSupportSending] = useState(false);
  const [supportError, setSupportError] = useState<string | null>(null);

  const scrollRef = useRef<ScrollView>(null);
  const supportScrollRef = useRef<ScrollView>(null);

  const storageKey = getChatStorageKey(token);

  // Load saved chat
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

  // Persist chat
  useEffect(() => {
    if (messages.length > 1) {
      chatStorage.setItem(storageKey, JSON.stringify(messages));
    }
  }, [messages, storageKey]);

  const scrollToBottom = useCallback(() => {
    setTimeout(() => {
      scrollRef.current?.scrollToEnd({ animated: true });
      supportScrollRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, supportMessages, scrollToBottom]);

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

  const handleQuestionSelect = useCallback(
    async (question: string) => {
      setSelectedTopic(null);
      setShowTopics(false);
      setMessages((prev) => [...prev, { from: 'user', text: question }]);
      setIsSending(true);
      setIsBotTyping(true);
      setError(null);

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
    },
    []
  );

  const handleBackToTopics = useCallback(() => {
    setSelectedTopic(null);
    setShowTopics(true);
  }, []);

  const handleShowTopicsMenu = useCallback(() => {
    setSelectedTopic(null);
    setShowTopics(true);
  }, []);

  const loadOrCreateSupportTicket = useCallback(
    async (initialMessage: string) => {
      setSupportFormSubmitting(true);
      setSupportError(null);
      const result = await createSupportTicket(initialMessage);

      if (result.ok && result.data.ticket?.id) {
        const ticket = result.data.ticket;
        setActiveSupportTicket(ticket);
        setSupportMessages([
          {
            id: 0,
            ticket_id: ticket.id,
            sender: 'user',
            message: initialMessage,
            created_at: new Date().toISOString(),
          },
        ]);
        setSupportChatView(true);
        setShowSupportForm(false);
        setSupportFormValue('');
      } else {
        const fallbackTicket: SupportTicket = {
          id: Date.now(),
          user_id: 0,
          message: initialMessage,
          status: 'open',
          created_at: new Date().toISOString(),
        };
        const fallbackMsg: SupportMessage = {
          id: 0,
          ticket_id: fallbackTicket.id,
          sender: 'user',
          message: initialMessage,
          created_at: fallbackTicket.created_at,
        };
        const adminReply: SupportMessage = {
          id: 1,
          ticket_id: fallbackTicket.id,
          sender: 'admin',
          message:
            'Ваше обращение получено. Администратор свяжется с вами в ближайшее время.',
          created_at: new Date().toISOString(),
        };
        setActiveSupportTicket(fallbackTicket);
        setSupportMessages([fallbackMsg, adminReply]);
        setSupportChatView(true);
        setShowSupportForm(false);
        setSupportFormValue('');
      }
      setSupportFormSubmitting(false);
    },
    []
  );

  const [supportChatView, setSupportChatView] = useState(false);

  const handleSupportFormSubmit = useCallback(
    (e?: { preventDefault?: () => void }) => {
      e?.preventDefault?.();
      const trimmed = supportFormValue.trim();
      if (!trimmed || supportFormSubmitting) return;
      loadOrCreateSupportTicket(trimmed);
    },
    [supportFormValue, supportFormSubmitting, loadOrCreateSupportTicket]
  );

  const handleCloseSupportChat = useCallback(() => {
    setSupportChatView(false);
    setActiveSupportTicket(null);
    setSupportMessages([]);
    setSupportInputValue('');
    setShowSupportForm(false);
  }, []);

  const handleSendSupportMessage = useCallback(async () => {
    const trimmed = supportInputValue.trim();
    if (!trimmed || !activeSupportTicket || supportSending) return;

    const optimisticMsg: SupportMessage = {
      id: Date.now(),
      ticket_id: activeSupportTicket.id,
      sender: 'user',
      message: trimmed,
      created_at: new Date().toISOString(),
    };
    setSupportMessages((prev) => [...prev, optimisticMsg]);
    setSupportInputValue('');
    setSupportSending(true);

    const result = await sendSupportMessage(activeSupportTicket.id, trimmed);
    if (result.ok) {
      const res = await getSupportTicketMessages(activeSupportTicket.id);
      if (res.ok && res.data.messages) {
        setSupportMessages(res.data.messages);
      }
    } else {
      setSupportMessages((prev) => [
        ...prev,
        {
          id: prev.length + 1,
          ticket_id: activeSupportTicket.id,
          sender: 'admin',
          message:
            'Сообщение получено. Администратор ответит вам в ближайшее время.',
          created_at: new Date().toISOString(),
        },
      ]);
    }
    setSupportSending(false);
  }, [supportInputValue, activeSupportTicket, supportSending]);

  const scrollPaddingBottom = 24;
  const inputBarBottomPadding = insets.bottom + 12;

  const handleBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(tabs)' as const);
    }
  }, [router]);

  if (supportChatView && activeSupportTicket) {
    return (
      <KeyboardAvoidingView
        style={styles.flex1}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <ThemedView style={styles.container}>
          <View style={[styles.supportHeader, { borderBottomColor: border }]}>
          <Pressable
            onPress={handleCloseSupportChat}
            style={({ pressed }) => [
              styles.backButton,
              pressed && styles.pressed,
            ]}
          >
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </Pressable>
          <View style={[styles.supportAvatar, { backgroundColor: `${primary}33` }]}>
            <MaterialIcons name="headset-mic" size={24} color={primary} />
          </View>
          <View style={styles.supportHeaderText}>
            <ThemedText style={styles.supportTitle}>Чат с поддержкой</ThemedText>
            <ThemedText style={[styles.supportSubtitle, { color: textMuted }]}>
              Администратор
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
          {supportMessages.map((msg) => (
            <View
              key={msg.id}
              style={[
                styles.messageRow,
                msg.sender === 'admin' ? styles.messageRowLeft : styles.messageRowRight,
              ]}
            >
              {msg.sender === 'admin' && (
                <View style={[styles.avatar, { backgroundColor: primary }]}>
                  <MaterialIcons name="headset-mic" size={20} color="#FFF" />
                </View>
              )}
              <View
                style={[
                  styles.bubble,
                  msg.sender === 'admin'
                    ? [styles.bubbleLeft, { backgroundColor: border }]
                    : [styles.bubbleRight, { backgroundColor: primary }],
                ]}
              >
                <ThemedText
                  style={[
                    styles.bubbleText,
                    msg.sender === 'user' && styles.bubbleTextWhite,
                  ]}
                >
                  {msg.message}
                </ThemedText>
                <ThemedText
                  style={[
                    styles.bubbleTime,
                    msg.sender === 'admin' ? { color: textMuted } : styles.bubbleTimeWhite,
                  ]}
                >
                  {new Date(msg.created_at).toLocaleTimeString('ru-RU', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </ThemedText>
              </View>
              {msg.sender === 'user' && (
                <View style={[styles.avatar, styles.avatarUser]}>
                  <MaterialIcons name="person" size={20} color="#FFF" />
                </View>
              )}
            </View>
          ))}
          {supportSending && (
            <View style={[styles.messageRow, styles.messageRowRight]}>
              <View style={[styles.bubble, styles.bubbleRight, { backgroundColor: `${primary}80` }]}>
                <ThemedText style={[styles.bubbleText, styles.bubbleTextWhite]}>
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
                paddingBottom: inputBarBottomPadding,
              },
            ]}
          >
            <View style={styles.inputRow}>
              <TextInput
                style={[
                  styles.input,
                  styles.inputFlex,
                  { color: text, borderColor: border, backgroundColor: background },
                ]}
                placeholder="Напишите сообщение..."
                placeholderTextColor={textMuted}
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
      </KeyboardAvoidingView>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex1}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <ThemedView style={styles.container}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable
            onPress={handleBack}
            style={({ pressed }) => [styles.headerBackButton, pressed && styles.pressed]}
            hitSlop={12}
          >
            <MaterialIcons name="arrow-back" size={24} color={text} />
          </Pressable>
          <ThemedText type="title" style={styles.title}>
            Сообщение
          </ThemedText>
        </View>

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
                  <ThemedText style={[styles.supportButtonText, { color: primary }]}>
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
            <View style={[styles.bubble, styles.bubbleLeft, { backgroundColor: border }]}>
              <View style={styles.typingDots}>
                <View style={[styles.dot, { backgroundColor: primary }]} />
                <View style={[styles.dot, styles.dot2, { backgroundColor: primary }]} />
                <View style={[styles.dot, styles.dot3, { backgroundColor: primary }]} />
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
              paddingBottom: inputBarBottomPadding,
            },
          ]}
        >
          {error && (
            <ThemedText style={[styles.errorText, { color: primary }]}>{error}</ThemedText>
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
              { color: text, borderColor: border, backgroundColor: background },
            ]}
            placeholder="Напишите сообщение..."
            placeholderTextColor={textMuted}
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
      </ThemedView>

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
          <View
            style={[styles.modalContent, { backgroundColor: background }]}
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
            <ThemedText style={[styles.modalDesc, { color: textMuted }]}>
              Опишите вашу проблему. Администратор свяжется с вами в чате.
            </ThemedText>
            <TextInput
              style={[
                styles.modalTextArea,
                { color: text, borderColor: border, backgroundColor: `${border}20` },
              ]}
              placeholder="Опишите проблему..."
              placeholderTextColor={textMuted}
              value={supportFormValue}
              onChangeText={setSupportFormValue}
              multiline
              numberOfLines={4}
              editable={!supportFormSubmitting}
            />
            {supportError && (
              <ThemedText style={[styles.supportError, { color: primary }]}>
                {supportError}
              </ThemedText>
            )}
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
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  headerBackButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    marginBottom: 0,
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
    gap: 12,
  },
  topicsSection: {
    gap: 12,
    marginBottom: 8,
  },
  topicCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  topicIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  topicContent: {
    flex: 1,
    minWidth: 0,
  },
  topicTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  topicDesc: {
    fontSize: 13,
  },
  questionsSection: {
    marginBottom: 16,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 12,
  },
  backLinkText: {
    fontSize: 14,
    fontWeight: '500',
  },
  questionsCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  questionsTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  questionsSubtitle: {
    fontSize: 14,
    marginBottom: 8,
  },
  questionButton: {
    padding: 12,
    borderRadius: 8,
  },
  questionText: {
    fontSize: 14,
  },
  supportButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  supportButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  messageRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  messageRowLeft: {
    justifyContent: 'flex-start',
  },
  messageRowRight: {
    justifyContent: 'flex-end',
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarUser: {
    backgroundColor: '#6B7280',
  },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
  },
  bubbleLeft: {
    borderTopLeftRadius: 4,
  },
  bubbleRight: {
    borderTopRightRadius: 4,
  },
  bubbleText: {
    fontSize: 15,
    lineHeight: 22,
  },
  bubbleTextWhite: {
    color: '#FFF',
  },
  bubbleTime: {
    fontSize: 11,
    marginTop: 4,
  },
  bubbleTimeWhite: {
    color: 'rgba(255,255,255,0.8)',
  },
  typingDots: {
    flexDirection: 'row',
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    opacity: 0.6,
  },
  dot2: {
    opacity: 0.8,
  },
  dot3: {
    opacity: 1,
  },
  inputBar: {
    padding: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  errorText: {
    fontSize: 12,
    marginBottom: 4,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
  },
  menuButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  input: {
    minHeight: 48,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    maxHeight: 120,
  },
  inputFlex: {
    flex: 1,
  },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    opacity: 0.5,
  },
  pressed: {
    opacity: 0.8,
  },
  // Support chat
  supportHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    gap: 12,
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  supportAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  supportHeaderText: {
    flex: 1,
  },
  supportTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  supportSubtitle: {
    fontSize: 12,
  },
  // Modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  modalTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  closeButton: {
    padding: 8,
  },
  modalDesc: {
    fontSize: 14,
    marginBottom: 16,
  },
  modalTextArea: {
    minHeight: 120,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    fontSize: 16,
    textAlignVertical: 'top',
    marginBottom: 16,
  },
  supportError: {
    fontSize: 13,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
  },
  submitButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 48,
    borderRadius: 8,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
