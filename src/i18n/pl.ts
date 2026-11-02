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
} as const satisfies Record<keyof typeof en, string>;
