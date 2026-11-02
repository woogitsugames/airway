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
  // [task-16] Save/load issues are translated by the composition root.
  'save.error.corrupt': 'The saved game is damaged. A new game has been started.',
  'save.error.unsupported': 'The save is from a newer game version. A new game has been started.',
  'save.error.storage-unavailable': 'The saved game could not be read. A new game has been started.',
} as const;
