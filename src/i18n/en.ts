// English is the fallback catalog for all player-visible copy.
export const en = {
  'app.title': 'Airway',
  'canvas.label': 'Airway game world',
  'status.loading': 'Loading',
  'status.ready': 'Ready',
  'language.english': 'English',
  'language.polish': 'Polish',
  'action.resume': 'Resume',
  'action.pause': 'Pause',
  'notice.week': 'Week {week}',
  // [task-06] Airport overlays and developer fixture.
  'airport.focus': 'Rotate to {code}',
  'airport.waiting': '{code}: {count} passengers waiting',
  'airport.jammed': '{code}: congestion, {seconds} seconds remaining',
  'airport.demo.zoom': 'Zoom',
  'airport.demo.pool': 'Overlay nodes: {count}',
  // [task-07] Route drawing, airport-paper ATC hint and route actions.
  'route.aircraft.turboprop': 'turboprop',
  'route.aircraft.widebody': 'widebody aircraft',
  'route.atc.distance': '{distance} km · {from} → {to}',
  'route.atc.overRange': 'Too far for {aircraft}',
  'route.atc.stopover': 'Choose a city along the way',
  'route.menu.label': 'Route actions',
  'route.menu.remove': 'Remove',
  'route.menu.shorten': 'Shorten',
  'route.menu.cancel': 'Cancel',
  'route.undo': 'Undo last route change',
} as const;
