import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useRouter, type Href } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { calculateDeskHeights } from '@/lib/desk-height-utils';
import { useStepsStore } from '@/stores/steps-store';

const CARD_ORANGE = '#D94F15';

/** Открыть «Шаги» сразу на вкладке «Настройки» (рост и вес для калькулятора стола). */
export const STEPS_SETTINGS_HREF = {
  pathname: '/steps',
  params: { tab: 'settings' },
} as Href;

/** Экран калькулятора / умный офис — чёрная карточка, серые рамки, оранжевая ссылка. */
const SMART_OFFICE_THEME = {
  cardBg: '#000000',
  border: 'rgba(255,255,255, 0.14)',
  text: '#FFFFFF',
  muted: '#9CA3AF',
  valueBg: '#0A0A0A',
  valueBorder: 'rgba(255,255,255, 0.12)',
  linkBorder: 'rgba(255,255,255, 0.14)',
  iconMuted: '#9CA3AF',
};

export type SmartDeskCalculatorProps = {
  containerStyle?: StyleProp<ViewStyle>;
  /**
   * default — общий вид для светлых экранов;
   * smartOffice — полная карточка (экран /client/desk-height);
   * compact — строка-вход → полный калькулятор;
   * embedded — без перехода: только подсказка и высоты (настройки «Шаги»).
   */
  variant?: 'default' | 'smartOffice' | 'compact' | 'embedded';
  /** Только compact: «dark» — умный офис; «app» — тема экрана «Шаги». */
  compactTheme?: 'dark' | 'app';
};

/** Калькулятор высоты стола по росту/весу из «Шаги». */
export function SmartDeskCalculator({
  containerStyle,
  variant = 'default',
  compactTheme = 'dark',
}: SmartDeskCalculatorProps) {
  const router = useRouter();
  const themeText = useThemeColor({}, 'text');
  const themeMuted = useThemeColor({}, 'textMuted');
  const themeBorder = useThemeColor({}, 'border');
  const themePrimary = useThemeColor({}, 'primary');

  const heightCm = useStepsStore((s) => s.settings.heightCm);
  const weightKg = useStepsStore((s) => s.settings.weightKg);
  const deskHeights = useMemo(() => {
    if (heightCm == null) return null;
    return calculateDeskHeights(heightCm, weightKg);
  }, [heightCm, weightKg]);

  if (variant === 'compact') {
    const isDark = compactTheme === 'dark';
    const titleColor = isDark ? SMART_OFFICE_THEME.text : themeText;
    const subColor = isDark ? SMART_OFFICE_THEME.muted : themeMuted;
    const iconColor = isDark ? SMART_OFFICE_THEME.iconMuted : themeMuted;

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
          isDark ? styles.compactDark : [styles.compactApp, { borderColor: themeBorder }],
          { opacity: pressed ? (isDark ? 0.88 : 0.92) : 1 },
          containerStyle,
        ]}
      >
        <MaterialIcons name="desktop-windows" size={22} color={iconColor} />
        <View style={styles.compactTextCol}>
          <ThemedText style={[styles.compactTitle, { color: titleColor }]}>Высота рабочего стола</ThemedText>
          <ThemedText style={[styles.compactSubtitle, { color: subColor }]} numberOfLines={2}>
            {subtitle}
          </ThemedText>
        </View>
        <MaterialIcons name="chevron-right" size={22} color={CARD_ORANGE} />
      </Pressable>
    );
  }

  if (variant === 'embedded') {
    const hintInvalidHeight =
      heightCm != null
        ? 'Рост должен быть в диапазоне 100–250 см — поправьте значение выше.'
        : null;

    return (
      <View style={[styles.embeddedCard, { borderColor: themeBorder }, containerStyle]}>
        <View style={styles.embeddedHeader}>
          <MaterialIcons name="desktop-windows" size={22} color={themeMuted} />
          <ThemedText style={[styles.embeddedTitle, { color: themeText }]}>Умный стол</ThemedText>
        </View>
        {deskHeights ? (
          <>
            <ThemedText style={[styles.embeddedHint, { color: themeMuted }]}>
              Рекомендуемая высота по текущему росту и весу из полей выше.
            </ThemedText>
            <View style={styles.valuesRow}>
              <View style={[styles.embeddedValueBox, { borderColor: themeBorder }]}>
                <ThemedText style={[styles.embeddedValueLabel, { color: themeMuted }]}>Сидя</ThemedText>
                <ThemedText style={[styles.embeddedValueNum, { color: themeText }]}>
                  {deskHeights.sitting} см
                </ThemedText>
              </View>
              <View style={[styles.embeddedValueBox, { borderColor: themeBorder }]}>
                <ThemedText style={[styles.embeddedValueLabel, { color: themeMuted }]}>Стоя</ThemedText>
                <ThemedText style={[styles.embeddedValueNum, { color: themeText }]}>
                  {deskHeights.standing} см
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <ThemedText style={[styles.embeddedHint, { color: themeMuted }]}>
            {hintInvalidHeight ??
              'Укажите рост (и при желании вес) в блоке выше — здесь появятся высоты для работы сидя и стоя.'}
          </ThemedText>
        )}
      </View>
    );
  }

  const isOffice = variant === 'smartOffice';
  const text = isOffice ? SMART_OFFICE_THEME.text : themeText;
  const muted = isOffice ? SMART_OFFICE_THEME.muted : themeMuted;
  const border = isOffice ? SMART_OFFICE_THEME.border : themeBorder;
  const primary = isOffice ? CARD_ORANGE : themePrimary;

  const linkWrapperStyle = ({ pressed }: { pressed: boolean }) => [
    styles.link,
    isOffice ? styles.linkSmartOffice : { borderColor: border },
    !isOffice && { borderColor: border },
    isOffice && {
      borderColor: SMART_OFFICE_THEME.linkBorder,
      opacity: pressed ? 0.82 : 1,
    },
    !isOffice && pressed && styles.linkPressed,
  ];

  const valueCardDynamic = isOffice
    ? {
        backgroundColor: SMART_OFFICE_THEME.valueBg,
        borderColor: SMART_OFFICE_THEME.valueBorder,
      }
    : { borderColor: border };

  const metaStepsLine =
    heightCm != null
      ? weightKg != null
        ? `По данным из «Шаги»: рост ${heightCm} см, вес ${weightKg} кг.`
        : `По данным из «Шаги»: рост ${heightCm} см.`
      : null;

  if (isOffice) {
    return (
      <View style={[styles.officeCard, containerStyle]}>
        <View style={styles.officeHeader}>
          <MaterialIcons name="desktop-windows" size={22} color={SMART_OFFICE_THEME.iconMuted} />
          <ThemedText style={styles.officeTitle}>Высота рабочего стола</ThemedText>
        </View>

        {deskHeights && metaStepsLine ? (
          <>
            <ThemedText style={styles.officeMeta}>{metaStepsLine}</ThemedText>
            <View style={styles.valuesRow}>
              <View style={[styles.officeValueCard, valueCardDynamic]}>
                <ThemedText style={styles.officeValueLabel}>Сидя</ThemedText>
                <ThemedText style={styles.officeValueNumber}>
                  {deskHeights.sitting} см
                </ThemedText>
              </View>
              <View style={[styles.officeValueCard, valueCardDynamic]}>
                <ThemedText style={styles.officeValueLabel}>Стоя</ThemedText>
                <ThemedText style={styles.officeValueNumber}>
                  {deskHeights.standing} см
                </ThemedText>
              </View>
            </View>
          </>
        ) : (
          <ThemedText style={styles.officeMeta}>
            {heightCm != null
              ? 'Рост должен быть в диапазоне 100–250 см. Исправьте значение в «Шаги».'
              : 'Укажите рост и при желании вес в «Шаги» — здесь появятся рекомендуемые высоты стола сидя и стоя.'}
          </ThemedText>
        )}

        <Pressable onPress={() => router.push(STEPS_SETTINGS_HREF)} style={linkWrapperStyle}>
          <ThemedText style={styles.officeLinkText}>
            {deskHeights ? 'Изменить рост и вес в «Шаги»' : 'Открыть «Шаги»'}
          </ThemedText>
          <MaterialIcons name="chevron-right" size={22} color={CARD_ORANGE} />
        </Pressable>
      </View>
    );
  }

  return (
    <View style={[styles.card, { borderColor: border }, containerStyle]}>
      <View style={styles.header}>
        <MaterialIcons name="event-seat" size={20} color={themeMuted} />
        <ThemedText style={[styles.title, { color: text }]}>Умный стол</ThemedText>
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
            <View style={[styles.valueCard, valueCardDynamic]}>
              <ThemedText style={[styles.valueLabel, { color: muted }]}>Сидя</ThemedText>
              <ThemedText style={[styles.valueNumber, { color: text }]}>
                {deskHeights.sitting} см
              </ThemedText>
            </View>
            <View style={[styles.valueCard, valueCardDynamic]}>
              <ThemedText style={[styles.valueLabel, { color: muted }]}>Стоя</ThemedText>
              <ThemedText style={[styles.valueNumber, { color: text }]}>
                {deskHeights.standing} см
              </ThemedText>
            </View>
          </View>
          <Pressable onPress={() => router.push(STEPS_SETTINGS_HREF)} style={linkWrapperStyle}>
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
          <Pressable onPress={() => router.push(STEPS_SETTINGS_HREF)} style={linkWrapperStyle}>
            <ThemedText style={[styles.linkText, { color: primary }]}>Открыть «Шаги»</ThemedText>
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
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  compactDark: {
    backgroundColor: SMART_OFFICE_THEME.cardBg,
    borderColor: SMART_OFFICE_THEME.border,
  },
  compactApp: {
    backgroundColor: 'transparent',
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
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 12,
  },
  embeddedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 12,
    paddingHorizontal: 12,
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
    borderRadius: 14,
    borderWidth: 1,
    borderColor: SMART_OFFICE_THEME.border,
    backgroundColor: SMART_OFFICE_THEME.cardBg,
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 14,
    gap: 14,
  },
  officeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  officeTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: SMART_OFFICE_THEME.text,
    letterSpacing: -0.35,
    flex: 1,
    lineHeight: 24,
  },
  officeMeta: {
    fontSize: 14,
    lineHeight: 20,
    color: SMART_OFFICE_THEME.muted,
  },
  officeValueCard: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    minWidth: 0,
  },
  officeValueLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: SMART_OFFICE_THEME.muted,
    marginBottom: 6,
    letterSpacing: 0.15,
  },
  officeValueNumber: {
    fontSize: 26,
    fontWeight: '700',
    color: SMART_OFFICE_THEME.text,
    letterSpacing: -0.5,
  },
  officeLinkText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: CARD_ORANGE,
  },
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    gap: 12,
  },
  valueCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 10,
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
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
  },
  linkSmartOffice: {
    marginTop: 2,
    backgroundColor: 'transparent',
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
