import { formatDateForApi } from '@/lib/dateTimeUtils';

export type ParseTaskScheduleFromTextResult = {
  cleanedTitle: string;
  /** День срока из текста; null если только время — вызывающая сторона подставляет «сегодня». */
  dateKey: string | null;
  /** HH:mm из текста; null если в тексте не было времени. */
  time: string | null;
  matched: boolean;
  /** Фрагмент исходной строки, распознанный как срок (для подсветки в UI). */
  scheduleTail: string | null;
};

function addDaysFromKey(dateKey: string, days: number): string {
  const d = new Date(dateKey + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return formatDateForApi(d);
}

function dateKeyForWeekday(dateKey: string, targetJsWeekDay: number): string {
  const d = new Date(dateKey + 'T12:00:00');
  const cur = d.getDay();
  const add = (targetJsWeekDay - cur + 7) % 7;
  d.setDate(d.getDate() + add);
  return formatDateForApi(d);
}

/** Ближайшая суббота от дня (как «на выходных» в TaskAddSheet). */
function nextSaturdayKeyFrom(todayKey: string): string {
  const d = new Date(todayKey + 'T12:00:00');
  const wd = d.getDay();
  if (wd === 6) return formatDateForApi(d);
  d.setDate(d.getDate() + (6 - wd));
  return formatDateForApi(d);
}

function nextMondayAfterToday(todayKey: string): string {
  const d = new Date(todayKey + 'T12:00:00');
  d.setDate(d.getDate() + 1);
  while (d.getDay() !== 1) d.setDate(d.getDate() + 1);
  return formatDateForApi(d);
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Необязательные знаки после срока («завтра.», «15:30!») — иначе распознавание «зависает» до снятия пункта. */
const OPTIONAL_PUNCT_BEFORE_END = '(?:\\s*[.,;:!?\\u2026]+)?\\s*';

function normalizeTaskTitleInput(raw: string): string {
  let s = raw.replace(/\u00A0/g, ' ').replace(/\u202F/g, ' ').trimEnd();
  if (typeof s.normalize === 'function') {
    try {
      s = s.normalize('NFC');
    } catch {
      /* unpaired surrogates — без NFC, иначе на части движков всё падает */
    }
  }
  return s;
}

function isValidYmdKey(key: unknown): key is string {
  return typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key);
}

function normalizeTime(h: number, m: number): string | null {
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return `${pad2(h)}:${pad2(m)}`;
}

/** Месяцы: ru / en / kk (каз.), регистр не важен. */
const MONTH_NAME_TO_INDEX: { pattern: RegExp; monthIndex: number }[] = [
  // 0 — January / қаңтар / январь
  {
    pattern:
      /^(?:january|jan|қаңтар|қаңт|январ(?:я|ь))$/iu,
    monthIndex: 0,
  },
  {
    pattern: /^(?:february|feb|ақпан|феврал(?:я|ь))$/iu,
    monthIndex: 1,
  },
  {
    pattern: /^(?:march|mar|наурыз|марта?)$/iu,
    monthIndex: 2,
  },
  {
    pattern: /^(?:april|apr|сәуір|апрел(?:я|ь))$/iu,
    monthIndex: 3,
  },
  {
    pattern: /^(?:may|мамыр|мая?)$/iu,
    monthIndex: 4,
  },
  {
    pattern: /^(?:june|jun|маусым|июн(?:я|ь))$/iu,
    monthIndex: 5,
  },
  {
    pattern: /^(?:july|jul|шілде|июл(?:я|ь))$/iu,
    monthIndex: 6,
  },
  {
    pattern: /^(?:august|aug|тамыз|августа?)$/iu,
    monthIndex: 7,
  },
  {
    pattern: /^(?:september|sept?|sep|қыркүйек|сентябр(?:я|ь))$/iu,
    monthIndex: 8,
  },
  {
    pattern: /^(?:october|oct|қазан|октябр(?:я|ь))$/iu,
    monthIndex: 9,
  },
  {
    pattern: /^(?:november|nov|қараша|ноябр(?:я|ь))$/iu,
    monthIndex: 10,
  },
  {
    pattern: /^(?:december|dec|желтоқсан|декабр(?:я|ь))$/iu,
    monthIndex: 11,
  },
];

function monthIndexFromWord(raw: string): number | null {
  const word = raw.replace(/\.$/, '').trim();
  if (!word) return null;
  const hit = MONTH_NAME_TO_INDEX.find((x) => x.pattern.test(word));
  return hit ? hit.monthIndex : null;
}

/** Английское название месяца в начале (для «April 5»). */
const EN_MONTH_NAMES_INDEX: Record<string, number> = {
  january: 0,
  jan: 0,
  february: 1,
  feb: 1,
  march: 2,
  mar: 2,
  april: 3,
  apr: 3,
  may: 4,
  june: 5,
  jun: 5,
  july: 6,
  jul: 6,
  august: 7,
  aug: 7,
  september: 8,
  sep: 8,
  sept: 8,
  october: 9,
  oct: 9,
  november: 10,
  nov: 10,
  december: 11,
  dec: 11,
};

const WEEKDAY_SUFFIX_PAIRS: { pattern: string; jsDay: number }[] = [
  // RU
  { pattern: '(?:воскресень(?:е|я)|вс\\.?)', jsDay: 0 },
  { pattern: '(?:понедельник|пн\\.?)', jsDay: 1 },
  { pattern: '(?:вторник|вт\\.?)', jsDay: 2 },
  { pattern: '(?:сред[ау]|ср\\.?)', jsDay: 3 },
  { pattern: '(?:четверг|чт\\.?)', jsDay: 4 },
  { pattern: '(?:пятниц[ау]|пт\\.?)', jsDay: 5 },
  { pattern: '(?:суббот[ау]|сб\\.?)', jsDay: 6 },
  // EN
  { pattern: '(?:sunday|sun\\.?)', jsDay: 0 },
  { pattern: '(?:monday|mon\\.?)', jsDay: 1 },
  { pattern: '(?:tuesday|tue\\.?)', jsDay: 2 },
  { pattern: '(?:wednesday|wed\\.?)', jsDay: 3 },
  { pattern: '(?:thursday|thu\\.?|thur\\.?|thurs\\.?)', jsDay: 4 },
  { pattern: '(?:friday|fri\\.?)', jsDay: 5 },
  { pattern: '(?:saturday|sat\\.?)', jsDay: 6 },
  // KK
  { pattern: '(?:жексенбі|жек\\.?)', jsDay: 0 },
  { pattern: '(?:дүйсенбі|дүйс\\.?)', jsDay: 1 },
  { pattern: '(?:сейсенбі|сейс\\.?)', jsDay: 2 },
  { pattern: '(?:сәрсенбі|сәрс\\.?)', jsDay: 3 },
  { pattern: '(?:бейсенбі|бейс\\.?)', jsDay: 4 },
  { pattern: '(?:жұма|жм\\.?)', jsDay: 5 },
  { pattern: '(?:сенбі|сен\\.?)', jsDay: 6 },
];

/** Длинные относительные фразы — выше коротких (tomorrow / ертең). */
const RELATIVE_SUFFIX_RULES: { pattern: RegExp; resolve: (todayKey: string) => string }[] = [
  {
    pattern: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:послезавтра|после\\s+завтра|day\\s+after\\s+tomorrow|the\\s+day\\s+after\\s+tomorrow|арғы\\s+күні|арғы\\s+күн)${OPTIONAL_PUNCT_BEFORE_END}$`,
      'iu'
    ),
    resolve: (k) => addDaysFromKey(k, 2),
  },
  {
    pattern: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:следующая\\s+неделя|на\\s+следующей\\s+неделе|next\\s+week|келесі\\s+апта)${OPTIONAL_PUNCT_BEFORE_END}$`,
      'iu'
    ),
    resolve: (k) => nextMondayAfterToday(k),
  },
  {
    pattern: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:через\\s+неделю|через\\s+7\\s+дн|in\\s+a\\s+week|in\\s+one\\s+week|бір\\s+аптадан\\s+кейін|бир\\s+аптадан\\s+кейін|аптадан\\s+кейін)${OPTIONAL_PUNCT_BEFORE_END}$`,
      'iu'
    ),
    resolve: (k) => addDaysFromKey(k, 7),
  },
  {
    pattern: new RegExp(`(?:^|\\s)(?:,\\s*)?через\\s+день${OPTIONAL_PUNCT_BEFORE_END}$`, 'iu'),
    resolve: (k) => addDaysFromKey(k, 2),
  },
  {
    pattern: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:на\\s+выходных|on\\s+the\\s+weekend|this\\s+weekend|at\\s+the\\s+weekend|on\\s+weekend|демалыс\\s+күндері|демалыста)${OPTIONAL_PUNCT_BEFORE_END}$`,
      'iu'
    ),
    resolve: (k) => nextSaturdayKeyFrom(k),
  },
  {
    pattern: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:завтра|tomorrow|ертең|erten)${OPTIONAL_PUNCT_BEFORE_END}$`,
      'iu'
    ),
    resolve: (k) => addDaysFromKey(k, 1),
  },
  {
    pattern: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:сегодня|today|бүгін|бугин)${OPTIONAL_PUNCT_BEFORE_END}$`,
      'iu'
    ),
    resolve: (k) => k,
  },
];

const WORD_MONTH_LINE = new RegExp(
  `(?:^|\\s)(?:,\\s*)?(\\d{1,2})\\s+([a-zA-Zа-яёА-ЯЁәғқңөұүһіӘҒҚҢӨҰҮҺІ\\.]+)${OPTIONAL_PUNCT_BEFORE_END}$`,
  'iu'
);

/**
 * Снимает с конца строки время: «ЧЧ:ММ», «в/at ЧЧ[:.]ММ» (точка только после предлога).
 */
function peelTimeSuffix(input: string): { rest: string; time: string | null } {
  const end = `${OPTIONAL_PUNCT_BEFORE_END}$`;
  const withRuV = new RegExp(`(?:^|\\s)в\\s*(\\d{1,2})[:.](\\d{2})${end}`, 'iu');
  const withEnAt = new RegExp(`(?:^|\\s)at\\s*(\\d{1,2})[:.](\\d{2})${end}`, 'iu');
  /** Қазақша: «сағ 15:00», «сағат 9:00» */
  const withKk = new RegExp(
    `(?:^|\\s)(?:сағатта|сағат|сағ)\\s*(\\d{1,2})[:.](\\d{2})${end}`,
    'iu'
  );
  const colonForm = new RegExp(`(?:^|\\s)(\\d{1,2}):(\\d{2})${end}`);
  const m =
    input.match(withRuV) ?? input.match(withEnAt) ?? input.match(withKk) ?? input.match(colonForm);
  if (!m || m.index === undefined) return { rest: input, time: null };
  const h = parseInt(m[1], 10);
  const min = parseInt(m[2], 10);
  const t = normalizeTime(h, min);
  if (!t) return { rest: input, time: null };
  const rest = input.slice(0, m.index).trimEnd();
  return { rest, time: t };
}

/** Фиксированное время по «утро / вечер / morning…», если в тексте ещё нет ЧЧ:ММ. */
const DP_END = `${OPTIONAL_PUNCT_BEFORE_END}$`;
const DAYPART_SUFFIX_RULES: { re: RegExp; time: string }[] = [
  {
    re: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:in\\s+the\\s+morning|this\\s+morning|tomorrow\\s+morning)${DP_END}`,
      'iu'
    ),
    time: '09:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:in\\s+the\\s+afternoon)${DP_END}`, 'iu'),
    time: '15:00',
  },
  {
    re: new RegExp(
      `(?:^|\\s)(?:,\\s*)?(?:in\\s+the\\s+evening|this\\s+evening|tomorrow\\s+evening)${DP_END}`,
      'iu'
    ),
    time: '19:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:in\\s+the\\s+night|at\\s+night|tonight)${DP_END}`, 'iu'),
    time: '21:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:at\\s+noon|at\\s+midday)${DP_END}`, 'iu'),
    time: '12:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:midday|noon)${DP_END}`, 'iu'),
    time: '12:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:afternoon)${DP_END}`, 'iu'),
    time: '15:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:evening)${DP_END}`, 'iu'),
    time: '19:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:morning)${DP_END}`, 'iu'),
    time: '09:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:night)${DP_END}`, 'iu'),
    time: '21:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:в\\s+)?полночь${DP_END}`, 'iu'),
    time: '00:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?полуночи${DP_END}`, 'iu'),
    time: '00:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:в\\s+)?полдень${DP_END}`, 'iu'),
    time: '12:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?полдня${DP_END}`, 'iu'),
    time: '12:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:утром|утра|утро)${DP_END}`, 'iu'),
    time: '09:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:днём|днем)${DP_END}`, 'iu'),
    time: '15:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:вечером|вечера|вечер)${DP_END}`, 'iu'),
    time: '19:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:ночью|ночь)${DP_END}`, 'iu'),
    time: '21:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:таңертең|таңда|ертең\\s+таң)${DP_END}`, 'iu'),
    time: '09:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:түс\\s+кезінде|түс\\s+бойы)${DP_END}`, 'iu'),
    time: '15:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:кешке|кеште)${DP_END}`, 'iu'),
    time: '19:00',
  },
  {
    re: new RegExp(`(?:^|\\s)(?:,\\s*)?(?:түнде|түн)${DP_END}`, 'iu'),
    time: '21:00',
  },
];

/**
 * С конца строки: утро / вечер / noon / таңертең… (только если ещё нет явного времени).
 */
function peelDaypartSuffix(
  input: string,
  timeAlready: string | null
): { rest: string; time: string | null } {
  if (timeAlready != null) return { rest: input, time: null };
  for (const { re, time } of DAYPART_SUFFIX_RULES) {
    const m = input.match(re);
    if (m && m.index !== undefined) {
      return { rest: input.slice(0, m.index).trimEnd(), time };
    }
  }
  return { rest: input, time: null };
}

/**
 * После снятия времени — дата в конце (ru / en / kk и числовые форматы).
 */
function peelDateSuffix(rest: string, todayKey: string): { rest: string; dateKey: string | null } {
  const s = rest.trimEnd();
  if (!s) return { rest: s, dateKey: null };

  const tryRelative = (
    pattern: RegExp,
    resolve: () => string
  ): { rest: string; dateKey: string | null } | null => {
    const m = s.match(pattern);
    if (!m || m.index === undefined) return null;
    const before = s.slice(0, m.index).trimEnd();
    return { rest: before, dateKey: resolve() };
  };

  let r: { rest: string; dateKey: string | null } | null | undefined;

  for (const rule of RELATIVE_SUFFIX_RULES) {
    r = tryRelative(rule.pattern, () => rule.resolve(todayKey));
    if (r) break;
  }

  if (!r) {
    for (const { pattern, jsDay } of WEEKDAY_SUFFIX_PAIRS) {
      const reFull = new RegExp(
        `(?:^|\\s)(?:,\\s*)?(${pattern})${OPTIONAL_PUNCT_BEFORE_END}$`,
        'iu'
      );
      const m = s.match(reFull);
      if (m && m.index !== undefined) {
        const before = s.slice(0, m.index).trimEnd();
        r = { rest: before, dateKey: dateKeyForWeekday(todayKey, jsDay) };
        break;
      }
    }
  }

  if (!r) {
    const monthFirst = s.match(
      new RegExp(
        `(?:^|\\s)(?:,\\s*)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?${OPTIONAL_PUNCT_BEFORE_END}$`,
        'i'
      )
    );
    if (monthFirst && monthFirst.index !== undefined) {
      const monRaw = monthFirst[1].replace(/\.$/, '').toLowerCase();
      const day = parseInt(monthFirst[2], 10);
      const monthIdx = EN_MONTH_NAMES_INDEX[monRaw];
      const before = s.slice(0, monthFirst.index).trimEnd();
      if (monthIdx !== undefined && day >= 1 && day <= 31) {
        const now = new Date(todayKey + 'T12:00:00');
        let y = now.getFullYear();
        const cand = new Date(y, monthIdx, day);
        if (cand < new Date(todayKey + 'T00:00:00')) y += 1;
        r = { rest: before, dateKey: formatDateForApi(new Date(y, monthIdx, day)) };
      }
    }
  }

  if (!r) {
    const numFull = s.match(
      new RegExp(
        `(?:^|\\s)(?:,\\s*)?(\\d{1,2})[./-](\\d{1,2})[./-](\\d{4})${OPTIONAL_PUNCT_BEFORE_END}$`,
        'i'
      )
    );
    if (numFull && numFull.index !== undefined) {
      const day = parseInt(numFull[1], 10);
      const month = parseInt(numFull[2], 10);
      const year = parseInt(numFull[3], 10);
      const before = s.slice(0, numFull.index).trimEnd();
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        r = {
          rest: before,
          dateKey: formatDateForApi(new Date(year, month - 1, day)),
        };
      }
    }
  }

  if (!r) {
    const numShort = s.match(
      new RegExp(
        `(?:^|\\s)(?:,\\s*)?(\\d{1,2})[./-](\\d{1,2})${OPTIONAL_PUNCT_BEFORE_END}$`,
        'i'
      )
    );
    if (numShort && numShort.index !== undefined) {
      const day = parseInt(numShort[1], 10);
      const month = parseInt(numShort[2], 10);
      const before = s.slice(0, numShort.index).trimEnd();
      if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
        const now = new Date(todayKey + 'T12:00:00');
        let y = now.getFullYear();
        const cand = new Date(y, month - 1, day);
        if (cand < new Date(todayKey + 'T00:00:00')) y += 1;
        r = { rest: before, dateKey: formatDateForApi(new Date(y, month - 1, day)) };
      }
    }
  }

  if (!r) {
    const wordMonth = s.match(WORD_MONTH_LINE);
    if (wordMonth && wordMonth.index !== undefined) {
      const day = parseInt(wordMonth[1], 10);
      const word = wordMonth[2].replace(/\.$/, '');
      const monthIdx = monthIndexFromWord(word);
      if (monthIdx !== null && day >= 1 && day <= 31) {
        const before = s.slice(0, wordMonth.index).trimEnd();
        const now = new Date(todayKey + 'T12:00:00');
        let y = now.getFullYear();
        const cand = new Date(y, monthIdx, day);
        if (cand < new Date(todayKey + 'T00:00:00')) y += 1;
        r = { rest: before, dateKey: formatDateForApi(new Date(y, monthIdx, day)) };
      }
    }
  }

  if (!r) return { rest: s, dateKey: null };
  return r;
}

function extractScheduleTail(trimmed: string, cleanedTitle: string): string | null {
  const tFull = trimmed.trim();
  const cFull = cleanedTitle.trim();
  if (cFull.length === 0) return tFull.length > 0 ? tFull : null;
  if (!tFull.startsWith(cFull)) return null;
  const tail = tFull.slice(cFull.length).replace(/^[\s,;:—–-]+/, '').trim();
  return tail.length > 0 ? tail : null;
}

/**
 * Разбор срока из конца названия (ru, en, kk).
 * Примеры: «Молоко завтра», «Call tomorrow at 15:00», «Ертең жиналыс», «5 April», «April 5».
 */
export function parseTaskScheduleFromText(
  raw: string,
  opts: { todayKey: string; tomorrowKey?: string }
): ParseTaskScheduleFromTextResult {
  try {
    return parseTaskScheduleFromTextUnsafe(raw, opts);
  } catch {
    const fallback = normalizeTaskTitleInput(String(raw));
    return {
      cleanedTitle: fallback || '',
      dateKey: null,
      time: null,
      matched: false,
      scheduleTail: null,
    };
  }
}

function parseTaskScheduleFromTextUnsafe(
  raw: string,
  opts: { todayKey: string; tomorrowKey?: string }
): ParseTaskScheduleFromTextResult {
  const todayKey = isValidYmdKey(opts.todayKey) ? opts.todayKey : formatDateForApi(new Date());

  const trimmed = normalizeTaskTitleInput(raw);
  if (!trimmed) {
    return { cleanedTitle: '', dateKey: null, time: null, matched: false, scheduleTail: null };
  }

  const afterTime = peelTimeSuffix(trimmed);
  let time = afterTime.time;
  let work = afterTime.rest;

  const afterDaypart = peelDaypartSuffix(work, time);
  if (afterDaypart.time != null) {
    time = afterDaypart.time;
  }
  work = afterDaypart.rest;

  const afterDate = peelDateSuffix(work, todayKey);
  const dateKey = afterDate.dateKey;
  work = afterDate.rest;

  const cleanedTitle = work.replace(/[\s,]+$/g, '').replace(/^[\s,]+/g, '').trim();

  /** Пустой заголовок допускается, если вся строка — только срок («завтра», «в 15:30»). */
  const matched =
    (dateKey !== null || time !== null) &&
    (cleanedTitle.length === 0 || cleanedTitle !== trimmed);

  if (!matched) {
    return { cleanedTitle: trimmed, dateKey: null, time: null, matched: false, scheduleTail: null };
  }

  return {
    cleanedTitle,
    dateKey,
    time,
    matched: true,
    scheduleTail: extractScheduleTail(trimmed, cleanedTitle),
  };
}
