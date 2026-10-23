import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FullWindowOverlay } from 'react-native-screens';

import { ProductUi } from '@/constants/theme';

type ToastIcon = React.ComponentProps<typeof MaterialIcons>['name'];

interface Toast {
  id: string;
  title: string;
  description?: string;
  /** `error` — the dark product UI error with an optional action («Повторить»). */
  variant?: 'default' | 'destructive' | 'success' | 'error';
  duration?: number;
  /** Icon instead of the variant's own (e.g. `wifi-off` for a lost connection). */
  icon?: ToastIcon;
  /** A button in the toast; pressing it also closes the toast. */
  action?: { label: string; onPress: () => void };
}

/** Errors of the product UI are always dark: they sit over any screen. */
const ERROR_TOAST = ProductUi.dark;

interface ToastContextType {
  show: (toast: Omit<Toast, 'id'>) => void;
  hide: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<(Toast & { animation: Animated.Value })[]>([]);
  const animations = useRef(new Map<string, Animated.Value>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const nextId = useRef(0);

  const hide = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) clearTimeout(timer);
    timers.current.delete(id);
    const animation = animations.current.get(id);
    if (!animation) return;
    Animated.timing(animation, { toValue: 0, duration: 300, useNativeDriver: true }).start(({ finished }) => {
      if (!finished) return;
      animations.current.delete(id);
      setToasts((previous) => previous.filter((toast) => toast.id !== id));
    });
  }, []);

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = String(++nextId.current);
    const animation = new Animated.Value(0);
    const entry = { ...toast, id, duration: toast.duration ?? 3000, animation };
    animations.current.set(id, animation);
    setToasts((previous) => [...previous, entry]);
    Animated.timing(animation, { toValue: 1, duration: 300, useNativeDriver: true }).start();
    if (entry.duration > 0) timers.current.set(id, setTimeout(() => hide(id), entry.duration));
  }, [hide]);

  useEffect(() => {
    const activeTimers = timers.current;
    const activeAnimations = animations.current;
    return () => {
      activeTimers.forEach(clearTimeout);
      activeTimers.clear();
      activeAnimations.forEach((animation) => animation.stopAnimation());
      activeAnimations.clear();
    };
  }, []);

  const getToastColor = (variant?: string) => {
    switch (variant) {
      case 'destructive':
        return '#B8400E';
      case 'success':
        return ERROR_TOAST.success;
      case 'error':
        return ERROR_TOAST.dangerSoft;
      default:
        return '#114A65';
    }
  };

  const getToastIcon = (variant?: string): ToastIcon => {
    switch (variant) {
      case 'destructive':
      case 'error':
        return 'error';
      case 'success':
        return 'check-circle';
      default:
        return 'info';
    }
  };

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toasts.length > 0 && (
        <FullWindowOverlay>
          <View style={styles.modalRoot} pointerEvents="box-none">
            {toasts.map((toast) => {
              const anim = toast.animation;
              const backgroundColor = getToastColor(toast.variant);
              const icon = toast.icon ?? getToastIcon(toast.variant);
              const isError = toast.variant === 'error';
              const isSuccess = toast.variant === 'success';

              return (
                <Animated.View
                  key={toast.id}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.toast,
                    isError && styles.errorToast,
                    isSuccess && styles.successToast,
                    {
                      backgroundColor,
                      opacity: anim ?? 1,
                      transform: [
                        {
                          translateY: anim
                            ? anim.interpolate({
                                inputRange: [0, 1],
                                outputRange: [-100, 0],
                              })
                            : 0,
                        },
                      ],
                    },
                  ]}
                >
                  <View style={styles.toastContent}>
                    <MaterialIcons
                      name={icon}
                      size={isError ? 22 : 24}
                      color={isError ? ERROR_TOAST.danger : '#FFFFFF'}
                      style={styles.icon}
                    />
                    <View style={styles.textContainer}>
                      <Text style={[styles.title, isSuccess && styles.successTitle]}>{toast.title}</Text>
                      {toast.description && (
                        <Text style={[styles.description, isError && styles.errorDescription]}>{toast.description}</Text>
                      )}
                    </View>
                  </View>
                  {toast.action ? (
                    <Pressable
                      onPress={() => {
                        hide(toast.id);
                        toast.action?.onPress();
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [styles.actionButton, pressed && { opacity: 0.8 }]}
                    >
                      <Text style={styles.actionLabel}>{toast.action.label}</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => hide(toast.id)}
                      style={styles.closeButton}
                      hitSlop={8}
                      accessibilityRole="button"
                      accessibilityLabel="Закрыть уведомление"
                    >
                      <MaterialIcons name="close" size={20} color="#FFFFFF" />
                    </Pressable>
                  )}
                </Animated.View>
              );
            })}
          </View>
        </FullWindowOverlay>
      )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return context;
}

const styles = StyleSheet.create({
  modalRoot: {
    flex: 1,
    pointerEvents: 'box-none',
  },
  toast: {
    position: 'absolute',
    top: 60,
    left: 16,
    right: 16,
    zIndex: 1,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 24,
  },
  toastContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  icon: {
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  description: {
    color: '#FFFFFF',
    fontSize: 14,
    opacity: 0.9,
    marginTop: 2,
  },
  closeButton: {
    marginLeft: 12,
    padding: 4,
  },
  successToast: {
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
  },
  successTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  errorToast: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `${ERROR_TOAST.danger}99`,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  errorDescription: {
    fontSize: 13,
    color: `rgba(${ERROR_TOAST.fgRgb}, 0.75)`,
    opacity: 1,
  },
  actionButton: {
    marginLeft: 12,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: `rgba(${ERROR_TOAST.fgRgb}, 0.12)`,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
