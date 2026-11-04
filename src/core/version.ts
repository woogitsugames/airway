// [night-12ap] R3j: the app version for the playtest record (logbook "Copy summary"). Vite replaces
// __AIRWAY_VERSION__ with package.json's version at build and dev time (vite.config.ts); headless tests read "dev".
declare const __AIRWAY_VERSION__: string | undefined;

export const APP_VERSION: string = typeof __AIRWAY_VERSION__ === 'string' ? __AIRWAY_VERSION__ : 'dev';
