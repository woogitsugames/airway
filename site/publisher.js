// [night-11al] R7c, D-241: one publisher / service-provider details block (Polish e-services act art. 5, the
// Apple/Google trader card). The strings live in site/i18n.js as `publisher.*`; the game copies them word for word
// (test:publisher) and docs/store/README.md lists the same values for the store consoles. Until the owner answers
// Q-01, the identity fields hold visible "[Q-01 …]" placeholders: every release path (AIRWAY_RELEASE=1 test:site,
// build:site, android:release / android:aab) refuses to ship them.

/** Rows of the block, in display order. Each row has `publisher.<field>.label` and `publisher.<field>`. */
export const PUBLISHER_FIELDS = ['name', 'address', 'register', 'email', 'phone', 'trader'];
/** Every key of the block, shared by the site and the game. */
export const PUBLISHER_KEYS = ['publisher.title', ...PUBLISHER_FIELDS.flatMap(field => [`publisher.${field}.label`, `publisher.${field}`]),
  'publisher.note'];
/** A placeholder is any value that still names an open owner question in square brackets, e.g. "[Q-01: …]". */
export const PLACEHOLDER = /\[Q-\d+\b/;

/** Keys (as "lang:key") whose value is missing or still a placeholder. Empty means the block can ship. */
export function publisherGaps(translations) {
  const gaps = [];
  for (const language of Object.keys(translations)) {
    for (const key of PUBLISHER_KEYS) {
      const value = translations[language][key];
      if (typeof value !== 'string' || !value.trim() || PLACEHOLDER.test(value)) gaps.push(`${language}:${key}`);
    }
  }
  return gaps;
}

/** Throws in a release build while the block still has placeholders (used by build:site and the Android release). */
export function assertPublisherReady(translations, where) {
  const gaps = publisherGaps(translations);
  if (gaps.length) throw new Error(`${where}: publisher details still have placeholders (Q-01): ${gaps.join(', ')}`);
}
