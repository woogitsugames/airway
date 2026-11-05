// [night-12az] R3e (D-246): App Check tokens for the leaderboard callables. The token comes from a native
// attestation provider (Play Integrity on Android, App Attest on iOS, the debug provider in DEV/debug builds) through
// a Capacitor plugin port; the REST client sends it as `X-Firebase-AppCheck` on callable requests only. Without a
// provider (web, tests, a build without the plugin) no header is sent and the server decides (APP_CHECK_ENFORCED).
// Never throws: a token that cannot be had is simply not sent.

export const APP_CHECK_HEADER = 'X-Firebase-AppCheck';
/** A cached token is reused until this long before its expiry. */
const REFRESH_MARGIN_MS = 5 * 60_000;
/** Without an expiry from the provider, a token is reused for this long (App Check's default TTL is 1 h). */
const DEFAULT_TTL_MS = 30 * 60_000;

/** Structural port of `@capacitor-firebase/app-check` (FirebaseAppCheck plugin): initialize + getToken. */
export interface AppCheckPort {
  initialize(options: { debugToken: boolean; isTokenAutoRefreshEnabled: boolean }): Promise<void>;
  getToken(options?: { forceRefresh?: boolean }): Promise<{ token: string; expireTimeMillis?: number }>;
}

/** Resolves to the current token, or null when there is none. */
export type AppCheckTokenSource = () => Promise<string | null>;

export interface AppCheckOptions {
  /** Debug provider (DEV and debug builds; its secret is registered in the Firebase console). */
  readonly debug: boolean;
  readonly now?: () => number;
  /** A provider that does not answer in time is skipped for this call (the request goes without the header). */
  readonly timeoutMs?: number;
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => { timer = setTimeout(() => reject(new Error('App Check timeout')), ms); }),
  ]).finally(() => { if (timer !== undefined) clearTimeout(timer); });
}

/** null without a port; otherwise a cached, never-throwing token source. */
export function appCheckTokenSource(port: AppCheckPort | null, options: AppCheckOptions): AppCheckTokenSource | null {
  if (!port) return null;
  const now = options.now ?? (() => Date.now());
  const timeoutMs = options.timeoutMs ?? 5000;
  let ready: Promise<void> | null = null;
  let cached: { token: string; expiresAt: number } | null = null;
  return async () => {
    if (cached && cached.expiresAt - REFRESH_MARGIN_MS > now()) return cached.token;
    try {
      // No background refresh: a token is fetched only when a callable needs one (Play Integrity quota, D-246).
      ready ??= port.initialize({ debugToken: options.debug, isTokenAutoRefreshEnabled: false });
      await withTimeout(ready, timeoutMs);
    } catch {
      ready = null; // initialise again on the next call
      return null;
    }
    try {
      const result = await withTimeout(port.getToken({ forceRefresh: false }), timeoutMs);
      if (typeof result?.token !== 'string' || !result.token) return null;
      const expiresAt = Number.isFinite(result.expireTimeMillis) ? result.expireTimeMillis! : now() + DEFAULT_TTL_MS;
      cached = { token: result.token, expiresAt };
      return result.token;
    } catch {
      return null;
    }
  };
}
