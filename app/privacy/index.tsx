import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useThemeColor } from '@/hooks/use-theme-color';
import { PRIVACY_CONTENT, type PrivacyLanguage } from '@/constants/privacy-content';

export default function PrivacyScreen() {
  const router = useRouter();
  const [lang, setLang] = useState<PrivacyLanguage>('ru');
  const content = PRIVACY_CONTENT[lang];
  const primary = useThemeColor({}, 'primary');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const border = useThemeColor({}, 'border');
  const background = useThemeColor({}, 'background');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
        <View style={styles.inner}>
          <View style={styles.backSpacer} />
          <Pressable style={styles.backRow} onPress={() => router.back()}>
            <ThemedText style={[styles.backText, { color: textMuted }]}>
              Назад
            </ThemedText>
          </Pressable>

          <View style={[styles.card, { borderColor: border, backgroundColor: background }]}>
            <View style={styles.header}>
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

            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
              {content.sections.map((section) => (
                <View style={styles.section} key={section.heading}>
                  <ThemedText style={styles.sectionTitle}>{section.heading}</ThemedText>
                  <ThemedText style={styles.sectionText}>{section.content}</ThemedText>
                </View>
              ))}
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
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },
  backSpacer: { height: 24 },
  backRow: {
    marginBottom: 20,
    paddingVertical: 8,
  },
  backText: { fontSize: 16, fontWeight: '500' },
  card: {
    flex: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  header: { padding: 20, paddingBottom: 12 },
  langRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  langButton: {
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  langText: { fontWeight: '500', fontSize: 14 },
  title: {
    fontSize: 28,
    lineHeight: 40,
    fontWeight: '600',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    lineHeight: 26,
    textAlign: 'center',
    marginTop: 8,
  },
  lastUpdate: {
    textAlign: 'center',
    marginTop: 8,
    fontSize: 15,
  },
  scroll: { flex: 1 },
  scrollContent: { padding: 20, paddingTop: 8, gap: 20, paddingBottom: 40 },
  section: { gap: 8 },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    lineHeight: 26,
  },
  sectionText: {
    fontSize: 16,
    lineHeight: 26,
  },
});
