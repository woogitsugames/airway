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
  // [task-20] Accessibility settings, controls and city announcements.
  'a11y.settingsTitle': 'Dostępność',
  'a11y.textScale': 'Rozmiar tekstu',
  'a11y.enhancedGlyphs': 'Większe symbole celów z grubszym konturem',
  'a11y.haptics': 'Wibracje dotykowe',
  'a11y.cityDescription': '{city}. Liczba oczekujących: {waiting}. {state}.',
  'a11y.cityAirport': 'Lotnisko',
  'a11y.cityNormal': 'Hub działa prawidłowo',
  'a11y.cityBusy': 'Hub bliski zapełnienia',
  'a11y.cityJammed': 'Zator w hubie',
  'a11y.action.undo': 'Cofnij ostatnią trasę',
  'a11y.action.turboprop': 'Wybierz samolot turbośmigłowy',
  'a11y.action.widebody': 'Wybierz samolot szerokokadłubowy',
  'a11y.action.hub': 'Rozbuduj hub',
  'a11y.action.speed': 'Zmień prędkość gry',
  'a11y.action.menu': 'Otwórz menu główne',
  'a11y.action.settings': 'Otwórz ustawienia',
  'a11y.action.back': 'Wróć',
} as const satisfies Record<keyof typeof en, string>;
