import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { FullWindowOverlay } from 'react-native-screens';

interface Toast {
  id: string;
  title: string;
  description?: string;
  variant?: 'default' | 'destructive' | 'success';
  duration?: number;
}

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
        return '#10B981';
      default:
        return '#114A65';
    }
  };

  const getToastIcon = (variant?: string) => {
    switch (variant) {
      case 'destructive':
        return 'error' as const;
      case 'success':
        return 'check-circle' as const;
      default:
        return 'info' as const;
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
              const icon = getToastIcon(toast.variant);

              return (
                <Animated.View
                  key={toast.id}
                  style={[
                    styles.toast,
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
                      size={24}
                      color="#FFFFFF"
                      style={styles.icon}
                    />
                    <View style={styles.textContainer}>
                      <Text style={styles.title}>{toast.title}</Text>
                      {toast.description && (
                        <Text style={styles.description}>{toast.description}</Text>
                      )}
                    </View>
                  </View>
                  <Pressable
                    onPress={() => hide(toast.id)}
                    style={styles.closeButton}
                    hitSlop={8}
                  >
                    <MaterialIcons name="close" size={20} color="#FFFFFF" />
                  </Pressable>
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
});
