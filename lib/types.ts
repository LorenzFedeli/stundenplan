export type Program = 'ID' | 'FD' | 'KD' | 'I+D';
export type Category = 'essentials' | 'skills' | 'projects' | 'theory' | 'practice';
export type Profile = { semester: number; program: Program; xy: string; number: string; letter: string };
export type Course = {
 id: string; code: string; title: string; lecturer: string; room: string;
 day: number; start: string; end: string; semesters: number[]; programs: Program[];
 category: Category; groups?: { xy?: string[]; number?: string[]; letter?: string[] };
 elective?: boolean; note?: string; dates?: string[]; startDate?: string; endDate?: string;
 unscheduled?: boolean;
};
export type CalendarOptions = { startDate: string; endDate: string; excludeHolidays: boolean; name?: string };
