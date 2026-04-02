import React, { createContext, useContext, useState, useCallback } from 'react';
import { Animated, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [animations] = useState<Map<string, Animated.Value>>(new Map());

  const show = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).substring(7);
    const newToast: Toast = { id, duration: 3000, ...toast };

    animations.set(id, new Animated.Value(0));

    setToasts((prev) => [...prev, newToast]);

    Animated.timing(animations.get(id)!, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();

    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        hide(id);
      }, newToast.duration);
    }
  }, []);

  const hide = useCallback((id: string) => {
    const anim = animations.get(id);
    if (anim) {
      Animated.timing(anim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        animations.delete(id);
      });
    }
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
      {/*
        Отдельный Modal — иначе z-index не перекрывает другие Modal (шиты задач, пикеры).
        box-none: тапы мимо баннера уходят на контент под этим слоем.
      */}
      <Modal
        visible={toasts.length > 0}
        transparent
        animationType="none"
        statusBarTranslucent
        presentationStyle="overFullScreen"
        onRequestClose={() => {
          const last = toasts[toasts.length - 1];
          if (last) hide(last.id);
        }}
      >
        <View style={styles.modalRoot} pointerEvents="box-none">
          {toasts.map((toast) => {
            const anim = animations.get(toast.id);
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
      </Modal>
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
