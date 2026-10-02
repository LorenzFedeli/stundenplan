import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: 'FK12 — Mein Stundenplan',
 description: 'Dein persönlicher Stundenplan für Design an der Hochschule München. Semester, Studienrichtung und Gruppen auswählen, Kalender exportieren.',
 icons: { icon: '/favicon.svg' },
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="de"><body>{children}</body></html>;
}
