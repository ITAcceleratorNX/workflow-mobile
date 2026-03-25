import { Image } from 'expo-image';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { useThemeColor } from '@/hooks/use-theme-color';

const LOGO_SOURCE = require('@/assets/logo/logo.png');

/** Контур: тёмная тема (логотип на тёмном фоне) */
const GHOST_DARK = 'rgba(255,255,255,0.35)';
/** Контур: светлая тема (логотип на светлом фоне) */
const GHOST_LIGHT = 'rgba(0,0,0,0.2)';
/** Заливка в тёмной теме (overlay) */
const FILL_DARK = '#FFFFFF';

export interface PageLoaderProps {
  size?: number;
  style?: ViewStyle;
  /**
   * 'overlay' — для PullToRefresh (адаптивно под системную тему).
   * 'default' — для полноэкранной загрузки (адаптивно под тему).
   */
  variant?: 'default' | 'overlay';
}

export function PageLoader({ size = 80, style, variant = 'default' }: PageLoaderProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const themeTextColor = useThemeColor({}, 'text');
  const ghostColor = useMemo(
    () => (colorScheme === 'dark' ? GHOST_DARK : GHOST_LIGHT),
    [colorScheme]
  );
  const fillColor = useMemo(() => {
    if (variant === 'overlay') {
      return colorScheme === 'dark' ? FILL_DARK : themeTextColor;
    }
    return themeTextColor;
  }, [colorScheme, variant, themeTextColor]);
  const rotation = useSharedValue(0);
  const fillProgress = useSharedValue(0);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 4200, easing: Easing.linear }),
      -1,
    );
    fillProgress.value = withRepeat(
      withSequence(
        withTiming(1, {
          duration: 2200,
          easing: Easing.bezier(0.4, 0, 0.2, 1),
        }),
        withDelay(500, withTiming(0, { duration: 0 })),
      ),
      -1,
    );
  }, [rotation, fillProgress]);

  const containerStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const clipStyle = useAnimatedStyle(() => ({
    height: `${fillProgress.value * 100}%`,
  }));

  return (
    <View style={[styles.wrapper, size ? { width: size, height: size } : null, style]}>
      <Animated.View style={[styles.container, containerStyle]}>
        {/** Ghost layer — контур, адаптируется к теме или фиксированный для overlay */}
        <View style={[styles.logoLayer, { width: size, height: size }]}>
          <Image
            source={LOGO_SOURCE}
            tintColor={ghostColor}
            style={[styles.logo, styles.logoGhost, { width: size, height: size }]}
            contentFit="contain"
          />
        </View>

        {/** Fill layer - clipped from bottom to top */}
        <Animated.View style={[styles.clipContainer, clipStyle, { width: size }]}>
          <View style={[styles.fillLayer, { width: size, height: size }]}>
            <Image
              source={LOGO_SOURCE}
              tintColor={fillColor}
              style={[styles.logo, { width: size, height: size }]}
              contentFit="contain"
            />
          </View>
        </Animated.View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  container: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLayer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  fillLayer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  logoGhost: {
    opacity: 0.15,
  },
});
