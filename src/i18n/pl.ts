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
  // [task-16] Save/load issue messages.
  'save.error.corrupt': 'Zapis gry jest uszkodzony. Rozpoczęto nową grę.',
  'save.error.unsupported': 'Zapis pochodzi z nowszej wersji gry. Rozpoczęto nową grę.',
  'save.error.storage-unavailable': 'Nie udało się odczytać zapisu gry. Rozpoczęto nową grę.',
} as const satisfies Record<keyof typeof en, string>;
