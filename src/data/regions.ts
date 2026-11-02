// First six region glyphs and CVD palette values exactly match the approved Diorama mockup.
// Asia/Oceania are provisional extensions pending the owner's final glyph approval.
export const REGION_IDS = ['NAM', 'SAM', 'EUN', 'EUS', 'AFR', 'ME', 'ASI', 'OCE'] as const;
export type RegionId = (typeof REGION_IDS)[number];
export type RegionGlyph = 'chevron' | 'bowtie' | 'crescent' | 'keyhole' | 'fin' | 'bracket' | 'wing' | 'hook';

export interface RegionDefinition {
  readonly glyph: RegionGlyph;
  readonly color: `#${string}`;
  readonly namePl: string;
  readonly nameEn: string;
  readonly provisional?: boolean;
}

// Paths use the same 12-by-12 centred coordinate system as mockups/lib/scene.mjs.
export const GLYPH_PATHS: Readonly<Record<RegionGlyph, string>> = {
  chevron: 'M-6 -5 L0 1 L6 -5 L6 0 L0 6 L-6 0Z',
  bowtie: 'M-6 -5.5 L0 0 L-6 5.5Z M6 -5.5 L0 0 L6 5.5Z',
  crescent: 'M2.5 -5.45 A6 6 0 1 0 2.5 5.45 A6.6 6.6 0 0 1 2.5 -5.45Z',
  keyhole: 'M0 -6.2 A3.4 3.4 0 1 1 0 0.6 A3.4 3.4 0 1 1 0 -6.2Z M-1.7 -1 L1.7 -1 L3.4 6 L-3.4 6Z',
  fin: 'M-6 6 L6 6 L6 2.5 L-1 -6 L-6 -6Z',
  bracket: 'M-6 -6 L-1.5 -6 L-1.5 1.5 L6 1.5 L6 6 L-6 6Z',
  // Provisional non-Metro silhouettes: a swept aircraft wing and a terminal jet-bridge hook.
  wing: 'M-6 4 L-2 -1 L6 -6 L4 -1 L6 2 L-2 1 L-6 6Z',
  hook: 'M-6 -6 L-2 -6 L-2 0 L4 0 L4 -3 L6 -3 L6 4 L-1 4 L-1 6 L-6 6Z',
};

export const REGIONS: Readonly<Record<RegionId, RegionDefinition>> = {
  NAM: { glyph: 'fin', color: '#0072B2', namePl: 'Ameryka Północna', nameEn: 'North America' },
  SAM: { glyph: 'bracket', color: '#56B4E9', namePl: 'Ameryka Południowa', nameEn: 'South America' },
  EUN: { glyph: 'chevron', color: '#009E73', namePl: 'Europa Północna', nameEn: 'Northern Europe' },
  EUS: { glyph: 'crescent', color: '#E69F00', namePl: 'Europa Południowa', nameEn: 'Southern Europe' },
  AFR: { glyph: 'keyhole', color: '#13302E', namePl: 'Afryka', nameEn: 'Africa' },
  ME: { glyph: 'bowtie', color: '#CC79A7', namePl: 'Bliski Wschód', nameEn: 'Middle East' },
  ASI: { glyph: 'wing', color: '#7B27D1', namePl: 'Azja', nameEn: 'Asia', provisional: true },
  OCE: { glyph: 'hook', color: '#DEEE83', namePl: 'Oceania', nameEn: 'Oceania', provisional: true },
} as const;
