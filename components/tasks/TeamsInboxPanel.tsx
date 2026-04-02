import { MaterialIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useRouter, type Href } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useTeams } from '@/hooks/use-teams';
import { useAuthStore } from '@/stores/auth-store';

function membersPluralRu(n: number): string {
  const n10 = n % 10;
  const n100 = n % 100;
  if (n10 === 1 && n100 !== 11) return 'участник';
  if (n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return 'участника';
  return 'участников';
}

type TeamsInboxPanelProps = {
  onClose: () => void;
};

/** Монтировать только при открытой панели — тогда подгружается список команд. */
export function TeamsInboxPanel({ onClose }: TeamsInboxPanelProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { height: screenH } = useWindowDimensions();
  const slideDistance = Math.min(screenH * 0.92, 720);
  const listMaxHeight = Math.min(screenH * 0.52, 520);
  const translateY = useRef(new Animated.Value(slideDistance)).current;

  const background = useThemeColor({}, 'background');
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const primary = useThemeColor({}, 'primary');
  const border = useThemeColor({}, 'border');
  const cardBg = useThemeColor({}, 'cardBackground');

  const isGuest = useAuthStore((s) => s.isGuest);
  const { teams, loading, error } = useTeams();

  useEffect(() => {
    translateY.setValue(slideDistance);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 260,
      useNativeDriver: true,
    }).start();
  }, [slideDistance, translateY]);

  const finishClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const runCloseAnimation = useCallback(
    (after?: () => void) => {
      Animated.timing(translateY, {
        toValue: slideDistance,
        duration: 220,
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          finishClose();
          if (after) {
            setTimeout(after, 0);
          }
        }
      });
    },
    [finishClose, slideDistance, translateY]
  );

  const handleClose = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runCloseAnimation();
  }, [runCloseAnimation]);

  const goCreateTeam = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    runCloseAnimation(() => {
      router.push('/client/teams/create' as Href);
    });
  }, [runCloseAnimation, router]);

  const openTeam = useCallback(
    (teamId: number) => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      runCloseAnimation(() => {
        router.push(`/client/teams/${teamId}` as Href);
      });
    },
    [runCloseAnimation, router]
  );

  return (
    <Modal visible transparent animationType="none" onRequestClose={handleClose}>
      <View style={styles.root}>
        <Pressable style={styles.backdrop} onPress={handleClose} accessibilityLabel="Закрыть панель" />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: background,
              paddingBottom: Math.max(insets.bottom, 16),
              maxHeight: '88%',
              transform: [{ translateY }],
            },
          ]}
        >
          <View style={styles.grabberWrap} pointerEvents="none">
            <View style={[styles.grabber, { backgroundColor: primary }]} />
          </View>
          <View style={styles.sheetHeader}>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.headerBtn} accessibilityLabel="Закрыть">
              <MaterialIcons name="close" size={26} color={textMuted} />
            </Pressable>
            <ThemedText style={[styles.sheetTitle, { color: text }]}>Команды</ThemedText>
            <Pressable onPress={handleClose} hitSlop={12} style={styles.headerBtn} accessibilityLabel="Готово">
              <MaterialIcons name="check" size={24} color={primary} />
            </Pressable>
          </View>

          {isGuest ? (
            <View style={[styles.centerBlock, { minHeight: 200 }]}>
              <MaterialIcons name="lock-outline" size={40} color={textMuted} />
              <ThemedText style={[styles.hint, { color: textMuted }]}>
                Войдите в аккаунт, чтобы работать с командами
              </ThemedText>
            </View>
          ) : loading ? (
            <View style={[styles.centerBlock, { minHeight: 200 }]}>
              <ActivityIndicator size="large" color={primary} />
            </View>
          ) : error ? (
            <View style={[styles.centerBlock, { minHeight: 200 }]}>
              <ThemedText style={{ color: textMuted, textAlign: 'center' }}>{error}</ThemedText>
            </View>
          ) : teams.length === 0 ? (
            <View style={[styles.centerBlock, { minHeight: 200 }]}>
              <MaterialIcons name="groups" size={44} color={textMuted} />
              <ThemedText style={[styles.hint, { color: textMuted }]}>Пока нет команд</ThemedText>
              <ThemedText style={[styles.subHint, { color: textMuted }]}>
                Создайте команду — позже здесь можно будет смотреть статистику
              </ThemedText>
            </View>
          ) : (
            <ScrollView
              style={{ maxHeight: listMaxHeight }}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {teams.map((t) => {
                const memberCount = t.members?.length ?? 0;
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => openTeam(t.id)}
                    style={({ pressed }) => [
                      styles.teamRow,
                      { borderColor: border, backgroundColor: cardBg, opacity: pressed ? 0.88 : 1 },
                    ]}
                    accessibilityRole="button"
                    accessibilityLabel={`Команда ${t.name}, редактировать`}
                  >
                    <View style={[styles.teamIcon, { backgroundColor: `${primary}22` }]}>
                      <MaterialIcons name="groups" size={22} color={primary} />
                    </View>
                    <View style={styles.teamText}>
                      <ThemedText style={[styles.teamName, { color: text }]} numberOfLines={2}>
                        {t.name}
                      </ThemedText>
                      <ThemedText style={[styles.teamMeta, { color: textMuted }]}>
                        {memberCount} {membersPluralRu(memberCount)}
                      </ThemedText>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}

          {!isGuest && (
            <View style={[styles.footer, { borderTopColor: border }]}>
              <Pressable
                onPress={goCreateTeam}
                style={({ pressed }) => [
                  styles.createBtn,
                  { backgroundColor: primary, opacity: pressed ? 0.92 : 1 },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Создать команду"
              >
                <MaterialIcons name="add" size={22} color="#fff" />
                <ThemedText style={styles.createBtnText}>Создать команду</ThemedText>
              </Pressable>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    width: '100%',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 16,
  },
  grabberWrap: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 42,
    height: 5,
    borderRadius: 2.5,
    opacity: 0.95,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 8,
  },
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  centerBlock: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
    paddingVertical: 24,
  },
  hint: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  subHint: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    gap: 10,
  },
  teamRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  teamIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teamText: {
    flex: 1,
    minWidth: 0,
  },
  teamName: {
    fontSize: 16,
    fontWeight: '600',
  },
  teamMeta: {
    fontSize: 13,
    marginTop: 2,
  },
  footer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  createBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
  },
  createBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
});
