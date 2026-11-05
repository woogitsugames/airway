// [night-11at] D-255: entry of the legal-text chunk (dist/assets/legal-*.js). Only `loadLegalText()` in ../index.ts
// imports it (dynamically), so Vite emits it as its own file inside dist/ (bundled with the app, no network) and the
// main chunk stays smaller.
import type { Language } from '../languages';
import { en } from './en';
import { pl } from './pl';

export type LegalKey = keyof typeof en;
export const LEGAL_CATALOGS: Record<Language, Record<LegalKey, string>> = { en, pl };
