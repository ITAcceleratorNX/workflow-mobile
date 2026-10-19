import { MaterialIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { FontSizes, LineHeights, Radius, Spacing } from '@/constants/theme';
import { useThemeColor } from '@/hooks/use-theme-color';
import type { RequestGroup } from '@/lib/api';
import { formatRequestDate } from '@/lib/dateTimeUtils';
import { clientConfirmationDeadline } from '@/lib/request-permissions';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

/**
 * Где заявка на пути к закрытию: работы ждут подтверждения Администратора, результат ждёт
 * Клиента (до какого времени), Клиент вернул её с замечаниями, как она закрыта.
 */
export function RequestClosureInfo({
  request,
  isAuthor,
}: {
  request: RequestGroup;
  /** Текущий пользователь — автор заявки: ему адресованы подсказки о подтверждении. */
  isAuthor: boolean;
}) {
  const deadline = clientConfirmationDeadline(request);

  if (deadline) {
    const until = formatRequestDate(deadline.toISOString());
    return (
      <ClosureNotice
        icon="schedule"
        tone="warning"
        title={isAuthor ? 'Подтвердите выполнение' : 'Ожидает подтверждения Клиента'}
        body={
          isAuthor
            ? `Подтвердите результат или оставьте замечания до ${until}. Без ответа заявка закроется автоматически.`
            : `Заявка закроется автоматически ${until}, если Клиент не ответит.`
        }
      />
    );
  }

  if (request.status === 'awaiting_admin_review') {
    const text = isAuthor
      ? 'Администратор проверит результат и передаст заявку вам на подтверждение.'
      : 'Ждёт подтверждения Администратора, затем уйдёт Клиенту.';
    return (
      <ClosureNotice
        icon="fact-check"
        tone="success"
        title="Работы выполнены — на проверке"
        body={request.work_done_at ? `${formatRequestDate(request.work_done_at)} · ${text}` : text}
      />
    );
  }

  if (request.status === 'execution' && request.last_remark) {
    return (
      <ClosureNotice
        icon="rate-review"
        tone="warning"
        title={
          isAuthor
            ? 'Ваши замечания переданы на доработку'
            : 'Замечания Клиента — заявка на доработке'
        }
        body={request.last_remark}
        caption={request.last_remark_at ? formatRequestDate(request.last_remark_at) : undefined}
      />
    );
  }

  if (request.status === 'completed' && request.close_method) {
    const auto = request.close_method === 'auto';
    return (
      <ClosureNotice
        icon="check-circle"
        tone="success"
        title={auto ? 'Закрыта автоматически' : 'Подтверждена Клиентом'}
        body={`${auto ? 'Подтверждение не поступило в течение 24 часов' : 'Клиент принял результат'}${
          request.closed_at ? ` · ${formatRequestDate(request.closed_at)}` : ''
        }`}
      />
    );
  }

  return null;
}

function ClosureNotice({
  icon,
  tone,
  title,
  body,
  caption,
}: {
  icon: IconName;
  tone: 'warning' | 'success';
  title: string;
  body: string;
  caption?: string;
}) {
  const text = useThemeColor({}, 'text');
  const textMuted = useThemeColor({}, 'textMuted');
  const accent = useThemeColor({}, tone);
  const soft = useThemeColor({}, tone === 'warning' ? 'warningSoft' : 'successSoft');

  return (
    <View style={[styles.notice, { backgroundColor: soft }]}>
      <View style={styles.header}>
        <MaterialIcons name={icon} size={18} color={accent} />
        <ThemedText style={[styles.title, { color: text }]}>{title}</ThemedText>
      </View>
      <ThemedText style={[styles.body, { color: text }]}>{body}</ThemedText>
      {caption ? (
        <ThemedText style={[styles.caption, { color: textMuted }]}>{caption}</ThemedText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    borderRadius: Radius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    gap: Spacing.xs,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  title: {
    flex: 1,
    fontSize: FontSizes.body,
    lineHeight: LineHeights.body,
    fontWeight: '600',
  },
  body: {
    fontSize: FontSizes.bodySmall,
    lineHeight: LineHeights.bodySmall,
  },
  caption: {
    fontSize: FontSizes.caption,
    lineHeight: LineHeights.caption,
  },
});
