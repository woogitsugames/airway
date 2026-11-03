/**
 * [night-12c] D-92: saves, logbook, streak and settings travel to a new phone through the OS backup, the
 * leaderboard identity does not. The install marker lives where no backup reaches it (Android: a file in the app
 * files directory that the backup rules do not include; iOS: Library/NoCloud). A missing marker means a fresh
 * install or a restore onto another device: the restored identity keys are dropped before anything reads them,
 * and the next official daily signs in as a new anonymous player.
 */
import { Capacitor } from '@capacitor/core';

export const INSTALL_MARKER_PATH = 'aw-install-v1.json';

export interface InstallMarker {
  /** True when this installation has written its marker before. Throws when the marker cannot be read. */
  exists(): Promise<boolean>;
  /** Writes the marker; throws when it cannot be written. */
  write(): Promise<void>;
}

export interface RemovableStorage {
  removeItem(key: string): void;
}

export type InstallCheck = 'same-install' | 'new-install' | 'unknown';

/**
 * On a new installation, writes the marker first and only then forgets `keys`: a marker that cannot be written
 * would otherwise reset the identity on every launch. Never throws.
 */
export async function forgetIdentityOnNewInstall(marker: InstallMarker | null, storage: RemovableStorage | null,
  keys: readonly string[]): Promise<InstallCheck> {
  if (!marker) return 'unknown';
  try {
    if (await marker.exists()) return 'same-install';
    await marker.write();
  } catch {
    return 'unknown';
  }
  for (const key of keys) {
    try { storage?.removeItem(key); } catch { /* storage blocked: nothing was restored into it either */ }
  }
  return 'new-install';
}

/** The native marker (Capacitor Filesystem, `Directory.LibraryNoCloud`); null on the web and without the plugin. */
export async function createNativeInstallMarker(): Promise<InstallMarker | null> {
  try {
    if (!Capacitor.isNativePlatform() || !Capacitor.isPluginAvailable('Filesystem')) return null;
    const { Filesystem, Directory, Encoding } = await import('@capacitor/filesystem');
    const location = { path: INSTALL_MARKER_PATH, directory: Directory.LibraryNoCloud };
    return {
      exists: async () => {
        try { await Filesystem.stat(location); return true; } catch { /* missing: checked by the write below */ }
        return false;
      },
      write: async () => {
        await Filesystem.writeFile({ ...location, data: '{"v":1}', encoding: Encoding.UTF8 });
      },
    };
  } catch {
    return null;
  }
}
