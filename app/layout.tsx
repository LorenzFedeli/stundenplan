import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
 title: 'Stundenplan · 1. Semester BA Design',
 description: 'Dein persönlicher Stundenplan für Design an der Hochschule München. KD, ID oder FD und Gruppen auswählen, Kalender exportieren.',
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
 return <html lang="de"><body>{children}</body></html>;
}
