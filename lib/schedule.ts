import type { CalendarOptions, Course, Profile } from './types';

export const DEFAULT_START = '2026-10-05';
export const DEFAULT_END = '2027-01-22';

export function minutes(time: string): number {
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return NaN;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

export function matchesProfile(course: Course, profile: Profile): boolean {
  return course.semesters.includes(profile.semester) && course.programs.includes(profile.program) &&
    (['xy', 'number', 'letter'] as const).every(key => {
      const allowed = course.groups?.[key];
      return !allowed?.length || allowed.includes(profile[key]);
    });
}

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
function nextDate(value: string): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
function holiday(value: string): boolean {
  return value >= '2026-12-24' && value <= '2027-01-06' ||
    ['2026-10-03', '2026-11-01', '2026-12-25', '2026-12-26', '2027-01-01', '2027-01-06'].includes(value);
}
function occurs(course: Course, start: string, end: string): string[] {
  if (course.unscheduled) return [];
  const allDay = !!course.dates && !course.start && !course.end;
  if (!allDay && (!Number.isFinite(minutes(course.start)) || minutes(course.end) <= minutes(course.start) || !Number.isFinite(minutes(course.end)))) return [];
  // Explicit dates are authoritative; course bounds apply only to weekly series.
  if (course.dates) return [...new Set(course.dates)].filter(d => validDate(d) && d >= start && d <= end).sort();
  const from = course.startDate && validDate(course.startDate) && course.startDate > start ? course.startDate : start;
  const to = course.endDate && validDate(course.endDate) && course.endDate < end ? course.endDate : end;
  if (from > to) return [];
  const result: string[] = [];
  for (let date = from; date <= to; date = nextDate(date)) {
    const day = (new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7;
    if (day === course.day) result.push(date);
  }
  return result;
}
function escapeText(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/\r\n|\r|\n/g, '\\n').replace(/;/g, '\\;').replace(/,/g, '\\,');
}
function fold(value: string): string {
  const encoder = new TextEncoder();
  let result = '', line = '', length = 0;
  for (const character of value) {
    const size = encoder.encode(character).length;
    if (length + size > 75) { result += `${line}\r\n`; line = ' '; length = 1; }
    line += character; length += size;
  }
  return result + line;
}
function stamp(date: string, time: string): string { return `${date.replace(/-/g, '')}T${time.replace(':', '')}00`; }
function uid(value: string): string {
  let hash = 2166136261;
  for (const character of value) { hash ^= character.codePointAt(0)!; hash = Math.imul(hash, 16777619); }
  return `${encodeURIComponent(value).slice(0, 120)}-${(hash >>> 0).toString(16)}@fk12-stundenplan`;
}
const timezone = [
  'BEGIN:VTIMEZONE', 'TZID:Europe/Berlin', 'X-LIC-LOCATION:Europe/Berlin',
  'BEGIN:DAYLIGHT', 'TZOFFSETFROM:+0100', 'TZOFFSETTO:+0200', 'TZNAME:CEST',
  'DTSTART:19700329T020000', 'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU', 'END:DAYLIGHT',
  'BEGIN:STANDARD', 'TZOFFSETFROM:+0200', 'TZOFFSETTO:+0100', 'TZNAME:CET',
  'DTSTART:19701025T030000', 'RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU', 'END:STANDARD', 'END:VTIMEZONE',
];

/** Weekdays: 0 = Monday, 6 = Sunday. Calendar dates are local Berlin dates. */
export function buildCalendar(courses: Course[], options: CalendarOptions): string {
  const start = options.startDate || DEFAULT_START, end = options.endDate || DEFAULT_END;
  if (!validDate(start) || !validDate(end) || start > end) throw new Error('Bitte einen gültigen Zeitraum auswählen.');
  if (new Date(`${end}T00:00:00Z`).getTime() - new Date(`${start}T00:00:00Z`).getTime() > 366 * 86400000) throw new Error('Der Exportzeitraum darf höchstens ein Jahr betragen.');
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FK12//Stundenplan//DE', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', `X-WR-CALNAME:${escapeText(options.name || 'FK12 Stundenplan')}`, 'X-WR-TIMEZONE:Europe/Berlin', ...timezone];
  const dtstamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  for (const course of [...new Map(courses.map(c => [c.id, c])).values()]) {
    const dates = occurs(course, start, end);
    const included = dates.filter(date => !options.excludeHolidays || !holiday(date));
    if (!included.length) continue;
    const instances = course.dates ? included : [included[0]];
    for (const date of instances) {
      const description = [course.code, course.lecturer && `Lehrende: ${course.lecturer}`, course.note, 'Quelle: Seminarplanung BA WS 2026/27 (Entwurf). Kursbeginn und Änderungen bitte prüfen.'].filter(Boolean).join('\n');
      const eventDates = !course.start && !course.end
        ? [`DTSTART;VALUE=DATE:${date.replace(/-/g, '')}`, `DTEND;VALUE=DATE:${nextDate(date).replace(/-/g, '')}`]
        : [`DTSTART;TZID=Europe/Berlin:${stamp(date, course.start)}`, `DTEND;TZID=Europe/Berlin:${stamp(date, course.end)}`];
      lines.push('BEGIN:VEVENT', `UID:${uid(`${course.id}-${start.slice(0, 4)}${course.dates ? `-${date}` : ''}`)}`, `DTSTAMP:${dtstamp}`, ...eventDates, `SUMMARY:${escapeText(course.title)}`, `LOCATION:${escapeText(course.room)}`, `DESCRIPTION:${escapeText(description)}`);
      if (!course.dates && dates.length > 1) {
        const last = dates[dates.length - 1];
        lines.push(`RRULE:FREQ=WEEKLY;UNTIL=${last.replace(/-/g, '')}T225959Z`);
        const excluded = dates.filter(d => d >= date && options.excludeHolidays && holiday(d));
        if (excluded.length) lines.push(`EXDATE;TZID=Europe/Berlin:${excluded.map(d => stamp(d, course.start)).join(',')}`);
      }
      lines.push('END:VEVENT');
    }
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function conflicts(courses: Course[]): [string, string][] {
  const result: [string, string][] = [];
  const dates = courses.map(c => new Set(occurs(c, DEFAULT_START, DEFAULT_END)));
  for (let i = 0; i < courses.length; i++) for (let j = i + 1; j < courses.length; j++) {
    const a = courses[i], b = courses[j];
    if (a.id !== b.id && minutes(a.start) < minutes(b.end) && minutes(b.start) < minutes(a.end) && [...dates[i]].some(date => dates[j].has(date))) result.push([a.id, b.id]);
  }
  return result;
}
