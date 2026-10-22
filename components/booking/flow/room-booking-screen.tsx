import { MaterialIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useState, type ComponentProps, type ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { MeetingRoom, MeetingRoomBooking, Office } from '@/lib/api';
import {
  BOOKING_COMMENT_MAX,
  COMMENT_QUICK_ADDS,
  appendToComment,
  formatBookingDay,
  formatDuration,
  formatTime,
  maskTimeInput,
  officeHours,
} from '@/lib/booking-flow';
import { getRoomPhotoUris } from '@/lib/image-uri';

import { EquipmentChips } from './equipment-chips';
import { useRoomBooking, type RoomBookingState } from './use-room-booking';

const ORANGE_GRADIENT = ['#F35713', '#281504'] as const;
const ACCENT = '#E85D2B';
const ERROR = '#FFB4B4';
const SUCCESS = '#86EFAC';
const WARNING = '#FDE68A';

type IconName = ComponentProps<typeof MaterialIcons>['name'];

function RoundButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.round} hitSlop={8}>
      <MaterialIcons name={icon} size={22} color="#fff" />
    </Pressable>
  );
}

function Header({ title, subtitle, icon, onPress }: { title: string; subtitle?: string; icon: IconName; onPress: () => void }) {
  return (
    <View style={styles.header}>
      <RoundButton icon={icon} onPress={onPress} label={icon === 'close' ? 'Закрыть' : 'Назад'} />
      <View style={{ flex: 1 }}>
        <Text style={styles.title} numberOfLines={2}>
          {title}
        </Text>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      </View>
    </View>
  );
}

function PrimaryButton({ label, onPress, disabled, loading }: { label: string; onPress: () => void; disabled?: boolean; loading?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={[styles.primary, disabled && styles.primaryDisabled]}
    >
      {loading ? <ActivityIndicator color={ACCENT} /> : null}
      <Text style={[styles.primaryText, disabled && styles.primaryTextDisabled]}>{label}</Text>
    </Pressable>
  );
}

function SectionTitle({ children, aside }: { children: ReactNode; aside?: string }) {
  return (
    <View style={styles.sectionTitleRow}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {aside ? <Text style={styles.muted}>{aside}</Text> : null}
    </View>
  );
}

/** Карточка переговорной перед бронью. */
function RoomInfo({ room, office }: { room: MeetingRoom; office?: Office | null }) {
  const photos = getRoomPhotoUris(room);
  const hours = officeHours(office ?? room.office);
  return (
    <View style={{ gap: 18 }}>
      {photos[0] ? (
        <Image source={{ uri: photos[0] }} style={styles.hero} contentFit="cover" />
      ) : (
        <View style={[styles.hero, styles.heroEmpty]}>
          <MaterialIcons name="meeting-room" size={40} color="rgba(255,255,255,0.6)" />
        </View>
      )}
      <View style={styles.metaRow}>
        {room.capacity ? (
          <View style={styles.meta}>
            <MaterialIcons name="people" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.metaText}>до {room.capacity} человек</Text>
          </View>
        ) : null}
        {room.floor != null ? (
          <View style={styles.meta}>
            <MaterialIcons name="layers" size={16} color="rgba(255,255,255,0.8)" />
            <Text style={styles.metaText}>{room.floor} этаж</Text>
          </View>
        ) : null}
        <View style={styles.meta}>
          <MaterialIcons name="schedule" size={16} color="rgba(255,255,255,0.8)" />
          <Text style={styles.metaText}>
            {formatTime(hours.start)}–{formatTime(hours.end)}
          </Text>
        </View>
      </View>
      {room.equipment?.length ? (
        <View style={{ gap: 8 }}>
          <Text style={styles.caps}>Оснащение</Text>
          <EquipmentChips items={room.equipment} />
        </View>
      ) : null}
      {room.description ? (
        <View style={{ gap: 6 }}>
          <Text style={styles.caps}>Описание</Text>
          <Text style={styles.body}>{room.description}</Text>
        </View>
      ) : null}
    </View>
  );
}

function TimeField({ label, value, onChange, invalid }: { label: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={[styles.timeField, focused && styles.timeFieldFocused, invalid && styles.timeFieldInvalid]}>
      <Text style={styles.timeLabel}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={(text) => onChange(maskTimeInput(text))}
        keyboardType="number-pad"
        maxLength={5}
        placeholder="__:__"
        placeholderTextColor="rgba(255,255,255,0.35)"
        accessibilityLabel={`Время «${label}»`}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        style={styles.timeInput}
      />
    </View>
  );
}

/** Шаг 1: день, время, занятость, свободные окна. */
function TimeStep({ state }: { state: RoomBookingState }) {
  const { week, weekOffset, changeWeek, day, setDay, from, setFrom, to, setTo, check, busy, hours, suggestions } = state;
  const conflicts = !check.ok && check.reason === 'busy' ? check.conflicts : [];
  const invalidTo = !check.ok && check.reason !== 'incomplete' && to.length === 5;
  const invalidFrom = !check.ok && ['past', 'hours', 'step', 'format'].includes(check.reason) && from.length === 5;

  let status: ReactNode;
  if (state.availabilityLoading) {
    status = <Text style={styles.muted}>Проверяем занятость…</Text>;
  } else if (state.availabilityError) {
    status = (
      <Pressable onPress={state.retryAvailability}>
        <Text style={[styles.statusText, { color: ERROR }]}>{state.availabilityError} · Повторить</Text>
      </Pressable>
    );
  } else if (check.ok) {
    status = (
      <View style={styles.statusRow}>
        <MaterialIcons name="check" size={18} color={SUCCESS} />
        <Text style={[styles.statusText, { color: SUCCESS }]}>{formatDuration(check.duration)} · свободно</Text>
      </View>
    );
  } else if (check.reason === 'incomplete') {
    status = (
      <View style={styles.statusRow}>
        <MaterialIcons name="schedule" size={16} color="rgba(255,255,255,0.75)" />
        <Text style={styles.muted}>{check.message}</Text>
      </View>
    );
  } else {
    status = (
      <View style={styles.statusRow}>
        <MaterialIcons name="error-outline" size={18} color={ERROR} />
        <Text style={[styles.statusText, { color: ERROR }]}>{check.message}</Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 22 }}>
      <View>
        <View style={styles.sectionTitleRow}>
          <Text style={styles.sectionTitle}>Дата</Text>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <Pressable onPress={() => changeWeek(-1)} disabled={weekOffset === 0} style={[styles.weekBtn, weekOffset === 0 && { opacity: 0.3 }]} accessibilityLabel="Предыдущая неделя">
              <MaterialIcons name="chevron-left" size={20} color="#fff" />
            </Pressable>
            <Pressable onPress={() => changeWeek(1)} disabled={weekOffset >= 3} style={[styles.weekBtn, weekOffset >= 3 && { opacity: 0.3 }]} accessibilityLabel="Следующая неделя">
              <MaterialIcons name="chevron-right" size={20} color="#fff" />
            </Pressable>
          </View>
        </View>
        <View style={styles.weekRow}>
          {week.map((d) => {
            const selected = d.date === day;
            return (
              <Pressable
                key={d.date}
                disabled={d.disabled}
                onPress={() => setDay(d.date)}
                accessibilityRole="radio"
                accessibilityState={{ selected, disabled: d.disabled }}
                style={[styles.day, selected && styles.daySelected, d.disabled && { opacity: 0.35 }]}
              >
                <Text style={[styles.dayWeek, selected && styles.dayTextSelected]}>{d.weekday}</Text>
                <Text style={[styles.dayNum, selected && styles.dayTextSelected]}>{d.day}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Время</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <TimeField label="С" value={from} onChange={setFrom} invalid={invalidFrom} />
          <Text style={styles.dash}>—</Text>
          <TimeField label="До" value={to} onChange={setTo} invalid={invalidTo} />
        </View>
        <View style={{ marginTop: 10, minHeight: 22 }}>{status}</View>
        <Text style={[styles.small, { marginTop: 4 }]}>
          От 15 мин до 2 ч · офис работает {formatTime(hours.start)}–{formatTime(hours.end)}
        </Text>
      </View>

      {suggestions.length > 0 && (
        <View>
          <Text style={[styles.body, { marginBottom: 8 }]}>Свободно рядом:</Text>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {suggestions.map((slot) => (
              <Pressable key={`${slot.start}-${slot.end}`} onPress={() => state.pickSlot(slot)} style={styles.suggestion}>
                <Text style={styles.suggestionText}>
                  {formatTime(slot.start)}–{formatTime(slot.end)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      <View>
        <Text style={[styles.sectionTitle, { marginBottom: 8 }]}>Занято в этот день</Text>
        {busy.length === 0 ? (
          <Text style={styles.muted}>
            {state.availabilityLoading ? '…' : `Свободно весь день, ${formatTime(hours.start)}–${formatTime(hours.end)}`}
          </Text>
        ) : (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {busy.map((b) => {
              const clash = conflicts.some((c) => c.start === b.start && c.end === b.end);
              return (
                <View key={`${b.start}-${b.end}`} style={[styles.busy, clash && styles.busyClash]}>
                  <View style={styles.busyDot} />
                  <Text style={styles.busyText}>
                    {formatTime(b.start)}–{formatTime(b.end)}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

/** Шаг 2: сводка, компания (из профиля или своя — только для брони), пожелания. */
function DetailsStep({ state, room }: { state: RoomBookingState; room: MeetingRoom }) {
  const { day, from, to, check, profileCompany, companyOverride, setCompanyOverride, comment, setComment } = state;
  const photo = getRoomPhotoUris(room)[0];
  const editingCompany = companyOverride !== null;

  return (
    <View style={{ gap: 22 }}>
      <View style={styles.summary}>
        {photo ? <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" /> : <View style={[styles.thumb, styles.heroEmpty]} />}
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryTitle} numberOfLines={2}>
            {room.name}
          </Text>
          <Text style={styles.muted}>
            {day ? formatBookingDay(day) : ''} · {from}–{to}
          </Text>
          {check.ok ? <Text style={styles.small}>{formatDuration(check.duration)}</Text> : null}
        </View>
        <Pressable onPress={() => state.setStep('time')} hitSlop={8}>
          <Text style={styles.link}>Изменить</Text>
        </Pressable>
      </View>

      <View>
        <SectionTitle>Компания</SectionTitle>
        {!editingCompany && profileCompany ? (
          <View style={styles.companyCard}>
            <MaterialIcons name="business" size={22} color="rgba(255,255,255,0.85)" />
            <View style={{ flex: 1 }}>
              <Text style={styles.companyName}>{profileCompany}</Text>
              <Text style={styles.small}>Из вашего профиля</Text>
            </View>
            <Pressable onPress={() => setCompanyOverride(profileCompany)} hitSlop={8}>
              <Text style={styles.link}>Изменить</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={[styles.companyCard, state.companyMissing && { borderColor: WARNING }]}>
              <MaterialIcons name="business" size={22} color="rgba(255,255,255,0.85)" />
              <TextInput
                value={companyOverride ?? ''}
                onChangeText={(text) => setCompanyOverride(text.slice(0, 255))}
                placeholder="Название компании"
                placeholderTextColor="rgba(255,255,255,0.55)"
                accessibilityLabel="Название компании для этой брони"
                autoFocus={editingCompany && !!profileCompany}
                style={styles.companyInput}
              />
              {profileCompany ? (
                <Pressable onPress={() => setCompanyOverride(null)} hitSlop={8} accessibilityLabel="Вернуть компанию из профиля">
                  <MaterialIcons name="undo" size={20} color="rgba(255,255,255,0.8)" />
                </Pressable>
              ) : null}
            </View>
            {profileCompany ? (
              <Text style={[styles.small, { marginTop: 6 }]}>Только для этой брони — компания в профиле не изменится.</Text>
            ) : (
              <View style={[styles.statusRow, { marginTop: 6 }]}>
                <MaterialIcons name="error-outline" size={14} color={WARNING} />
                <Text style={[styles.small, { color: WARNING, flex: 1 }]}>
                  В профиле не указана компания — введите её для этой брони
                </Text>
              </View>
            )}
          </>
        )}
      </View>

      <View>
        <SectionTitle aside="необязательно">Комментарий</SectionTitle>
        <View style={styles.commentBox}>
          <TextInput
            value={comment}
            onChangeText={(text) => setComment(text.slice(0, BOOKING_COMMENT_MAX))}
            placeholder="Пожелания к встрече, например: вода, дополнительные стулья"
            placeholderTextColor="rgba(255,255,255,0.55)"
            multiline
            accessibilityLabel="Пожелания к брони"
            style={styles.commentInput}
          />
          <Text style={[styles.small, { textAlign: 'right' }]}>
            {comment.length} / {BOOKING_COMMENT_MAX}
          </Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
          {COMMENT_QUICK_ADDS.map((phrase) => (
            <Pressable key={phrase} onPress={() => setComment(appendToComment(comment, phrase))} style={styles.quick}>
              <MaterialIcons name="add" size={16} color="#fff" />
              <Text style={styles.quickText}>{phrase}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {state.submitError ? (
        <View style={styles.statusRow}>
          <MaterialIcons name="error-outline" size={18} color={ERROR} />
          <Text style={[styles.statusText, { color: ERROR, flex: 1 }]}>{state.submitError}</Text>
        </View>
      ) : null}
    </View>
  );
}

function BookingFlow({
  room,
  office,
  onBack,
  onBooked,
}: {
  room: MeetingRoom;
  office?: Office | null;
  onBack: () => void;
  onBooked: (booking: MeetingRoomBooking) => void;
}) {
  const state = useRoomBooking(room, office, { onBooked });
  const isTime = state.step === 'time';
  return (
    <>
      <Header
        title="Бронирование"
        subtitle={`Шаг ${isTime ? 1 : 2} из 2 · ${isTime ? 'время' : 'детали'}`}
        icon={isTime ? 'close' : 'chevron-left'}
        onPress={isTime ? onBack : () => state.setStep('time')}
      />
      <View style={styles.progress}>
        <View style={[styles.progressBar, styles.progressOn]} />
        <View style={[styles.progressBar, isTime ? styles.progressOff : styles.progressOn]} />
      </View>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {isTime ? <TimeStep state={state} /> : <DetailsStep state={state} room={room} />}
      </ScrollView>
      <View style={styles.footer}>
        {isTime ? (
          <PrimaryButton label="Далее" onPress={() => state.setStep('details')} disabled={!state.canContinue} />
        ) : (
          <PrimaryButton
            label={state.submitting ? 'Бронируем…' : 'Забронировать'}
            onPress={() => void state.submit()}
            disabled={!state.canSubmit}
            loading={state.submitting}
          />
        )}
      </View>
    </>
  );
}

/**
 * Бронь переговорной (по макету): карточка комнаты → шаг 1 «время» → шаг 2 «детали».
 * Полноэкранно на оранжевом градиенте; после брони — `onBooked`.
 */
export function RoomBookingScreen({
  room,
  office,
  onClose,
  onBooked,
}: {
  room: MeetingRoom;
  office?: Office | null;
  onClose: () => void;
  onBooked: (booking: MeetingRoomBooking) => void;
}) {
  const insets = useSafeAreaInsets();
  const [stage, setStage] = useState<'room' | 'flow'>('room');
  const subtitle = [office?.name ?? room.office?.name, room.floor != null ? `${room.floor} этаж` : null].filter(Boolean).join(' · ');

  return (
    <LinearGradient colors={ORANGE_GRADIENT} style={{ flex: 1 }}>
      <KeyboardAvoidingView
        style={{ flex: 1, paddingTop: insets.top + 8, paddingBottom: Math.max(insets.bottom, 12) }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {stage === 'room' ? (
          <>
            <Header title={room.name} subtitle={subtitle} icon="chevron-left" onPress={onClose} />
            <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scroll}>
              <RoomInfo room={room} office={office} />
            </ScrollView>
            <View style={styles.footer}>
              <PrimaryButton label="Выбрать время" onPress={() => setStage('flow')} />
            </View>
          </>
        ) : (
          <BookingFlow room={room} office={office} onBack={() => setStage('room')} onBooked={onBooked} />
        )}
      </KeyboardAvoidingView>
    </LinearGradient>
  );
}

const glass = { backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.28)' } as const;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingHorizontal: 20, paddingBottom: 14 },
  round: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' },
  title: { color: '#fff', fontSize: 22, fontWeight: '700' },
  subtitle: { color: 'rgba(255,255,255,0.8)', fontSize: 14, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 16 },
  progressBar: { flex: 1, height: 4, borderRadius: 2 },
  progressOn: { backgroundColor: '#fff' },
  progressOff: { backgroundColor: 'rgba(255,255,255,0.3)' },
  scroll: { paddingHorizontal: 20, paddingBottom: 24 },
  footer: { paddingHorizontal: 20, paddingTop: 8 },
  primary: { height: 52, borderRadius: 16, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  primaryDisabled: { backgroundColor: 'rgba(255,255,255,0.25)' },
  primaryText: { color: ACCENT, fontSize: 17, fontWeight: '600' },
  primaryTextDisabled: { color: 'rgba(255,255,255,0.65)' },
  sectionTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: '#fff', fontSize: 17, fontWeight: '600' },
  muted: { color: 'rgba(255,255,255,0.78)', fontSize: 14 },
  small: { color: 'rgba(255,255,255,0.72)', fontSize: 12 },
  caps: { color: 'rgba(255,255,255,0.75)', fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase' },
  body: { color: '#fff', fontSize: 15, lineHeight: 21 },
  hero: { width: '100%', aspectRatio: 16 / 10, borderRadius: 18 },
  heroEmpty: { backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  metaText: { color: '#fff', fontSize: 14 },
  weekRow: { flexDirection: 'row', gap: 6 },
  weekBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.2)', alignItems: 'center', justifyContent: 'center' },
  day: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.15)' },
  daySelected: { backgroundColor: '#fff' },
  dayWeek: { color: 'rgba(255,255,255,0.85)', fontSize: 11 },
  dayNum: { color: '#fff', fontSize: 18, fontWeight: '600', marginTop: 2 },
  dayTextSelected: { color: ACCENT },
  timeField: { flex: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10, ...glass },
  timeFieldFocused: { borderColor: '#fff' },
  timeFieldInvalid: { borderColor: '#FF8A8A' },
  timeLabel: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
  timeInput: { color: '#fff', fontSize: 28, fontWeight: '600', padding: 0, marginTop: 2 },
  dash: { color: 'rgba(255,255,255,0.8)', fontSize: 22 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 15, fontWeight: '600' },
  suggestion: { flex: 1, height: 44, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  suggestionText: { color: ACCENT, fontSize: 16, fontWeight: '600' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.3)', borderWidth: 1, borderColor: 'transparent' },
  busyClash: { borderColor: '#FF8A8A' },
  busyDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#FF6B6B' },
  busyText: { color: '#fff', fontSize: 15 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 18, padding: 12, ...glass },
  thumb: { width: 56, height: 56, borderRadius: 12 },
  summaryTitle: { color: '#fff', fontSize: 16, fontWeight: '600' },
  link: { color: '#fff', fontSize: 14, fontWeight: '600' },
  companyCard: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 14, ...glass },
  companyName: { color: '#fff', fontSize: 16, fontWeight: '600' },
  companyInput: { flex: 1, color: '#fff', fontSize: 16, padding: 0 },
  commentBox: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, ...glass },
  commentInput: { color: '#fff', fontSize: 15, minHeight: 64, textAlignVertical: 'top', padding: 0 },
  quick: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,0.65)' },
  quickText: { color: '#fff', fontSize: 14 },
});
