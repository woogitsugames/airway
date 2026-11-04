// [night-11ad] R7k, D-214: launch settings of the static site, in one place. Every store link stays empty until the
// store page exists: an empty link shows a disabled "coming soon" tag, never a guess. Filling one requires the
// official badge artwork for that store in assets/badges/ (Apple and Google brand rules; test:site enforces it).
export const LAUNCH = {
  /** Public origin, used for canonical, hreflang and og:image (crawlers need absolute URLs). */
  origin: 'https://airway.games',
  stores: {
    /** Google Play listing or pre-registration URL, https://play.google.com/store/apps/details?id=… */
    googlePlay: '',
    /** App Store listing or pre-order URL, https://apps.apple.com/… */
    appStore: '',
  },
};

/** Store hosts a link may point to; anything else is rejected by site.js and test:site. */
export const STORE_HOSTS = { googlePlay: 'play.google.com', appStore: 'apps.apple.com' };
/** Official badge files expected once a link is set (not committed while the links are empty). */
export const STORE_BADGES = { googlePlay: 'assets/badges/google-play.svg', appStore: 'assets/badges/app-store.svg' };

/** Real game screenshots (site/make-assets.mjs, from docs/store/shots/). "failure" waits for a store:shots run with
 *  the N11t game-over wording ("Sieć zamknięta"); the committed store PNGs still say "Siatka wstrzymana". */
export const SITE_SHOTS = { scenes: ['night', 'game', 'upgrade', 'menu'], languages: ['pl', 'en'], width: 540, height: 960 };

/** A configured store link, or null while it is empty or not on the store's own host. */
export function storeLink(store) {
  const value = LAUNCH.stores[store];
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === STORE_HOSTS[store] ? url.href : null;
  } catch {
    return null;
  }
}
