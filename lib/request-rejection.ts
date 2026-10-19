type RejectedRequestFields = {
  rejectedBy?: { full_name: string } | null;
  rejected_at?: string | null;
};

type HistoryEntry = {
  action_type: string;
  created_at: string;
  user?: { full_name: string } | null;
};

/**
 * Кем и когда отклонена заявка: поля группы (GET /request-groups/:id), а для
 * заявок, отклонённых до появления этих полей, — последняя запись 'rejected' в истории.
 */
export function getRejectionMeta(
  request: RejectedRequestFields,
  history: HistoryEntry[] | null | undefined
): { rejectedByName?: string; rejectedAt?: string } {
  const log = history?.filter((entry) => entry.action_type === 'rejected').at(-1);
  return {
    rejectedByName: request.rejectedBy?.full_name ?? log?.user?.full_name ?? undefined,
    rejectedAt: request.rejected_at ?? log?.created_at ?? undefined,
  };
}
