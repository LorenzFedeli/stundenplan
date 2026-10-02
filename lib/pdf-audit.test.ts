import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { courses } from './courses';
import { matchesProfile, buildCalendar } from './schedule';
import expected from './pdf-times.json';

test('all 35 first-semester PDF blocks retain their day and exact time boundaries', () => {
 assert.equal(courses.length, Object.keys(expected).length);
 for (const [id, times] of Object.entries(expected)) {
  const course = courses.find(c => c.id === id);
  assert.ok(course, id);
  assert.deepEqual([course.day, course.start, course.end], times, id);
 }
});
test('every group is selectable and retained independently', () => {
 const page = readFileSync(new URL('../app/page.tsx', import.meta.url), 'utf8');
 assert.ok(page.includes("['1','2','3','4','5','6'].map"));
 assert.ok(page.includes("['A','B','C','D'].map"));
 assert.ok(page.includes("['X','Y'].map"));
 assert.ok(!page.includes('if(patch.xy)'));
 for (const program of ['ID','KD','FD'] as const)
  for (const xy of ['X','Y']) for (const number of ['1','2','3','4','5','6']) for (const letter of ['A','B','C','D']) {
   const selected = courses.filter(c => matchesProfile(c,{semester:1,program,xy,number,letter}));
   assert.equal(selected.length,9,`${program}/${xy}/${number}/${letter}`);
   const calendar = buildCalendar(selected,{startDate:'2026-10-05',endDate:'2027-01-22',excludeHolidays:true});
   assert.equal((calendar.match(/BEGIN:VEVENT/g)||[]).length,9);
  }
});
