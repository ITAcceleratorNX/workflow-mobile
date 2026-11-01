/** Роли, которые видят бронирования офисов, а не только свои (бэкенд: GET /meeting-room-bookings). */
const OFFICE_BOOKINGS_ROLES = ['admin-worker', 'department-head', 'manager'];

export function canSeeOfficeBookings(role: string | null | undefined): boolean {
  return !!role && OFFICE_BOOKINGS_ROLES.includes(role);
}

/** Офис-менеджер видит только свой офис; Администратор и Руководитель — все офисы. */
export function isOfficeScopedBookings(role: string | null | undefined): boolean {
  return role === 'department-head';
}

export function officeBookingsTabLabel(role: string | null | undefined): string {
  return isOfficeScopedBookings(role) ? 'Брони офиса' : 'Все брони';
}

export function getBookingStatusText(status?: string): string {
  switch (status) {
    case 'scheduled':
      return 'Запланировано';
    case 'in_progress':
      return 'В процессе';
    case 'completed':
      return 'Завершено';
    case 'cancelled':
    case 'auto_cancelled':
      return 'Отменено';
    case 'confirmed':
      return 'Подтверждено';
    default:
      return 'Активно';
  }
}

/**
 * Сообщение карточки брони, которую не удалось открыть. Чужая и несуществующая бронь отвечают
 * одинаково (403), поэтому текст не говорит, есть ли она.
 */
export function bookingCardErrorMessage(status: number | undefined, error: string): string {
  if (status === 403 || status === 404) {
    return 'Бронирование недоступно. Возможно, у вас нет к нему доступа или ваши права изменились.';
  }
  if (status === 401) return 'Войдите в аккаунт, чтобы открыть бронирование.';
  return error || 'Не удалось загрузить бронирование';
}
