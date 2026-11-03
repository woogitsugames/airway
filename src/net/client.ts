// [night-06] Dependency-free Firebase client over REST: anonymous Auth (Identity Toolkit) and callable
// Cloud Functions ({data} → {result}). No Firebase SDK in the bundle; works against the local emulators.
import { authUrl, functionUrl, type NetConfig } from './config.ts';

export type Fetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) =>
  Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

export interface Session { readonly uid: string; readonly idToken: string; readonly refreshToken: string; readonly expiresAt: number }

export interface TokenStore {
  load(): Session | null;
  save(session: Session): void;
}

export class NetError extends Error {
  constructor(readonly code: 'offline' | 'auth' | 'rejected' | 'server', message: string, readonly reason?: string) {
    super(message);
  }
}

export class FirebaseRestClient {
  private session: Session | null;

  constructor(private readonly config: NetConfig, private readonly fetcher: Fetch, private readonly tokens: TokenStore,
    private readonly now: () => number = () => Date.now()) {
    this.session = tokens.load();
  }

  get uid(): string | null { return this.session?.uid ?? null; }

  private async post(url: string, body: unknown, headers: Record<string, string> = {}): Promise<unknown> {
    let response;
    try {
      response = await this.fetcher(url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
    } catch (error) {
      throw new NetError('offline', error instanceof Error ? error.message : 'network error');
    }
    const json = await response.json().catch(() => null);
    if (!response.ok) {
      const message = (json as { error?: { message?: string; status?: string } } | null)?.error;
      const code = response.status === 401 || response.status === 403 ? 'auth' : response.status >= 500 ? 'server' : 'rejected';
      throw new NetError(code, message?.message ?? `HTTP ${response.status}`, message?.status);
    }
    return json;
  }

  /** Anonymous account, created once and refreshed before expiry. */
  async signIn(): Promise<Session> {
    const current = this.session;
    if (current && current.expiresAt - 60_000 > this.now()) return current;
    let json: Record<string, unknown>;
    if (current) {
      json = await this.post(authUrl(this.config, 'token'), { grant_type: 'refresh_token', refresh_token: current.refreshToken }) as Record<string, unknown>;
      json = { localId: json.user_id, idToken: json.id_token, refreshToken: json.refresh_token, expiresIn: json.expires_in };
    } else {
      json = await this.post(authUrl(this.config, 'accounts:signUp'), { returnSecureToken: true }) as Record<string, unknown>;
    }
    if (typeof json.localId !== 'string' || typeof json.idToken !== 'string' || typeof json.refreshToken !== 'string') {
      throw new NetError('auth', 'unexpected auth response');
    }
    const session: Session = {
      uid: json.localId, idToken: json.idToken, refreshToken: json.refreshToken,
      expiresAt: this.now() + 1000 * (Number(json.expiresIn) || 3600),
    };
    this.session = session;
    this.tokens.save(session);
    return session;
  }

  /** Callable function: request {data}, response {result}; errors carry the HttpsError status. */
  async call<T>(name: string, data: unknown): Promise<T> {
    const session = await this.signIn();
    const json = await this.post(functionUrl(this.config, name), { data }, { Authorization: `Bearer ${session.idToken}` });
    if (!json || typeof json !== 'object' || !('result' in json)) throw new NetError('server', 'unexpected callable response');
    return (json as { result: T }).result;
  }
}
