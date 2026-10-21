import { useCallback, useEffect, useMemo, useState } from 'react';

import {
  createMeetingRoomBooking,
  getRoomDailyAvailability,
  type MeetingRoom,
  type MeetingRoomBooking,
  type Office,
} from '@/lib/api';
import {
  almatyDay,
  almatyMinutes,
  bookingWeek,
  busyIntervals,
  checkBookingTime,
  firstBookableDay,
  formatTime,
  officeHours,
  parseTime,
  suggestFreeSlots,
  toIso,
  type Interval,
} from '@/lib/booking-flow';
import { useAuthStore } from '@/stores/auth-store';
import { useGuestDemoStore } from '@/stores/guest-demo-store';

export type BookingStep = 'time' | 'details';

/**
 * Состояние двухшагового сценария брони (как в вебе): дата и время, затем компания и пожелания.
 * Занятость и часы офиса — из /rooms/:id/availability выбранного дня; гость бронирует локально.
 */
export function useRoomBooking(
  room: MeetingRoom,
  office: Office | null | undefined,
  { onBooked }: { onBooked: (booking: MeetingRoomBooking) => void }
) {
  const profileCompany = useAuthStore((s) => s.user?.company?.name?.trim() || null);
  const isGuest = useAuthStore((s) => s.isGuest);
  const guestBookings = useGuestDemoStore((s) => s.bookings);
  const addGuestBooking = useGuestDemoStore((s) => s.addBooking);

  // «Сейчас» обновляется раз в минуту: сегодня нельзя начать раньше текущего времени.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const [step, setStep] = useState<BookingStep>('time');
  const [weekOffset, setWeekOffset] = useState(0);
  const week = useMemo(() => bookingWeek(now, weekOffset), [now, weekOffset]);
  const [day, setDay] = useState<string | null>(() => {
    const start = Date.now();
    return firstBookableDay(bookingWeek(start)) ?? firstBookableDay(bookingWeek(start, 1));
  });
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const [reloadKey, setReloadKey] = useState(0);
  const [companyOverride, setCompanyOverride] = useState<string | null>(profileCompany ? null : '');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Занятость дня с сервера: результат хранится с ключом запроса, загрузка = ключ ещё не совпал.
  const requestKey = day ? `${room.id}|${day}|${reloadKey}` : null;
  const [loaded, setLoaded] = useState<{ key: string; busy: Interval[]; office: Office | null; error: string | null } | null>(null);
  useEffect(() => {
    if (!day || !requestKey || isGuest) return;
    let cancelled = false;
    getRoomDailyAvailability(room.id, day).then((res) => {
      if (cancelled) return;
      setLoaded(
        res.ok
          ? { key: requestKey, busy: busyIntervals(day, res.data.bookings ?? []), office: res.data.room?.office ?? null, error: null }
          : { key: requestKey, busy: [], office: null, error: res.error || 'Не удалось загрузить занятость' }
      );
    });
    return () => {
      cancelled = true;
    };
  }, [room.id, day, requestKey, isGuest]);

  const guestBusy = useMemo(() => {
    if (!isGuest || !day) return [];
    const zoned = (value: string) => (/(Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}+05:00`);
    const own = guestBookings.filter((b) => b.meeting_room_id === room.id && b.status !== 'cancelled');
    return busyIntervals(day, own.map((b) => ({ start_time: zoned(b.start_time), end_time: zoned(b.end_time) })));
  }, [isGuest, day, guestBookings, room.id]);

  const current = loaded && loaded.key === requestKey ? loaded : null;
  const availabilityLoading = !isGuest && !!requestKey && !current;
  const availabilityError = isGuest ? null : (current?.error ?? null);
  const serverBusy = current?.busy;
  const busy = useMemo(() => (isGuest ? guestBusy : (serverBusy ?? [])), [isGuest, guestBusy, serverBusy]);
  const hours = useMemo(
    () => officeHours(current?.office ?? office ?? room.office),
    [current?.office, office, room.office]
  );

  const nowMinutes = day && day === almatyDay(now) ? almatyMinutes(now) : null;
  const check = useMemo(() => checkBookingTime({ from, to, hours, busy, nowMinutes }), [from, to, hours, busy, nowMinutes]);
  const suggestions = useMemo(() => {
    if (check.ok || check.reason !== 'busy') return [];
    const start = parseTime(from);
    const end = parseTime(to);
    if (start === null || end === null) return [];
    return suggestFreeSlots({ start, end, hours, busy, nowMinutes });
  }, [check, from, to, hours, busy, nowMinutes]);

  const companyName = companyOverride === null ? profileCompany : companyOverride.trim();
  const companyMissing = !companyName;
  const canContinue = !!day && check.ok && !availabilityLoading && !availabilityError;
  const canSubmit = canContinue && !companyMissing && !submitting;

  const changeWeek = useCallback(
    (delta: number) => {
      const next = Math.max(0, weekOffset + delta);
      setWeekOffset(next);
      setDay(firstBookableDay(bookingWeek(now, next)));
    },
    [now, weekOffset]
  );

  const pickSlot = useCallback((slot: Interval) => {
    setFrom(formatTime(slot.start));
    setTo(formatTime(slot.end));
  }, []);

  const submit = useCallback(async () => {
    if (!canSubmit || !day || !check.ok) return;
    const start = parseTime(from)!;
    const end = parseTime(to)!;
    setSubmitting(true);
    setSubmitError(null);
    if (isGuest) {
      const id = addGuestBooking({
        meeting_room_id: room.id,
        start_time: toIso(day, start),
        end_time: toIso(day, end),
        status: 'scheduled',
        company_name: companyName,
        meetingRoom: room,
      });
      setSubmitting(false);
      onBooked({ id, meeting_room_id: room.id, start_time: toIso(day, start), end_time: toIso(day, end), status: 'scheduled', meetingRoom: room });
      return;
    }
    const res = await createMeetingRoomBooking({
      meeting_room_id: room.id,
      start_time: toIso(day, start),
      end_time: toIso(day, end),
      // Своя компания — только для этой брони; иначе бэкенд подставит компанию из профиля.
      company_name: companyOverride !== null && companyName !== profileCompany ? companyName : null,
      comment: comment.trim() || null,
    });
    setSubmitting(false);
    if (res.ok) {
      onBooked(res.data);
    } else {
      setSubmitError(res.error || 'Не удалось создать бронь');
      // Время могли занять, пока заполняли детали.
      setReloadKey((k) => k + 1);
    }
  }, [canSubmit, day, check, from, to, isGuest, addGuestBooking, room, companyName, onBooked, companyOverride, profileCompany, comment]);

  return {
    step,
    setStep,
    week,
    weekOffset,
    changeWeek,
    day,
    setDay,
    from,
    setFrom,
    to,
    setTo,
    busy,
    hours,
    availabilityLoading,
    availabilityError,
    retryAvailability: () => setReloadKey((k) => k + 1),
    check,
    suggestions,
    pickSlot,
    canContinue,
    profileCompany,
    companyOverride,
    setCompanyOverride,
    companyMissing,
    comment,
    setComment,
    submit,
    submitting,
    submitError,
    canSubmit,
  };
}

export type RoomBookingState = ReturnType<typeof useRoomBooking>;
