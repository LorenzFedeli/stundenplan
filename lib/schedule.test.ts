import test from 'node:test';
import assert from 'node:assert/strict';
import { buildCalendar, matchesProfile, conflicts, minutes } from './schedule';
import type { Course, CalendarOptions } from './types';
const options: CalendarOptions = { startDate: '2026-10-01', endDate: '2027-01-22', excludeHolidays: true };
const course: Course = { id: 'a', code: '1.1', title: 'Entwerfen', lecturer: 'Muster', room: 'R 101', day: 0, start: '09:00', end: '12:00', semesters: [1], programs: ['ID'], category: 'skills' };
const unfold = (s: string) => s.replace(/\r\n /g, '');
test('groups and common courses filter accurately', () => {
  const profile = { semester: 1, program: 'ID' as const, xy: 'X', number: '2', letter: 'C' };
  assert.equal(matchesProfile(course, profile), true);
  assert.equal(matchesProfile({ ...course, groups: { xy: ['Y'] } }, profile), false);
  assert.equal(matchesProfile({ ...course, groups: { xy: ['X'], number: ['2'], letter: ['C'] } }, profile), true);
  assert.equal(matchesProfile({ ...course, groups: { letter: ['A', 'B'] } }, profile), false);
  assert.equal(matchesProfile({ ...course, semesters: [3] }, profile), false);
  assert.equal(matchesProfile({ ...course, programs: ['KD'] }, profile), false);
});
test('DST-aware local recurrence and Christmas exceptions', () => {
  const text = unfold(buildCalendar([course], options));
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20261005T090000/);
  assert.match(text, /TZOFFSETFROM:\+0200\r\nTZOFFSETTO:\+0100/);
  assert.match(text, /BYMONTH=10;BYDAY=-1SU/);
  assert.match(text, /RRULE:FREQ=WEEKLY;UNTIL=20270118T225959Z/);
  assert.match(text, /EXDATE;TZID=Europe\/Berlin:20261228T090000,20270104T090000/);
  assert.doesNotMatch(buildCalendar([course], { ...options, excludeHolidays: false }), /EXDATE/);
});
test('escapes text and folds UTF-8 lines at 75 octets', () => {
  const title = 'Öä🙂'.repeat(40) + ', A; B\\C\nD';
  const text = buildCalendar([{ ...course, title }], options);
  for (const line of text.split('\r\n')) assert.ok(Buffer.byteLength(line) <= 75, line);
  assert.ok(unfold(text).includes(`SUMMARY:${'Öä🙂'.repeat(40)}\\, A\\; B\\\\C\\nD`));
  assert.ok(text.endsWith('\r\n'));
});
test('explicit dates make separate bounded events without recurring rules', () => {
  const text = unfold(buildCalendar([{ ...course, dates: ['2026-10-07', '2026-10-07', '2026-12-25', '2027-02-02', 'bad'] }], options));
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20261007T090000/);
  assert.doesNotMatch(text, /RRULE:FREQ=WEEKLY/);
});
test('course date bounds and unscheduled courses respected', () => {
  const text = unfold(buildCalendar([{ ...course, startDate: '2026-11-01', endDate: '2026-11-20' }, { ...course, id: 'b', unscheduled: true }], options));
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 1);
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20261102T090000/);
  assert.match(text, /UNTIL=20261116T225959Z/);
});
test('empty selection is valid and invalid intervals are rejected', () => {
  assert.doesNotMatch(buildCalendar([], options), /BEGIN:VEVENT/);
  for (const bad of [{ startDate: '2027-02-31' }, { endDate: '2026-09-01' }, { startDate: 'nonsense' }]) assert.throws(() => buildCalendar([course], { ...options, ...bad }));
});
test('UID remains stable between exports', () => {
  assert.equal(buildCalendar([course], options).match(/UID:(.*)/)?.[1], buildCalendar([course], options).match(/UID:(.*)/)?.[1]);
});
test('overlaps need shared actual dates and non-touching times', () => {
  assert.deepEqual(conflicts([course, { ...course, id: 'b', start: '11:00' }]), [['a', 'b']]);
  assert.deepEqual(conflicts([course, { ...course, id: 'b', start: '12:00', end: '14:00' }]), []);
  assert.deepEqual(conflicts([{ ...course, dates: ['2026-10-05'] }, { ...course, id: 'b', dates: ['2026-10-12'] }]), []);
  assert.deepEqual(conflicts([course, { ...course, id: 'b', day: 2, dates: ['2026-10-05'] }]), [['a', 'b']]);
});
test('time parser rejects invalid times', () => {
  assert.equal(minutes('10:15'), 615);
  assert.ok(Number.isNaN(minutes('25:15')));
});
test('explicit dates override weekly course bounds but obey export bounds', () => {
  const text = unfold(buildCalendar([{ ...course, startDate: '2026-10-05', dates: ['2026-09-28', '2026-09-29', '2026-09-30'] }], { ...options, startDate: '2026-09-29' }));
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20260929T090000/);
  assert.match(text, /DTSTART;TZID=Europe\/Berlin:20260930T090000/);
  assert.doesNotMatch(text, /20260928/);
});
test('explicit untimed dates export all-day events with exclusive next-day end', () => {
  const text = unfold(buildCalendar([{ ...course, start: '', end: '', day: -1, dates: ['2026-10-31', '2026-11-02'] }], options));
  assert.equal((text.match(/BEGIN:VEVENT/g) || []).length, 2);
  assert.match(text, /DTSTART;VALUE=DATE:20261031\r\nDTEND;VALUE=DATE:20261101/);
  assert.match(text, /DTSTART;VALUE=DATE:20261102\r\nDTEND;VALUE=DATE:20261103/);
  assert.doesNotMatch(text, /DTSTART;TZID/);
});
