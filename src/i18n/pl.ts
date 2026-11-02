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
  // [task-18] Localized offline daily ticket.
  'daily.share.title': 'AIRWAY / WYZWANIE DNIA',
  'daily.share.official': 'PRÓBA OFICJALNA',
  'daily.share.practice': 'TRENING',
  'daily.share.date': 'DATA {date}',
  'daily.share.score': 'WYNIK {score}',
  'daily.share.weeks': 'TYGODNIE {weeks}',
  'daily.share.ticket': 'BILET {ticket}',
  'daily.share.dialog': 'Udostępnij bilet',
} as const satisfies Record<keyof typeof en, string>;
