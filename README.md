# Stundenplan – 1. Semester BA Design

Next.js-App für KD (Kommunikationsdesign), ID (Industriedesign) und FD (Fotodesign) an der Hochschule München, Wintersemester 2026/27.

## Funktionen

- Studienrichtung sowie Teilgruppe X/Y, Zahlengruppe und Buchstabengruppe wählen.
- Gültige Gruppen: X mit 1–3 und C/D; Y mit 4–6 und A/B.
- Wochenraster auf dem Desktop und Tagesliste auf kleinen Bildschirmen.
- Kursdetails mit Lehrenden, Raum und Zeit.
- Kalenderexport als `.ics` mit einstellbarem Zeitraum, Europe/Berlin-Zeitzone und optionalen Ferienausnahmen.

## Lokal starten

```sh
npm ci
npm run dev
```

Die App läuft auf `http://localhost:3000`.

## Prüfen und bauen

```sh
npm run typecheck
npm test
npm run build
```

Die statische Website wird nach `out/` exportiert und kann auf jedem statischen Webserver bereitgestellt werden. Auswahl und Kalendererzeugung laufen im Browser; es gibt keine Konten oder Datenbank.

## Datenquellen

- `public/seminarplan.pdf`: Seminarplan BA Design WiSe 2026/27, Entwurf vom 18.09.2026.
- [Offizieller FK12-Ablaufplan](https://mediapool.hm.edu/media/fk12/fk12_lokal/03_studierende/seminarplaene_1/AblaufplanFK12_WiSe_2026_27.pdf): Pflichtkurse ab 05.10.2026, Vorlesungsende 22.01.2027, Weihnachtspause 24.12.2026–06.01.2027.

`lib/courses.ts` enthält ausschließlich die Erstsemester-Pflichtkurse für KD, ID und FD. Informatik + Design und höhere Semester gehören nicht zum Geltungsbereich. Unbestätigte Vortragsfenster werden nicht als regelmäßige Pflichtkurse übernommen. Bei Gestaltungsgrundlagen Gruppe 1 gilt die im PDF ausgeschriebene Zeit 12:15–15:30; Gruppe 2 endet laut Raster um 16:15.

Änderungen des Entwurfs oder zusätzliche Veranstaltungen aus Moodle müssen im Kurskatalog aktualisiert werden.
