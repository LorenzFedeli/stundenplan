'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { registerTimetableTools } from '@/lib/browser-tools';
import { CalendarDays, Download, Check, ChevronDown, X, List, Grid2X2, Minus, Info } from 'lucide-react';
import { courses } from '@/lib/courses';
import type { Course, Profile, Program, CalendarOptions } from '@/lib/types';
import { buildCalendar, matchesProfile, minutes, conflicts } from '@/lib/schedule';

const programs: { id: Program; label: string }[] = [{ id: 'ID', label: 'Industriedesign' }, { id: 'KD', label: 'Kommunikationsdesign' }, { id: 'FD', label: 'Fotodesign' }];
const days = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];
const categories = { essentials: 'Essentials', skills: 'Skills', projects: 'Projects', theory: 'Theorie', practice: 'Praxis' };
const initialProfile: Profile = { semester: 1, program: 'ID', xy: 'X', number: '2', letter: 'C' };
const initialOptions: CalendarOptions = { startDate: '2026-10-05', endDate: '2027-01-22', excludeHolidays: true };
const formatTime = (time: string) => time.replace(':', '.');

function Selection({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
 return <label className="select-field"><span>{label}</span><div className="select-wrap"><select value={value} onChange={e => onChange(e.target.value)}>{children}</select><ChevronDown size={17} aria-hidden="true" /></div></label>;
}
function CourseBlock({ course, compact, onOpen, style }: { course: Course; compact?: boolean; onOpen: (c: Course) => void; style?: React.CSSProperties }) {
 return <button className={`course-block ${course.category}${compact ? ' compact' : ''}`} style={style} onClick={() => onOpen(course)} aria-label={`${course.title}, ${days[course.day]}, ${course.start} bis ${course.end}, ${course.room}`}>
  <span className="course-top"><span>{formatTime(course.start)}–{formatTime(course.end)}</span><span>{course.code}</span></span>
  <strong>{course.title}</strong><span className="course-room">{course.room || 'Raum siehe Kursinfo'}</span>
  {!compact && <span className="course-lecturer">{course.lecturer}</span>}
 </button>;
}
function layoutDay(items: Course[]) {
 const sorted = [...items].sort((a,b) => minutes(a.start)-minutes(b.start) || minutes(b.end)-minutes(a.end));
 const result: { course: Course; lane: number; lanes: number }[]=[];
 let cluster: typeof result=[]; let end=-1; let laneEnds: number[]=[];
 function flush() { for (const item of cluster) item.lanes=laneEnds.length; result.push(...cluster); cluster=[]; laneEnds=[]; }
 for (const course of sorted) {
  if (minutes(course.start)>=end) { flush(); end=-1; }
  let lane=laneEnds.findIndex(t=>t<=minutes(course.start)); if(lane<0)lane=laneEnds.length;
  laneEnds[lane]=minutes(course.end); cluster.push({course,lane,lanes:1}); end=Math.max(end,minutes(course.end));
 }
 flush(); return result;
}

export default function Home() {
 const [profile,setProfile]=useState<Profile>(initialProfile);
 const [activeProfile,setActiveProfile]=useState<Profile>(initialProfile);
 const [generated,setGenerated]=useState(false);
 const [view,setView]=useState<'week'|'list'>('week');
 const [detail,setDetail]=useState<Course|null>(null);
 const [exportOpen,setExportOpen]=useState(false);
 const [options,setOptions]=useState<CalendarOptions>(initialOptions);
 const [message,setMessage]=useState('');
 const [exportError,setExportError]=useState('');
 const planRef=useRef<HTMLElement>(null);
 const exportRef=useRef<HTMLDialogElement>(null);
 const detailRef=useRef<HTMLDialogElement>(null);
 const available=useMemo(()=>courses.filter(c=>matchesProfile(c,activeProfile)),[activeProfile]);
 const chosen=available;
 const exportable=chosen.filter(c=>!c.unscheduled&&c.start&&c.end);
 const scheduled=chosen.filter(c=>!c.unscheduled&&c.day>=0&&c.start&&c.end);
 const unscheduled=chosen.filter(c=>c.unscheduled||(!c.dates?.length&&(c.day<0||!c.start||!c.end)));
 const overlap=useMemo(()=>conflicts(scheduled),[scheduled]);
 const activeDays=new Set(scheduled.map(c=>c.day)).size;
 const hours=scheduled.reduce((s,c)=>s+minutes(c.end)-minutes(c.start),0)/60;
 const groupText=`${activeProfile.xy} / ${activeProfile.number} / ${activeProfile.letter}`;
 const shownDays=scheduled.some(c=>c.day>4)?days.slice(0,Math.max(...scheduled.map(c=>c.day))+1):days.slice(0,5);
 const earliest=Math.min(9*60,...scheduled.map(c=>minutes(c.start)));
 const latest=Math.max(18*60,...scheduled.map(c=>minutes(c.end)));
 const startHour=Math.floor(earliest/60);const endHour=Math.ceil(latest/60);
 const height=(endHour-startHour)*76;
 const dirty=JSON.stringify(profile)!==JSON.stringify(activeProfile);
 const toolState=useRef({generated,profile:activeProfile,courses:chosen});
 toolState.current={generated,profile:activeProfile,courses:chosen};

 useEffect(()=>registerTimetableTools({
  read:()=>toolState.current,
  configure:next=>flushSync(()=>{setProfile(next);setActiveProfile(next);setGenerated(true);setOptions({...initialOptions});}),
 }),[]);

 useEffect(()=> { if(exportOpen)exportRef.current?.showModal(); else exportRef.current?.close(); },[exportOpen]);
 useEffect(()=> { if(detail)detailRef.current?.showModal(); else detailRef.current?.close(); },[detail]);
 useEffect(()=> { if(!message)return;const t=setTimeout(()=>setMessage(''),4500);return()=>clearTimeout(t); },[message]);

 function updateProfile(patch: Partial<Profile>) {
  setProfile(p=> {
   const next={...p,...patch};
   if(patch.xy) {
    if(next.xy==='X'&&Number(next.number)>3)next.number='2';
    if(next.xy==='Y'&&Number(next.number)<4)next.number='5';
    if(next.xy==='X'&&!['C','D'].includes(next.letter))next.letter='C';
    if(next.xy==='Y'&&!['A','B'].includes(next.letter))next.letter='A';
   }
   return next;
  });
 }
 function generate(e: React.FormEvent) {
  e.preventDefault();setActiveProfile({...profile});setGenerated(true);
  setOptions({...initialOptions});
  requestAnimationFrame(()=>planRef.current?.scrollIntoView({behavior:'smooth',block:'start'}));
 }
 function downloadCalendar() {
  try {
   if(!options.startDate||!options.endDate)throw new Error('Bitte Start- und Enddatum auswählen.');
   const ics=buildCalendar(chosen,{...options,name:`FK12 · ${activeProfile.program} · Semester ${activeProfile.semester}`});
   if(!ics.includes('BEGIN:VEVENT'))throw new Error('Im gewählten Zeitraum liegen keine exportierbaren Termine. Bitte passe den Zeitraum an.');
   const blob=new Blob([ics],{type:'text/calendar;charset=utf-8'});
   const url=URL.createObjectURL(blob);const link=document.createElement('a');link.href=url;
   link.download=`FK12_${activeProfile.program.replace('+','')}_Semester${activeProfile.semester}_WS26-27.ics`;
   document.body.appendChild(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);
   setExportOpen(false);setMessage('Kalenderdatei heruntergeladen.');setExportError('');
  } catch(e){setExportError(e instanceof Error?e.message:'Der Kalender konnte nicht erstellt werden.');}
 }

 return <>
 <header className="site-header"><span>Hochschule München · Fakultät 12</span><span>Wintersemester 2026/27</span></header>
 <main>
 <section className="intro"><div><h1>Stundenplan</h1><p className="intro-copy">1. Semester · BA Design</p></div></section>
 <form className="configurator" onSubmit={generate}>
  <div className="config-section program-section"><p className="step"><span>01</span> Studienrichtung</p><div className="program-options" role="group" aria-label="Studienrichtung auswählen">{programs.map(p=><button type="button" key={p.id} className={profile.program===p.id?'selected':''} aria-pressed={profile.program===p.id} onClick={()=>updateProfile({program:p.id})}><b>{p.id}</b><span>{p.label}</span>{profile.program===p.id&&<Check size={16}/>}</button>)}</div></div>
  <div className="config-section groups-section"><p className="step"><span>02</span> Gruppen</p><div className="group-fields"><Selection label="Teilgruppe" value={profile.xy} onChange={xy=>updateProfile({xy})}>{['X','Y'].map(v=><option key={v}>{v}</option>)}</Selection><Selection label="Zahlengruppe" value={profile.number} onChange={number=>updateProfile({number})}>{(profile.xy==='X'?['1','2','3']:['4','5','6']).map(v=><option key={v}>{v}</option>)}</Selection><Selection label="Buchstabengruppe" value={profile.letter} onChange={letter=>updateProfile({letter})}>{(profile.xy==='X'?['C','D']:['A','B']).map(v=><option key={v}>{v}</option>)}</Selection></div><p className="field-hint">X: 1–3 und C/D · Y: 4–6 und A/B</p><button type="submit" className="primary generate-button"><CalendarDays size={18}/>{generated?'Stundenplan aktualisieren':'Stundenplan erstellen'}</button></div>
 </form>
 <div className="source-line"><span><span className="source-dot"/>Planungsstand 18.09.2026 · Entwurf</span><a href="/seminarplan.pdf" target="_blank" rel="noreferrer">Originalplan ansehen</a></div>
 {!generated?<p className="initial-help">Studienrichtung und Gruppen auswählen, dann den Stundenplan erstellen.</p>:<section className="plan-section" ref={planRef}>
  <div className="plan-heading"><div><h2>Wochenplan</h2><div className="profile-summary"><span>{programs.find(p=>p.id===activeProfile.program)?.label}</span><span>{activeProfile.semester}. Semester</span><span>Gruppen {groupText}</span></div></div><button type="button" className="primary export-button" onClick={()=>{setExportError('');setExportOpen(true);}} disabled={!exportable.length}><Download size={18}/>Kalender exportieren</button></div>

  {dirty&&<div className="notice">Deine Auswahl wurde geändert. Klicke oben auf „Stundenplan aktualisieren“.</div>}

  <div className="plan-toolbar"><div className="stats"><span><b>{chosen.length}</b> Veranstaltungen</span><span><b>{activeDays}</b> Studientage</span><span><b>{hours.toLocaleString('de-DE',{maximumFractionDigits:1})}</b> Std. im Raster</span></div><div className="view-switch" role="group" aria-label="Ansicht"><button aria-pressed={view==='week'} className={view==='week'?'active':''} onClick={()=>setView('week')}><Grid2X2 size={16}/><span>Woche</span></button><button aria-pressed={view==='list'} className={view==='list'?'active':''} onClick={()=>setView('list')}><List size={17}/><span>Liste</span></button></div></div>
  {overlap.length>0&&<div className="notice overlap"><Info size={17}/>{overlap.length} zeitliche Überschneidung{overlap.length===1?'':'en'}. Prüfe deine Kursauswahl und die einzelnen Termine.</div>}
  {scheduled.length>0?<>
  <div className={`week-view ${view==='list'?'hidden':''}`}><div className="week-scroll"><div className="week-head" style={{gridTemplateColumns:`58px repeat(${shownDays.length},minmax(150px,1fr))`}}><div className="timezone">UHR</div>{shownDays.map((d,i)=><div className="day-head" key={d}><span>0{i+1}</span><strong>{d}</strong><small>{scheduled.filter(c=>c.day===i).length} {scheduled.filter(c=>c.day===i).length===1?'Kurs':'Kurse'}</small></div>)}</div><div className="week-body" style={{gridTemplateColumns:`58px repeat(${shownDays.length},minmax(150px,1fr))`}}><div className="time-axis" style={{height}}>{Array.from({length:endHour-startHour+1},(_,i)=><span style={{top:i*76}} key={i}>{String(startHour+i).padStart(2,'0')}:00</span>)}</div>{shownDays.map((d,index)=><div className="day-column" key={d} style={{height}}>{Array.from({length:endHour-startHour},(_,i)=><div className="hour-line" key={i} style={{top:i*76}}/>)}{layoutDay(scheduled.filter(c=>c.day===index)).map(({course:c,lane,lanes})=><CourseBlock key={c.id} course={c} compact={lanes>1} onOpen={setDetail} style={{top:(minutes(c.start)-startHour*60)/60*76,height:(minutes(c.end)-minutes(c.start))/60*76-4,left:`calc(${lane/lanes*100}% + 3px)`,width:`calc(${100/lanes}% - 6px)`}}/>)}{!scheduled.some(c=>c.day===index)&&<div className="free-day"><Minus size={20}/><span>Keine Kurse</span></div>}</div>)}</div></div></div>
  <div className={`list-view ${view==='week'?'desktop-hidden':''}`}>{shownDays.map((d,i)=><section className="list-day" key={d}><h3><span>0{i+1}</span>{d}</h3><div>{scheduled.filter(c=>c.day===i).sort((a,b)=>minutes(a.start)-minutes(b.start)).map(c=><button className={`list-course ${c.category}`} key={c.id} onClick={()=>setDetail(c)}><span className="list-time">{c.start}<br/><small>{c.end}</small></span><span className="list-course-main"><strong>{c.title}</strong><span>{c.lecturer}</span></span><span className="list-room">{c.room}</span><span className="list-code">{c.code}</span></button>)}{!scheduled.some(c=>c.day===i)&&<p className="list-free">Keine Kurse eingeplant.</p>}</div></section>)}</div>
  </>:<div className="empty-plan"><CalendarDays size={32}/><h3>Keine Kurse gefunden</h3><p>Bitte überprüfe die Studienrichtung und Gruppen.</p></div>}

  {unscheduled.length>0&&<div className="unscheduled"><h3>Weitere Veranstaltungen</h3><p>Diese Termine haben keine feste Wochenzeit und werden nicht exportiert.</p>{unscheduled.map(c=><div key={c.id}><b>{c.title}</b><span>{c.lecturer}</span><p>{c.note||'Termine werden im Kurs bekannt gegeben.'}</p></div>)}</div>}
  <div className="plan-bottom"><div className="legend">{Object.entries(categories).filter(([id])=>scheduled.some(c=>c.category===id)).map(([id,label])=><span key={id}><i className={id}/>{label}</span>)}</div><span>Auf einen Kurs klicken für Details</span></div>
  <div className="planning-note"><Info size={18}/><p>Zeiten und Räume laut Seminarplan vom 18.09.2026 (Entwurf). Änderungen bitte in Moodle prüfen. Beim Export werden die Weihnachtspause und die Zeitzone Europe/Berlin berücksichtigt.</p></div>
 </section>}
 </main>
 <footer><span>Inoffizielles Planungstool · 1. Semester</span><span><a href="https://mediapool.hm.edu/media/fk12/fk12_lokal/03_studierende/seminarplaene_1/AblaufplanFK12_WiSe_2026_27.pdf" target="_blank" rel="noreferrer">Semestertermine</a> <span className="footer-divider">/</span> WiSe 2026/27</span></footer>
 <dialog ref={exportRef} aria-labelledby="export-title" className="modal" onCancel={()=>setExportOpen(false)} onClick={e=>{if(e.target===e.currentTarget)setExportOpen(false);}}><div className="modal-inner"><button className="close-button" aria-label="Schließen" onClick={()=>setExportOpen(false)}><X/></button><h2 id="export-title">Kalenderexport</h2><p className="modal-intro">Exportiere deine ausgewählten Kurse als .ics-Datei für Apple Kalender, Google Kalender oder Outlook.</p><div className="date-fields"><label>Ab dem<input type="date" value={options.startDate} onChange={e=>setOptions(o=>({...o,startDate:e.target.value}))}/></label><label>Bis zum<input type="date" value={options.endDate} onChange={e=>setOptions(o=>({...o,endDate:e.target.value}))}/></label></div><label className="check-row"><input type="checkbox" checked={options.excludeHolidays} onChange={e=>setOptions(o=>({...o,excludeHolidays:e.target.checked}))}/><span>Vorlesungsfreie Tage auslassen<small>Weihnachtspause: 24.12.2026–06.01.2027</small></span></label><div className="export-summary"><CalendarDays size={20}/><span><strong>{exportable.length} Veranstaltungen</strong><small>Mit Räumen, Lehrenden und deutscher Zeitzone</small></span></div><p className="export-note">Voreingestellt: reguläre Lehrveranstaltungen ab 05.10.2026. Abweichende Kursstarts und festgelegte Einzeltermine werden berücksichtigt.</p>{exportError&&<p className="error" role="alert">{exportError}</p>}<button className="primary full-width" onClick={downloadCalendar}><Download size={18}/>.ics-Datei herunterladen</button></div></dialog>
 <dialog ref={detailRef} aria-labelledby="course-title" className="modal detail-modal" onCancel={()=>setDetail(null)} onClick={e=>{if(e.target===e.currentTarget)setDetail(null);}}>{detail&&<div className="modal-inner"><button className="close-button" aria-label="Schließen" onClick={()=>setDetail(null)}><X/></button><p className="eyebrow">{detail.code} / {categories[detail.category]}</p><h2 id="course-title">{detail.title}</h2><dl><div><dt>Wann</dt><dd>{days[detail.day]} · {detail.start}–{detail.end} Uhr</dd></div><div><dt>Wo</dt><dd>{detail.room||'Wird im Kurs bekannt gegeben'}</dd></div><div><dt>Mit wem</dt><dd>{detail.lecturer}</dd></div>{detail.groups&&<div><dt>Gruppen</dt><dd>{Object.values(detail.groups).flat().join(' / ')}</dd></div>}</dl>{detail.note&&<p className="detail-note">{detail.note}</p>}{detail.dates&&<p className="detail-note">Einzeltermine: {detail.dates.map(d=>d.split('-').reverse().join('.')).join(', ')}</p>}<p className="fine-print">Seminarplan · Stand 18.09.2026 · Entwurf</p></div>}</dialog>
 {message&&<div className="toast" role="status"><Check size={17}/>{message}</div>}
 </>;
}
