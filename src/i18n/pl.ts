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
  // [task-12] Weekly freight labels
  'upgrade.freight': 'FRACHT',
  'upgrade.selectHub': 'Wskaż hub na globusie',
  'upgrade.turboprop': 'Turbośmigłowiec',
  'upgrade.widebody': 'Szerokokadłubowiec',
  'upgrade.hub': 'Rozbudowa huba',
  'upgrade.slots': 'Sloty startowe',
  'upgrade.hubDetail': '+6 miejsc · przesiadka 15 min',
  'upgrade.slotsDetail': '+2 odloty na godzinę',
  'upgrade.aircraftDetail': '+1 samolot',
  'upgrade.pressure': 'Największy ruch',
} as const satisfies Record<keyof typeof en, string>;
