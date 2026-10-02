import type { Course, Profile, Program } from './types';

type Tool = {
  name: string;
  title: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean; untrustedContentHint: boolean };
  execute: (input: unknown) => unknown;
};
type Context = { registerTool: (tool: Tool, options: { signal: AbortSignal }) => void | Promise<void> };

// Progressive enhancement: ordinary browsers use the visible controls.
export function registerTimetableTools(actions: {
  configure: (profile: Profile) => void;
  read: () => { generated: boolean; profile: Profile; courses: Course[] };
}) {
  const context = (document as Document & { modelContext?: Context }).modelContext;
  if (!context?.registerTool) return;
  const lifecycle = new AbortController();
  const tools: Tool[] = [
    {
      name: 'read_timetable',
      title: 'Stundenplan lesen',
      description: 'Liest den aktuell sichtbaren Erstsemester-Stundenplan und die gewählten Gruppen.',
      inputSchema: { type: 'object', properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).length) throw new Error('Keine Parameter erforderlich.');
        const state = actions.read();
        return { ...state, courses: state.generated ? state.courses : [] };
      },
    },
    {
      name: 'configure_timetable',
      title: 'Stundenplan erstellen',
      description: 'Wählt KD, ID oder FD im ersten Semester sowie gültige Gruppen und erstellt den sichtbaren Wochenplan.',
      inputSchema: {
        type: 'object',
        properties: {
          program: { type: 'string', enum: ['KD', 'ID', 'FD'] },
          xy: { type: 'string', enum: ['X', 'Y'] },
          number: { type: 'string', enum: ['1', '2', '3', '4', '5', '6'] },
          letter: { type: 'string', enum: ['A', 'B', 'C', 'D'] },
        },
        required: ['program', 'xy', 'number', 'letter'], additionalProperties: false,
      },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute(input) {
        if (!input || typeof input !== 'object') throw new Error('Ungültige Auswahl.');
        const p = input as Record<string, unknown>;
        if (Object.keys(p).some(k => !['program', 'xy', 'number', 'letter'].includes(k)) ||
          !['KD', 'ID', 'FD'].includes(String(p.program)) || !['X', 'Y'].includes(String(p.xy)) ||
          !(p.xy === 'X' ? ['1', '2', '3'] : ['4', '5', '6']).includes(String(p.number)) ||
          !(p.xy === 'X' ? ['C', 'D'] : ['A', 'B']).includes(String(p.letter))) {
          throw new Error('Gültige Gruppen: X mit 1–3 und C/D, Y mit 4–6 und A/B.');
        }
        actions.configure({ semester: 1, program: p.program as Program, xy: String(p.xy), number: String(p.number), letter: String(p.letter) });
        return actions.read();
      },
    },
  ];
  for (const tool of tools) {
    try { void Promise.resolve(context.registerTool(tool, { signal: lifecycle.signal })).catch(() => undefined); }
    catch { /* Unsupported registrations never interfere with the timetable. */ }
  }
  return () => lifecycle.abort();
}
