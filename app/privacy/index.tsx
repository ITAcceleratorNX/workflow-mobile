import { useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  LayoutChangeEvent,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { PRIVACY_CONTENT, type PrivacyLanguage } from '@/constants/privacy-content';

export default function PrivacyScreen() {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [lang, setLang] = useState<PrivacyLanguage>('ru');
  const [sectionOffsets, setSectionOffsets] = useState<number[]>([]);
  const [activeSection, setActiveSection] = useState(0);

  const content = PRIVACY_CONTENT[lang];
  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');

  const handleSectionLayout = useCallback((index: number) => (e: LayoutChangeEvent) => {
    const { y } = e.nativeEvent.layout;
    setSectionOffsets((prev) => {
      const next = [...prev];
      next[index] = y;
      return next;
    });
  }, []);

  const scrollToSection = useCallback((index: number) => {
    const y = sectionOffsets[index];
    if (y !== undefined && scrollRef.current) {
      scrollRef.current.scrollTo({
        y: y - 16,
        animated: true,
      });
    }
  }, [sectionOffsets]);

  const handleScroll = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const offsetY = e.nativeEvent.contentOffset.y;
    if (sectionOffsets.length === 0) return;
    let idx = 0;
    for (let i = 0; i < sectionOffsets.length; i++) {
      if (sectionOffsets[i] != null && offsetY >= sectionOffsets[i] - 32) {
        idx = i;
      }
    }
    setActiveSection(idx);
  }, [sectionOffsets]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          {/* Sticky header */}
          <View style={[styles.headerSticky, { backgroundColor: background, borderBottomColor: border }]}>
            <Pressable style={styles.backRow} onPress={() => router.back()} hitSlop={12}>
              <ThemedText style={[styles.backText, { color: textMuted }]}>
                {lang === 'ru' ? 'Назад' : 'Back'}
              </ThemedText>
            </Pressable>

            <View style={styles.langRow}>
              <Pressable
                style={[
                  styles.langButton,
                  { borderColor: border },
                  lang === 'ru' && { backgroundColor: primary, borderColor: primary },
                ]}
                onPress={() => setLang('ru')}
              >
                <ThemedText style={[styles.langText, { color: lang === 'ru' ? '#FFFFFF' : text }]}>
                  RU
                </ThemedText>
              </Pressable>
              <Pressable
                style={[
                  styles.langButton,
                  { borderColor: border },
                  lang === 'en' && { backgroundColor: primary, borderColor: primary },
                ]}
                onPress={() => setLang('en')}
              >
                <ThemedText style={[styles.langText, { color: lang === 'en' ? '#FFFFFF' : text }]}>
                  EN
                </ThemedText>
              </Pressable>
            </View>

            <ThemedText type="title" style={styles.title}>{content.title}</ThemedText>
            <ThemedText style={[styles.subtitle, { color: textMuted }]}>{content.subtitle}</ThemedText>
            <ThemedText style={[styles.lastUpdate, { color: textMuted }]}>{content.lastUpdate}</ThemedText>
          </View>

          {/* Table of contents — только номера разделов для маленьких экранов */}
          <View style={[styles.tocWrap, { borderBottomColor: border }]}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.tocContent}
            >
              {content.sections.map((section, index) => (
                <Pressable
                  key={section.heading}
                  style={[
                    styles.tocChip,
                    { borderColor: border, backgroundColor: background },
                    activeSection === index && { borderColor: primary, backgroundColor: primary },
                  ]}
                  onPress={() => scrollToSection(index)}
                >
                  <ThemedText
                    style={[
                      styles.tocChipText,
                      { color: activeSection === index ? '#FFFFFF' : textMuted },
                    ]}
                  >
                    {index + 1}
                  </ThemedText>
                </Pressable>
              ))}
            </ScrollView>
          </View>

          {/* Content */}
          <View style={[styles.card, { borderColor: border, backgroundColor: background }]}>
            <ScrollView
              ref={scrollRef}
              style={styles.scroll}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              onScroll={handleScroll}
              scrollEventThrottle={100}
            >
              {content.sections.map((section, index) => (
                <View
                  key={section.heading}
                  style={styles.section}
                  onLayout={handleSectionLayout(index)}
                >
                  <ThemedText style={styles.sectionTitle}>{section.heading}</ThemedText>
                  <ThemedText style={[styles.sectionText, { color: text }]}>{section.content}</ThemedText>
                </View>
              ))}
              <View style={styles.bottomSpacer} />
            </ScrollView>
          </View>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  inner: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 16,
  },
  headerSticky: {
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  backRow: {
    marginBottom: 12,
    paddingVertical: 8,
  },
  backText: { fontSize: 16, fontWeight: '500' },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  langButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  langText: { fontWeight: '600', fontSize: 14 },
  title: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    lineHeight: 22,
    textAlign: 'center',
    marginTop: 4,
  },
  lastUpdate: {
    textAlign: 'center',
    marginTop: 4,
    fontSize: 13,
  },
  tocWrap: {
    borderBottomWidth: 1,
    paddingVertical: 10,
  },
  tocContent: {
    paddingHorizontal: 4,
    gap: 6,
    paddingRight: 16,
    alignItems: 'center',
  },
  tocChip: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tocChipText: {
    fontSize: 14,
    fontWeight: '600',
  },
  card: {
    flex: 1,
    marginTop: 12,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 16, gap: 24, paddingBottom: 48 },
  section: { gap: 10 },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    lineHeight: 24,
  },
  sectionText: {
    fontSize: 15,
    lineHeight: 24,
  },
  bottomSpacer: { height: 24 },
});
