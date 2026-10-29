import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FullWindowOverlay } from 'react-native-screens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ProductUi } from '@/constants/theme';

type ToastIcon = React.ComponentProps<typeof MaterialIcons>['name'];

interface Toast {
  id: string;
  title: string;
  description?: string;
  /**
   * Figma «Тост», the same on iOS and Android: `success` — solid green, `error` — dark red with an
   * optional action («Повторить»), `info` — a neutral notice on the dark surface.
   */
  variant: 'success' | 'error' | 'info';
  duration?: number;
  /** Icon instead of the variant's own (e.g. `wifi-off` for a lost connection). */
  icon?: ToastIcon;
  /** A button in the toast; pressing it also closes the toast. */
  action?: { label: string; onPress: () => void };
}

/** Toasts of the product UI are always dark: they sit over any screen. */
const TOAST = ProductUi.dark;

const TOAST_COLORS: Record<Toast['variant'], string> = {
  success: TOAST.success,
  error: TOAST.dangerSoft,
  info: TOAST.surface,
};

const TOAST_ICONS: Record<Toast['variant'], ToastIcon> = {
  success: 'check-circle',
  error: 'error',
  info: 'info',
};

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
  const insets = useSafeAreaInsets();

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

  return (
    <ToastContext.Provider value={{ show, hide }}>
      {children}
      {toasts.length > 0 && (
        <FullWindowOverlay>
          <View style={styles.modalRoot} pointerEvents="box-none">
            {toasts.map((toast) => {
              const anim = toast.animation;
              const backgroundColor = TOAST_COLORS[toast.variant];
              const icon = toast.icon ?? TOAST_ICONS[toast.variant];
              const isError = toast.variant === 'error';
              const isSuccess = toast.variant === 'success';
              const isInfo = toast.variant === 'info';

              return (
                <Animated.View
                  key={toast.id}
                  accessibilityRole="alert"
                  accessibilityLiveRegion="polite"
                  style={[
                    styles.toast,
                    isError && styles.errorToast,
                    isSuccess && styles.successToast,
                    isInfo && styles.infoToast,
                    {
                      // Below the status bar, the notch or the Dynamic Island on any phone.
                      top: insets.top + 8,
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
                      size={isSuccess ? 24 : 22}
                      color={isError ? TOAST.danger : '#FFFFFF'}
                      style={styles.icon}
                    />
                    <View style={styles.textContainer}>
                      <Text style={[styles.title, isSuccess && styles.successTitle]}>{toast.title}</Text>
                      {toast.description && (
                        <Text style={[styles.description, !isSuccess && styles.mutedDescription]}>{toast.description}</Text>
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
    borderColor: `${TOAST.danger}99`,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  infoToast: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: `rgba(${TOAST.fgRgb}, 0.1)`,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  mutedDescription: {
    fontSize: 13,
    color: `rgba(${TOAST.fgRgb}, 0.75)`,
    opacity: 1,
  },
  actionButton: {
    marginLeft: 12,
    borderRadius: 10,
    paddingVertical: 7,
    paddingHorizontal: 12,
    backgroundColor: `rgba(${TOAST.fgRgb}, 0.12)`,
  },
  actionLabel: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
