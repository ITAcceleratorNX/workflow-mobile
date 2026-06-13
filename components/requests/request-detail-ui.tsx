import { MaterialIcons } from '@expo/vector-icons';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ReactNode,
  type ViewStyle,
} from 'react-native';

import { LongTermBadge } from '@/components/requests/long-term-badge';
import type { PrimaryActionItem } from '@/components/requests/request-action-config';
import { ThemedText } from '@/components/themed-text';
import {
  formatServiceCategoryDisplayName,
  getStatusBadgeTheme,
  getStatusLabel,
  getTypeLabel,
} from '@/constants/requests';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { RequestGroup, SubRequest } from '@/lib/api';
import { parseLocationDetail } from '@/lib/parse-location-detail';

export function DetailCard({
  title,
  children,
  style,
}: {
  title?: string;
  children: ReactNode;
  style?: ViewStyle;
}) {
  const cardBg = useThemeColor({}, 'cardBackground');
  const text = useThemeColor({}, 'text');

  return (
    <View style={[styles.card, { backgroundColor: cardBg }, style]}>
      {title ? (
        <ThemedText style={[styles.cardTitle, { color: text }]}>{title}</ThemedText>
      ) : null}
      {children}
    </View>
  );
}

export function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');

  return (
    <View style={styles.detailRow}>
      <ThemedText style={[styles.detailLabel, { color: textMuted }]}>{label}</ThemedText>
      <ThemedText style={[styles.detailValue, { color: text }]}>{value}</ThemedText>
    </View>
  );
}

function StatusBadge({ status }: { status: string }) {
  const theme = getStatusBadgeTheme(status);
  const bg = useThemeColor({}, theme.bg);
  const color = useThemeColor({}, theme.text);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color }]} numberOfLines={1}>
        {getStatusLabel(status)}
      </ThemedText>
    </View>
  );
}

function TypeBadge({ label }: { label: string }) {
  const bg = useThemeColor({}, 'surfaceElevated');
  const color = useThemeColor({}, 'textSecondary');

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <ThemedText style={[styles.badgeText, { color }]} numberOfLines={1}>
        {label}
      </ThemedText>
    </View>
  );
}

export function RequestDetailHeader({
  request,
  sub,
  isLongTerm,
}: {
  request: RequestGroup;
  sub: SubRequest | undefined;
  isLongTerm: boolean;
}) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');

  const categoryLabel = formatServiceCategoryDisplayName(sub?.category?.name);
  const title =
    sub?.title?.trim() ||
    categoryLabel ||
    'Без названия';
  const urgencyLabel = getTypeLabel(request.request_type ?? 'normal');

  return (
    <View style={styles.headerBlock}>
      <ThemedText style={[styles.requestNumber, { color: textMuted }]}>
        Заявка #{request.id}
      </ThemedText>
      <ThemedText style={[styles.requestTitle, { color: text }]}>{title}</ThemedText>
      <View style={styles.badgeRow}>
        <TypeBadge label={categoryLabel} />
        <TypeBadge label={urgencyLabel} />
        <StatusBadge status={request.status} />
        {isLongTerm ? <LongTermBadge detail /> : null}
      </View>
    </View>
  );
}

export function RequestDescriptionCard({ description }: { description: string }) {
  const text = useThemeColor({}, 'text');

  return (
    <DetailCard title="Описание">
      <ThemedText style={[styles.descriptionText, { color: text }]}>{description}</ThemedText>
    </DetailCard>
  );
}

export function RequestLocationCard({
  officeName,
  officeAddress,
  locationDetail,
}: {
  officeName?: string;
  officeAddress?: string;
  locationDetail?: string;
}) {
  const parsed = parseLocationDetail(locationDetail);
  const rows: Array<{ label: string; value: string }> = [];

  if (officeName?.trim()) rows.push({ label: 'Офис', value: officeName.trim() });
  if (officeAddress?.trim()) rows.push({ label: 'Адрес', value: officeAddress.trim() });
  if (parsed.block) rows.push({ label: 'Блок', value: parsed.block });
  if (parsed.floor) rows.push({ label: 'Этаж', value: parsed.floor });
  if (parsed.room) rows.push({ label: 'Помещение', value: parsed.room });
  if (parsed.extra) rows.push({ label: 'Дополнительно', value: parsed.extra });

  if (rows.length === 0) return null;

  return (
    <DetailCard title="Локация">
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </DetailCard>
  );
}

export function RequestMetaCard({
  title = 'Детали заявки',
  categoryName,
  subcategoryName,
  createdDate,
  clientName,
  plannedDate,
  executors,
  completionComment,
}: {
  title?: string;
  categoryName?: string;
  subcategoryName?: string;
  createdDate?: string;
  clientName?: string;
  plannedDate?: string;
  executors?: string[];
  completionComment?: string;
}) {
  const rows: Array<{ label: string; value: string }> = [];

  if (categoryName?.trim()) {
    rows.push({
      label: 'Категория',
      value: formatServiceCategoryDisplayName(categoryName),
    });
  }
  if (subcategoryName?.trim()) {
    rows.push({ label: 'Подкатегория', value: subcategoryName.trim() });
  }
  if (createdDate) {
    const d = new Date(createdDate);
    rows.push({
      label: 'Дата создания',
      value: Number.isNaN(d.getTime())
        ? createdDate
        : d.toLocaleString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }),
    });
  }
  if (clientName?.trim()) {
    rows.push({ label: 'Имя клиента', value: clientName.trim() });
  }
  if (plannedDate) {
    const d = new Date(plannedDate);
    rows.push({
      label: 'Запланировано на',
      value: Number.isNaN(d.getTime())
        ? plannedDate
        : d.toLocaleDateString('ru-RU', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          }),
    });
  }
  if (executors?.length) {
    rows.push({ label: 'Исполнители', value: executors.join(', ') });
  }
  if (completionComment?.trim()) {
    rows.push({ label: 'Комментарий по выполнению', value: completionComment.trim() });
  }

  if (rows.length === 0) return null;

  return (
    <DetailCard title={title}>
      {rows.map((row) => (
        <DetailRow key={row.label} label={row.label} value={row.value} />
      ))}
    </DetailCard>
  );
}

export function RequestPhotoStrip({
  photos,
  onPress,
}: {
  photos: Array<{ photo_url: string }>;
  onPress: (url: string) => void;
}) {
  const surfaceMuted = useThemeColor({}, 'surfaceMuted');

  if (!photos.length) return null;

  return (
    <DetailCard title="Фото">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.photoStripContent}
      >
        {photos.map((p, idx) => (
          <Pressable
            key={`${p.photo_url}-${idx}`}
            onPress={() => onPress(p.photo_url)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`Фото ${idx + 1}`}
            style={[styles.photoThumb, { backgroundColor: surfaceMuted }]}
          >
            <Image
              source={{ uri: p.photo_url }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          </Pressable>
        ))}
      </ScrollView>
    </DetailCard>
  );
}

export function RequestPrimaryActions({ actions }: { actions: PrimaryActionItem[] }) {
  const primary = useThemeColor({}, 'primary');
  const onPrimary = useThemeColor({}, 'onPrimary');
  const cardBg = useThemeColor({}, 'cardBackground');
  const text = useThemeColor({}, 'text');
  const border = useThemeColor({}, 'border');

  if (actions.length === 0) return null;

  return (
    <DetailCard title="Действия">
      <View style={styles.actionsColumn}>
        {actions.map((action) => {
          const isPrimary = action.variant === 'primary';
          return (
            <Pressable
              key={action.key}
              onPress={action.onClick}
              accessibilityRole="button"
              accessibilityLabel={action.label}
              style={({ pressed }) => [
                styles.actionButton,
                isPrimary
                  ? { backgroundColor: primary, opacity: pressed ? 0.88 : 1 }
                  : {
                      backgroundColor: cardBg,
                      borderColor: border,
                      borderWidth: 1,
                      opacity: pressed ? 0.88 : 1,
                    },
              ]}
            >
              {action.key === 'share' ? (
                <MaterialIcons
                  name="share"
                  size={20}
                  color={isPrimary ? onPrimary : text}
                  style={styles.actionIcon}
                />
              ) : action.key === 'accept' ? (
                <MaterialIcons
                  name="playlist-add-check"
                  size={20}
                  color={isPrimary ? onPrimary : text}
                  style={styles.actionIcon}
                />
              ) : (
                <MaterialIcons
                  name="check-circle"
                  size={20}
                  color={isPrimary ? onPrimary : text}
                  style={styles.actionIcon}
                />
              )}
              <ThemedText
                style={[
                  styles.actionLabel,
                  { color: isPrimary ? onPrimary : text },
                ]}
              >
                {action.label}
              </ThemedText>
            </Pressable>
          );
        })}
      </View>
    </DetailCard>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  cardTitle: {
    fontSize: FontSizes.bodySmall,
    fontWeight: '600',
    lineHeight: LineHeights.bodySmall,
    marginBottom: Spacing.md,
  },
  detailRow: {
    marginBottom: Spacing.md,
  },
  detailLabel: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
    marginBottom: Spacing.xs,
  },
  detailValue: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
  },
  headerBlock: {
    marginBottom: Spacing.lg,
  },
  requestNumber: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
    marginBottom: Spacing.xs,
  },
  requestTitle: {
    fontSize: FontSizes.headline,
    fontWeight: '700',
    lineHeight: LineHeights.headline,
    marginBottom: Spacing.md,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    alignItems: 'center',
  },
  badge: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs + 2,
    borderRadius: Radius.sm,
  },
  badgeText: {
    fontSize: FontSizes.caption,
    fontWeight: '600',
    lineHeight: LineHeights.caption,
  },
  descriptionText: {
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
  },
  photoStripContent: {
    gap: Spacing.sm,
  },
  photoThumb: {
    width: 88,
    height: 88,
    borderRadius: Radius.sm,
    overflow: 'hidden',
  },
  actionsColumn: {
    gap: Spacing.sm,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: Radius.md,
    minHeight: 48,
  },
  actionIcon: {
    marginRight: Spacing.sm,
  },
  actionLabel: {
    fontSize: FontSizes.body,
    fontWeight: '600',
    lineHeight: LineHeights.body,
  },
});
