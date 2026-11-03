// [night-06] D-66: leaderboards are disabled unless a Firebase web config is present at build time.
// Values come from Vite env (VITE_FIREBASE_*, see docs/FIREBASE.md); nothing secret lives in the client.

export interface NetConfig {
  readonly apiKey: string;
  readonly projectId: string;
  readonly region: string;
  /** "host:port" of the Functions emulator; Auth emulator at authEmulator. Empty in production. */
  readonly functionsEmulator: string;
  readonly authEmulator: string;
}

type Env = Readonly<Record<string, string | boolean | undefined>>;

/** Returns null (feature off) unless both the API key and the project id are set. */
export function readNetConfig(env: Env): NetConfig | null {
  const text = (key: string): string => (typeof env[key] === 'string' ? (env[key] as string).trim() : '');
  const apiKey = text('VITE_FIREBASE_API_KEY');
  const projectId = text('VITE_FIREBASE_PROJECT_ID');
  if (!apiKey || !projectId) return null;
  return {
    apiKey, projectId,
    region: text('VITE_FIREBASE_REGION') || 'europe-west1',
    functionsEmulator: text('VITE_FIREBASE_FUNCTIONS_EMULATOR'),
    authEmulator: text('VITE_FIREBASE_AUTH_EMULATOR'),
  };
}

export function functionUrl(config: NetConfig, name: string): string {
  return config.functionsEmulator
    ? `http://${config.functionsEmulator}/${config.projectId}/${config.region}/${name}`
    : `https://${config.region}-${config.projectId}.cloudfunctions.net/${name}`;
}

export function authUrl(config: NetConfig, path: 'accounts:signUp' | 'token'): string {
  const host = path === 'token' ? 'securetoken.googleapis.com/v1/token' : `identitytoolkit.googleapis.com/v1/${path}`;
  return config.authEmulator
    ? `http://${config.authEmulator}/${host}?key=${encodeURIComponent(config.apiKey)}`
    : `https://${host}?key=${encodeURIComponent(config.apiKey)}`;
}
