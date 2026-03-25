import * as Haptics from 'expo-haptics';
import React, {
  cloneElement,
  isValidElement,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  RefreshControl,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { PageLoader } from './page-loader';

type ScrollableChildProps = {
  refreshControl?: React.ReactNode;
  contentContainerStyle?: object | object[];
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollBeginDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  onScrollEndDrag?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
  scrollEventThrottle?: number;
};

function scrollableProps(el: React.ReactElement): ScrollableChildProps {
  return el.props as ScrollableChildProps;
}

export interface PullToRefreshProps {
  refreshing: boolean;
  onRefresh: () => void;
  children: React.ReactElement;
  /** Size of the PageLoader in the refresh overlay (default 56) */
  loaderSize?: number;
  /** Optional top offset for the loader (e.g. for safe area) */
  topOffset?: number;
  /** Pull distance in px for reaching 100% progress (default 100) */
  pullDistance?: number;
  /** Minimum time to keep loader visible after refresh starts (default 2s) */
  minVisibleMs?: number;
  /** Height of the "pull zone" at top when refreshing — content stays shifted down so the loader is visible in this band (default 88) */
  refreshZoneHeight?: number;
  style?: ViewStyle;
}

/**
 * Wraps a ScrollView or FlatList to show PageLoader (Threads-style) during pull-to-refresh
 * instead of the native spinner. Hides the native RefreshControl indicator and overlays
 * our custom loader.
 */
export function PullToRefresh({
  refreshing,
  onRefresh,
  children,
  loaderSize = 56,
  topOffset = 24,
  pullDistance = 100,
  minVisibleMs = 2000,
  refreshZoneHeight = 70,
  style,
}: PullToRefreshProps) {
  const [pullProgress, setPullProgress] = useState(0);
  const [isVisible, setIsVisible] = useState(false);
  const refreshStartedAt = useRef<number | null>(null);
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hapticBucketRef = useRef(0);
  const minOffsetRef = useRef(0);
  const isInCooldownRef = useRef(false);
  const hasReachedFullPullRef = useRef(false);

  const scaleShared = useSharedValue(0.3);
  const pulseShared = useSharedValue(1);
  const opacityShared = useSharedValue(0.12);

  useEffect(() => {
    if (refreshing) {
      isInCooldownRef.current = false;
      refreshStartedAt.current = Date.now();
      setIsVisible(true);
      setPullProgress(1);
      hasReachedFullPullRef.current = true;
      hapticBucketRef.current = 100;
      opacityShared.value = withTiming(1);
      scaleShared.value = withSequence(
        withSpring(1.15, { damping: 8, stiffness: 300 }),
        withSpring(1, { damping: 15, stiffness: 200 })
      );
      pulseShared.value = withRepeat(
        withSequence(
          withTiming(1.08, { duration: 600, easing: Easing.bezier(0.42, 0, 0.58, 1) }),
          withTiming(1, { duration: 600, easing: Easing.bezier(0.42, 0, 0.58, 1) })
        ),
        -1,
        true
      );
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      return;
    }

    isInCooldownRef.current = true;
    pulseShared.value = withTiming(1);
    const startedAt = refreshStartedAt.current;
    const elapsed = startedAt ? Date.now() - startedAt : minVisibleMs;
    const wait = Math.max(minVisibleMs - elapsed, 0);

    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = setTimeout(() => {
      isInCooldownRef.current = false;
      setIsVisible(false);
      setPullProgress(0);
      hapticBucketRef.current = 0;
      refreshStartedAt.current = null;
      hasReachedFullPullRef.current = false;
      scaleShared.value = withTiming(0.3);
      opacityShared.value = withTiming(0.12);
    }, wait);

    return () => {
      if (hideTimerRef.current) {
        clearTimeout(hideTimerRef.current);
      }
    };
  }, [refreshing, minVisibleMs]);

  useEffect(() => {
    if (refreshing) return;
    const scaleTarget = 0.3 + pullProgress * 0.7;
    scaleShared.value = withSpring(scaleTarget, { damping: 12, stiffness: 180 });
    opacityShared.value = withTiming(Math.max(pullProgress, 0.12));
  }, [pullProgress, refreshing]);

  const triggerProgressHaptic = useCallback((bucket: number) => {
    if (bucket >= 100) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      setTimeout(() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }, 55);
      return;
    }
    if (bucket >= 80) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
      return;
    }
    if (bucket >= 60) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      return;
    }
    if (bucket >= 40) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    if (bucket >= 20) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      return;
    }
    if (bucket >= 10) {
      Haptics.selectionAsync().catch(() => {});
    }
  }, []);

  const onChildScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (refreshing) return;
      if (isInCooldownRef.current) return;
      const y = event.nativeEvent.contentOffset.y;
      if (y < minOffsetRef.current) minOffsetRef.current = y;
      const raw = Math.max(0, -y);
      const progress = Math.min(raw / pullDistance, 1);
      if (progress >= 1) {
        hasReachedFullPullRef.current = true;
      }
      const lockedProgress = hasReachedFullPullRef.current ? 1 : progress;
      setPullProgress(lockedProgress);
      setIsVisible(progress > 0.02);

      const bucket = Math.floor(progress * 10) * 10;
      if (bucket > hapticBucketRef.current && bucket > 0) {
        hapticBucketRef.current = bucket;
        triggerProgressHaptic(bucket);
      } else if (bucket < hapticBucketRef.current) {
        hapticBucketRef.current = bucket;
      }
    },
    [pullDistance, refreshing, triggerProgressHaptic]
  );

  const onScrollBeginDrag = useCallback(() => {
    minOffsetRef.current = 0;
    hasReachedFullPullRef.current = false;
  }, []);

  const onScrollEndDrag = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const p = scrollableProps(children);
      if (typeof p.onScrollEndDrag === 'function') {
        p.onScrollEndDrag(event);
      }
      if (refreshing) return;
      if (minOffsetRef.current < -pullDistance) {
        onRefresh();
      }
      minOffsetRef.current = 0;
    },
    [children, onRefresh, pullDistance, refreshing]
  );

  // For non-iOS platforms we push the native RefreshControl spinner off-screen.
  // On iOS RefreshControl styling/offset often gets ignored — we use no RefreshControl,
  //      trigger refresh in onScrollEndDrag when user pulled enough (bounce gives negative offset).
  const refreshControl =
    Platform.OS !== 'ios' && Platform.OS !== 'web' ? (
      <RefreshControl
        refreshing={false}
        onRefresh={onRefresh}
        tintColor="transparent"
        colors={['transparent']}
        progressBackgroundColor="transparent"
        progressViewOffset={-10000}
        style={{ opacity: 0, height: 0, transform: [{ scale: 0.01 }] }}
      />
    ) : null;

  const existingContentStyle = scrollableProps(children).contentContainerStyle;
  const showRefreshZone = isVisible || refreshing;
  const contentContainerStyle = useMemo(() => {
    if (!showRefreshZone) return undefined;
    const base = Array.isArray(existingContentStyle)
      ? existingContentStyle
      : existingContentStyle
        ? [existingContentStyle]
        : [];
    return [...base, { paddingTop: topOffset + refreshZoneHeight }];
  }, [existingContentStyle, showRefreshZone, refreshZoneHeight, topOffset]);

  const child = isValidElement(children)
    ? (() => {
        const prev = scrollableProps(children);
        return cloneElement(
          children as React.ReactElement<ScrollableChildProps>,
          {
            refreshControl,
            ...(contentContainerStyle != null && { contentContainerStyle }),
            scrollEventThrottle: 16,
            onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              if (typeof prev.onScroll === 'function') {
                prev.onScroll(event);
              }
              onChildScroll(event);
            },
            onScrollBeginDrag: (event: NativeSyntheticEvent<NativeScrollEvent>) => {
              if (typeof prev.onScrollBeginDrag === 'function') {
                prev.onScrollBeginDrag(event);
              }
              onScrollBeginDrag();
            },
            onScrollEndDrag,
          } satisfies Partial<ScrollableChildProps>
        );
      })()
    : children;

  const indicatorAnimatedStyle = useAnimatedStyle(() => ({
    opacity: opacityShared.value,
    transform: [{ scale: scaleShared.value * pulseShared.value }],
  }));

  return (
    <View style={[styles.wrapper, style]}>
      {showRefreshZone && (
        <View
          style={[
            styles.overlay,
            { top: topOffset, height: refreshZoneHeight },
          ]}
        >
          <Animated.View style={indicatorAnimatedStyle}>
            <PageLoader size={loaderSize} variant="overlay" />
          </Animated.View>
        </View>
      )}
      {child}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    flex: 1,
  },
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    alignItems: 'center',
    justifyContent: 'center',
    pointerEvents: 'none',
  },
});
