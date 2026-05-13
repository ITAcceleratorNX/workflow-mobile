import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import { calculateDeskHeights } from '@/lib/desk-height-utils';
import { useStepsStore } from '@/stores/steps-store';

/** Открыть «Шаги» сразу на вкладке «Настройки» (рост и вес для калькулятора стола). */
export const STEPS_SETTINGS_HREF = {
  pathname: '/steps',
  params: { tab: 'settings' },
} as Href;

export type SmartDeskCalculatorProps = {
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * default — общий вид для светлых экранов;
   * smartOffice — полная карточка (экран /client/desk-height);
   * compact — строка-вход → полный калькулятор;
   * embedded — без перехода: только подсказка и высоты (настройки «Шаги»).
   */
  variant?: 'default' | 'smartOffice' | 'compact' | 'embedded';
  /**
   * Только compact:
   * - `dark` — поднятая контрастная карточка (для дашбордов / smart-home);
   * - `app` — обычный фон экрана.
   *
   * Оба варианта теперь живут в текущей теме приложения.
   */
  compactTheme?: 'dark' | 'app';
};

/** Калькулятор высоты стола по росту/весу из «Шаги». */
export function SmartDeskCalculator({
  containerStyle,
  variant = 'default',
  compactTheme = 'dark',
}: SmartDeskCalculatorProps) {
  const router = useRouter();
  const text = useThemeColor({}, 'text');
  const muted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const divider = useThemeColor({}, 'divider');
  const primary = useThemeColor({}, 'primary');
  const surface = useThemeColor({}, 'surface');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');

  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const deskHeights = useMemo(() => {
    if (heightCm == null) return null;
    return calculateDeskHeights(heightCm, weightKg);
  }, [heightCm, weightKg]);

  // ── compact variant ─────────────────────────────────────────────────────
  if (variant === 'compact') {
    const isContrast = compactTheme === 'dark';
    let subtitle: string;
    if (deskHeights) {
      subtitle = `Сидя ${deskHeights.sitting} см · Стоя ${deskHeights.standing} см`;
    } else if (heightCm != null) {
      subtitle = 'Уточните рост (100–250 см) в «Шаги»';
    } else {
      subtitle = 'Расчёт по росту и весу из «Шаги»';
    }

    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Высота рабочего стола, подробнее"
        onPress={() => router.push('/client/desk-height' as Href)}
        style={({ pressed }) => [
          styles.compactOuter,
          {
            backgroundColor: isContrast ? surfaceElevated : 'transparent',
            borderColor: isContrast ? divider : border,
          },
          { opacity: pressed ? 0.88 : 1 },
          containerStyle,
        ]}
      >
        <MaterialIcons name="desktop-windows" size={22} color={muted} />
        <View style={styles.compactTextCol}>
          <ThemedText style={[styles.compactTitle, { color: text }]}>
            Высота рабочего стола
          </ThemedText>
          <ThemedText
            style={[styles.compactSubtitle, { color: muted }]}
            numberOfLines={2}
          >
            {subtitle}
          </ThemedText>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={primary} />
      </Pressable>
    );
  }

  // ── embedded variant ────────────────────────────────────────────────────
  if (variant === 'embedded') {
    const hintInvalidHeight =
      heightCm != null
        ? 'Рост должен быть в диапазоне 100–250 см — поправьте значение выше.'
        : null;

    return (
      <View
        style={[styles.embeddedCard, { borderColor: border }, containerStyle]}
      >
        <View style={styles.embeddedHeader}>
          <MaterialIcons name="desktop-windows" size={22} color={muted} />
          <ThemedText style={[styles.embeddedTitle, { color: text }]}>
            Умный стол
          </ThemedText>
        </View>
        {deskHeights ? (
          <>
            <ThemedText style={[styles.embeddedHint, { color: muted }]}>
              Рекомендуемая высота по текущему росту и весу из полей выше.
            </ThemedText>
            <View style={styles.valuesRow}>
              <View
                style={[styles.embeddedValueBox, { borderColor: border }]}
              >
                <ThemedText
                  style={[styles.embeddedValueLabel, { color: muted }]}
                >
                  Сидя
                </ThemedText>
                <ThemedText style={[styles.embeddedValueNum, { color: text }]}>
                  {deskHeights.sitting} см
                </ThemedText>
              </View>
              <View
                style={[styles.embeddedValueBox, { borderColor: border }]}
              >
                <ThemedText
                  style={[styles.embeddedValueLabel, { color: muted }]}
                >
                  Стоя
                </ThemedText>
                <ThemedText style={[styles.embeddedValueNum, { color: text }]}>
                  {deskHeights.standing} см
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <ThemedText style={[styles.embeddedHint, { color: muted }]}>
            {hintInvalidHeight ??
              'Укажите рост (и при желании вес) в блоке выше — здесь появятся высоты для работы сидя и стоя.'}
          </ThemedText>
        )}
      </View>
    );
  }

  // ── smartOffice / default variants ──────────────────────────────────────
  const isOffice = variant === 'smartOffice';
  const cardBg = isOffice ? surfaceElevated : 'transparent';
  const cardBorder = isOffice ? divider : border;
  const valueBg = isOffice ? surface : 'transparent';
  const valueBorder = isOffice ? divider : border;

  const linkWrapperStyle = ({ pressed }: { pressed: boolean }) => [
    styles.link,
    { borderColor: cardBorder },
    pressed && styles.linkPressed,
  ];

  const metaStepsLine =
    heightCm != null
      ? weightKg != null
        ? `По данным из «Шаги»: рост ${heightCm} см, вес ${weightKg} кг.`
        : `По данным из «Шаги»: рост ${heightCm} см.`
      : null;

  if (isOffice) {
    return (
      <View
        style={[
          styles.officeCard,
          { backgroundColor: cardBg, borderColor: cardBorder },
          containerStyle,
        ]}
      >
        <View style={styles.officeHeader}>
          <MaterialIcons name="desktop-windows" size={22} color={muted} />
          <ThemedText style={[styles.officeTitle, { color: text }]}>
            Высота рабочего стола
          </ThemedText>
        </View>

        {deskHeights && metaStepsLine ? (
          <>
            <ThemedText style={[styles.officeMeta, { color: muted }]}>
              {metaStepsLine}
            </ThemedText>
            <View style={styles.valuesRow}>
              <View
                style={[
                  styles.officeValueCard,
                  { backgroundColor: valueBg, borderColor: valueBorder },
                ]}
              >
                <ThemedText
                  style={[styles.officeValueLabel, { color: muted }]}
                >
                  Сидя
                </ThemedText>
                <ThemedText style={[styles.officeValueNumber, { color: text }]}>
                  {deskHeights.sitting} см
                </ThemedText>
              </View>
              <View
                style={[
                  styles.officeValueCard,
                  { backgroundColor: valueBg, borderColor: valueBorder },
                ]}
              >
                <ThemedText
                  style={[styles.officeValueLabel, { color: muted }]}
                >
                  Стоя
                </ThemedText>
                <ThemedText style={[styles.officeValueNumber, { color: text }]}>
                  {deskHeights.standing} см
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <ThemedText style={[styles.officeMeta, { color: muted }]}>
            {heightCm != null
              ? 'Рост должен быть в диапазоне 100–250 см. Исправьте значение в «Шаги».'
              : 'Укажите рост и при желании вес в «Шаги» — здесь появятся рекомендуемые высоты стола сидя и стоя.'}
          </ThemedText>
        )}

        <Pressable
          onPress={() => router.push(STEPS_SETTINGS_HREF)}
          accessibilityRole="link"
          accessibilityLabel="Открыть Шаги"
          style={linkWrapperStyle}
        >
          <ThemedText style={[styles.officeLinkText, { color: primary }]}>
            {deskHeights ? 'Изменить рост и вес в «Шаги»' : 'Открыть «Шаги»'}
          </ThemedText>
          <MaterialIcons name="chevron-right" size={22} color={primary} />
        </Pressable>
      </View>
    );
  }

  // ── default variant ─────────────────────────────────────────────────────
  return (
    <View style={[styles.card, { borderColor: cardBorder }, containerStyle]}>
      <View style={styles.header}>
        <MaterialIcons name="event-seat" size={20} color={muted} />
        <ThemedText style={[styles.title, { color: text }]}>
          Умный стол
        </ThemedText>
      </View>
      <ThemedText style={[styles.subtitle, { color: muted }]}>
        Рекомендуемые высоты стола сидя и стоя по данным из «Шаги».
      </ThemedText>

      {deskHeights ? (
        <>
          <ThemedText style={[styles.meta, { color: muted }]}>
            По данным из «Шаги»: рост {heightCm} см
            {weightKg != null ? `, вес ${weightKg} кг` : ''}
            {weightKg == null
              ? '. Вес необязателен — с ним точнее высота для работы стоя.'
              : '.'}
          </ThemedText>
          <View style={styles.valuesRow}>
            <View
              style={[
                styles.valueCard,
                { backgroundColor: valueBg, borderColor: valueBorder },
              ]}
            >
              <ThemedText style={[styles.valueLabel, { color: muted }]}>
                Сидя
              </ThemedText>
              <ThemedText style={[styles.valueNumber, { color: text }]}>
                {deskHeights.sitting} см
              </ThemedText>
            </View>
            <View
              style={[
                styles.valueCard,
                { backgroundColor: valueBg, borderColor: valueBorder },
              ]}
            >
              <ThemedText style={[styles.valueLabel, { color: muted }]}>
                Стоя
              </ThemedText>
              <ThemedText style={[styles.valueNumber, { color: text }]}>
                {deskHeights.standing} см
              </ThemedText>
            </View>
          </View>
          <Pressable
            onPress={() => router.push(STEPS_SETTINGS_HREF)}
            accessibilityRole="link"
            accessibilityLabel="Изменить рост и вес"
            style={linkWrapperStyle}
          >
            <ThemedText style={[styles.linkText, { color: primary }]}>
              Изменить рост и вес в «Шаги»
            </ThemedText>
            <MaterialIcons name="chevron-right" size={20} color={primary} />
          </Pressable>
        </>
      ) : (
        <>
          <ThemedText style={[styles.meta, { color: muted }]}>
            {heightCm != null
              ? 'Рост должен быть в диапазоне 100–250 см. Исправьте значение в настройках «Шаги».'
              : 'Укажите рост (и при желании вес) в экране «Шаги» — здесь появятся рекомендуемые высоты стола сидя и стоя.'}
          </ThemedText>
          <Pressable
            onPress={() => router.push(STEPS_SETTINGS_HREF)}
            accessibilityRole="link"
            accessibilityLabel="Открыть Шаги"
            style={linkWrapperStyle}
          >
            <ThemedText style={[styles.linkText, { color: primary }]}>
              Открыть «Шаги»
            </ThemedText>
            <MaterialIcons name="chevron-right" size={20} color={primary} />
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  compactOuter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md + 2,
    borderRadius: Radius.lg - 2,
    borderWidth: 1,
  },
  compactTextCol: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  compactTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.32,
    lineHeight: 22,
  },
  compactSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    letterSpacing: 0.1,
  },
  embeddedCard: {
    borderRadius: Radius.md,
    borderWidth: 1,
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  embeddedTitle: {
    fontSize: 17,
    fontWeight: '700',
    letterSpacing: -0.25,
    lineHeight: 22,
  },
  embeddedHint: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '400',
  },
  embeddedValueBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: Radius.md - 2,
    borderWidth: 1,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    gap: 4,
  },
  embeddedValueLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  embeddedValueNum: {
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: -0.4,
  },
  officeCard: {
    borderRadius: Radius.lg - 2,
    borderWidth: 1,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md + 2,
    gap: Spacing.md + 2,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm + 2,
  },
  officeTitle: {
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: -0.35,
    flex: 1,
    lineHeight: 24,
  },
  officeMeta: {
    fontSize: 14,
    lineHeight: 20,
  },
  officeValueCard: {
    flex: 1,
    borderRadius: Radius.md,
    borderWidth: 1,
    paddingVertical: Spacing.md + 2,
    paddingHorizontal: Spacing.md,
    minWidth: 0,
  },
  officeValueLabel: {
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 6,
    letterSpacing: 0.15,
  },
  officeValueNumber: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  officeLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  card: {
    borderRadius: Radius.lg,
    borderWidth: 1,
    padding: Spacing.md + 2,
    gap: Spacing.sm + 2,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 18,
  },
  meta: {
    fontSize: 13,
    lineHeight: 18,
  },
  valuesRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  valueCard: {
    flex: 1,
    borderRadius: Radius.md - 2,
    borderWidth: 1,
    paddingVertical: Spacing.md - 2,
    paddingHorizontal: Spacing.md - 2,
    gap: 2,
  },
  valueLabel: {
    fontSize: 12,
    fontWeight: '500',
  },
  valueNumber: {
    fontSize: 20,
    fontWeight: '700',
  },
  link: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md + 2,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  linkPressed: {
    opacity: 0.85,
  },
});
