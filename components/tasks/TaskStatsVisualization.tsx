import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, G } from 'react-native-svg';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function clamp01(n: number) {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

type DonutProps = {
  size: number;
  strokeWidth: number;
  progress: number;
  color: string;
  trackColor: string;
  label: string;
  subtitle: string;
  textColor: string;
  mutedColor: string;
};

/**
 * Кольцо прогресса: доля выполненных от запланированных (анимация при смене данных).
 */
export function AnimatedProgressDonut({
  size,
  strokeWidth,
  progress,
  color,
  trackColor,
  label,
  subtitle,
  textColor,
  mutedColor,
}: DonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamp01(progress), {
      duration: 950,
      easing: Easing.out(Easing.cubic),
    });
  }, [progress, animated]);

  const circleProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - animated.value),
  }));

  const cx = size / 2;
  const cy = size / 2;

  return (
    <View style={styles.donutCard}>
      <View style={{ width: size, height: size }}>
        <Svg width={size} height={size}>
          <G transform={`rotate(-90 ${cx} ${cy})`}>
            <Circle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={trackColor}
              strokeWidth={strokeWidth}
              fill="none"
            />
            <AnimatedCircle
              cx={cx}
              cy={cy}
              r={radius}
              stroke={color}
              strokeWidth={strokeWidth}
              fill="none"
              strokeDasharray={`${circumference}, ${circumference}`}
              strokeLinecap="round"
              animatedProps={circleProps}
            />
          </G>
        </Svg>
        <View style={[styles.donutCenter, { width: size, height: size }]}>
          <ThemedText style={[styles.donutPercent, { color: textColor }]}>
            {Math.round(clamp01(progress) * 100)}%
          </ThemedText>
          <ThemedText style={[styles.donutSubtitle, { color: mutedColor }]} numberOfLines={1}>
            {subtitle}
          </ThemedText>
        </View>
      </View>
      <ThemedText style={[styles.donutLabel, { color: mutedColor }]}>{label}</ThemedText>
    </View>
  );
}

type BarRowProps = {
  label: string;
  completed: number;
  total: number;
  color: string;
  trackColor: string;
  textColor: string;
  mutedColor: string;
};

/**
 * Горизонтальная полоса: выполнено / всего (заполнение через scaleX, без привязки к onLayout).
 */
export function AnimatedStatBar({
  label,
  completed,
  total,
  color,
  trackColor,
  textColor,
  mutedColor,
}: BarRowProps) {
  const ratio = total > 0 ? completed / total : 0;
  const animated = useSharedValue(0);

  useEffect(() => {
    animated.value = withTiming(clamp01(ratio), {
      duration: 900,
      easing: Easing.out(Easing.cubic),
    });
  }, [ratio, animated]);

  const fillStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.max(0, animated.value) }],
  }));

  return (
    <View style={styles.barBlock}>
      <View style={styles.barHeader}>
        <ThemedText style={[styles.barLabel, { color: textColor }]}>{label}</ThemedText>
        <ThemedText style={[styles.barCounts, { color: mutedColor }]}>
          {completed} из {total}
        </ThemedText>
      </View>
      <View style={[styles.barTrack, { backgroundColor: trackColor }]}>
        <Animated.View
          style={[
            styles.barFill,
            {
              backgroundColor: color,
              transformOrigin: 'left',
            },
            fillStyle,
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  donutCard: {
    alignItems: 'center',
    minWidth: 100,
    flex: 1,
  },
  donutCenter: {
    position: 'absolute',
    left: 0,
    top: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  donutPercent: {
    fontSize: 20,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  donutSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  donutLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.4,
  },
  barBlock: {
    marginBottom: 18,
  },
  barHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  barLabel: {
    fontSize: 15,
    fontWeight: '700',
  },
  barCounts: {
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  barTrack: {
    height: 10,
    borderRadius: 5,
    overflow: 'hidden',
    width: '100%',
  },
  barFill: {
    height: '100%',
    width: '100%',
    borderRadius: 5,
  },
});
