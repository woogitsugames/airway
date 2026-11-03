/** Storage is deliberately outside src/sim. All persistent keys use the aw- namespace. */
import { Capacitor } from '@capacitor/core';
export const GAME_SAVE_KEY = 'aw-save-v1';
export const SETTINGS_KEY = 'aw-settings-v1';
const DB_NAME = 'aw-airway';
const OBJECT_STORE = 'entries';
const POINTER_KEY = 'aw-save-active';
const SAVE_PATHS = { a: 'aw-save-a.json', b: 'aw-save-b.json' } as const;

export interface KeyValueStorage {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

function assertKey(key: string): void {
  if (!/^aw-[a-z0-9-]+$/.test(key)) throw new Error('Storage key must use the aw- prefix');
}

/** IndexedDB is the browser's authoritative save/settings store; no localStorage fallback. */
export function createBrowserStorage(factory: IDBFactory | undefined = globalThis.indexedDB): KeyValueStorage {
  function openDatabase(): Promise<IDBDatabase> {
    if (!factory) return Promise.reject(new Error('IndexedDB is unavailable'));
    return new Promise((resolve, reject) => {
      const request = factory.open(DB_NAME, 1);
      let blocked = false;
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(OBJECT_STORE)) {
          request.result.createObjectStore(OBJECT_STORE);
        }
      };
      request.onsuccess = () => {
        if (blocked) request.result.close();
        else resolve(request.result);
      };
      request.onerror = () => reject(request.error ?? new Error('IndexedDB open failed'));
      request.onblocked = () => { blocked = true; reject(new Error('IndexedDB upgrade is blocked')); };
    });
  }

  async function run<T>(mode: IDBTransactionMode, key: string, operation: 'get' | 'put' | 'delete', value?: string): Promise<T> {
    assertKey(key);
    const db = await openDatabase();
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let result: unknown = null;
      const finish = (error?: Error) => {
        if (settled) return;
        settled = true;
        db.close();
        if (error) reject(error);
        else resolve(result as T);
      };
      try {
        const transaction = db.transaction(OBJECT_STORE, mode);
        const store = transaction.objectStore(OBJECT_STORE);
        const request = operation === 'get' ? store.get(key) :
          operation === 'put' ? store.put(value, key) : store.delete(key);
        request.onsuccess = () => { result = operation === 'get' ? (request.result ?? null) : undefined; };
        transaction.oncomplete = () => finish();
        transaction.onerror = () => finish(transaction.error ?? new Error('IndexedDB transaction failed'));
        transaction.onabort = () => finish(transaction.error ?? new Error('IndexedDB transaction aborted'));
      } catch (cause) {
        finish(cause instanceof Error ? cause : new Error(String(cause)));
      }
    });
  }

  return {
    get: (key) => run<string | null>('readonly', key, 'get'),
    set: (key, value) => run<void>('readwrite', key, 'put', value),
    remove: (key) => run<void>('readwrite', key, 'delete'),
  };
}

/** Structural plugin ports keep this module testable in Node without Capacitor. */
export interface PreferencesPort {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<unknown>;
  remove(options: { key: string }): Promise<unknown>;
}
export interface FilesystemPort {
  readFile(options: { path: string; directory: 'DATA'; encoding: 'utf8' }): Promise<{ data: string | Blob }>;
  writeFile(options: { path: string; data: string; directory: 'DATA'; encoding: 'utf8' }): Promise<unknown>;
  deleteFile(options: { path: string; directory: 'DATA' }): Promise<unknown>;
}

/**
 * Capacitor device storage: Preferences for small settings and the committed save slot,
 * Filesystem/Data for the potentially large JSON. Alternating slots keep the previous
 * save intact if an app is killed during the next write. The pointer is committed last.
 * Pass @capacitor/preferences.Preferences and @capacitor/filesystem.Filesystem here.
 */
export function createNativeStorage(preferences: PreferencesPort, filesystem: FilesystemPort): KeyValueStorage {
  async function currentSlot(): Promise<'a' | 'b' | null> {
    const { value } = await preferences.get({ key: POINTER_KEY });
    if (value == null) return null;
    if (value !== 'a' && value !== 'b') throw new Error('Invalid save-slot pointer');
    return value;
  }
  return {
    async get(key) {
      assertKey(key);
      if (key !== GAME_SAVE_KEY) return (await preferences.get({ key })).value;
      const slot = await currentSlot();
      if (slot === null) return null;
      const result = await filesystem.readFile({ path: SAVE_PATHS[slot], directory: 'DATA', encoding: 'utf8' });
      if (typeof result.data !== 'string') throw new Error('Save file is not UTF-8 text');
      return result.data;
    },
    async set(key, value) {
      assertKey(key);
      if (key !== GAME_SAVE_KEY) {
        await preferences.set({ key, value });
        return;
      }
      const next = (await currentSlot()) === 'a' ? 'b' : 'a';
      await filesystem.writeFile({ path: SAVE_PATHS[next], data: value, directory: 'DATA', encoding: 'utf8' });
      await preferences.set({ key: POINTER_KEY, value: next });
    },
    async remove(key) {
      assertKey(key);
      if (key !== GAME_SAVE_KEY) {
        await preferences.remove({ key });
        return;
      }
      // Never leave a pointer to a deleted save, even if file cleanup fails.
      await preferences.remove({ key: POINTER_KEY });
      for (const path of Object.values(SAVE_PATHS)) {
        try { await filesystem.deleteFile({ path, directory: 'DATA' }); } catch { /* Optional stale slot. */ }
      }
    },
  };
}

/** The composition root selects native Capacitor plugins or IndexedDB. */
export function createPlatformStorage(options?: {
  native?: { preferences: PreferencesPort; filesystem: FilesystemPort };
  indexedDB?: IDBFactory;
}): KeyValueStorage {
  return options?.native
    ? createNativeStorage(options.native.preferences, options.native.filesystem)
    : createBrowserStorage(options?.indexedDB);
}

/**
 * Boot helper for the composition root: on Android/iOS loads @capacitor/preferences and
 * @capacitor/filesystem (WebView IndexedDB may be evicted by the OS); on the web uses IndexedDB.
 */
export async function createDefaultStorage(): Promise<KeyValueStorage> {
  try {
    if (Capacitor.isNativePlatform() && Capacitor.isPluginAvailable('Preferences') &&
      Capacitor.isPluginAvailable('Filesystem')) {
      const [{ Preferences }, { Filesystem, Directory, Encoding }] = await Promise.all([
        import('@capacitor/preferences'), import('@capacitor/filesystem'),
      ]);
      const filesystem: FilesystemPort = {
        readFile: (o) => Filesystem.readFile({ path: o.path, directory: Directory.Data, encoding: Encoding.UTF8 }),
        writeFile: (o) => Filesystem.writeFile({ path: o.path, data: o.data, directory: Directory.Data,
          encoding: Encoding.UTF8 }),
        deleteFile: (o) => Filesystem.deleteFile({ path: o.path, directory: Directory.Data }),
      };
      return createNativeStorage(Preferences, filesystem);
    }
  } catch {
    // Plugins missing from this shell: fall back to the browser store below.
  }
  return createBrowserStorage();
}

/** Settings have an independent key, lifecycle and update frequency from game saves. */
export async function readSettings<T extends Record<string, unknown>>(storage: KeyValueStorage): Promise<T | null> {
  try {
    const raw = await storage.get(SETTINGS_KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as T : null;
  } catch {
    return null;
  }
}

export async function writeSettings(storage: KeyValueStorage, settings: Readonly<Record<string, unknown>>): Promise<void> {
  if (settings === null || Array.isArray(settings) || typeof settings !== 'object') {
    throw new Error('Settings must be an object');
  }
  await storage.set(SETTINGS_KEY, JSON.stringify(settings));
}
