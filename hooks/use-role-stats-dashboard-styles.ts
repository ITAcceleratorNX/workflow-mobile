import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/use-theme-color';

/** Общие стили дашбордов статистики (admin-worker / department-head / executor). */
export function useRoleStatsDashboardStyles() {
  const background = useThemeColor({}, 'background');
  const surfaceElevated = useThemeColor({}, 'surfaceElevated');
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const danger = useThemeColor({}, 'danger');
  const dangerSoft = useThemeColor({}, 'dangerSoft');
  const border = useThemeColor({}, 'border');

  const styles = useMemo(
    () =>
      StyleSheet.create({
        screenRoot: {
          flex: 1,
          backgroundColor: background,
        },
        loadingBox: {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          gap: 12,
        },
        loadingText: {
          fontSize: 14,
        },
        errorBox: {
          margin: 16,
          padding: 16,
          borderRadius: 12,
          backgroundColor: dangerSoft,
          borderWidth: 1,
          borderColor: danger,
        },
        errorText: {
          color: danger,
          marginBottom: 12,
        },
        retryButton: {
          alignSelf: 'flex-start',
          paddingVertical: 8,
          paddingHorizontal: 16,
          borderRadius: 8,
          backgroundColor: primary,
        },
        retryText: {
          color: onPrimary,
          fontWeight: '600',
        },
        scrollContent: {
          paddingHorizontal: 16,
        },
        quickStatsRow: {
          flexDirection: 'row',
          flexWrap: 'wrap',
          gap: 10,
          marginBottom: 16,
        },
        quickStatCard: {
          flex: 1,
          minWidth: '47%',
          maxWidth: '48%',
          borderRadius: 12,
          padding: 14,
        },
        quickStatNew: {
          backgroundColor: 'rgba(202,138,4,0.2)',
        },
        quickStatWork: {
          backgroundColor: 'rgba(37,99,235,0.2)',
        },
        quickStatDone: {
          backgroundColor: 'rgba(22,163,74,0.2)',
        },
        quickStatOverdue: {
          backgroundColor: 'rgba(220,38,38,0.2)',
        },
        quickStatOnTime: {
          backgroundColor: 'rgba(34,197,94,0.2)',
        },
        quickStatValue: {
          fontSize: 22,
          fontWeight: 'bold',
          marginTop: 6,
        },
        quickStatLabel: {
          fontSize: 12,
          marginTop: 2,
        },
        card: {
          borderRadius: 12,
          padding: 16,
          marginBottom: 16,
          backgroundColor: surfaceElevated,
          borderWidth: 1,
          borderColor: border,
        },
        cardTitle: {
          fontSize: 17,
          fontWeight: '600',
          marginBottom: 16,
        },
      }),
    [background, surfaceElevated, primary, onPrimary, danger, dangerSoft, border],
  );

  return styles;
}
