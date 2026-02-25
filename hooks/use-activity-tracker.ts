import { useEffect, useRef, useCallback, useState } from 'react';
import { Accelerometer } from 'expo-sensors';
import { Subscription } from 'expo-sensors/build/Pedometer';

import { useActivityTrackerStore } from '@/stores/activity-tracker-store';

// Threshold для определения сидя/стоя (в g, где 1g = 9.8 m/s²)
// Expo Accelerometer возвращает значения в g, не в m/s²
// При сидении: ~1.0-1.1g (малые колебания)
// При стоянии/ходьбе: 1.2-2.0g (значительные колебания)
const STANDING_THRESHOLD = 1.05; // Порог для определения "стояния" (>1.15g)
const MOVEMENT_WINDOW = 500; // Окно анализа в мс

export function useActivityTracker() {
  const {
    isTracking,
    statistics,
    postureStartTime,
    lastPosture,
    requestStartTracking,
    requestStopTracking,
    setPostureStartTime,
    setLastPosture,
    updateStatistics,
  } = useActivityTrackerStore();

  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const subscriptionRef = useRef<Subscription | null>(null);
  const movementBufferRef = useRef<number[]>([]);
  const lastUpdateRef = useRef<number>(Date.now());
  const isTrackingRef = useRef(isTracking);

  // Обновляем ref при изменении isTracking
  isTrackingRef.current = isTracking;

  // Проверка доступности акселерометра
  useEffect(() => {
    const checkAvailability = async () => {
      const available = await Accelerometer.isAvailableAsync();
      console.log('[ActivityTracker] Accelerometer available:', available);
      setIsAvailable(available);
    };
    checkAvailability();
  }, []);

  // Запрос разрешений на датчики
  const requestPermission = useCallback(async (): Promise<boolean> => {
    try {
      const available = await Accelerometer.isAvailableAsync();
      if (!available) {
        console.log('[ActivityTracker] Accelerometer not available');
        return false;
      }

      console.log('[ActivityTracker] Requesting permission...');
      const { status } = await Accelerometer.requestPermissionsAsync();
      console.log('[ActivityTracker] Permission status:', status);

      return status === 'granted';
    } catch (error) {
      console.error('[ActivityTracker] Error requesting permission:', error);
      return false;
    }
  }, []);

  // Определение позы по данным акселерометра
  const detectPosture = useCallback((acceleration: number): 'sitting' | 'standing' => {
    return acceleration > STANDING_THRESHOLD ? 'standing' : 'sitting';
  }, []);

  // Стабильный callback для обработки данных - используем рефы для доступа к актуальным значениям
  const handleAccelerometerData = useCallback((data: { x: number; y: number; z: number }) => {
    if (!isTrackingRef.current) return;

    // Вычисляем общее ускорение
    const acceleration = Math.sqrt(data.x ** 2 + data.y ** 2 + data.z ** 2);

    // Лог каждое измерение для отладки (редко чтобы не спамить)
    if (Math.random() < 0.05) {
      console.log('[ActivityTracker] Raw data:', {
        accel: acceleration.toFixed(2),
        x: data.x.toFixed(1),
        y: data.y.toFixed(1),
        z: data.z.toFixed(1),
      });
    }

    // Добавляем в буфер
    movementBufferRef.current.push(acceleration);

    // Ограничиваем размер буфера
    if (movementBufferRef.current.length > 10) {
      movementBufferRef.current.shift();
    }

    const now = Date.now();
    const timeDelta = now - lastUpdateRef.current;

    // Обновляем статистику каждые MOVEMENT_WINDOW мс
    if (timeDelta >= MOVEMENT_WINDOW && movementBufferRef.current.length > 0) {
      // Среднее ускорение за период
      const avgAcceleration =
        movementBufferRef.current.reduce((a, b) => a + b, 0) /
        movementBufferRef.current.length;

      const currentPosture = detectPosture(avgAcceleration);
      const elapsedSeconds = timeDelta / 1000;

      // Всегда получаем актуальное состояние из store (callback может быть со старым замыканием)
      const state = useActivityTrackerStore.getState();
      const currentLastPosture = state.lastPosture;
      const currentPostureStartTime = state.postureStartTime;

      // Лог для отладки позы
      if (Math.random() < 0.1) {
        console.log('[ActivityTracker] Posture check:', {
          avg: avgAcceleration.toFixed(3),
          posture: currentPosture,
          last: currentLastPosture,
          elapsed: elapsedSeconds.toFixed(1) + 's',
        });
      }

      // Обновляем статистику
      state.updateStatistics((prev) => {
        const newStats = { ...prev };

        // Всегда добавляем прошедшее время к текущей позе (каждые 500ms)
        if (currentPosture === 'sitting') {
          newStats.totalSittingTime += elapsedSeconds;
        } else {
          newStats.totalStandingTime += elapsedSeconds;
        }

        // Если поза изменилась - фиксируем интервал и счетчик вставаний
        if (currentLastPosture !== currentPosture && currentLastPosture !== 'unknown') {
          console.log('[ActivityTracker] POSTURE CHANGED:', currentLastPosture, '->', currentPosture);

          if (currentPostureStartTime) {
            const intervalDuration = (now - currentPostureStartTime) / 1000;
            newStats.intervals.push({
              start: currentPostureStartTime,
              end: now,
              duration: intervalDuration,
              type: currentLastPosture,
            });
          }

          if (currentLastPosture === 'sitting' && currentPosture === 'standing') {
            newStats.standUpCount += 1;
            newStats.lastStandUpTime = now;
          }
        }

        newStats.currentPosture = currentPosture;
        return newStats;
      });

      // Обновляем время начала текущей позы при смене позы
      if (currentLastPosture !== currentPosture) {
        state.setPostureStartTime(now);
        state.setLastPosture(currentPosture);
      }

      lastUpdateRef.current = now;
    }
  }, [detectPosture]); // Стабильный callback - читаем state из getState()

  // Подписка на акселерометр - подписываемся один раз при монтировании
  useEffect(() => {
    console.log('[ActivityTracker] Setting up accelerometer listener');

    const setupSubscription = async () => {
      try {
        // Устанавливаем частоту обновления
        Accelerometer.setUpdateInterval(100);

        // Подписываемся
        subscriptionRef.current = Accelerometer.addListener(handleAccelerometerData);
        console.log('[ActivityTracker] Subscribed to accelerometer');
      } catch (error) {
        console.error('[ActivityTracker] Error subscribing:', error);
      }
    };

    setupSubscription();

    // Отписка при размонтировании
    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.remove();
        subscriptionRef.current = null;
        console.log('[ActivityTracker] Unsubscribed from accelerometer');
      }
    };
  }, [handleAccelerometerData]);

  // Завершение интервала при остановке трекера
  useEffect(() => {
    if (!isTracking && lastPosture !== 'unknown' && postureStartTime) {
      const now = Date.now();
      const intervalDuration = (now - postureStartTime) / 1000;

      updateStatistics((prev) => {
        const newStats = { ...prev };
        newStats.intervals.push({
          start: postureStartTime,
          end: now,
          duration: intervalDuration,
          type: lastPosture,
        });

        if (lastPosture === 'sitting') {
          newStats.totalSittingTime += intervalDuration;
        } else {
          newStats.totalStandingTime += intervalDuration;
        }

        return newStats;
      });
    }
  }, [isTracking, lastPosture, postureStartTime, updateStatistics]);

  return {
    isTracking,
    statistics,
    isAvailable,
    requestPermission,
    startTracking: requestStartTracking,
    stopTracking: requestStopTracking,
  };
}
