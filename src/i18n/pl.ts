// Polish uses exactly the same translation keys and parameter names as English.
import type { en } from './en';

export const pl = {
  'app.title': 'Airway',
  'canvas.label': 'Świat gry Airway',
  'status.loading': 'Wczytywanie',
  'status.ready': 'Gotowe',
  'language.english': 'Angielski',
  'language.polish': 'Polski',
  'action.resume': 'Wznów',
  'action.pause': 'Pauza',
  'notice.week': 'Tydzień {week}',
  // [task-06] Airport overlays and developer fixture.
  'airport.focus': 'Obróć do {code}',
  'airport.waiting': '{code}: {count} pasażerów czeka',
  'airport.jammed': '{code}: zator, pozostało {seconds} sekund',
  'airport.demo.zoom': 'Przybliżenie',
  'airport.demo.pool': 'Elementy nakładki: {count}',
  // [task-07] Rysowanie tras, pasek ATC i działania na trasach.
  'route.aircraft.turboprop': 'turbośmigłowca',
  'route.aircraft.widebody': 'samolotu szerokokadłubowego',
  'route.atc.distance': '{distance} km · {from} → {to}',
  'route.atc.overRange': 'Za daleko dla {aircraft}',
  'route.atc.stopover': 'Wskaż miasto po drodze',
  'route.menu.label': 'Działania na trasie',
  'route.menu.remove': 'Usuń',
  'route.menu.shorten': 'Skróć',
  'route.menu.cancel': 'Anuluj',
  'route.undo': 'Cofnij ostatnią zmianę trasy',
} as const satisfies Record<keyof typeof en, string>;
